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

import { PoolClient } from 'pg';
import type { Db } from './types/db';
import type { Migration } from './types/migrations';
import { CATALOG_PRODUCTS, CATALOG_TEMPLATES } from './data/catalog';

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'seed_catalogo_shiny_trodat',
    // Sin isApplied a propósito: una BD anterior al versionado no puede
    // contener este catálogo, así que no hay estado previo que detectar.
    // schema_migrations basta para que corra una sola vez.
    up: async (client: PoolClient) => {
      // 1. Productos raíz del catálogo, capturando el id que asigna la BD.
      //    Los productos van sin serial_number (NULL, no cadena vacía: la
      //    columna tiene UNIQUE y varias cadenas vacías chocarían entre sí).
      //    Por eso el id se lee del INSERT en lugar de re-consultar por
      //    nombre: products.name se repite en el catálogo de origen
      //    (COJINES DE REPUESTO aparece dos veces, con plantillas distintas).
      //
      //    El RETURNING sirve en los dos motores: en Postgres devuelve la
      //    fila insertada, y en SQLite el traductor de db.ts lo elimina y
      //    better-sqlite3 responde con lastInsertRowid.
      const idByCsvId = new Map<number, number>();

      for (const product of CATALOG_PRODUCTS) {
        const { rows } = await client.query(
          `INSERT INTO products (name, price, stock) VALUES ($1, $2, $3) RETURNING id`,
          [product.name, product.price, 0]
        );
        const inserted = rows[0] as { id?: number; lastInsertRowid?: number } | undefined;
        const realId = Number(inserted?.id ?? inserted?.lastInsertRowid);

        if (!Number.isInteger(realId) || realId <= 0) {
          throw new Error(`No se pudo obtener el id del producto "${product.name}" tras insertarlo`);
        }
        idByCsvId.set(product.csvId, realId);
      }

      // 2. Plantillas por lotes. Son ~990 filas: insertarlas una por una
      //    alarga el primer arranque sin necesidad. 7 columnas x 100 filas =
      //    700 parámetros por lote, dentro del límite de SQLite y de Postgres.
      //    Se omiten active y package para que apliquen los DEFAULT del esquema.
      const BATCH_SIZE = 100;
      for (let i = 0; i < CATALOG_TEMPLATES.length; i += BATCH_SIZE) {
        const batch = CATALOG_TEMPLATES.slice(i, i + BATCH_SIZE);
        const params: unknown[] = [];

        const tuples = batch.map((tpl) => {
          const productId = idByCsvId.get(tpl.csvProductId);
          if (!productId) {
            throw new Error(`La plantilla "${tpl.name}" apunta al producto ${tpl.csvProductId}, que no se sembró`);
          }
          const base = params.length;
          params.push(
            productId,
            tpl.name,
            tpl.templateSerialNumber,
            tpl.dimensions,
            tpl.description,
            tpl.finalPrice,
            tpl.category
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
        });

        await client.query(
          `INSERT INTO product_templates
             (product_id, name, template_serial_number, dimensions, description, final_price, category)
           VALUES ${tuples.join(', ')}`,
          params
        );
      }

      console.log(`Catálogo sembrado: ${CATALOG_PRODUCTS.length} productos, ${CATALOG_TEMPLATES.length} plantillas.`);
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
