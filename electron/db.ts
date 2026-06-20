import knex, { Knex } from 'knex';
import { types } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
import * as path from 'path';
import { app } from 'electron';
import { runMigrations } from './migrations';
import type { Db, DbExecuteResult } from './types/db';

import schemaTables from './schemaTables';
import schemaIndexes from './schemaIndexes';

// Cargar variables de entorno
import * as dotenv from 'dotenv';
dotenv.config();

const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase();
const isDev = !app.isPackaged;

// Configurar parser de tipos para Postgres
if (dbType === 'postgres') {
  types.setTypeParser(1700, (val: string) => parseFloat(val));
  types.setTypeParser(700,  (val: string) => parseFloat(val));
  types.setTypeParser(701,  (val: string) => parseFloat(val));
}

let knexInstance: Knex | null = null;

function getKnex(): Knex {
  if (knexInstance) return knexInstance;

  if (dbType === 'postgres') {
    knexInstance = knex({
      client: 'pg',
      connection: {
        user:     isDev ? process.env.DEV_DB_USER     : process.env.PROD_DB_USER,
        host:     isDev ? process.env.DEV_DB_HOST     : process.env.PROD_DB_HOST,
        database: isDev ? process.env.DEV_DB_NAME     : process.env.PROD_DB_NAME,
        password: isDev ? process.env.DEV_DB_PASSWORD : process.env.PROD_DB_PASSWORD,
        port:     parseInt(
          (isDev ? process.env.DEV_DB_PORT : process.env.PROD_DB_PORT) ?? '5432',
          10
        ),
      },
      pool: { min: 2, max: 10 }
    });
  } else {
    let dbPath: string;
    try {
      dbPath = isDev
        ? path.join(process.cwd(), 'seth_database.db')
        : path.join(app.getPath('userData'), 'seth_database.db');
    } catch (e) {
      // Si falla porque app no está lista en algún script de terminal, usar la raíz
      dbPath = path.join(process.cwd(), 'seth_database.db');
    }

    knexInstance = knex({
      client: 'better-sqlite3',
      connection: {
        filename: dbPath,
      },
      useNullAsDefault: true,
      pool: {
        afterCreate: (db: any, cb: any) => {
          try {
            db.pragma('foreign_keys = ON');

            db.function('unaccent', (str: any) => {
              if (typeof str !== 'string') return String(str || '');
              return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            });

            const getTrigrams = (str: string) => {
              const clean = '  ' + str.toLowerCase() + ' ';
              const trigrams: string[] = [];
              for (let i = 0; i < clean.length - 2; i++) {
                trigrams.push(clean.substring(i, i + 3));
              }
              return trigrams;
            };

            db.function('similarity', (a: any, b: any) => {
              const sa = String(a || '');
              const sb = String(b || '');
              if (!sa || !sb) return 0;
              
              const tA = getTrigrams(sa);
              const tB = getTrigrams(sb);
              const setA = new Set(tA);
              const setB = new Set(tB);
              
              let intersectionCount = 0;
              for (const trigram of setA) {
                if (setB.has(trigram)) {
                  intersectionCount++;
                }
              }
              
              const unionCount = setA.size + setB.size - intersectionCount;
              if (unionCount === 0) return 0;
              return intersectionCount / unionCount;
            });

            db.function('word_similarity', (a: any, b: any) => {
              const sa = String(a || '').toLowerCase();
              const sb = String(b || '').toLowerCase();
              if (!sa || !sb) return 0;
              if (sb.includes(sa)) return 1.0;
              
              const tA = getTrigrams(sa);
              const tB = getTrigrams(sb);
              const setA = new Set(tA);
              const setB = new Set(tB);
              
              let intersectionCount = 0;
              for (const trigram of setA) {
                if (setB.has(trigram)) {
                  intersectionCount++;
                }
              }
              
              const unionCount = setA.size + setB.size - intersectionCount;
              if (unionCount === 0) return 0;
              return intersectionCount / unionCount;
            });

            db.function('to_char', (dateVal: any, formatStr: any) => {
              if (!dateVal) return null;
              const str = String(dateVal);
              const date = new Date(str);
              if (isNaN(date.getTime())) {
                return str;
              }
              const fmt = String(formatStr).toUpperCase();
              if (fmt === 'YYYY-MM-DD') {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
              }
              if (fmt === 'YYYY') {
                return String(date.getFullYear());
              }
              return str;
            });

            db.function('now', () => new Date().toISOString());

            db.function('greatest', { varargs: true }, (...args: any[]) => {
              const values = args.filter(v => v !== null && v !== undefined);
              if (values.length === 0) return null;
              return Math.max(...values.map(Number));
            });

            db.function('least', { varargs: true }, (...args: any[]) => {
              const values = args.filter(v => v !== null && v !== undefined);
              if (values.length === 0) return null;
              return Math.min(...values.map(Number));
            });

            db.aggregate('bool_and', {
              start: () => 1,
              step: (total: any, val: any) => (total && (val === 1 || val === true || val === 'true' || val === '1')) ? 1 : 0,
            });
          } catch (err) {
            console.error('Error registering SQLite custom functions:', err);
          }
          cb(null, db);
        }
      }
    });
  }
  return knexInstance;
}

