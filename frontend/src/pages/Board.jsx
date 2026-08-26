import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  MeasuringStrategy,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  fetchBoard,
  createColumn,
  updateColumn,
  deleteColumn,
  createCard,
  updateCard,
  deleteCard,
  reorderCard,
} from '../api/boards';

/** Contenido visual de una tarjeta (reutilizado por SortableCard y el DragOverlay). */
function CardContent({ card }) {
  return (
    <>
      <p className="text-sm font-medium text-slate-900">{card.title}</p>
      {card.description && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{card.description}</p>
      )}
      {card.due_date && (
        <p className="mt-1.5 text-xs text-slate-400">
          📅 {new Date(`${card.due_date}T00:00:00`).toLocaleDateString()}
        </p>
      )}
    </>
  );
}

/** Tarjeta arrastrable. El id de dnd-kit es String(card.id) para evitar
 *  colisiones number/string; el data lleva column_id para saber de qué columna
 *  viene al soltar. Mientras se arrastra se oculta (opacity-0): el DragOverlay
 *  muestra la copia flotante que sigue al cursor. */
function SortableCard({ card, onStartEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(card.id),
    data: { type: 'card', columnId: card.column_id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li>
      <button
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onStartEdit}
        className={`block w-full rounded-md bg-white p-3 text-left shadow-sm hover:shadow ${
          isDragging ? 'opacity-0' : ''
        }`}
      >
        <CardContent card={card} />
      </button>
    </li>
  );
}

/** Zona de la lista de tarjetas de una columna: permite soltar encima
 *  (si se suelta sobre el hueco vacío, la tarjeta va al final). */
