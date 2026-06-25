import './env';
import type { Knex } from 'knex';
import * as path from 'path';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: path.join(process.cwd(), 'seth_database.db'),
    },
    useNullAsDefault: true,
  },
  production: {
    client: 'better-sqlite3',
    connection: {
      filename: 'seth_database.db', // Se modificará dinámicamente en db.ts para usar el directorio de datos del usuario (userData)
    },
    useNullAsDefault: true,
  },
  postgres: {
    client: 'pg',
    connection: {
      host: process.env.DEV_DB_HOST || 'localhost',
      user: process.env.DEV_DB_USER || 'postgres',
      password: process.env.DEV_DB_PASSWORD || '',
      database: process.env.DEV_DB_NAME || 'seth',
      port: parseInt(process.env.DEV_DB_PORT || '5432', 10),
    },
  }
};

export default config;
