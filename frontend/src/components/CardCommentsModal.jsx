import { useEffect } from 'react';

import CardComments from './CardComments';

/**
 * Modal de "solo comentarios" (Fase 6): se abre al hacer click en el
 * contador 💬 de una tarjeta. Deliberadamente NO comparte estado con
 * `editing` (el formulario de título/descripción/fecha de Board.jsx) — ver
 * comentarios y editar la tarjeta son dos acciones distintas, y esta solo
 * debe mostrar comentarios, nunca el formulario de edición.
 */
export default function CardCommentsModal({ boardId, card, onClose }) {
  // Cerrar con Escape, como cualquier modal.
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Comentarios de ${card.title}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Comentarios</p>
            <h2 className="font-semibold text-slate-900">{card.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            className="shrink-0 rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </header>
        <div className="overflow-y-auto p-4">
          <CardComments boardId={boardId} cardId={card.id} />
        </div>
      </div>
    </div>
  );
}
