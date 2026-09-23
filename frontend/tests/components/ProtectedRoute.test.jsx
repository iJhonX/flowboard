import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../src/components/ProtectedRoute';

// Se mockea el hook, no fetch/cookies: ProtectedRoute solo le importa el
// campo `status` que expone useAuth, así que probar sus 3 estados no
// necesita simular una sesión real.
const mockUseAuth = vi.fn();
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/tablero-privado']}>
      <Routes>
        <Route path="/login" element={<p>Página de login</p>} />
        <Route
          path="/tablero-privado"
          element={
            <ProtectedRoute>
              <p>Contenido protegido</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('muestra un loader mientras se restaura la sesión', () => {
    mockUseAuth.mockReturnValue({ status: 'loading' });
    renderProtected();
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('redirige a /login si no hay sesión', () => {
    mockUseAuth.mockReturnValue({ status: 'unauthenticated' });
    renderProtected();
    expect(screen.getByText('Página de login')).toBeInTheDocument();
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
  });

  it('muestra el contenido protegido si hay sesión', () => {
    mockUseAuth.mockReturnValue({ status: 'authenticated' });
    renderProtected();
    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
  });
});
