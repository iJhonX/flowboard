import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Defensa CSRF por Origin (Fase 9)', () => {
  const originalClientUrl = process.env.CLIENT_URL;

  beforeAll(() => {
    process.env.CLIENT_URL = 'https://flowboard.example.test/';
  });
  afterAll(() => {
    process.env.CLIENT_URL = originalClientUrl;
  });

  it('rechaza una mutación cuyo Origin no es el del frontend (403)', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Origin', 'https://sitio-malicioso.test');
    expect(res.status).toBe(403);
  });

  it('acepta una mutación desde el origen del frontend, aunque CLIENT_URL termine en "/"', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Origin', 'https://flowboard.example.test');
    expect(res.status).toBe(204);
  });

  it('no restringe métodos seguros (GET) por Origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://otro.test');
    expect([200, 503]).toContain(res.status);
  });

  it('permite peticiones sin Origin (curl, server-to-server)', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
  });
});
