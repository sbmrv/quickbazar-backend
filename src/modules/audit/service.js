import { User } from '../auth/model.js';
import { AuditLog } from './model.js';

/**
 * Record an admin mutation. Call this after the write succeeds.
 * @param {{ actorId: string, action: string, entityType: string, entityId: string, before?: unknown, after?: unknown, ip?: string }} entry
 */
export async function writeAudit(entry) {
  await AuditLog.create({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: String(entry.entityId),
    before: entry.before ?? null,
    after: entry.after ?? null,
    ip: entry.ip ?? '',
  });
}

/**
 * @param {{ page: number, limit: number }} query
 */
export async function listAuditLogs(query) {
  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
    AuditLog.countDocuments(),
  ]);
  const actorIds = [...new Set(rows.map((row) => String(row.actorId)))];
  const actors = await User.find({ _id: { $in: actorIds } })
    .select('name email phone')
    .lean();
  const byId = new Map(actors.map((actor) => [String(actor._id), actor]));

  return {
    rows: rows.map((row) => {
      const actor = byId.get(String(row.actorId));
      return {
        id: String(row._id),
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        before: row.before ?? null,
        after: row.after ?? null,
        ip: row.ip ?? '',
        createdAt: row.createdAt,
        actor: actor
          ? {
              id: String(actor._id),
              name: actor.name ?? '',
              email: actor.email ?? null,
              phone: actor.phone ?? null,
            }
          : { id: String(row.actorId), name: '', email: null, phone: null },
      };
    }),
    meta: { page: query.page, limit: query.limit, total },
  };
}
