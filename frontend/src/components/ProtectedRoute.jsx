import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Envuelve rutas que requieren sesión.
 * - Mientras se restaura la sesión (recarga de página) muestra un loader.
 * - Si no hay sesión, redirige a /login.
 */
export default function ProtectedRoute({ children }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return children;
}
