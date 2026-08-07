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
//
// La regla 3 aplica a partir de la primera entrega al cliente.
// La antigua v1 (add_template_serial_number) se eliminó antes de esa
// entrega porque su columna ya vive en el esquema base de schemaTables.ts,
// así que en una BD nueva no hacía absolutamente nada.
//
// Nota: el catálogo de productos NO se siembra aquí. Depende del primer
// usuario (queda como su autor), así que corre en bootstrapService.ts
// cuando se crea ese usuario desde la pantalla de configuración inicial.

import { PoolClient } from 'pg';
import type { Db } from './types/db';
import type { Migration } from './types/migrations';
import { APP_PERMISSIONS } from './data/permissions';

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'seed_permisos',
    // Sin isApplied a propósito: una BD anterior al versionado no puede
    // existir todavía. schema_migrations basta para que corra una sola vez.
    up: async (client: PoolClient) => {
      // Los permisos son datos de referencia de la app: deben existir en
      // cualquier instalación, aún antes de que haya usuarios a quién
      // asignárselos. Por eso van en una migración y no en el bootstrap.
      for (const permission of APP_PERMISSIONS) {
        await client.query(
          `INSERT INTO permissions (name, description) VALUES ($1, $2)`,
          [permission.name, permission.description]
        );
      }

      console.log(`Permisos sembrados: ${APP_PERMISSIONS.length}.`);
    }
  }
];

// ─── RUNNER PRINCIPAL ───────────────────────────────────────────────────────

export async function runMigrations(db: Db, client: PoolClient): Promise<void> {
  // 1. Crear tabla de control si no existe
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER      PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
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

    // Verificar si la migración ya está aplicada físicamente (ej. bases de datos pre-versionadas)
    if (migration.isApplied) {
      const alreadyApplied = await migration.isApplied(client);
      if (alreadyApplied) {
        await client.query(
          `INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`,
          [migration.version, migration.name]
        );
        console.log(`v${migration.version} ya estaba aplicada (se registró en control).`);
        continue;
      }
    }

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
