import { useEffect, useState } from 'react';
import { fetchActivity } from '../api/activity';
import { socket } from '../socket';

// Mismos eventos que mutan el tablero (ver BOARD_SOCKET_EVENTS en Board.jsx)
// más 'comment:created', que no cambia el tablero pero sí genera una entrada
// de actividad.
const ACTIVITY_SOCKET_EVENTS = [
  'column:created',
  'column:updated',
  'column:deleted',
  'card:created',
  'card:updated',
  'card:deleted',
  'card:moved',
  'comment:created',
];

/** Mensaje legible por tipo de acción. metadata la arma boards.controller.js. */
function describeActivity(entry) {
  const { action_type: type, metadata = {} } = entry;
  switch (type) {
    case 'column_created':
      return `creó la columna "${metadata.columnName}"`;
    case 'column_updated':
      return `renombró una columna a "${metadata.columnName}"`;
    case 'column_deleted':
      return `eliminó una columna`;
    case 'card_created':
      return `creó la tarjeta "${metadata.title}"`;
    case 'card_updated':
      return `editó la tarjeta "${metadata.title}"`;
    case 'card_deleted':
      return `eliminó la tarjeta "${metadata.title}"`;
    case 'card_moved':
      return `movió la tarjeta "${metadata.title}"`;
    case 'comment_created':
      return `comentó en "${metadata.cardTitle}": "${metadata.preview}"`;
    default:
      return type;
  }
}

/**
 * Panel lateral con el feed de actividad del tablero (Fase 6). Solo hace
 * fetch mientras está abierto (`open`); mientras lo está, se refresca ante
 * cualquier evento del socket que genere una entrada nueva — mismo patrón
 * "refetch completo, sin merge" que usa Board.jsx para las columnas/tarjetas.
 */
export default function ActivityFeed({ boardId, open, onClose }) {
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    function load() {
      fetchActivity(boardId)
        .then((data) => {
          if (!cancelled) {
            setActivity(data.activity);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err.message);
        });
    }

    load();
    ACTIVITY_SOCKET_EVENTS.forEach((event) => socket.on(event, load));

    return () => {
      cancelled = true;
      ACTIVITY_SOCKET_EVENTS.forEach((event) => socket.off(event, load));
    };
  }, [open, boardId]);

  if (!open) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-10 flex w-80 flex-col border-l border-slate-200 bg-white shadow-xl">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-slate-800">Actividad</h2>
        <button
          onClick={onClose}
          className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ×
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {activity === null ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no hay actividad en este tablero.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((entry) => (
              <li key={entry._id} className="text-sm">
                <p className="text-slate-700">
                  <span className="font-medium">{entry.user_name}</span>{' '}
                  {describeActivity(entry)}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(entry.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
