-- ==========================================
-- 1. Tabla de Clientes
-- ==========================================
CREATE TABLE IF NOT EXISTS clientes (
    client_code TEXT PRIMARY KEY,
    max_devices INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'demo' CHECK (status IN ('demo', 'activo')),
    is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NOTA IMPORTANTE:
-- client_code funciona como un secreto de facto (controla acceso y cupos).
-- Genera estos códigos con alta entropía, por ejemplo:
--   SELECT encode(gen_random_bytes(16), 'hex');  -- requiere pgcrypto
-- Evita códigos cortos, secuenciales o basados en el nombre del cliente.

-- ==========================================
-- 2. Tabla de Dispositivos / PCs
-- ==========================================
CREATE TABLE IF NOT EXISTS dispositivos (
    hardware_id TEXT PRIMARY KEY,
    client_code TEXT REFERENCES clientes(client_code) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    first_boot TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_connection TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispositivos_client_code ON dispositivos(client_code);

-- ==========================================
-- 3. Tabla de control de intentos (rate limiting)
-- ==========================================
-- Registra intentos de llamada al RPC por IP para frenar enumeración
-- de client_code y ataques de fuerza bruta / agotamiento de cupos.
CREATE TABLE IF NOT EXISTS rpc_attempts (
    id BIGSERIAL PRIMARY KEY,
    ip_addr INET NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpc_attempts_ip_time ON rpc_attempts(ip_addr, attempted_at);

-- Limpieza periódica recomendada (ej. via pg_cron o Edge Function programada):
--   DELETE FROM rpc_attempts WHERE attempted_at < NOW() - INTERVAL '1 day';

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================
-- RLS habilitado sin políticas = deny-all por defecto para anon/authenticated.
-- Todo el acceso pasa exclusivamente por la función SECURITY DEFINER de abajo.
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc_attempts ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- FUNCIÓN RPC (SECURITY DEFINER)
-- ==========================================
CREATE OR REPLACE FUNCTION registrar_o_validar_dispositivo(
    p_hardware_id TEXT,
    p_client_code TEXT,
    p_device_name TEXT
)
RETURNS TABLE (
    resultado TEXT,
    client_status TEXT,
    first_boot TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max_devices INTEGER;
    v_status TEXT;
    v_is_suspended BOOLEAN;
    v_is_blocked BOOLEAN;
    v_device_count INTEGER;
    v_device_exists BOOLEAN;
    v_first_boot TIMESTAMPTZ;
    v_client_ip INET;
    v_recent_attempts INTEGER;
    v_hardware_owned_elsewhere BOOLEAN;
BEGIN
    -- ==========================================
    -- 0. Rate limiting por IP
    -- ==========================================
    v_client_ip := inet_client_addr();

    IF v_client_ip IS NOT NULL THEN
        SELECT COUNT(*) INTO v_recent_attempts
        FROM rpc_attempts
        WHERE ip_addr = v_client_ip
          AND attempted_at > NOW() - INTERVAL '1 minute';

        -- Ajusta el umbral según tu volumen normal de tráfico
        IF v_recent_attempts >= 20 THEN
            RETURN QUERY SELECT 'rate_limited'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
            RETURN;
        END IF;

        INSERT INTO rpc_attempts (ip_addr) VALUES (v_client_ip);
    END IF;

    -- ==========================================
    -- 1. Verificar que el hardware_id no pertenezca a otro cliente
    -- ==========================================
    SELECT EXISTS (
        SELECT 1 FROM dispositivos
        WHERE hardware_id = p_hardware_id
          AND client_code != p_client_code
    ) INTO v_hardware_owned_elsewhere;

    IF v_hardware_owned_elsewhere THEN
        RETURN QUERY SELECT 'hardware_already_registered_elsewhere'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- ==========================================
    -- 2. Obtener info del cliente
    -- ==========================================
    SELECT max_devices, status, is_suspended
    INTO v_max_devices, v_status, v_is_suspended
    FROM clientes
    WHERE client_code = p_client_code;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'client_not_found'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    IF v_is_suspended THEN
        RETURN QUERY SELECT 'suspended'::TEXT, v_status, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- ==========================================
    -- 3. Verificar si el dispositivo ya existe
    -- ==========================================
    SELECT is_blocked, dispositivos.first_boot INTO v_is_blocked, v_first_boot
    FROM dispositivos
    WHERE hardware_id = p_hardware_id AND client_code = p_client_code;

    v_device_exists := FOUND;

    IF v_device_exists THEN
        IF v_is_blocked THEN
            RETURN QUERY SELECT 'blocked'::TEXT, v_status, v_first_boot;
            RETURN;
        END IF;

        UPDATE dispositivos
        SET last_connection = NOW(),
            device_name = p_device_name
        WHERE hardware_id = p_hardware_id AND client_code = p_client_code;

        RETURN QUERY SELECT 'authorized'::TEXT, v_status, v_first_boot;
        RETURN;
    ELSE
        -- ==========================================
        -- 4. Dispositivo nuevo: verificar cupos disponibles
        -- ==========================================
        SELECT COUNT(*)::INTEGER INTO v_device_count
        FROM dispositivos
        WHERE client_code = p_client_code AND is_blocked = FALSE;

        IF v_device_count >= v_max_devices THEN
            RETURN QUERY SELECT 'limit_exceeded'::TEXT, v_status, NULL::TIMESTAMPTZ;
            RETURN;
        END IF;

        v_first_boot := NOW();
        INSERT INTO dispositivos (hardware_id, client_code, device_name, is_blocked, first_boot, last_connection)
        VALUES (p_hardware_id, p_client_code, p_device_name, FALSE, v_first_boot, NOW());

        RETURN QUERY SELECT 'authorized'::TEXT, v_status, v_first_boot;
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION registrar_o_validar_dispositivo(TEXT, TEXT, TEXT) TO anon;

-- rpc_attempts no necesita permisos para anon: la función accede a ella
-- internamente como SECURITY DEFINER, sin exponer la tabla directamente.