import { Router } from 'express';
import { pool } from '../config/postgres.js';
import { isMongoConnected } from '../config/mongo.js';

export const healthRouter = Router();

healthRouter.get('/health', async (req, res) => {
  const status = { postgres: 'down', mongo: 'down' };

  try {
    await pool.query('SELECT 1');
    status.postgres = 'up';
  } catch (err) {
    status.postgresError = err.message;
  }

  status.mongo = isMongoConnected() ? 'up' : 'down';

  const allUp = status.postgres === 'up' && status.mongo === 'up';
  res.status(allUp ? 200 : 503).json({ ok: allUp, ...status });
});
