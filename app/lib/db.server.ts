import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../db/schema';

declare global {
  var __db_pool: pg.Pool | undefined;
}

const pool =
  globalThis.__db_pool ??
  new pg.Pool({
    connectionString:
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/links',
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__db_pool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };

