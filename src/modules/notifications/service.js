import { Notification } from './model.js';
import { emitRoom } from '../../sockets/hub.js';

/**
 * @param {unknown} userId
 * @param {{ title: string, body?: string, refType?: string, refId?: string }} input
 */
export async function notifyUser(userId, input) {
  const note = await Notification.create({
    userId,
    title: input.title,
    body: input.body ?? '',
    refType: input.refType ?? '',
    refId: input.refId ?? '',
  });
  const payload = {
    id: String(note._id),
    title: note.title,
    body: note.body,
    read: false,
    createdAt: note.createdAt,
    refType: note.refType,
    refId: note.refId,
  };
  emitRoom(`user:${userId}`, 'notification:new', payload);
  return payload;
}

/**
 * @param {string} userId
 */
export async function listNotifications(userId) {
  const rows = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(30).lean();
  return rows.map((row) => ({
    id: String(row._id),
    title: row.title,
    body: row.body,
    read: Boolean(row.read),
    createdAt: row.createdAt,
    refType: row.refType,
    refId: row.refId,
  }));
}

/**
 * @param {string} userId
 * @param {string} id
 */
export async function markRead(userId, id) {
  await Notification.updateOne({ _id: id, userId }, { read: true });
  return { read: true };
}
