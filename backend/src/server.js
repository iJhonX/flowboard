import 'dotenv/config';
import { createServer } from 'node:http';

import app from './app.js';
import { checkPostgresConnection } from './config/postgres.js';
import { connectMongo } from './config/mongo.js';
import { initSockets } from './sockets/index.js';

const httpServer = createServer(app);
const PORT = process.env.PORT ?? 4000;

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

  initSockets(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

start();
