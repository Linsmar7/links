import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });

async function run() {
  console.log('Running database migrations...');
  const client = await pool.connect();
  try {
    // Enable extensions needed for search
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    await client.query('CREATE EXTENSION IF NOT EXISTS unaccent;');
    console.log('Extensions verified: pg_trgm, unaccent.');
  } catch (err) {
    console.warn('Warning creating extensions (might not have superuser or already created):', err.message);
  } finally {
    client.release();
  }

  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations completed successfully.');
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

