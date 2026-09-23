import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { createUserTracker } from './helpers.js';

describe('CRUD core: equipos, tableros, columnas y tarjetas', () => {
  const users = createUserTracker();
  let owner;
  let outsider; // usuario sin membresía, para los checks de autorización
  let teamId;
  let boardId;

  beforeAll(async () => {
    owner = await users.register('board-owner');
    outsider = await users.register('board-outsider');

    const teamRes = await request(app)
      .post('/api/teams')
      .set('Cookie', owner.cookies)
      .send({ name: 'Equipo de test' });
    teamId = teamRes.body.team.id;

    const boardRes = await request(app)
      .post(`/api/teams/${teamId}/boards`)
      .set('Cookie', owner.cookies)
      .send({ name: 'Tablero de test' });
    boardId = boardRes.body.board.id;
  });

  afterAll(() => users.cleanup());

  it('GET /api/boards/:boardId devuelve el tablero recién creado, sin columnas', async () => {
    const res = await request(app).get(`/api/boards/${boardId}`).set('Cookie', owner.cookies);
    expect(res.status).toBe(200);
    expect(res.body.board.id).toBe(boardId);
    expect(res.body.columns).toEqual([]);
    expect(res.body.myRole).toBe('owner');
  });

  it('un usuario ajeno al equipo recibe 404 (no 403, anti-enumeración)', async () => {
    const res = await request(app).get(`/api/boards/${boardId}`).set('Cookie', outsider.cookies);
    expect(res.status).toBe(404);
  });

  it('un :boardId no numérico devuelve 400, no 500', async () => {
    const res = await request(app).get('/api/boards/no-es-un-id').set('Cookie', owner.cookies);
    expect(res.status).toBe(400);
  });

  describe('columnas y tarjetas', () => {
    let columnId;
    let cardId;

    it('crea una columna (201)', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/columns`)
        .set('Cookie', owner.cookies)
        .send({ name: 'Por hacer' });
      expect(res.status).toBe(201);
      expect(res.body.column.position).toBe(0);
      columnId = res.body.column.id;
    });

    it('rechaza una columna sin nombre (400)', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/columns`)
        .set('Cookie', owner.cookies)
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('crea una tarjeta dentro de la columna (201)', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/cards`)
        .set('Cookie', owner.cookies)
        .send({ column_id: columnId, title: 'Tarjeta de test', description: '' });
      expect(res.status).toBe(201);
      expect(res.body.card.column_id).toBe(columnId);
      cardId = res.body.card.id;
    });

    it('rechaza crear una tarjeta en una columna de otro tablero (400)', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/cards`)
        .set('Cookie', owner.cookies)
        .send({ column_id: columnId + 999999, title: 'No debería crearse' });
      expect(res.status).toBe(400);
    });

    it('edita la tarjeta (PATCH, reemplazo completo)', async () => {
      const res = await request(app)
        .patch(`/api/boards/${boardId}/cards/${cardId}`)
        .set('Cookie', owner.cookies)
        .send({ title: 'Tarjeta editada', description: 'ahora con descripción', due_date: null });
      expect(res.status).toBe(200);
      expect(res.body.card.title).toBe('Tarjeta editada');
    });

    it('el tablero ahora incluye la columna y la tarjeta', async () => {
      const res = await request(app).get(`/api/boards/${boardId}`).set('Cookie', owner.cookies);
      expect(res.body.columns).toHaveLength(1);
      expect(res.body.columns[0].cards).toHaveLength(1);
      expect(res.body.columns[0].cards[0].title).toBe('Tarjeta editada');
    });

    it('reordena la tarjeta a la posición 0 de su misma columna (no-op válido)', async () => {
      const res = await request(app)
        .put(`/api/boards/${boardId}/cards/${cardId}/position`)
        .set('Cookie', owner.cookies)
        .send({ column_id: columnId, position: 0 });
      expect(res.status).toBe(200);
    });

    it('un miembro ajeno no puede borrar la tarjeta (404)', async () => {
      const res = await request(app)
        .delete(`/api/boards/${boardId}/cards/${cardId}`)
        .set('Cookie', outsider.cookies);
      expect(res.status).toBe(404);
    });

    it('borra la tarjeta (204)', async () => {
      const res = await request(app)
        .delete(`/api/boards/${boardId}/cards/${cardId}`)
        .set('Cookie', owner.cookies);
      expect(res.status).toBe(204);
    });

    it('borra la columna (204)', async () => {
      const res = await request(app)
        .delete(`/api/boards/${boardId}/columns/${columnId}`)
        .set('Cookie', owner.cookies);
      expect(res.status).toBe(204);
    });

    it('un :columnId no numérico devuelve 400, no 500 (antes de esta fase no se validaba)', async () => {
      const res = await request(app)
        .delete(`/api/boards/${boardId}/columns/no-es-un-id`)
        .set('Cookie', owner.cookies);
      expect(res.status).toBe(400);
    });
  });
});
