import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL ?? '';
const isLocalDb = /localhost|127\.0\.0\.1/.test(connectionString);
const hasExplicitSslMode = /sslmode=/.test(connectionString);

export const pool = new Pool({
  connectionString,
  // Providers like Neon set sslmode in the URL and support full certificate
  // verification — let pg honor that instead of overriding it. Only fall
  // back to a permissive setting for hosts that need SSL but don't specify it.
  ssl: isLocalDb || hasExplicitSslMode ? undefined : { rejectUnauthorized: false },
});

export async function checkPostgresConnection() {
  await pool.query('SELECT 1');
}
