import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

/**
 * Instancia única compartida por toda la app. `autoConnect: false`: cada
 * pantalla que necesite tiempo real (por ahora solo Board.jsx) conecta al
 * montarse y desconecta al desmontarse, en vez de mantener una conexión
 * abierta durante toda la sesión sin usarla.
 * `withCredentials: true` envía la cookie httpOnly del access token en el
 * handshake (mismo mecanismo de sesión que `apiFetch`).
 */
export const socket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: false,
});
