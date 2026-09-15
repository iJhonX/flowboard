import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

/**
 * Instancia única compartida por toda la app. `autoConnect: false`: la
 * primera pantalla que necesite tiempo real (por ahora solo Board.jsx)
 * conecta bajo demanda, en vez de abrir la conexión antes de que haga falta.
 * `withCredentials: true` envía la cookie httpOnly del access token en el
 * handshake (mismo mecanismo de sesión que `apiFetch`).
 *
 * A partir de esa primera conexión, el socket se queda conectado durante
 * toda la sesión (Board.jsx solo entra/sale de la SALA del tablero al
 * montarse/desmontarse, nunca llama a `disconnect()`) — ver el comentario en
 * Board.jsx para el porqué: desconectar y reconectar en cada montaje es
 * una condición de carrera bajo StrictMode.
 */
export const socket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: false,
});
