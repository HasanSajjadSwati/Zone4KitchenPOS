import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RECYCLE_TABLES } from '../constants/recycle';
import type { RecycleType } from './registry';

// ---------------------------------------------------------------------------------------------
// In-memory fake of database.js. It does not pattern-match the service's SQL text: it evaluates
// the small SQL subset the registry and the service use (SELECT with WHERE a AND b, one JOIN,
// COUNT(*), DISTINCT, IN, FOR UPDATE; UPDATE ... SET col = ?/NULL WHERE id = ?; DELETE; the audit
// INSERT) against per-table row arrays, and throws on anything else. It also enforces what the
// live Postgres database would: boolean columns reject integers, the auditLogs NOT NULL / FK /
// CHECK rules, foreign keys on DELETE, the live-only unique indexes, writes only inside a
// transaction on a row that transaction locked FOR UPDATE, and rollback when the callback throws.
// ---------------------------------------------------------------------------------------------

type Row = Record<string, any>;

const fake = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));

const TABLES = [
  'roles', 'users', 'categories', 'menuItems', 'variants', 'variantOptions', 'menuItemVariants',
  'deals', 'dealItems', 'dealVariants', 'customers', 'waiters', 'riders', 'diningTables', 'employees',
  'employeeLoans', 'expenses', 'orders', 'pastOrders', 'orderItems', 'pastOrderItems', 'payments',
  'pastPayments', 'auditLogs', 'registerSessions', 'kotPrints', 'riderReceipts',
];

// The live auditLogs table: userId is NOT NULL (FK to users) and action must be one of these.
const AUDIT_ACTIONS = ['create', 'update', 'delete', 'print', 'export', 'login', 'logout', 'backup', 'restore', 'wipe', 'import'];

// BOOLEAN in Postgres, which rejects an integer literal or an integer parameter there.
const BOOLEAN_COLUMNS = ['isActive', 'isPaid', 'isDealOnly', 'hasVariants', 'isRequired'];

// [child table, column, parent table] — checked when a parent row is deleted.
const FOREIGN_KEYS: Array<[string, string, string]> = [
  ['menuItems', 'categoryId', 'categories'], ['deals', 'categoryId', 'categories'], ['categories', 'parentId', 'categories'],
  ['menuItemVariants', 'menuItemId', 'menuItems'], ['menuItemVariants', 'variantId', 'variants'],
  ['dealItems', 'dealId', 'deals'], ['dealItems', 'menuItemId', 'menuItems'],
  ['dealVariants', 'dealId', 'deals'], ['dealVariants', 'variantId', 'variants'], ['variantOptions', 'variantId', 'variants'],
  ['orderItems', 'menuItemId', 'menuItems'], ['orderItems', 'dealId', 'deals'],
  ['orders', 'tableId', 'diningTables'], ['orders', 'waiterId', 'waiters'], ['orders', 'riderId', 'riders'],
  ['orders', 'customerId', 'customers'], ['orders', 'createdBy', 'users'], ['orders', 'completedBy', 'users'],
  ['users', 'roleId', 'roles'], ['auditLogs', 'userId', 'users'], ['payments', 'receivedBy', 'users'],
];

// Unique indexes that apply only among live rows (WHERE deletedAt IS NULL).
const LIVE_UNIQUE: Array<[string, string]> = [
  ['users', 'username'], ['customers', 'phone'], ['diningTables', 'tableNumber'], ['employees', 'cnic'], ['roles', 'name'],
];

interface Tx { locks: Set<string>; statements: number }
interface Result { rows: Row[]; rowCount: number }

function tableRows(name: string): Row[] {
  const rows = fake.tables[name];
  if (!rows) throw new Error(`relation "${name}" does not exist`);
  return rows;
}

type Getter = (alias?: string) => Row;
type Condition = (get: Getter, params: any[]) => boolean;

