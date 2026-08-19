import bcrypt from 'bcryptjs';
import { pool } from '../config/postgres.js';
import {
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  verifyToken,
} from '../utils/tokens.js';

const BCRYPT_ROUNDS = 10;

/** Convierte una fila de users en el objeto seguro para el cliente (sin password_hash). */
function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
}

async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
}

async function findUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
}

/** POST /api/auth/register */
export async function register(req, res, next) {
  const { name, email, password } = req.body;

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con este email' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash]
    );

    setAuthCookies(res, rows[0].id);
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (err) {
    // Carrera entre el SELECT previo y el INSERT: violación de unicidad
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una cuenta con este email' });
    }
    next(err);
  }
}

/** POST /api/auth/login */
export async function login(req, res, next) {
  const { email, password } = req.body;

  try {
    const user = await findUserByEmail(email);
    // Mismo mensaje para email inexistente y contraseña incorrecta:
    // no revelar qué dato fue el que falló (evita enumeración de cuentas).
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    setAuthCookies(res, user.id);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/auth/refresh — renueva la sesión usando el refresh token. */
export async function refresh(req, res, next) {
  const token = req.cookies?.[REFRESH_TOKEN_COOKIE];

  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const payload = verifyToken(token, process.env.JWT_REFRESH_SECRET);
    const user = await findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Cuenta no encontrada' });
    }

    // Rotación: se emiten access Y refresh nuevos, así cada refresco renueva la ventana
    setAuthCookies(res, user.id);
    res.json({ user: publicUser(user) });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesión expirada, vuelve a iniciar sesión' });
    }
    next(err);
  }
}

/** POST /api/auth/logout — invalida la sesión en el cliente. */
export function logout(_req, res) {
  clearAuthCookies(res);
  res.status(204).end();
}

/** GET /api/auth/me — devuelve el usuario autenticado (para restaurar sesión al recargar). */
export async function me(req, res, next) {
  try {
    const user = await findUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}
