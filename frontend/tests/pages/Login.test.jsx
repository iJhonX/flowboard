import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from '../../src/pages/Login';

const mockLogin = vi.fn();
let mockUser = null;

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, login: mockLogin }),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<p>Home protegido</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Login', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockUser = null;
  });

  it('envía email y contraseña al hacer submit y navega a "/" si el login funciona', async () => {
    mockLogin.mockResolvedValue({ id: 1, name: 'Test' });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'Test1234!');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'Test1234!');
    expect(await screen.findByText('Home protegido')).toBeInTheDocument();
  });

  it('muestra el mensaje de error si el login falla, sin navegar', async () => {
    mockLogin.mockRejectedValue(new Error('Credenciales inválidas'));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'contraseñaIncorrecta');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument();
    expect(screen.queryByText('Home protegido')).not.toBeInTheDocument();
  });

  it('si ya hay una sesión activa, redirige directo a "/" sin mostrar el formulario', () => {
    mockUser = { id: 1, name: 'Ya logueado' };
    renderLogin();
    expect(screen.getByText('Home protegido')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });
});
