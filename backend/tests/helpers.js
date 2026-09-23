import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/config/postgres.js';

/**
 * Los tests pegan contra las mismas bases de datos de desarrollo (Neon +
 * Atlas) que se usaron manualmente durante todo el proyecto — no hay Docker
 * ni un Postgres/Mongo local en este setup.
 *
 * Vitest corre los archivos de test EN PARALELO por defecto. La primera
 * versión de este helper limpiaba con `DELETE ... WHERE email LIKE
 * 'vitest-%'` en el afterAll de cada archivo — y como el patrón es el mismo
 * para todos, el afterAll de auth.test.js (que termina rápido) borraba de
 * paso los usuarios que boards.test.js/permissions.test.js todavía estaban
 * usando, en cascada con sus equipos y tableros a mitad de carrera (se vio
 * como 404 "no eres miembro" en tests que deberían haber pasado). Por eso
 * cada archivo ahora trackea los ids que ÉL creó y solo borra esos — sin
 * pisar el estado de los demás archivos, corran en el orden que corran.
 */
const TEST_EMAIL_PREFIX = 'vitest-';

/** Email de test único por llamada, para no chocar con corridas anteriores. */
export function testEmail(label) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${TEST_EMAIL_PREFIX}${label}-${unique}@example.test`;
}

/** Registra un usuario y devuelve sus cookies de sesión ya parseadas para supertest. */
export async function registerAndLogin(label) {
  const email = testEmail(label);
  const password = 'Test1234!';
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: `Test ${label}`, email, password });

  if (res.status !== 201) {
    throw new Error(`No se pudo registrar el usuario de test: ${JSON.stringify(res.body)}`);
  }

  return { email, password, user: res.body.user, cookies: extractCookies(res) };
}

/** supertest expone el header crudo Set-Cookie; hay que quedarse solo con "nombre=valor". */
export function extractCookies(res) {
  const setCookie = res.headers['set-cookie'] ?? [];
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

/**
 * Borra exactamente los usuarios cuyos ids se pasan (y en cascada sus
 * equipos/tableros/columnas/tarjetas). Cada archivo de test debe pasar solo
 * los ids que ÉL creó — ver la nota de arriba sobre por qué no se puede
 * limpiar por patrón de email compartido entre archivos.
 */
export async function cleanupTestUsers(userIds) {
  if (!userIds || userIds.length === 0) return;
  await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [userIds]);
}

/**
 * Envoltorio de conveniencia: registra usuarios con `register` y va
 * acumulando sus ids sola, así cada archivo de test no tiene que llevar el
 * array a mano. Uso típico:
 *
 *   const users = createUserTracker();
 *   const owner = await users.register('board-owner');
 *   afterAll(() => users.cleanup());
 */
export function createUserTracker() {
  const ids = [];
  return {
    async register(label) {
      const created = await registerAndLogin(label);
      ids.push(created.user.id);
      return created;
    },
    cleanup: () => cleanupTestUsers(ids),
  };
}
