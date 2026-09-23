import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { testEmail, extractCookies, cleanupTestUsers, registerAndLogin } from './helpers.js';

// Cada test de este archivo registra al menos un usuario real (algunos
// directo por request(), otros vía el helper registerAndLogin) — se
// trackean los ids acá y se borran todos juntos al final. Ver la nota en
// helpers.js sobre por qué no se puede limpiar por patrón de email
// compartido entre archivos de test que corren en paralelo.
const createdUserIds = [];

describe('Autenticación', () => {
  afterAll(() => cleanupTestUsers(createdUserIds));

  describe('POST /api/auth/register', () => {
    it('crea un usuario y deja cookies de sesión (201)', async () => {
      const email = testEmail('register-ok');
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Nuevo Usuario', email, password: 'Test1234!' });
      createdUserIds.push(res.body.user?.id);

      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ name: 'Nuevo Usuario', email });
      expect(res.body.user.password_hash).toBeUndefined();
      const setCookie = res.headers['set-cookie'] ?? [];
      expect(setCookie.some((c) => c.startsWith('access_token='))).toBe(true);
      expect(setCookie.some((c) => c.startsWith('refresh_token='))).toBe(true);
    });

    it('rechaza un email duplicado (409)', async () => {
      const email = testEmail('register-dup');
      const first = await request(app).post('/api/auth/register').send({
        name: 'Original',
        email,
        password: 'Test1234!',
      });
      createdUserIds.push(first.body.user?.id);

      const res = await request(app).post('/api/auth/register').send({
        name: 'Otro',
        email,
        password: 'Test1234!',
      });

      expect(res.status).toBe(409);
    });

    it('rechaza un email con formato inválido (400)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Nombre',
        email: 'no-es-un-email',
        password: 'Test1234!',
      });
      expect(res.status).toBe(400);
    });

    it('rechaza una contraseña corta (400)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Nombre',
        email: testEmail('register-shortpw'),
        password: '123',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('inicia sesión con credenciales correctas (200)', async () => {
      const email = testEmail('login-ok');
      const password = 'Test1234!';
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Login Ok', email, password });
      createdUserIds.push(registerRes.body.user?.id);

      const res = await request(app).post('/api/auth/login').send({ email, password });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(email);
    });

    it('rechaza una contraseña incorrecta (401)', async () => {
      const email = testEmail('login-badpw');
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Login Bad', email, password: 'Test1234!' });
      createdUserIds.push(registerRes.body.user?.id);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'ContraseñaIncorrecta1!' });
      expect(res.status).toBe(401);
    });

    it('rechaza un email que no existe (401, mismo mensaje que password incorrecta)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail('no-existe'), password: 'Test1234!' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('devuelve el usuario autenticado con cookie válida (200)', async () => {
      const { cookies, user } = await registerAndLogin('me-ok');
      createdUserIds.push(user.id);
      const res = await request(app).get('/api/auth/me').set('Cookie', cookies);
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user.id);
    });

    it('rechaza la petición sin cookie de sesión (401)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh y POST /api/auth/logout', () => {
    it('renueva la sesión con el refresh token (200, cookies nuevas)', async () => {
      const { cookies, user } = await registerAndLogin('refresh-ok');
      createdUserIds.push(user.id);
      const res = await request(app).post('/api/auth/refresh').set('Cookie', cookies);
      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'] ?? [];
      expect(setCookie.some((c) => c.startsWith('access_token='))).toBe(true);
    });

    it('rechaza el refresh sin cookie (401)', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
    });

    it('logout limpia la sesión: /me deja de funcionar con las cookies devueltas', async () => {
      const { cookies, user } = await registerAndLogin('logout-ok');
      createdUserIds.push(user.id);
      const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', cookies);
      expect(logoutRes.status).toBe(204);

      const clearedCookies = extractCookies(logoutRes);
      const meRes = await request(app).get('/api/auth/me').set('Cookie', clearedCookies);
      expect(meRes.status).toBe(401);
    });
  });
});
