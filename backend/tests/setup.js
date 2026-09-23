// Se ejecuta antes de cargar cualquier archivo de test (ver vitest.config.js
// -> setupFiles). TIENE que ser lo primero en cargar dotenv: config/postgres.js
// lee process.env.DATABASE_URL al importarse (a nivel de módulo, no dentro de
// una función), así que si algo importara ese archivo antes de que dotenv
// corriera, el pool se crearía con una connection string vacía.
import 'dotenv/config';
import { afterAll } from 'vitest';
import { pool } from '../src/config/postgres.js';
import { connectMongo } from '../src/config/mongo.js';

await connectMongo();

afterAll(async () => {
  await pool.end();
  const mongoose = (await import('mongoose')).default;
  await mongoose.disconnect();
});
