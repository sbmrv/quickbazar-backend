import { describe, expect, it, vi } from 'vitest';
import { requireRole } from './requireRole.js';

describe('requireRole', () => {
  it('rejects a buyer from an admin-only handler', () => {
    const next = vi.fn();
    requireRole('admin')({ user: { roles: ['buyer'] } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN', status: 403 }));
  });

  it('allows a user who has the role', () => {
    const next = vi.fn();
    requireRole('seller')({ user: { roles: ['buyer', 'seller'] } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