function parseWhere(where: string): Condition {
  let next = 0;
  const conditions: Condition[] = where.split(' AND ').map((part) => {
    let m = /^(?:(\w+)\.)?(\w+) IS (NOT )?NULL$/.exec(part);
    if (m) {
      const [, alias, col, not] = m;
      return (get) => (not ? get(alias)[col] != null : get(alias)[col] == null);
    }
    m = /^(?:(\w+)\.)?(\w+) = '([^']*)'$/.exec(part);
    if (m) {
      const [, alias, col, literal] = m;
      return (get) => get(alias)[col] === literal;
    }
    m = /^(?:(\w+)\.)?(\w+) (=|<>) \?$/.exec(part);
    if (m) {
      const [, alias, col, op] = m;
      const at = next++;
      return (get, params) => (op === '=' ? get(alias)[col] === params[at] : get(alias)[col] !== params[at]);
    }
    m = /^(?:(\w+)\.)?(\w+) IN \(\?(?:, \?)*\)$/.exec(part);
    if (m) {
      const [, alias, col] = m;
      const at = next;
      const count = (part.match(/\?/g) ?? []).length;
      next += count;
      return (get, params) => params.slice(at, at + count).includes(get(alias)[col]);
    }
    throw new Error(`fake db: unsupported condition "${part}"`);
  });
  return (get, params) => conditions.every((c) => c(get, params));
}

const SELECT_RE =
  /^SELECT (DISTINCT )?(.+?) FROM (\w+)(?: (\w+))?(?: JOIN (\w+) (\w+) ON (\w+)\.(\w+) = (\w+)\.(\w+))? WHERE (.+?)( FOR UPDATE)?$/;

