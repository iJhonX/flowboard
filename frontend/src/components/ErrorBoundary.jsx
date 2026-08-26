import { Component } from 'react';

/**
 * Red de seguridad global: si un render lanza una excepción no capturada,
 * React desmonta todo el árbol y la página queda en blanco. Con este boundary
 * se muestra el mensaje real (y un botón de recarga) en vez de la pantalla
 * blanca, y se loguea el error a consola para poder diagnosticarlo.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error capturado por el ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
          <p className="text-lg font-semibold text-slate-900">Algo salió mal</p>
          <p className="max-w-md break-all px-4 text-center text-sm text-red-600">
            {String(this.state.error)}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
