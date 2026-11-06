import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
});

vi.mock('pg', () => {
  class Pool {
    query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    on = vi.fn();
    connect = vi.fn();
    end = vi.fn();
  }
  return { default: { Pool, types: { setTypeParser: vi.fn() } }, Pool };
});

import { db, normalizeRowKeys, withTransaction } from './database.js';

describe('normalizeRowKeys', () => {
  it('maps the new soft-delete columns to camelCase', () => {
    expect(normalizeRowKeys({ deletedat: 'x', deletedby: 'u', purgedat: null })).toEqual({
      deletedAt: 'x',
      deletedBy: 'u',
      purgedAt: null,
    });
  });
});

describe('withTransaction', () => {
  it('gives the callback allAsync, returning every row with camelCase keys', async () => {
    const client = {
      query: vi.fn(async (sql: string) =>
        sql.startsWith('SELECT')
          ? { rows: [{ deletedat: 'x', isactive: 1 }, { deletedat: null, isactive: 0 }], rowCount: 2 }
          : { rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    (db.connect as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const rows = await withTransaction((tx) => tx.allAsync('SELECT deletedAt, isActive FROM waiters WHERE id = ?', ['w1']));

    expect(rows).toEqual([{ deletedAt: 'x', isActive: true }, { deletedAt: null, isActive: false }]);
    expect(client.query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      'SELECT deletedAt, isActive FROM waiters WHERE id = $1',
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalled();
  });
});
