import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { createUserTracker } from './helpers.js';

describe('Roles y permisos (Fase 7)', () => {
  const users = createUserTracker();
  let owner;
  let admin;
  let member;
  let teamId;
  let boardId;

  beforeAll(async () => {
    owner = await users.register('perm-owner');
    admin = await users.register('perm-admin');
    member = await users.register('perm-member');

    const teamRes = await request(app)
      .post('/api/teams')
      .set('Cookie', owner.cookies)
      .send({ name: 'Equipo de permisos' });
    teamId = teamRes.body.team.id;

    await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Cookie', owner.cookies)
      .send({ email: admin.email });
    await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Cookie', owner.cookies)
      .send({ email: member.email });

    // admin arranca como 'member' (así invita inviteMember); se promueve.
    await request(app)
      .patch(`/api/teams/${teamId}/members/${admin.user.id}`)
      .set('Cookie', owner.cookies)
      .send({ role: 'admin' });

    const boardRes = await request(app)
      .post(`/api/teams/${teamId}/boards`)
      .set('Cookie', owner.cookies)
      .send({ name: 'Tablero de permisos' });
    boardId = boardRes.body.board.id;
  });

  afterAll(() => users.cleanup());

  it('un member no puede invitar miembros (403)', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Cookie', member.cookies)
      .send({ email: 'nadie@example.test' });
    expect(res.status).toBe(403);
  });

  it('un member no puede borrar el tablero (403)', async () => {
    const res = await request(app).delete(`/api/boards/${boardId}`).set('Cookie', member.cookies);
    expect(res.status).toBe(403);
  });

  it('un member no puede cambiar roles, aunque sea el suyo propio (403)', async () => {
    const res = await request(app)
      .patch(`/api/teams/${teamId}/members/${member.user.id}`)
      .set('Cookie', member.cookies)
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('un admin no puede cambiar roles (solo el owner puede, 403)', async () => {
    const res = await request(app)
      .patch(`/api/teams/${teamId}/members/${member.user.id}`)
      .set('Cookie', admin.cookies)
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('nadie puede expulsar al owner del equipo (400)', async () => {
    const res = await request(app)
      .delete(`/api/teams/${teamId}/members/${owner.user.id}`)
      .set('Cookie', admin.cookies);
    expect(res.status).toBe(400);
  });

  it('un admin no puede expulsar a otro admin (403); el owner sí puede (204)', async () => {
    // Se crea un segundo admin descartable solo para este test.
    const secondAdmin = await users.register('perm-admin2');
    await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Cookie', owner.cookies)
      .send({ email: secondAdmin.email });
    await request(app)
      .patch(`/api/teams/${teamId}/members/${secondAdmin.user.id}`)
      .set('Cookie', owner.cookies)
      .send({ role: 'admin' });

    const blocked = await request(app)
      .delete(`/api/teams/${teamId}/members/${secondAdmin.user.id}`)
      .set('Cookie', admin.cookies);
    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .delete(`/api/teams/${teamId}/members/${secondAdmin.user.id}`)
      .set('Cookie', owner.cookies);
    expect(allowed.status).toBe(204);
  });

  it('owner y admin sí pueden borrar el tablero (204)', async () => {
    const boardRes = await request(app)
      .post(`/api/teams/${teamId}/boards`)
      .set('Cookie', owner.cookies)
      .send({ name: 'Tablero descartable' });
    const disposableBoardId = boardRes.body.board.id;

    const res = await request(app)
      .delete(`/api/boards/${disposableBoardId}`)
      .set('Cookie', admin.cookies);
    expect(res.status).toBe(204);
  });

  it('cualquier miembro (no solo owner/admin) puede asignar una tarjeta', async () => {
    const columnRes = await request(app)
      .post(`/api/boards/${boardId}/columns`)
      .set('Cookie', owner.cookies)
      .send({ name: 'Col' });
    const cardRes = await request(app)
      .post(`/api/boards/${boardId}/cards`)
      .set('Cookie', owner.cookies)
      .send({ column_id: columnRes.body.column.id, title: 'Asignable' });

    const res = await request(app)
      .post(`/api/boards/${boardId}/cards/${cardRes.body.card.id}/assignees`)
      .set('Cookie', member.cookies)
      .send({ user_id: member.user.id });
    expect(res.status).toBe(201);
  });
});
