import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { teamsRouter } from './routes/teams.routes.js';
import { boardsRouter } from './routes/boards.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

/**
 * App de Express separada de server.js (Fase 8) para poder testearla con
 * supertest sin levantar un puerto real ni pasar por el bootstrap de
 * conexión a Postgres/Mongo/sockets — los tests hacen esa conexión ellos
 * mismos donde la necesitan (ver tests/setup.js).
 */
const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', teamsRouter);
app.use('/api', boardsRouter);
app.use('/api', notificationsRouter);

app.use(errorHandler);

export default app;
