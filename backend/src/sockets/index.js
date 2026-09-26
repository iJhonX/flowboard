import { Server } from 'socket.io';
import { parseCookie } from 'cookie';
import { ACCESS_TOKEN_COOKIE, verifyToken } from '../utils/tokens.js';
import { findBoardIfMember } from '../middleware/requireBoardMember.js';

let io = null;

function boardRoom(boardId) {
  return `board:${boardId}`;
}

// Sala personal (Fase 7): a diferencia de `board:<id>`, a esta se une
// automáticamente CUALQUIER socket autenticado, sin pasar por un evento
// `join` — las notificaciones son del usuario, no de un tablero abierto,
// así que tienen que llegarle sin importar en qué pantalla esté.
function userRoom(userId) {
  return `user:${userId}`;
}

/**
 * Autentica el handshake leyendo la misma cookie httpOnly que usa la API
 * REST (ACCESS_TOKEN_COOKIE). No hay refresh sobre el socket: si el access
 * token expira, la conexión ya establecida sigue activa (solo se valida al
 * conectar, como es habitual en socket.io) — el cliente reconecta con un
 * token fresco cada vez que Board.jsx se monta.
 */
function authenticateSocket(socket, next) {
  try {
    const cookies = parseCookie(socket.request.headers.cookie ?? '');
    const token = cookies[ACCESS_TOKEN_COOKIE];
    if (!token) {
      return next(new Error('No autenticado'));
    }
    const payload = verifyToken(token, process.env.JWT_SECRET);
    socket.userId = payload.sub;
    next();
  } catch {
    next(new Error('No autenticado'));
  }
}

/**
 * Inicializa Socket.io sobre el mismo servidor HTTP que Express.
 * Una sala por tablero (`board:<id>`): el cliente se une al abrir el
 * tablero y se sale al cerrarlo. Se re-verifica membresía al unirse
 * (mismo criterio que requireBoardMember) porque el cliente puede emitir
 * `board:join` con cualquier id, sin pasar por la ruta REST.
 */
export function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL?.replace(/\/$/, ''), credentials: true },
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    socket.join(userRoom(socket.userId));

    socket.on('board:join', async (boardId, callback) => {
      const id = Number(boardId);
      if (!Number.isInteger(id) || id <= 0) {
        return callback?.({ ok: false, error: 'ID de tablero inválido' });
      }
      try {
        const board = await findBoardIfMember(socket.userId, id);
        if (!board) {
          return callback?.({ ok: false, error: 'Tablero no encontrado o no eres miembro' });
        }
        socket.join(boardRoom(id));
        callback?.({ ok: true });
      } catch {
        callback?.({ ok: false, error: 'Error al unirse al tablero' });
      }
    });

    socket.on('board:leave', (boardId) => {
      socket.leave(boardRoom(Number(boardId)));
    });
  });

  return io;
}

/** Emite un evento a todos los clientes unidos a la sala de un tablero. */
export function emitToBoard(boardId, event, payload) {
  io?.to(boardRoom(boardId)).emit(event, payload);
}

/** Emite un evento a todas las conexiones (pestañas) de un usuario. */
export function emitToUser(userId, event, payload) {
  io?.to(userRoom(userId)).emit(event, payload);
}
