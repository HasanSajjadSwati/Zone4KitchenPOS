import { describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  users: { toArray: vi.fn() },
}));

vi.mock('@/db', () => ({ db }));
vi.mock('@/services/api', () => ({ apiClient: {} }));
vi.mock('@/utils/audit', () => ({ logAudit: vi.fn() }));

import { getAllUsers } from './settingsService';

// The server leaves deleted users out of the plain list, so management shows what it is given
// (inactive users included).
describe('user management list', () => {
  it('shows every user the server lists, inactive ones included', async () => {
    db.users.toArray.mockResolvedValue([
      { id: 'u1', username: 'shiraz', isActive: true },
      { id: 'u2', username: 'usman', isActive: false },
    ]);

    expect((await getAllUsers()).map((u: { id: string }) => u.id)).toEqual(['u1', 'u2']);
  });
});
