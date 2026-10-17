/**
 * @param {import('express').Request} req
 */
export function actorFrom(req) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  return { actorId: req.user.id, ip: String(ip).replace(/^::ffff:/, '') };
}

export const objectId = /^[a-f0-9]{24}$/i;
