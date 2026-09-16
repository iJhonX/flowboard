import { apiFetch } from './client';

export function fetchNotifications() {
  return apiFetch('/api/notifications');
}

export function markNotificationsRead() {
  return apiFetch('/api/notifications/mark-read', { method: 'POST' });
}
