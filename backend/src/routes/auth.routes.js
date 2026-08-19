import { Router } from 'express';
import { register, login, refresh, logout, me } from '../controllers/auth.controller.js';
import { registerSchema, loginSchema } from '../validators/auth.schemas.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRouter = Router();

authRouter.post('/auth/register', validate(registerSchema), register);
authRouter.post('/auth/login', validate(loginSchema), login);
authRouter.post('/auth/refresh', refresh);
authRouter.post('/auth/logout', logout);
authRouter.get('/auth/me', requireAuth, me);