const asyncLocalStorage = new AsyncLocalStorage<Knex | Knex.Transaction>();

// Helper de traducción de queries PG -> SQLite
function translatePgToSqlite(sql: string, params: unknown[] = []): { sql: string; params: unknown[] } {
  const newParams: unknown[] = [];
  
  // 1. Traducir parámetros $1, $2 a ? y duplicar parámetros reusados
  let translatedSql = sql.replace(/\$(\d+)/g, (match, numStr) => {
    const index = parseInt(numStr, 10) - 1;
    newParams.push(params[index]);
    return '?';
  });

  // 2. Reemplazar ILIKE por LIKE
  translatedSql = translatedSql.replace(/\bilike\b/gi, 'like');

  // 3. Remover casts específicos de Postgres como ::jsonb
  translatedSql = translatedSql.replace(/::jsonb/gi, '');

  // 4. Remover cláusulas RETURNING para SQLite
  translatedSql = translatedSql.replace(/\breturning\s+([a-z0-9_*, ]+)/gi, '');

  // 5. Remover "AT TIME ZONE '...'"
  translatedSql = translatedSql.replace(/\bAT\s+TIME\s+ZONE\s+'[^']+'/gi, '');

  return { sql: translatedSql, params: newParams };
}

const BOOLEAN_KEYS = new Set([
  'active',
  'is_active',
  'completado',
  'is_delivered',
  'is_paid',
  'converted_to_order',
  'maquila_completada',
  'mostrador_completado',
  'all_completed'
]);

function convertBooleans(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(convertBooleans);
  }
  
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (BOOLEAN_KEYS.has(key)) {
        res[key] = val === 1 || val === true || val === 'true' || val === '1';
      } else if (typeof val === 'object' && val !== null) {
        res[key] = convertBooleans(val);
      } else {
        res[key] = val;
      }
    }
    return res;
  }
  
  return obj;
}

