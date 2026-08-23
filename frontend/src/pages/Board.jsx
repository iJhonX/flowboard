import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchBoard,
  createColumn,
  updateColumn,
  deleteColumn,
  createCard,
  updateCard,
  deleteCard,
} from '../api/boards';

/**
 * Tablero (Fase 3): columnas + tarjetas con CRUD completo vía formularios,
 * sin drag & drop (eso es Fase 4) y sin recargar la página.
 * El estado es local a esta página: no hace falta store global todavía
 * (decisión de Fase 3; se revisará si Fase 5 lo requiere).
 */
export default function Board() {
  const { boardId } = useParams();

  // board = null mientras carga | { board, columns }
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Añadir columna
  const [showNewColumn, setShowNewColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  // Añadir tarjeta: título por columna (key = columnId)
  const [cardTitles, setCardTitles] = useState({});

  // Edición de tarjeta: cardId + valores del formulario
  const [editing, setEditing] = useState(null);

  // Renombrar columna: columnId + nombre
  const [editingColumn, setEditingColumn] = useState(null);

  // Evita setState tras desmontar (navegación rápida con una mutación en vuelo).
  // OJO: hay que volver a ponerlo en true dentro del effect — StrictMode en
  // desarrollo monta→desmonta→remonta, y si solo se inicializa con useRef(true)
  // el cleanup del primer ciclo lo deja en false para siempre.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchBoard(boardId)
      .then((data) => {
        if (!cancelled) {
          setBoard(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  async function refresh() {
    const data = await fetchBoard(boardId);
    if (!mountedRef.current) return;
    setBoard(data);
    setActionError(null);
  }

  async function handleCreateColumn(e) {
    e.preventDefault();
    setActionError(null);
    try {
      await createColumn(boardId, newColumnName.trim());
      setNewColumnName('');
      setShowNewColumn(false);
      await refresh();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleCreateCard(e, columnId) {
    e.preventDefault();
    const title = cardTitles[columnId]?.trim();
    if (!title) return;
    setActionError(null);
    try {
      await createCard(boardId, columnId, { title });
      setCardTitles((prev) => ({ ...prev, [columnId]: '' }));
      await refresh();
    } catch (err) {
      setActionError(err.message);
    }
  }

  function startEdit(card) {
    setEditing({
      cardId: card.id,
      title: card.title,
      description: card.description ?? '',
      due_date: card.due_date ?? '',
    });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setActionError(null);
    try {
      await updateCard(boardId, editing.cardId, {
        title: editing.title.trim(),
        description: editing.description,
        due_date: editing.due_date || null,
      });
      setEditing(null);
      await refresh();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleDeleteCard(cardId) {
    if (!window.confirm('¿Eliminar esta tarjeta?')) return;
    setActionError(null);
    try {
      await deleteCard(boardId, cardId);
      setEditing(null);
      await refresh();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleDeleteColumn(columnId) {
    if (!window.confirm('¿Eliminar esta columna? Sus tarjetas también se eliminarán.')) return;
    setActionError(null);
    try {
      await deleteColumn(boardId, columnId);
      // Si se estaba editando una tarjeta de esa columna, cerrar la edición
      setEditing(null);
      setEditingColumn(null);
      await refresh();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleRenameColumn(e) {
    e.preventDefault();
    if (!editingColumn) return;
    setActionError(null);
    try {
      await updateColumn(boardId, editingColumn.columnId, editingColumn.name.trim());
      setEditingColumn(null);
      await refresh();
    } catch (err) {
      setActionError(err.message);
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

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to={`/teams/${board.board.team_id}`} className="text-sm text-slate-500 hover:text-slate-700">
              ← Equipo
            </Link>
            <h1 className="text-xl font-semibold text-slate-900">{board.board.name}</h1>
            {board.board.description && (
              <span className="hidden text-sm text-slate-400 sm:inline">{board.board.description}</span>
            )}
          </div>
          <Link to="/health" className="text-sm text-slate-500 hover:text-slate-700">
            Estado del sistema
          </Link>
        </div>
      </header>

      {actionError && (
        <div className="mx-auto mt-4 max-w-5xl px-4">
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          {board.columns.map((column) => (
            <section
              key={column.id}
              className="flex w-72 shrink-0 flex-col rounded-lg bg-slate-200/70 p-3"
            >
              <header className="mb-2 flex items-center justify-between gap-2">
                {editingColumn?.columnId === column.id ? (
                  <form onSubmit={handleRenameColumn} className="flex flex-1 items-center gap-1.5">
                    <input
                      type="text"
                      required
                      maxLength={120}
                      autoFocus
                      value={editingColumn.name}
                      onChange={(e) =>
                        setEditingColumn({ ...editingColumn, name: e.target.value })
                      }
                      className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingColumn(null)}
                      className="rounded px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-300"
                    >
                      ×
                    </button>
                  </form>
                ) : (
                  <>
                    <h2 className="min-w-0 truncate font-medium text-slate-800">{column.name}</h2>
                    <div className="flex shrink-0 items-center">
                      <button
                        onClick={() =>
                          setEditingColumn({ columnId: column.id, name: column.name })
                        }
                        title="Renombrar columna"
                        className="rounded px-1.5 text-slate-400 hover:bg-slate-300 hover:text-slate-700"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDeleteColumn(column.id)}
                        title="Eliminar columna"
                        className="rounded px-1.5 text-slate-400 hover:bg-slate-300 hover:text-slate-700"
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
              </header>

              <ul className="space-y-2">
                {column.cards.map((card) => (
                  <li key={card.id}>
                    {editing?.cardId === card.id ? (
                      <form onSubmit={handleSaveEdit} className="space-y-2 rounded-md bg-white p-3 shadow-sm">
                        <input
                          type="text"
                          required
                          maxLength={200}
                          value={editing.title}
                          onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                        <textarea
                          rows={3}
                          maxLength={5000}
                          placeholder="Descripción (opcional)"
                          value={editing.description}
                          onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                        <input
                          type="date"
                          value={editing.due_date}
                          onChange={(e) => setEditing({ ...editing, due_date: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="rounded px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCard(card.id)}
                            className="ml-auto rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => startEdit(card)}
                        className="block w-full rounded-md bg-white p-3 text-left shadow-sm hover:shadow"
                      >
                        <p className="text-sm font-medium text-slate-900">{card.title}</p>
                        {card.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{card.description}</p>
                        )}
                        {card.due_date && (
                          <p className="mt-1.5 text-xs text-slate-400">
                            📅 {new Date(`${card.due_date}T00:00:00`).toLocaleDateString()}
                          </p>
                        )}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              <form onSubmit={(e) => handleCreateCard(e, column.id)} className="mt-2 flex gap-1.5">
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Nueva tarjeta…"
                  value={cardTitles[column.id] ?? ''}
                  onChange={(e) =>
                    setCardTitles((prev) => ({ ...prev, [column.id]: e.target.value }))
                  }
                  className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!cardTitles[column.id]?.trim()}
                  className="rounded bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                >
                  +
                </button>
              </form>
            </section>
          ))}

          {showNewColumn ? (
            <form
              onSubmit={handleCreateColumn}
              className="flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-slate-200/70 p-3"
            >
              <input
                type="text"
                autoFocus
                required
                maxLength={120}
                placeholder="Nombre de la columna"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Añadir
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewColumn(false)}
                  className="rounded px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowNewColumn(true)}
              className="w-72 shrink-0 rounded-lg border border-dashed border-slate-400 p-3 text-sm text-slate-500 hover:bg-slate-200/50"
            >
              + Añadir columna
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