function select(text: string, params: any[], tx: Tx | null): Row[] {
  const m = SELECT_RE.exec(text);
  if (!m) throw new Error(`Unexpected SQL in test: ${text}`);
  const [, distinct, list, table, alias, joinTable, joinAlias, la, lc, ra, rc, where, forUpdate] = m;
  const baseAlias = alias ?? table;

  let contexts: Array<Record<string, Row>> = tableRows(table).map((r) => ({ [baseAlias]: r }));
  if (joinTable) {
    contexts = contexts
      .flatMap((c) => tableRows(joinTable).map((j) => ({ ...c, [joinAlias]: j })))
      .filter((c) => c[la][lc] === c[ra][rc]);
  }
  const getter = (c: Record<string, Row>): Getter => (a?: string) => {
    if (!a && joinTable) throw new Error(`fake db: unqualified column in a join: ${text}`);
    const row = c[a ?? baseAlias];
    if (!row) throw new Error(`missing FROM-clause entry for table "${a}"`);
    return row;
  };
  const test = parseWhere(where);
  const matched = contexts.filter((c) => test(getter(c), params));

  if (forUpdate) {
    if (!tx) throw new Error('fake db: FOR UPDATE outside a transaction');
    if (joinTable || where !== 'id = ?') throw new Error(`fake db: unexpected lock query: ${text}`);
    tx.locks.add(`${table}:${params[0]}`);
  }

  if (list === 'COUNT(*) AS n') return [{ n: String(matched.length) }]; // pg returns COUNT as a string

  const items = list.split(', ');
  let rows = matched.map((c) => {
    const get = getter(c);
    const out: Row = {};
    for (const item of items) {
      if (item === '*') {
        Object.assign(out, { ...get() });
        continue;
      }
      const col = /^(?:(\w+)\.)?(\w+)(?: AS (\w+))?$/.exec(item);
      if (!col) throw new Error(`fake db: unsupported select item "${item}"`);
      const [, a, name, as] = col;
      out[as ?? name] = get(a)[name];
    }
    return out;
  });
  if (distinct) {
    const seen = new Set<string>();
    rows = rows.filter((r) => {
      const key = JSON.stringify(r);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return rows;
}

function requireLock(tx: Tx, table: string, id: unknown, verb: string) {
  if (!tx.locks.has(`${table}:${id}`)) throw new Error(`fake db: ${verb} ${table} row ${id} that was not locked FOR UPDATE`);
}

function update(text: string, params: any[], tx: Tx): Result {
  const m = /^UPDATE (\w+) SET (.+) WHERE id = \?$/.exec(text);
  if (!m) throw new Error(`Unexpected SQL in test: ${text}`);
  const [, table, sets] = m;
  let next = 0;
  const values: Row = {};
  for (const assignment of sets.split(', ')) {
    const a = /^(\w+) = (\?|NULL)$/.exec(assignment);
    if (!a) throw new Error(`fake db: unsupported assignment "${assignment}"`);
    const value = a[2] === '?' ? params[next++] : null;
    if (BOOLEAN_COLUMNS.includes(a[1]) && typeof value === 'number') {
      throw new Error(`column "${a[1]}" is of type boolean but expression is of type integer`);
    }
    values[a[1]] = value;
  }
  const id = params[next];
  requireLock(tx, table, id, 'UPDATE of');
  const rows = tableRows(table).filter((r) => r.id === id);
  for (const row of rows) {
    for (const col of Object.keys(values)) {
      if (!(col in row)) throw new Error(`column "${col}" of relation "${table}" does not exist`);
    }
    Object.assign(row, values);
  }
  for (const [t, col] of LIVE_UNIQUE) {
    if (t !== table) continue;
    const live = tableRows(t).filter((r) => r.deletedAt == null).map((r) => r[col]).filter((v) => v != null);
    if (new Set(live).size !== live.length) throw new Error(`duplicate key value violates unique constraint "uq_${t}_${col}_live"`);
  }
  return { rows: [], rowCount: rows.length };
}

function remove(text: string, params: any[], tx: Tx): Result {
  const m = /^DELETE FROM (\w+) WHERE (\w+) = \?$/.exec(text);
  if (!m) throw new Error(`Unexpected SQL in test: ${text}`);
  const [, table, col] = m;
  if (col === 'id') requireLock(tx, table, params[0], 'DELETE of');
  const rows = tableRows(table);
  const doomed = rows.filter((r) => r[col] === params[0]);
  for (const [child, fk, parent] of FOREIGN_KEYS) {
    if (parent !== table) continue;
    for (const d of doomed) {
      if (tableRows(child).some((r) => r[fk] === d.id && !doomed.includes(r))) {
        throw new Error(`update or delete on table "${table}" violates foreign key constraint on table "${child}"`);
      }
    }
  }
  fake.tables[table] = rows.filter((r) => !doomed.includes(r));
  return { rows: [], rowCount: doomed.length };
}

function insertAudit(text: string, params: any[]): Result {
  const expected = 'INSERT INTO auditLogs (id, userId, action, tableName, recordId, before, after, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
  if (text !== expected) throw new Error(`Unexpected SQL in test: ${text}`);
  const [id, userId, action, tableName, recordId, before, after, description, createdAt] = params;
  if (userId == null) throw new Error('null value in column "userid" of relation "auditlogs" violates not-null constraint');
  if (!tableRows('users').some((u) => u.id === userId)) throw new Error('insert on table "auditlogs" violates foreign key constraint "auditlogs_userid_fkey"');
  if (!AUDIT_ACTIONS.includes(action)) throw new Error('new row for relation "auditlogs" violates check constraint "auditlogs_action_check"');
  tableRows('auditLogs').push({ id, userId, action, tableName, recordId, before, after, description, createdAt });
  return { rows: [], rowCount: 1 };
}

function exec(sql: string, params: any[] = [], tx: Tx | null = null): Result {
  const text = sql.replace(/\s+/g, ' ').trim();
  if (new RegExp(`\\b(${BOOLEAN_COLUMNS.join('|')})\\s*=\\s*[01]\\b`).test(text)) {
    throw new Error('operator does not exist: boolean = integer');
  }
  if (tx) {
    if (tx.statements === 0 && !text.endsWith(' FOR UPDATE')) {
      throw new Error(`fake db: a recycle transaction must lock its row first, got: ${text}`);
    }
    tx.statements += 1;
  }
  if (text.startsWith('SELECT ')) {
    const rows = select(text, params, tx);
    return { rows, rowCount: rows.length };
  }
  if (!tx) throw new Error(`fake db: write outside a transaction: ${text}`);
  if (text.startsWith('UPDATE ')) return update(text, params, tx);
  if (text.startsWith('DELETE ')) return remove(text, params, tx);
  if (text.startsWith('INSERT INTO auditLogs ')) return insertAudit(text, params);
  throw new Error(`Unexpected SQL in test: ${text}`);
}

vi.mock('../db/database.js', () => ({
  getAsync: vi.fn(async (sql: string, params?: any[]) => exec(sql, params).rows[0]),
  allAsync: vi.fn(async (sql: string, params?: any[]) => exec(sql, params).rows),
  runAsync: vi.fn(async (sql: string, params?: any[]) => ({ rowCount: exec(sql, params).rowCount })),
  withTransaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
    const snapshot = structuredClone(fake.tables);
    const tx: Tx = { locks: new Set(), statements: 0 };
    try {
      return await fn({
        getAsync: async (sql: string, params?: any[]) => exec(sql, params, tx).rows[0],
        allAsync: async (sql: string, params?: any[]) => exec(sql, params, tx).rows,
        runAsync: async (sql: string, params?: any[]) => ({ rowCount: exec(sql, params, tx).rowCount }),
      });
    } catch (error) {
      fake.tables = snapshot;
      throw error;
    }
  }),
}));

import { deleteForever, listBin, restore, softDelete } from './recycleService.js';

// --------------------------------------------------------------------------------------------- helpers

const RECYCLE = new Set<string>(RECYCLE_TABLES);
const ADMIN = 'u-admin';
const IN_BIN = { deletedAt: '2026-11-06T09:00:00.000Z', deletedBy: ADMIN };

function add(table: string, row: Row): Row {
  const full = RECYCLE.has(table) ? { deletedAt: null, deletedBy: null, purgedAt: null, ...row } : { ...row };
  tableRows(table).push(full);
  return full;
}
const find = (table: string, id: string) => tableRows(table).find((r) => r.id === id);
const audits = () => tableRows('auditLogs');
const conflict = (error: string) => ({ ok: false, status: 409, error });

beforeEach(() => {
  fake.tables = Object.fromEntries(TABLES.map((t) => [t, [] as Row[]]));
  add('roles', { id: 'r-admin', name: 'Admin' });
  add('users', { id: ADMIN, username: 'admin', passwordHash: '$2a$10$hash', fullName: 'Owner', roleId: 'r-admin', isActive: true });
});

// --------------------------------------------------------------------------------------------- tests

describe('softDelete', () => {
  it('soft-deletes a waiter with history and keeps the row', async () => {
    add('waiters', { id: 'w1', name: 'Ali', phone: '0300-1234567', isActive: true });
    add('orders', { id: 'o1', orderNumber: 'ORD-00001', status: 'completed', waiterId: 'w1' });
    add('pastOrders', { id: 'p1', orderNumber: 'ORD-00000', status: 'completed', waiterId: 'w1' });

    expect(await softDelete('waiters', 'w1', ADMIN)).toEqual({ ok: true });

    const waiter = find('waiters', 'w1')!;
    expect(waiter).toMatchObject({ name: 'Ali', phone: '0300-1234567', isActive: true, deletedBy: ADMIN, purgedAt: null });
    expect(Date.now() - Date.parse(waiter.deletedAt)).toBeLessThan(60_000);
    expect(find('orders', 'o1')!.waiterId).toBe('w1');
    expect(audits()).toHaveLength(1);
    expect(audits()[0]).toMatchObject({ userId: ADMIN, action: 'delete', tableName: 'waiters', recordId: 'w1' });
    expect(audits()[0].description).toMatch(/^\[DELETE\] .*Ali/);
  });

  it('refuses a category used by live menu items, naming them', async () => {
    add('categories', { id: 'c1', name: 'Fast Food', type: 'major', parentId: null });
    for (const [i, name] of ['Zinger', 'Fries', 'Burger', 'Wrap', 'Shake', 'Nuggets'].entries()) {
      add('menuItems', { id: `m${i}`, name, categoryId: 'c1', description: null });
    }
    add('menuItems', { id: 'm-old', name: 'Old', categoryId: 'c1', description: null, ...IN_BIN });

    expect(await softDelete('categories', 'c1', ADMIN)).toEqual(
      conflict('Cannot delete: used by 6 live menu items (Zinger, Fries, Burger, Wrap, Shake, …). Move or delete them first.'),
    );
    expect(find('categories', 'c1')!.deletedAt).toBeNull();
    expect(audits()).toHaveLength(0);
  });

  it('refuses a dining table on an open order, naming the order', async () => {
    add('diningTables', { id: 't1', tableNumber: 'T5', capacity: 4, isActive: true });
    add('orders', { id: 'o1', orderNumber: 'ORD-01021', status: 'open', tableId: 't1' });
    add('orders', { id: 'o2', orderNumber: 'ORD-00990', status: 'completed', tableId: 't1' });

    expect(await softDelete('diningTables', 't1', ADMIN)).toEqual(
      conflict('Cannot delete: on 1 open order (ORD-01021). Finish or cancel it first.'),
    );
    expect(find('diningTables', 't1')!.deletedAt).toBeNull();
    expect(audits()).toHaveLength(0);
  });

  it('refuses a second delete of the same row (409) and writes one audit row', async () => {
    add('waiters', { id: 'w1', name: 'Ali', phone: null, isActive: true });

    expect(await softDelete('waiters', 'w1', ADMIN)).toEqual({ ok: true });
    expect(await softDelete('waiters', 'w1', ADMIN)).toEqual(conflict('Already in the Recycle Bin'));
    expect(audits()).toHaveLength(1);
  });

  it('answers 400 for an unknown type and 404 for a missing or forever-deleted row', async () => {
    add('waiters', { id: 'w-gone', name: 'Old (Deleted)', phone: null, ...IN_BIN, purgedAt: '2026-11-06T10:00:00.000Z' });

    expect(await softDelete('nope' as RecycleType, 'w1', ADMIN)).toMatchObject({ ok: false, status: 400 });
    expect(await softDelete('waiters', 'missing', ADMIN)).toEqual({ ok: false, status: 404, error: 'Waiter not found' });
    expect(await softDelete('waiters', 'w-gone', ADMIN)).toEqual({ ok: false, status: 404, error: 'Waiter not found' });
    expect(await restore('waiters', 'missing', ADMIN)).toMatchObject({ ok: false, status: 404 });
    expect(await deleteForever('waiters', 'missing', ADMIN)).toMatchObject({ ok: false, status: 404 });
    expect(audits()).toHaveLength(0);
  });

  it('rolls the delete back when the audit row cannot be written', async () => {
    add('waiters', { id: 'w1', name: 'Ali', phone: null, isActive: true });

    await expect(softDelete('waiters', 'w1', 'no-such-user')).rejects.toThrow(/auditlogs_userid_fkey/);
    expect(find('waiters', 'w1')!.deletedAt).toBeNull();
    expect(audits()).toHaveLength(0);
  });
});

describe('restore', () => {
  it('restore clears the mark', async () => {
    const original = { ...add('users', { id: 'u2', username: 'fahad', passwordHash: '$2a$10$x', fullName: 'Fahad', roleId: 'r-admin', isActive: true }) };

    expect(await softDelete('users', 'u2', ADMIN)).toEqual({ ok: true });
    expect(find('users', 'u2')).toMatchObject({ username: 'fahad', isActive: true, deletedBy: ADMIN });
    expect(await restore('users', 'u2', ADMIN)).toEqual({ ok: true });

    expect(find('users', 'u2')).toEqual(original);
    expect(audits().map((a) => a.action)).toEqual(['delete', 'restore']);
    expect(audits()[1]).toMatchObject({ userId: ADMIN, tableName: 'users', recordId: 'u2' });
    expect(audits()[1].description).toMatch(/^\[RESTORE\] .*Fahad/);
  });

  it('restore refuses while the category is in the bin', async () => {
    add('categories', { id: 'c1', name: 'Drinks', type: 'major', parentId: null, ...IN_BIN });
    add('menuItems', { id: 'm1', name: 'Cola', categoryId: 'c1', description: null, ...IN_BIN });

    expect(await restore('menuItems', 'm1', ADMIN)).toEqual(conflict('Restore category Drinks first'));
    expect(find('menuItems', 'm1')!.deletedAt).toBe(IN_BIN.deletedAt);
    expect(audits()).toHaveLength(0);
  });

  it('restore refuses when the username is now taken', async () => {
    add('users', { id: 'u2', username: 'fahad', passwordHash: '$2a$10$x', fullName: 'Fahad', roleId: 'r-admin', isActive: true, ...IN_BIN });
    add('users', { id: 'u3', username: 'fahad', passwordHash: '$2a$10$y', fullName: 'Fahad Khan', roleId: 'r-admin', isActive: true });

    expect(await restore('users', 'u2', ADMIN)).toEqual(conflict('The username "fahad" is now used by another user'));
    expect(find('users', 'u2')!.deletedAt).toBe(IN_BIN.deletedAt);
    expect(audits()).toHaveLength(0);
  });

  it('restore of a live row is 409', async () => {
    add('waiters', { id: 'w1', name: 'Ali', phone: null, isActive: true });

    expect(await restore('waiters', 'w1', ADMIN)).toEqual(conflict('Not in the Recycle Bin'));
    expect(audits()).toHaveLength(0);
  });
});

describe('deleteForever', () => {
  it('delete forever of an unused table removes it', async () => {
    add('diningTables', { id: 't1', tableNumber: 'T9', capacity: 4, isActive: true, ...IN_BIN });

    expect(await deleteForever('diningTables', 't1', ADMIN)).toEqual({ ok: true, outcome: 'removed' });

    expect(find('diningTables', 't1')).toBeUndefined();
    expect(audits()).toHaveLength(1);
    expect(audits()[0]).toMatchObject({ userId: ADMIN, action: 'delete', tableName: 'diningTables', recordId: 't1' });
    expect(audits()[0].description).toMatch(/^\[DELETE_FOREVER\] .*T9.*removed/);
  });

  it('delete forever of a menu item with sales tombstones it as "Zinger (Deleted)", clears description, keeps it out of listBin', async () => {
    add('categories', { id: 'c1', name: 'Fast Food', type: 'major', parentId: null });
    add('menuItems', { id: 'm1', name: 'Zinger', categoryId: 'c1', description: 'Spicy', isActive: true, ...IN_BIN });
    add('orders', { id: 'o1', orderNumber: 'ORD-00001', status: 'completed' });
    add('orderItems', { id: 'oi1', orderId: 'o1', itemType: 'menu_item', menuItemId: 'm1', dealId: null });

    expect(await deleteForever('menuItems', 'm1', ADMIN)).toEqual({ ok: true, outcome: 'tombstoned' });

    const item = find('menuItems', 'm1')!;
    expect(item).toMatchObject({ name: 'Zinger (Deleted)', description: null, categoryId: 'c1', isActive: true, deletedAt: IN_BIN.deletedAt });
    expect(Date.now() - Date.parse(item.purgedAt)).toBeLessThan(60_000);
    expect(find('orderItems', 'oi1')!.menuItemId).toBe('m1');
    expect((await listBin()).map((e) => e.id)).not.toContain('m1');
    expect(audits()[0]).toMatchObject({ action: 'delete', tableName: 'menuItems', recordId: 'm1' });
    expect(audits()[0].description).toMatch(/^\[DELETE_FOREVER\] .*Zinger.*tombstoned/);
    expect(audits()[0].after).not.toContain('Spicy');
  });

  it('delete forever removes plainChildren on removal only', async () => {
    add('categories', { id: 'c1', name: 'Fast Food', type: 'major', parentId: null });
    add('variants', { id: 'v1', name: 'Size', type: 'size' });
    add('menuItems', { id: 'm1', name: 'Wrap', categoryId: 'c1', description: null, ...IN_BIN });
    add('menuItems', { id: 'm2', name: 'Zinger', categoryId: 'c1', description: null, ...IN_BIN });
    add('menuItemVariants', { id: 'mv1', menuItemId: 'm1', variantId: 'v1' });
    add('menuItemVariants', { id: 'mv2', menuItemId: 'm2', variantId: 'v1' });
    add('orders', { id: 'o1', orderNumber: 'ORD-00001', status: 'completed' });
    add('orderItems', { id: 'oi1', orderId: 'o1', itemType: 'menu_item', menuItemId: 'm2', dealId: null });

    expect(await deleteForever('menuItems', 'm1', ADMIN)).toEqual({ ok: true, outcome: 'removed' });
    expect(await deleteForever('menuItems', 'm2', ADMIN)).toEqual({ ok: true, outcome: 'tombstoned' });

    expect(find('menuItems', 'm1')).toBeUndefined();
    expect(find('menuItemVariants', 'mv1')).toBeUndefined();
    expect(find('menuItemVariants', 'mv2')).toBeDefined();
    expect(find('variants', 'v1')).toBeDefined();
  });

  it('delete forever refuses while its menu items are in the bin', async () => {
    add('categories', { id: 'c1', name: 'Drinks', type: 'major', parentId: null, ...IN_BIN });
    add('menuItems', { id: 'm1', name: 'Zinger', categoryId: 'c1', description: null, ...IN_BIN });
    add('menuItems', { id: 'm2', name: 'Fries', categoryId: 'c1', description: null, ...IN_BIN });

    expect(await deleteForever('categories', 'c1', ADMIN)).toEqual(
      conflict('Delete forever or restore 2 menu items (Zinger, Fries) first'),
    );
    expect(find('categories', 'c1')).toMatchObject({ name: 'Drinks', purgedAt: null });
    expect(audits()).toHaveLength(0);
  });

  it('delete forever after a concurrent restore answers 409', async () => {
    add('waiters', { id: 'w1', name: 'Ali', phone: '0300', isActive: true, ...IN_BIN });

    expect(await restore('waiters', 'w1', ADMIN)).toEqual({ ok: true });
    expect(await deleteForever('waiters', 'w1', ADMIN)).toEqual(conflict('Not in the Recycle Bin'));

    expect(find('waiters', 'w1')).toMatchObject({ name: 'Ali', phone: '0300', deletedAt: null, purgedAt: null });
    expect(audits().map((a) => a.action)).toEqual(['restore']);
  });

  it('user tombstone frees the username and makes the password unusable', async () => {
    add('users', { id: 'u2', username: 'fahad', passwordHash: '$2a$10$x', fullName: 'Fahad', roleId: 'r-admin', isActive: true, ...IN_BIN });
    add('orders', { id: 'o1', orderNumber: 'ORD-00001', status: 'completed', createdBy: 'u2' });

    expect(await deleteForever('users', 'u2', ADMIN)).toEqual({ ok: true, outcome: 'tombstoned' });

    expect(find('users', 'u2')).toMatchObject({
      username: 'deleted-u2', passwordHash: '!', fullName: 'Fahad (Deleted)', roleId: 'r-admin', isActive: true,
    });
    expect(find('orders', 'o1')!.createdBy).toBe('u2');
    expect(audits()[0].before).not.toContain('$2a$');
    expect(audits()[0].after).not.toContain('$2a$');
  });
});

describe('listBin', () => {
  it("listBin returns usedBy counts and the deleter's name", async () => {
    add('users', { id: 'u2', username: 'fahad', passwordHash: 'h', fullName: 'Fahad', roleId: 'r-admin', isActive: true,
      deletedAt: '2026-11-06T08:00:00.000Z', deletedBy: ADMIN });
    add('waiters', { id: 'w1', name: 'Ali', phone: null, deletedAt: '2026-11-05T10:00:00.000Z', deletedBy: ADMIN });
    add('customers', { id: 'cu1', name: 'Bilal', phone: '0301', deletedAt: new Date('2026-11-04T12:00:00.000Z'), deletedBy: null });
    add('customers', { id: 'cu2', name: 'Gone (Deleted)', phone: '', ...IN_BIN, purgedAt: '2026-11-06T09:30:00.000Z' });
    add('waiters', { id: 'w2', name: 'Live', phone: null });
    // u2 created two orders and completed one of them: "orders" is 2, not 3.
    add('orders', { id: 'oa', orderNumber: 'ORD-1', status: 'completed', createdBy: 'u2', completedBy: 'u2', waiterId: 'w1' });
    add('orders', { id: 'ob', orderNumber: 'ORD-2', status: 'completed', createdBy: 'u2', completedBy: ADMIN, waiterId: 'w1' });
    add('orders', { id: 'oc', orderNumber: 'ORD-3', status: 'completed', waiterId: 'w1' });
    add('pastOrders', { id: 'pa', orderNumber: 'ORD-0', status: 'completed', waiterId: 'w1' });
    add('pastOrders', { id: 'pb', orderNumber: 'ORD-00', status: 'completed', waiterId: 'w1' });
    add('payments', { id: 'pay1', orderId: 'oa', receivedBy: 'u2' });

    const bin = await listBin();

    expect(bin).toEqual([
      { type: 'users', typeLabel: 'User', id: 'u2', name: 'Fahad', deletedAt: '2026-11-06T08:00:00.000Z',
        deletedBy: ADMIN, deletedByName: 'Owner', usedBy: [{ label: 'orders', count: 2 }, { label: 'payments', count: 1 }] },
      { type: 'waiters', typeLabel: 'Waiter', id: 'w1', name: 'Ali', deletedAt: '2026-11-05T10:00:00.000Z',
        deletedBy: ADMIN, deletedByName: 'Owner', usedBy: [{ label: 'orders', count: 3 }, { label: 'archived orders', count: 2 }] },
      { type: 'customers', typeLabel: 'Customer', id: 'cu1', name: 'Bilal', deletedAt: '2026-11-04T12:00:00.000Z',
        deletedBy: null, deletedByName: null, usedBy: [] },
    ]);
    expect((await listBin('waiters')).map((e) => e.id)).toEqual(['w1']);
  });
});
