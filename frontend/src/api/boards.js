import { apiFetch } from './client';

export function fetchBoard(boardId) {
  return apiFetch(`/api/boards/${boardId}`);
}

export function createColumn(boardId, name) {
  return apiFetch(`/api/boards/${boardId}/columns`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function updateColumn(boardId, columnId, name) {
  return apiFetch(`/api/boards/${boardId}/columns/${columnId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function deleteColumn(boardId, columnId) {
  return apiFetch(`/api/boards/${boardId}/columns/${columnId}`, { method: 'DELETE' });
}

export function createCard(boardId, columnId, { title, description = '', due_date = null }) {
  return apiFetch(`/api/boards/${boardId}/cards`, {
    method: 'POST',
    body: JSON.stringify({ column_id: columnId, title, description, due_date }),
  });
}

export function updateCard(boardId, cardId, { title, description, due_date }) {
  return apiFetch(`/api/boards/${boardId}/cards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title, description, due_date }),
  });
}

export function deleteCard(boardId, cardId) {
  return apiFetch(`/api/boards/${boardId}/cards/${cardId}`, { method: 'DELETE' });
}

/** Reordenar tarjeta (Fase 4): columna destino + índice 0-based. */
export function reorderCard(boardId, cardId, columnId, position) {
  return apiFetch(`/api/boards/${boardId}/cards/${cardId}/position`, {
    method: 'PUT',
    body: JSON.stringify({ column_id: columnId, position }),
  });
}

/** Borrar tablero completo (Fase 7) — owner/admin. */
export function deleteBoard(boardId) {
  return apiFetch(`/api/boards/${boardId}`, { method: 'DELETE' });
}

/** Asignar/desasignar miembros del equipo a una tarjeta (Fase 7). */
export function assignCard(boardId, cardId, userId) {
  return apiFetch(`/api/boards/${boardId}/cards/${cardId}/assignees`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

export function unassignCard(boardId, cardId, userId) {
  return apiFetch(`/api/boards/${boardId}/cards/${cardId}/assignees/${userId}`, {
    method: 'DELETE',
  });
}
