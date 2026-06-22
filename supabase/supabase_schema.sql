-- ==========================================
-- SCHEMA FOR SUPABASE (LICENSING CLOUD)
-- Execute this SQL script in your Supabase SQL Editor
-- ==========================================

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
-- ROW LEVEL SECURITY (RLS) - Optional/Recommended
-- ==========================================
-- Since this application is distributed directly to client PCs, 
-- if they use the public/anon key, you can configure RLS rules.
-- For a simple direct connection setup, you can temporarily disable RLS,
-- or configure specific insert/select policies.

-- Disable RLS if you want direct access using the Anon key without auth policies:
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos DISABLE ROW LEVEL SECURITY;
