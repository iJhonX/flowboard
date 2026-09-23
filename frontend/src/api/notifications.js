import { apiFetch } from './client';

/** `before`: ISO date opcional (Fase 8) — pide la página siguiente a esa fecha. */
export function fetchNotifications(before) {
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  return apiFetch(`/api/notifications${query}`);
}

export function markNotificationsRead() {
  return apiFetch('/api/notifications/mark-read', { method: 'POST' });
}
