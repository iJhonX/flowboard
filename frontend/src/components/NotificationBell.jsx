import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchNotifications, markNotificationsRead } from '../api/notifications';
import { socket } from '../socket';

/**
 * Campanita de notificaciones (Fase 7): se agrega en el header de Home,
 * TeamDetail y Board porque una mención/asignación puede pasar en un
 * tablero que el usuario no tiene abierto — a diferencia de Actividad
 * (Fase 6), que es por tablero, esto es personal y tiene que verse desde
 * cualquier pantalla.
 *
 * Llama a socket.connect() igual que Board.jsx (idempotente si ya está
 * conectado, ver socket.js) y se une automáticamente a su sala personal
 * en el servidor (sockets/index.js) sin necesidad de un evento `join`.
 */
export default function NotificationBell() {
  const [notifications, setNotifications] = useState(null); // null = cargando
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    socket.connect();
    let cancelled = false;
    fetchNotifications()
      .then((data) => {
        if (!cancelled) setNotifications(data.notifications);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleNew(notification) {
      setNotifications((prev) => {
        if (!prev) return prev;
        if (prev.some((n) => n._id === notification._id)) return prev;
        return [notification, ...prev];
      });
    }
    socket.on('notification:created', handleNew);
    return () => socket.off('notification:created', handleNew);
  }, []);

  // Cerrar al clickear afuera o con Escape (mismo patrón que CardCommentsModal).
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  // Abrir el panel marca todo como leído, igual que Slack/Trello — sin
  // endpoint por notificación individual, solo esta acción masiva.
  async function handleToggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && unreadCount > 0) {
      setNotifications((prev) => prev?.map((n) => ({ ...n, read: true })));
      try {
        await markNotificationsRead();
      } catch (err) {
        setError(err.message);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        title="Notificaciones"
        className="relative rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-xl">
          <header className="border-b border-slate-200 px-4 py-2">
            <h2 className="text-sm font-semibold text-slate-800">Notificaciones</h2>
          </header>
          <div className="max-h-96 overflow-y-auto">
            {error && <p className="p-4 text-xs text-red-600">{error}</p>}
            {notifications === null ? (
              <p className="p-4 text-xs text-slate-400">Cargando…</p>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-xs text-slate-400">No tenés notificaciones todavía.</p>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n._id} className="border-b border-slate-100 last:border-0">
                    <Link
                      to={`/boards/${n.board_id}`}
                      onClick={() => setOpen(false)}
                      className={`block px-4 py-2.5 text-sm hover:bg-slate-50 ${
                        n.read ? 'text-slate-500' : 'text-slate-800'
                      }`}
                    >
                      <p>{n.message}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
