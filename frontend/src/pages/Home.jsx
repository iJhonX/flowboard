import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Página protegida de ejemplo (Fase 1).
 * En fases siguientes se convierte en el dashboard con los equipos del usuario.
 */
export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-semibold text-slate-900">FlowBoard</h1>
          <div className="flex items-center gap-4">
            <Link to="/health" className="text-sm text-slate-500 hover:text-slate-700">
              Estado del sistema
            </Link>
            <button
              onClick={logout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-2xl font-semibold text-slate-900">¡Hola, {user.name}! 👋</h2>
        <p className="mt-2 text-slate-600">
          Has iniciado sesión como <span className="font-medium">{user.email}</span>.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Esta es una página protegida: solo es visible con una sesión activa. Si recargas la
          página, la sesión se restaura automáticamente desde la cookie httpOnly.
        </p>

        <div className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          En la Fase 2 aparecerán aquí tus equipos y tableros.
        </div>
      </main>
    </div>
  );
}
