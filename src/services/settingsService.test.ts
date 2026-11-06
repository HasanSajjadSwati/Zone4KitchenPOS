import { describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  users: { toArray: vi.fn() },
}));

vi.mock('@/db', () => ({ db }));
vi.mock('@/services/api', () => ({ apiClient: {} }));
vi.mock('@/utils/audit', () => ({ logAudit: vi.fn() }));

import { getAllUsers } from './settingsService';

describe('user management list', () => {
  it('leaves out deleted users but keeps inactive ones', async () => {
    db.users.toArray.mockResolvedValue([
      { id: 'u1', username: 'shiraz', isActive: true, deletedAt: null },
      { id: 'u2', username: 'usman', isActive: false, deletedAt: null },
      { id: 'u3', username: 'fahad.deleted.1', isActive: false, deletedAt: '2026-11-06T12:00:00.000Z' },
    ]);

    expect((await getAllUsers()).map((u: { id: string }) => u.id)).toEqual(['u1', 'u2']);
  });
});
