import { apiFetch } from './client';

export function fetchMyTeams() {
  return apiFetch('/api/teams');
}

export function createTeam(name) {
  return apiFetch('/api/teams', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function fetchTeam(teamId) {
  return apiFetch(`/api/teams/${teamId}`);
}

export function inviteMember(teamId, email) {
  return apiFetch(`/api/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function createBoard(teamId, name, description = '') {
  return apiFetch(`/api/teams/${teamId}/boards`, {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}