const db: Db = {
  async getOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T | null> {
    const client = asyncLocalStorage.getStore() ?? getKnex();
    try {
      if (dbType === 'sqlite') {
        const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
        const isUpdate = sql.trim().toUpperCase().startsWith('UPDATE');
        const hasReturning = sql.toUpperCase().includes('RETURNING');

        if ((isInsert || isUpdate) && hasReturning) {
          // 1. Ejecutar la consulta modificadora (con RETURNING removido)
          const { sql: sqlT, params: paramsT } = translatePgToSqlite(sql, params);
          const result = await client.raw(sqlT, paramsT as any);

          // 2. Emular RETURNING obteniendo la fila modificada
          if (isInsert) {
            const insertMatch = sql.trim().match(/^INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
            if (insertMatch) {
              const tableName = insertMatch[1];
              const insertId = result.lastInsertRowid;
              const selectResult = await client.raw(`SELECT * FROM ${tableName} WHERE id = ?`, [insertId]);
              const row = selectResult[0] ?? null;
              return convertBooleans(row) as T | null;
            }
          } else if (isUpdate) {
            const updateMatch = sql.trim().match(/^UPDATE\s+([a-zA-Z0-9_]+)/i);
            const whereMatch = sql.match(/\bWHERE\b([\s\S]+?)(?:\bRETURNING\b|$)/i);
            if (updateMatch && whereMatch) {
              const tableName = updateMatch[1];
              const whereClause = whereMatch[0];
              const selectSql = `SELECT * FROM ${tableName} ${whereClause}`;
              const { sql: selectSqlT, params: selectParamsT } = translatePgToSqlite(selectSql, params);
              const selectResult = await client.raw(selectSqlT, selectParamsT as any);
              const row = selectResult[0] ?? null;
              return convertBooleans(row) as T | null;
            }
          }
        }

        // Caso normal
        const { sql: sqlT, params: paramsT } = translatePgToSqlite(sql, params);
        const result = await client.raw(sqlT, paramsT as any);
        const row = result[0] ?? null;
        return convertBooleans(row) as T | null;
      } else {
        const result = await client.raw(sql, params as any);
        return (result.rows[0] ?? null) as T | null;
      }
    } catch (e) {
      const err = e as Error;
      console.error('Database Error:', err.message, '\nQuery:', sql, '\nParams:', params);
      throw e;
    }
  },

  async getAll<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const client = asyncLocalStorage.getStore() ?? getKnex();
    try {
      if (dbType === 'sqlite') {
        const { sql: sqlT, params: paramsT } = translatePgToSqlite(sql, params);
        const result = await client.raw(sqlT, paramsT as any);
        return convertBooleans(result) as T[];
      } else {
        const result = await client.raw(sql, params as any);
        return result.rows as T[];
      }
    } catch (e) {
      const err = e as Error;
      console.error('Database Error:', err.message, '\nQuery:', sql, '\nParams:', params);
      throw e;
    }
  },

  async execute(sql: string, params: unknown[] = []): Promise<DbExecuteResult> {
    let pgSql = sql;

    if (dbType === 'postgres') {
      if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
        pgSql += ' RETURNING *';
      }
    }

    const client = asyncLocalStorage.getStore() ?? getKnex();
    try {
      if (dbType === 'sqlite') {
        const { sql: sqlT, params: paramsT } = translatePgToSqlite(pgSql, params);
        const result = await client.raw(sqlT, paramsT as any);
        return {
          changes: result.changes ?? null,
          lastInsertRowid: result.lastInsertRowid ?? null,
        };
      } else {
        const result = await client.raw(pgSql, params as any);
        return {
          changes: result.rowCount,
          lastInsertRowid:
            result.rows.length > 0 && result.rows[0].id ? result.rows[0].id : null,
        };
      }
    } catch (e) {
      const err = e as Error;
      console.error('Database Error:', err.message, '\nQuery:', pgSql, '\nParams:', params);
      throw e;
    }
  },

  transaction<T>(fn: (...args: unknown[]) => Promise<T>) {
    return async (...args: unknown[]): Promise<T> => {
      const activeClient = asyncLocalStorage.getStore() ?? getKnex();
      return await activeClient.transaction(async (trx) => {
        return await asyncLocalStorage.run(trx, () => fn(...args));
      });
    };
  },

  async exec(sql: string): Promise<unknown> {
    const client = asyncLocalStorage.getStore() ?? getKnex();
    if (dbType === 'sqlite') {
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      for (const statement of statements) {
        const { sql: sqlT } = translatePgToSqlite(statement, []);
        await client.raw(sqlT);
      }
      return;
    } else {
      return await client.raw(sql);
    }
  },
};

export async function initDb(): Promise<void> {
  try {
    const activeKnex = getKnex();
    if (dbType === 'sqlite') {
      const sqliteSchema = schemaTables
        .replace(/'\[\]'::jsonb/gi, "'[]'")
        .replace(/::jsonb/gi, '')
        .replace(/JSONB/gi, 'TEXT')
        .replace(/SERIAL\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/TIMESTAMPTZ/gi, 'DATETIME')
        .replace(/DECIMAL\(\d+,\s*\d+\)/gi, 'NUMERIC')
        .replace(/DEFAULT\s+NOW\(\)/gi, 'DEFAULT CURRENT_TIMESTAMP');

      const statements = sqliteSchema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        await activeKnex.raw(statement);
      }

      const sqliteIndexes = schemaIndexes
        .replace(/\bAT\s+TIME\s+ZONE\s+'[^']+'/gi, '');

      const indexStatements = sqliteIndexes
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of indexStatements) {
        await activeKnex.raw(statement);
      }

      await activeKnex.raw(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version    INTEGER      PRIMARY KEY,
          name       VARCHAR(255) NOT NULL,
          applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const existingMigrations = await activeKnex.raw('SELECT version FROM schema_migrations');
      const appliedVersions = new Set(existingMigrations.map((r: any) => r.version));
      const totalMigrations = 29;
      for (let i = 1; i <= totalMigrations; i++) {
        if (!appliedVersions.has(i)) {
          await activeKnex.raw('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [i, `migration_v${i}`]);
        }
      }

      console.log('✅ Base de datos SQLite Inicializada');
    } else {
      await activeKnex.raw(schemaTables);

      const adapter = {
        query: async (querySql: string, queryParams: any[] = []) => {
          const res = await activeKnex.raw(querySql, queryParams);
          return res;
        }
      };
      await runMigrations(db, adapter as any);
      await activeKnex.raw(schemaIndexes);
      console.log('✅ Base de datos PG Inicializada');
    }
  } catch (e) {
    console.error('❌ Error inicializando DB:', e);
  }
}

export default db;
