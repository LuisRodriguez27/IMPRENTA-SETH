-- 1. Table of Customers / Clients
CREATE TABLE IF NOT EXISTS clientes (
    client_code TEXT PRIMARY KEY,
    max_devices INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'demo' CHECK (status IN ('demo', 'activo')),
    is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table of Devices / PCs
CREATE TABLE IF NOT EXISTS dispositivos (
    hardware_id TEXT PRIMARY KEY,
    client_code TEXT REFERENCES clientes(client_code) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    first_boot TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_connection TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for fast queries
CREATE INDEX IF NOT EXISTS idx_dispositivos_client_code ON dispositivos(client_code);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) - Secure configuration
-- ==========================================
-- We enable RLS on both tables so that direct SELECT/INSERT/UPDATE/DELETE queries 
-- using the public 'anon' key are completely blocked.
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SECURE DATABASE FUNCTIONS (RPC) - SECURITY DEFINER
-- ==========================================
-- These functions run with admin privileges (SECURITY DEFINER), allowing clients 
-- to execute specific operations safely without direct access to the tables.

-- Function 1: Securely validate and register a device
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
SET search_path = public -- Secure practice for SECURITY DEFINER functions
AS $$
DECLARE
    v_max_devices INTEGER;
    v_status TEXT;
    v_is_suspended BOOLEAN;
    v_is_blocked BOOLEAN;
    v_device_count INTEGER;
    v_device_exists BOOLEAN;
    v_first_boot TIMESTAMPTZ;
BEGIN
    -- 1. Obtain client info
    SELECT max_devices, status, is_suspended
    INTO v_max_devices, v_status, v_is_suspended
    FROM clientes
    WHERE client_code = p_client_code;

    -- If client does not exist
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'client_not_found'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- If client is suspended, block access
    IF v_is_suspended THEN
        RETURN QUERY SELECT 'suspended'::TEXT, v_status, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- 2. Check if the device is already registered
    SELECT is_blocked, dispositivos.first_boot INTO v_is_blocked, v_first_boot
    FROM dispositivos
    WHERE hardware_id = p_hardware_id AND client_code = p_client_code;

    v_device_exists := FOUND;

    IF v_device_exists THEN
        -- If the device itself is blocked, deny access
        IF v_is_blocked THEN
            RETURN QUERY SELECT 'blocked'::TEXT, v_status, v_first_boot;
            RETURN;
        END IF;

        -- Update last connection timestamp and current device name
        UPDATE dispositivos
        SET last_connection = NOW(),
            device_name = p_device_name
        WHERE hardware_id = p_hardware_id AND client_code = p_client_code;

        RETURN QUERY SELECT 'authorized'::TEXT, v_status, v_first_boot;
        RETURN;
    ELSE
        -- 3. For new devices, check if client has available seats
        SELECT COUNT(*)::INTEGER INTO v_device_count
        FROM dispositivos
        WHERE client_code = p_client_code AND is_blocked = FALSE;

        -- If device limit reached, deny registration
        IF v_device_count >= v_max_devices THEN
            RETURN QUERY SELECT 'limit_exceeded'::TEXT, v_status, NULL::TIMESTAMPTZ;
            RETURN;
        END IF;

        -- Register new device
        v_first_boot := NOW();
        INSERT INTO dispositivos (hardware_id, client_code, device_name, is_blocked, first_boot, last_connection)
        VALUES (p_hardware_id, p_client_code, p_device_name, FALSE, v_first_boot, NOW());

        RETURN QUERY SELECT 'authorized'::TEXT, v_status, v_first_boot;
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permissions for the public anon key
GRANT EXECUTE ON FUNCTION registrar_o_validar_dispositivo(TEXT, TEXT, TEXT) TO anon;
