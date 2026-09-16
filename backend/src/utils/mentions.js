// Detecta menciones tipo @email en un comentario (Fase 7). Se elige el
// email como formato de mención (en vez de "@Nombre") porque es el único
// dato de un usuario que es único en el sistema (users.email UNIQUE) — un
// nombre puede repetirse entre miembros del equipo y sería ambiguo a quién
// notificar. Es menos cómodo de escribir que un "@nombre" con autocompletar,
// pero eso pediría un sistema de @usernames que no existe en este esquema;
// se documenta como simplificación aceptada para el alcance del proyecto.
const MENTION_REGEX = /@([\w.+-]+@[\w-]+\.[\w.-]+)/g;

/** Devuelve los emails mencionados en `text`, sin duplicados y en minúsculas. */
export function extractMentionedEmails(text) {
  const matches = text.matchAll(MENTION_REGEX);
  const emails = [...matches].map((m) => m[1].toLowerCase());
  return [...new Set(emails)];
}
