import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../../src/components/ErrorBoundary';

function Bomb() {
  throw new Error('Boom de prueba');
}

describe('ErrorBoundary', () => {
  it('renderiza los hijos normalmente cuando no hay error', () => {
    render(
      <ErrorBoundary>
        <p>Contenido normal</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('Contenido normal')).toBeInTheDocument();
  });

  it('muestra el mensaje de error y un botón de recarga si un hijo explota', () => {
    // React loguea el error del render a console.error por defecto; se
    // silencia acá para que el test no ensucie la salida (ya se afirma que
    // el propio boundary lo loguea con su console.error explícito).
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(screen.getByText(/Boom de prueba/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar página' })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
