import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchMyTeams, createTeam } from '../api/teams';

/**
 * Dashboard de la Fase 2: lista mis equipos y permite crear uno nuevo.
 * (En Fases posteriores se convierte en la vista general de tableros.)
 */
export default function Home() {
  const { user, logout } = useAuth();
  const [teams, setTeams] = useState(null); // null = cargando
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  async function loadTeams() {
    try {
      const { teams: list } = await fetchMyTeams();
      setTeams(list);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchMyTeams()
      .then(({ teams: list }) => {
        if (!cancelled) {
          setTeams(list);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setTeams([]);
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateTeam(e) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createTeam(name);
      setName('');
      await loadTeams();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-semibold text-slate-900">FlowBoard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">Hola, {user.name}</span>
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

      <main className="mx-auto max-w-3xl px-4 py-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Crear equipo</h2>
          <form onSubmit={handleCreateTeam} className="mt-3 flex gap-3">
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              placeholder="Nombre del equipo (ej. Equipo Rocket)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? 'Creando…' : 'Crear equipo'}
            </button>
          </form>
          {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Mis equipos</h2>

          {teams === null && <p className="mt-3 text-sm text-slate-500">Cargando…</p>}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {teams !== null && !error && teams.length === 0 && (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
              Aún no tienes equipos. Crea el primero arriba ☝️
            </p>
          )}

          {teams !== null && teams.length > 0 && (
            <ul className="mt-3 space-y-2">
              {teams.map((team) => (
                <li key={team.id}>
                  <Link
                    to={`/teams/${team.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-indigo-300 hover:shadow-sm"
                  >
                    <span className="font-medium text-slate-900">{team.name}</span>
                    <span className="text-xs text-slate-400">
                      {team.member_count} miembro{team.member_count === 1 ? '' : 's'} · {team.my_role}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
