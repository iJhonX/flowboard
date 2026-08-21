import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { checkPostgresConnection } from './config/postgres.js';
import { connectMongo } from './config/mongo.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { teamsRouter } from './routes/teams.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', teamsRouter);

app.use(errorHandler);

async function start() {
  // Fail fast: sin estos secrets la firma de tokens fallaría en runtime con errores confusos
  const missingSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter((key) => !process.env[key]);
  if (missingSecrets.length > 0) {
    console.error(`Faltan variables de entorno: ${missingSecrets.join(', ')} (ver backend/.env.example)`);
    process.exit(1);
  }

  try {
    await checkPostgresConnection();
    console.log('PostgreSQL conectado');
  } catch (err) {
    console.error('No se pudo conectar a PostgreSQL:', err.message);
  }

  try {
    await connectMongo();
    console.log('MongoDB conectado');
  } catch (err) {
    console.error('No se pudo conectar a MongoDB:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

start();
