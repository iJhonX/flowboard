import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchTeam, inviteMember, createBoard } from '../api/teams';

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Miembro' };

/**
 * Detalle de un equipo (Fase 2): miembros, tableros, crear tablero e invitar.
 * Si el usuario no es miembro, el API devuelve 404 y se muestra el error.
 */
export default function TeamDetail() {
  const { teamId } = useParams();
  const [detail, setDetail] = useState(null); // null = cargando
  const [error, setError] = useState(null);

  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [boardError, setBoardError] = useState(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);

  const canInvite = detail?.team && ['owner', 'admin'].includes(detail.myRole);

  async function load() {
    try {
      const data = await fetchTeam(teamId);
      setDetail({
        team: data.team,
        members: data.members,
        boards: data.boards,
        myRole: data.myRole,
      });
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchTeam(teamId)
      .then((data) => {
        if (!cancelled) {
          setDetail({
            team: data.team,
            members: data.members,
            boards: data.boards,
            myRole: data.myRole,
          });
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  async function handleCreateBoard(e) {
    e.preventDefault();
    setBoardError(null);
    setCreatingBoard(true);
    try {
      await createBoard(teamId, boardName, boardDescription);
      setBoardName('');
      setBoardDescription('');
      await load();
    } catch (err) {
      setBoardError(err.message);
    } finally {
      setCreatingBoard(false);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviteError(null);
    setInviting(true);
    try {
      await inviteMember(teamId, inviteEmail);
      setInviteEmail('');
      await load();
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <p className="text-red-600">{error}</p>
        <Link to="/" className="mt-4 text-sm text-indigo-600 hover:underline">
          ← Volver a mis equipos
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">
              ← Mis equipos
            </Link>
            <h1 className="text-xl font-semibold text-slate-900">{detail.team.name}</h1>
          </div>
          <Link to="/health" className="text-sm text-slate-500 hover:text-slate-700">
            Estado del sistema
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Crear tablero</h2>
          <form onSubmit={handleCreateBoard} className="mt-3 space-y-3">
            <input
              type="text"
              required
              maxLength={120}
              placeholder="Nombre del tablero (ej. Sprint 1)"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <input
              type="text"
              maxLength={500}
              placeholder="Descripción (opcional)"
              value={boardDescription}
              onChange={(e) => setBoardDescription(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={creatingBoard}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {creatingBoard ? 'Creando…' : 'Crear tablero'}
            </button>
          </form>
          {boardError && <p className="mt-2 text-sm text-red-600">{boardError}</p>}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Tableros</h2>
          {detail.boards.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
              Este equipo aún no tiene tableros.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {detail.boards.map((board) => (
                <li key={board.id}>
                  <Link
                    to={`/boards/${board.id}`}
                    className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-indigo-300 hover:shadow-sm"
                  >
                    <p className="font-medium text-slate-900">{board.name}</p>
                    {board.description && (
                      <p className="mt-0.5 text-sm text-slate-500">{board.description}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                      Creado el {new Date(board.created_at).toLocaleDateString()} · Abrir tablero →
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Miembros ({detail.members.length})</h2>
          <ul className="mt-3 space-y-2">
            {detail.members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{member.name}</p>
                  <p className="text-sm text-slate-500">{member.email}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {ROLE_LABELS[member.role] ?? member.role}
                </span>
              </li>
            ))}
          </ul>

          {canInvite ? (
            <form onSubmit={handleInvite} className="mt-4 flex gap-3">
              <input
                type="email"
                required
                placeholder="Email del miembro a invitar"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={inviting}
                className="rounded-md border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
              >
                {inviting ? 'Invitando…' : 'Invitar'}
              </button>
            </form>
          ) : (
            <p className="mt-4 text-xs text-slate-400">
              Solo el owner o un admin pueden invitar miembros.
            </p>
          )}
          {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
        </section>
      </main>
    </div>
  );
}
