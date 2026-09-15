import { useEffect, useState } from 'react';
import { fetchComments, createComment } from '../api/comments';
import { socket } from '../socket';

/**
 * Comentarios de una tarjeta (Fase 6). Vive dentro del formulario de edición
 * de Board.jsx, así que su ciclo de vida es corto: se monta al abrir una
 * tarjeta y se desmonta al cerrarla o guardar/cancelar.
 *
 * Tiempo real: escucha 'comment:created' en el socket ya conectado por
 * Board.jsx y agrega el comentario si es de esta tarjeta.
 *
 * Hay DOS caminos que pueden insertar el mismo comentario: la respuesta del
 * propio POST (handleSubmit) y el eco de 'comment:created' (el autor está
 * en la sala del tablero, así que también le llega su propio evento). La
 * respuesta HTTP y el mensaje de socket viajan por canales distintos y no
 * hay garantía de orden entre ellos — en la práctica el socket puede llegar
 * ANTES de que se resuelva el fetch del POST. Por eso ambos caminos insertan
 * de la misma forma seguro-ante-duplicados: comprueban por _id si el
 * comentario ya está en la lista antes de agregarlo, así que gana el que
 * llegue primero y el segundo es un no-op.
 */
function addCommentIfNew(prev, comment) {
  const list = prev ?? [];
  if (list.some((c) => c._id === comment._id)) return list;
  return [...list, comment];
}

export default function CardComments({ boardId, cardId }) {
  const [comments, setComments] = useState(null); // null = cargando
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  // No hace falta resetear `comments` a null aquí: este componente vive
  // dentro de un <li key={card.id}>, así que React lo desmonta/remonta por
  // completo al cambiar de tarjeta en edición (el estado ya nace en null).
  useEffect(() => {
    let cancelled = false;
    fetchComments(boardId, cardId)
      .then((data) => {
        if (!cancelled) setComments(data.comments);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId, cardId]);

  useEffect(() => {
    function handleNewComment(payload) {
      if (payload.cardId !== cardId) return;
      setComments((prev) => (prev ? addCommentIfNew(prev, payload.comment) : prev));
    }
    socket.on('comment:created', handleNewComment);
    return () => socket.off('comment:created', handleNewComment);
  }, [cardId]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const { comment } = await createComment(boardId, cardId, trimmed);
      setComments((prev) => addCommentIfNew(prev, comment));
      setText('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Comentarios</h3>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      {comments === null ? (
        <p className="mb-2 text-xs text-slate-400">Cargando…</p>
      ) : comments.length === 0 ? (
        <p className="mb-2 text-xs text-slate-400">Sin comentarios todavía.</p>
      ) : (
        <ul className="mb-2 max-h-40 space-y-2 overflow-y-auto">
          {comments.map((comment) => (
            <li key={comment._id} className="rounded bg-slate-50 p-2 text-xs">
              <p className="font-medium text-slate-700">{comment.user_name}</p>
              <p className="whitespace-pre-wrap text-slate-600">{comment.text}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          type="text"
          maxLength={2000}
          placeholder="Escribe un comentario…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
