/** @type {import('socket.io').Server | null} */
let io = null;

/**
 * @param {import('socket.io').Server} server
 */
export function bindIo(server) {
  io = server;
}

/**
 * @param {string} room
 * @param {string} event
 * @param {unknown} payload
 */
export function emitRoom(room, event, payload) {
  io?.to(room).emit(event, payload);
}