function ColumnCardsDroppable({ columnId, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${columnId}`,
    data: { type: 'column', columnId },
  });

  return (
    <ul
      ref={setNodeRef}
      className={`space-y-2 rounded-md ${isOver ? 'bg-indigo-100/70' : ''}`}
    >
      {children}
    </ul>
  );
}

/**
 * Calcula el movimiento de la tarjeta activa sobre el objetivo `over` en el
 * estado actual de columnas.
 * - Dentro de la misma columna: arrayMove (semántica dnd-kit estándar: la tarjeta
 *   ocupa la posición de la tarjeta sobre la que se suelta).
 * - Entre columnas: quitar de origen e insertar delante de la tarjeta objetivo
 *   (o al final si se suelta sobre el hueco de la columna).
 * Devuelve { columns, targetColId, finalIndex, crossColumn } o null si no hay cambio.
 */
function computeMove(prevColumns, activeId, over) {
  const source = prevColumns.find((c) => c.cards.some((x) => String(x.id) === activeId));
  if (!source) return null;

  let targetColId;
  let overIndex; // null = soltar sobre el hueco de la columna (al final)
  if (over.data.current?.type === 'column') {
    targetColId = over.data.current.columnId;
    overIndex = null;
  } else if (over.data.current?.type === 'card') {
    targetColId = over.data.current.columnId;
    const targetCol = prevColumns.find((c) => c.id === targetColId);
    // Guard: el data de `over` puede quedar obsoleto tras un cambio de layout
    if (!targetCol) return null;
    overIndex = targetCol.cards.findIndex((x) => String(x.id) === over.id);
    if (overIndex === -1) return null;
  } else {
    return null;
  }

  const targetCol = prevColumns.find((c) => c.id === targetColId);
  // Guard de paridad con el caso anterior
  if (!targetCol) return null;
  const sameColumn = source.id === targetColId;

  if (sameColumn) {
    const oldIndex = source.cards.findIndex((x) => String(x.id) === activeId);
    const newIndex = overIndex === null ? source.cards.length - 1 : overIndex;
    if (oldIndex === newIndex) return null;
    const cards = arrayMove(source.cards, oldIndex, newIndex);
    return {
      columns: prevColumns.map((c) => (c.id === source.id ? { ...c, cards } : c)),
      targetColId: source.id,
      finalIndex: newIndex,
      crossColumn: false,
    };
  }

  const rest = source.cards.filter((x) => String(x.id) !== activeId);
  const moved = source.cards.find((x) => String(x.id) === activeId);
  const insertAt = overIndex === null ? targetCol.cards.length : Math.min(overIndex, targetCol.cards.length);
  const targetCards = [
    ...targetCol.cards.slice(0, insertAt),
    { ...moved, column_id: targetColId },
    ...targetCol.cards.slice(insertAt),
  ];
  return {
    columns: prevColumns.map((c) => {
      if (c.id === source.id) return { ...c, cards: rest };
      if (c.id === targetColId) return { ...c, cards: targetCards };
      return c;
    }),
    targetColId,
    finalIndex: insertAt,
    crossColumn: true,
  };
}

/**
 * Tablero (Fase 3 + Fase 4): CRUD completo de columnas/tarjetas y drag & drop
 * con @dnd-kit. Al soltar se actualiza el estado local al instante (optimista)
 * y se persiste con PUT /cards/:id/position; si el servidor falla se revierte
 * recargando el tablero.
 * El estado es local a esta página (decisión de Fase 3; se revisará en Fase 5).
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

  // Tarjeta que se está arrastrando (para el DragOverlay)
  const [activeCard, setActiveCard] = useState(null);

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

  // Tras soltar una tarjeta, el navegador dispara un click sobre el botón
  // (aunque se haya arrastrado): este flag traga UN click después de cada drag
  // para que no se abra el formulario de edición por accidente.
  const dragJustEndedRef = useRef(false);

  // Detección de colisión y estabilidad del `over` (patrón del ejemplo oficial
  // de dnd-kit para múltiples contenedores):
  // - lastOverId: cuando el layout cambia a mitad del drag (nuestro onDragOver
  //   mueve la tarjeta entre columnas), `over` puede volverse null; se devuelve
  //   el último objetivo conocido para que dnd-kit no pierda el `over`.
  const lastOverIdRef = useRef(null);
  const recentlyMovedToNewContainerRef = useRef(false);
  const activeIdRef = useRef(null);

  // Al mover una tarjeta a otra columna el layout se desplaza; pasado un frame
  // ya no hace falta el fallback de lastOverId.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      recentlyMovedToNewContainerRef.current = false;
    });
    return () => cancelAnimationFrame(raf);
  }, [board?.columns]);

  // Función plana (no useCallback): se recrea por render, que es justo lo que
  // dnd-kit necesita aquí porque los rects/columnas cambian con cada render.
  function collisionDetectionStrategy(args) {
      // 1) Droppables que intersecan con el puntero (o fallback por rectángulos)
      const pointerIntersections = pointerWithin(args);
      const intersections =
        pointerIntersections.length > 0 ? pointerIntersections : rectIntersection(args);
      let overId = getFirstCollision(intersections, 'id');

      if (overId != null) {
        // 2) Si el objetivo es una columna CON tarjetas, devolver la tarjeta
        //    más cercana dentro de ella (el hueco exacto donde caerá)
        const overStr = String(overId);
        if (overStr.startsWith('column-')) {
          const columnId = Number(overStr.slice('column-'.length));
          const column = board?.columns.find((c) => c.id === columnId);
          const containerItems = (column?.cards ?? []).map((c) => String(c.id));
          if (containerItems.length > 0) {
            overId = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (container) =>
                  String(container.id) !== overStr &&
                  containerItems.includes(String(container.id))
              ),
            })[0]?.id;
          }
        }
        lastOverIdRef.current = overId;
        return [{ id: overId }];
      }

      // 3) Sin intersección: si acabamos de mover de columna, apuntar al activo;
      //    si no, al último objetivo conocido (evita que over sea null)
      if (recentlyMovedToNewContainerRef.current) {
        lastOverIdRef.current = activeIdRef.current;
      }
      return lastOverIdRef.current ? [{ id: lastOverIdRef.current }] : [];
  }

  const sensors = useSensors(
    // distance 5px: un click normal (sin arrastrar) sigue abriendo la edición
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  /** onClick de las tarjetas: ignora el click que sigue a un drag. */
  function handleCardClick(card) {
    if (dragJustEndedRef.current) {
      dragJustEndedRef.current = false;
      return;
    }
    startEdit(card);
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

  /** Al empezar el arrastre: recordar la tarjeta para el DragOverlay. */
  function onDragStart(event) {
    dragJustEndedRef.current = false;
    const { active } = event;
    activeIdRef.current = active.id;
    const card =
      board.columns.flatMap((c) => c.cards).find((c) => String(c.id) === active.id) ?? null;
    setActiveCard(card);
  }

  /** Durante el arrastre: mover la tarjeta entre columnas en el estado local
   *  para que la columna destino abra hueco y la de origen se cierre
   *  (dentro de la misma columna lo anima la estrategia de sortable sola). */
  function onDragOver(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBoard((prev) => {
      const result = computeMove(prev.columns, active.id, over);
      if (!result || !result.crossColumn) return prev;
      recentlyMovedToNewContainerRef.current = true;
      return { ...prev, columns: result.columns };
    });
  }

  /** Al soltar: aplicar el movimiento final sobre el estado actual (que ya
   *  incorpora los onDragOver predictivos), persistir y limpiar el overlay.
   *  Se persiste SIEMPRE (aunque over sea null): si onDragOver ya había movido
   *  la tarjeta, ese movimiento debe quedar persistido. */
  function onDragEnd(event) {
    dragJustEndedRef.current = true;
    setActiveCard(null);
    const { active, over } = event;

    const result = over ? computeMove(board.columns, active.id, over) : null;
    const columns = result ? result.columns : board.columns;
    if (result) setBoard({ ...board, columns });

    // Localizar la tarjeta en el estado final y persistir su posición
    const col = columns.find((c) => c.cards.some((x) => String(x.id) === active.id));
    if (!col) return;
    const finalIndex = col.cards.findIndex((x) => String(x.id) === active.id);

    reorderCard(boardId, col.cards[finalIndex].id, col.id, finalIndex).catch(async (err) => {
      setActionError(err.message);
      await refresh();
    });
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
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          measuring={{
            droppable: {
              // Re-medir en cada render: los rects cambian cuando onDragOver
              // mueve tarjetas entre columnas (la estrategia por defecto solo
              // mide al iniciar el drag y produce rects obsoletos -> crash)
              strategy: MeasuringStrategy.Always,
            },
          }}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={(event) => {
            onDragEnd(event);
          }}
          onDragCancel={() => {
            dragJustEndedRef.current = true;
            setActiveCard(null);
          }}
        >
          <div className="flex items-start gap-4 overflow-x-auto pb-4">
            {board.columns.map((column) => {
              // La tarjeta en edición sale del SortableContext (se renderiza como formulario)
              const sortableCards = column.cards.filter((c) => editing?.cardId !== c.id);
              return (
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

                  <ColumnCardsDroppable columnId={column.id}>
                    <SortableContext items={sortableCards.map((c) => String(c.id))}>
                      {column.cards.map((card) =>
                        editing?.cardId === card.id ? (
                          <li key={card.id}>
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
                          </li>
                        ) : (
                          <SortableCard key={card.id} card={card} onStartEdit={() => handleCardClick(card)} />
                        )
                      )}
                    </SortableContext>
                  </ColumnCardsDroppable>

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
              );
            })}

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

          {/* Copia flotante de la tarjeta arrastrada: sigue al cursor mientras
              las tarjetas de la columna destino se corren para abrir hueco */}
          <DragOverlay dropAnimation={null}>
            {activeCard ? (
              <div className="w-64 rounded-md bg-white p-3 shadow-xl ring-2 ring-indigo-400">
                <CardContent card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
