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

import { normalizeRowKeys } from './database.js';

describe('normalizeRowKeys', () => {
  it('maps the new soft-delete columns to camelCase', () => {
    expect(normalizeRowKeys({ deletedat: 'x', deletedby: 'u', purgedat: null })).toEqual({
      deletedAt: 'x',
      deletedBy: 'u',
      purgedAt: null,
    });
  });
});
