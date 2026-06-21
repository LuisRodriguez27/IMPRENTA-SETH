// SISTEMA DE MIGRACIONES VERSIONADO
// Cada migración se ejecuta UNA SOLA VEZ y queda registrada
// en la tabla schema_migrations. Si la app inicia y ya están
// todas aplicadas, no hace ningún trabajo extra.
//
// Reglas para agregar migraciones nuevas:
//   1. Agrega un objeto al array MIGRATIONS con el siguiente
//      número de versión disponible.
//   2. Escribe toda la lógica usando `client.query()` (no db.xxx)
//      para que quede dentro de la misma transacción.
//   3. NUNCA modifiques o elimines migraciones ya aplicadas.

import { PoolClient } from 'pg';
import type { Db } from './types/db';
import type { Migration } from './types/migrations';

const MIGRATIONS: Migration[] = [
  /*
  {
    version: 1,
    name: 'ejemplo_migracion',
    isApplied: async (client: PoolClient) => {
      // Opcional: retornar true si ya se aplicó anteriormente
      return false;
    },
    up: async (client: PoolClient) => {
      await client.query(`ALTER TABLE tabla ADD COLUMN columna TEXT`);
    }
  }
  */
];

// ─── RUNNER PRINCIPAL ───────────────────────────────────────────────────────

export async function runMigrations(db: Db, client: PoolClient): Promise<void> {
  // 1. Crear tabla de control si no existe
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER      PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  // 2. Leer versiones ya aplicadas
  const { rows: appliedRows } = await client.query<{ version: number }>(
    `SELECT version FROM schema_migrations ORDER BY version ASC`
  );
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  // 3. Ejecutar migraciones pendientes en orden estricto
  let ran = 0;
  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;

    console.log(`Migración v${migration.version} (${migration.name})...`);
    try {
      await client.query('BEGIN');
      await migration.up(client);
      await client.query(
        `INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`,
        [migration.version, migration.name]
      );
      await client.query('COMMIT');
      console.log(`v${migration.version} aplicada.`);
      ran++;
    } catch (e) {
      await client.query('ROLLBACK');
      const err = e as Error;
      console.error(`Error en migración v${migration.version}: ${err.message}`);
      throw new Error(`Fallo en migración v${migration.version} — se hizo rollback: ${err.message}`);
    }
  }

  if (ran === 0) {
    console.log('No hay migraciones pendientes.');
  } else {
    console.log(`${ran} migración(es) aplicada(s) exitosamente.`);
  }
}
