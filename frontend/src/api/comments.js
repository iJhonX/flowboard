import { apiFetch } from './client';

export function fetchComments(boardId, cardId) {
  return apiFetch(`/api/boards/${boardId}/cards/${cardId}/comments`);
}

export function createComment(boardId, cardId, text) {
  return apiFetch(`/api/boards/${boardId}/cards/${cardId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}
