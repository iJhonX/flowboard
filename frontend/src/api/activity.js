import { apiFetch } from './client';

export function fetchActivity(boardId) {
  return apiFetch(`/api/boards/${boardId}/activity`);
}
