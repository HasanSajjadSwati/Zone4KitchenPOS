import { beforeAll, describe, expect, it, vi } from 'vitest';

const sql = vi.hoisted(() => [] as string[]);

vi.mock('./database.js', () => ({
  runAsync: vi.fn(async (q: string) => {
    sql.push(q.replace(/\s+/g, ' ').trim());
    return { rowCount: 0 };
  }),
  allAsync: vi.fn(async () => []),
  getAsync: vi.fn(async () => undefined),
}));

import { initializeDatabase } from './migrate.js';
import { RECYCLE_TABLES } from '../constants/recycle.js';

beforeAll(async () => {
  await initializeDatabase();
});

describe('recycle bin migration', () => {
  it('adds deletedAt, deletedBy and purgedAt to every recycle table', () => {
    for (const table of RECYCLE_TABLES) {
      for (const [col, type] of [['deletedAt', 'TIMESTAMPTZ'], ['deletedBy', 'TEXT'], ['purgedAt', 'TIMESTAMPTZ']]) {
        expect(sql).toContain(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`);
      }
    }
  });

  it('makes the five unique names unique only among live rows', () => {
    const constraints: Array<[string, string]> = [
      ['users', 'users_username_key'],
      ['customers', 'customers_phone_key'],
      ['diningTables', 'diningtables_tablenumber_key'],
      ['employees', 'employees_cnic_key'],
      ['roles', 'roles_name_key'],
    ];
    for (const [table, name] of constraints) {
      expect(sql).toContain(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${name}`);
    }
    const indexes: Array<[string, string, string]> = [
      ['users', 'username', 'uq_users_username_live'],
      ['customers', 'phone', 'uq_customers_phone_live'],
      ['diningTables', 'tableNumber', 'uq_diningTables_tableNumber_live'],
      ['employees', 'cnic', 'uq_employees_cnic_live'],
      ['roles', 'name', 'uq_roles_name_live'],
    ];
    for (const [table, col, idx] of indexes) {
      expect(sql).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS ${idx} ON ${table}(${col}) WHERE deletedAt IS NULL`);
    }
  });

  it('restores usernames renamed by the first user soft delete', () => {
    const restore = "UPDATE users SET username = split_part(username, '.deleted.', 1) WHERE deletedAt IS NOT NULL AND username LIKE '%.deleted.%'";
    const at = sql.indexOf(restore);
    expect(at).toBeGreaterThan(-1);
    const lastIndex = Math.max(...sql.map((s, i) => (s.startsWith('CREATE UNIQUE INDEX') ? i : -1)));
    expect(at).toBeGreaterThan(lastIndex);
  });
});
