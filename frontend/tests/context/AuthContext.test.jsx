import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';

const mockFetchMe = vi.fn();
const mockLoginRequest = vi.fn();
const mockLogoutRequest = vi.fn();

vi.mock('../../src/api/auth', () => ({
  fetchMe: (...args) => mockFetchMe(...args),
  login: (...args) => mockLoginRequest(...args),
  register: vi.fn(),
  logout: (...args) => mockLogoutRequest(...args),
}));

const mockSocketDisconnect = vi.fn();
vi.mock('../../src/socket', () => ({
  socket: { disconnect: (...args) => mockSocketDisconnect(...args) },
}));

/** Componente de prueba: expone el estado de useAuth como texto + botones. */
function Probe() {
  const { user, status, login, logout } = useAuth();
  return (
    <div>
      <p>status:{status}</p>
      <p>user:{user ? user.name : 'ninguno'}</p>
      <button onClick={() => login('a@example.com', 'Test1234!')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockFetchMe.mockReset();
    mockLoginRequest.mockReset();
    mockLogoutRequest.mockReset();
    mockSocketDisconnect.mockReset();
  });

  it('restaura la sesión con /me al montar si hay cookie válida', async () => {
    mockFetchMe.mockResolvedValue({ user: { id: 1, name: 'Restaurado' } });
    renderProbe();

    expect(screen.getByText('status:loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('status:authenticated')).toBeInTheDocument());
    expect(screen.getByText('user:Restaurado')).toBeInTheDocument();
  });

  it('si /me falla (401), queda unauthenticated sin usuario', async () => {
    mockFetchMe.mockRejectedValue(new Error('No autenticado'));
    renderProbe();
    await waitFor(() => expect(screen.getByText('status:unauthenticated')).toBeInTheDocument());
    expect(screen.getByText('user:ninguno')).toBeInTheDocument();
  });

  it('login() llama a la API y actualiza user/status', async () => {
    mockFetchMe.mockRejectedValue(new Error('No autenticado'));
    mockLoginRequest.mockResolvedValue({ user: { id: 2, name: 'Logueado' } });
    const user = userEvent.setup();
    renderProbe();

    await waitFor(() => expect(screen.getByText('status:unauthenticated')).toBeInTheDocument());
    await user.click(screen.getByText('Login'));

    expect(mockLoginRequest).toHaveBeenCalledWith('a@example.com', 'Test1234!');
    await waitFor(() => expect(screen.getByText('status:authenticated')).toBeInTheDocument());
    expect(screen.getByText('user:Logueado')).toBeInTheDocument();
  });

  it('logout() limpia la sesión y desconecta el socket', async () => {
    mockFetchMe.mockResolvedValue({ user: { id: 1, name: 'Alguien' } });
    mockLogoutRequest.mockResolvedValue();
    const user = userEvent.setup();
    renderProbe();

    await waitFor(() => expect(screen.getByText('status:authenticated')).toBeInTheDocument());
    await user.click(screen.getByText('Logout'));

    expect(mockLogoutRequest).toHaveBeenCalled();
    // Ver AuthContext.jsx: logout() desconecta el socket a propósito, si no
    // un usuario distinto que inicia sesión en la misma pestaña se queda
    // sin notificaciones en vivo (bug real de Fase 7, ya documentado ahí).
    expect(mockSocketDisconnect).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('status:unauthenticated')).toBeInTheDocument());
    expect(screen.getByText('user:ninguno')).toBeInTheDocument();
  });
});
