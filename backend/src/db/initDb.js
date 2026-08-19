import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../config/postgres.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, 'schema.sql');

async function initDb() {
  const schema = await readFile(schemaPath, 'utf-8');
  await pool.query(schema);
  console.log('Esquema aplicado correctamente (tabla users lista)');
}

initDb()
  .catch((err) => {
    console.error('Error al aplicar el esquema:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
