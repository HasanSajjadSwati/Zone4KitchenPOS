// Recycle Bin: soft delete, restore and delete forever for the types in ./registry.ts.
// Every change runs in one transaction that first locks the record (SELECT ... FOR UPDATE) and
// decides from that locked row, so two admins acting on the same record at once cannot both win
// (a delete forever that arrives after a restore sees a live row and answers 409). The audit row
// is written in the same transaction as the change: both happen or neither does.
// SQL safety: table and column names only ever come from the registry; the record id and every
// value are bound parameters. `type` is resolved through getTypeDef, never interpolated.
import { v4 as uuidv4 } from 'uuid';
import { allAsync, getAsync, withTransaction } from '../db/database.js';
import type { TransactionClient } from '../db/database.js';
import { TOMBSTONE_SUFFIX } from '../constants/recycle.js';
import { RECYCLE_TYPES, getTypeDef } from './registry.js';
import type { NamedCheck, RecycleType, RecycleTypeDef } from './registry.js';

export type RecycleResult =
  | { ok: true; outcome?: 'removed' | 'tombstoned' }
  | { ok: false; status: 400 | 404 | 409; error: string };

export interface BinEntry {
  type: RecycleType;
  typeLabel: string;
  id: string;
  name: string;
  deletedAt: string;
  deletedBy: string | null;
  deletedByName: string | null;
  usedBy: { label: string; count: number }[];
}

type Row = Record<string, any>;

// Error messages name at most this many records, then "…" (the total is always stated).
const MAX_NAMED = 5;

// How a unique column is called in "The <column> "x" is now used by another <type>".
const UNIQUE_LABELS: Record<string, string> = {
  username: 'username',
  phone: 'phone number',
  tableNumber: 'table number',
  cnic: 'CNIC',
  name: 'name',
};

interface Hit { label: string; names: string[] }

const conflict = (error: string): RecycleResult => ({ ok: false, status: 409, error });
const notFound = (def: RecycleTypeDef): RecycleResult => ({ ok: false, status: 404, error: `${def.label} not found` });
const isInBin = (row: Row): boolean => row.deletedAt != null && row.purgedAt == null;

// Registry labels are plural ("menu items", "categories"); used for a count of one.
const singular = (label: string): string => label.replace(/ies$/, 'y').replace(/s$/, '');

function nameList(names: string[]): string {
  const shown = names.slice(0, MAX_NAMED).join(', ');
  return names.length > MAX_NAMED ? `${shown}, …` : shown;
}

// "6 live menu items (Zinger, Fries, Burger, Wrap, Shake, …)" / "1 open order (ORD-01021)"
function counted(hit: Hit): string {
  const n = hit.names.length;
  return `${n} ${n === 1 ? singular(hit.label) : hit.label} (${nameList(hit.names)})`;
}

const joinAnd = (parts: string[]): string => parts.join(' and ');
const pronoun = (hits: Hit[]): string => (hits.reduce((n, h) => n + h.names.length, 0) === 1 ? 'it' : 'them');

// Runs each check (rows with a `name` column) and keeps the ones that found something.
async function findHits(tx: TransactionClient, checks: NamedCheck[], id: string): Promise<Hit[]> {
  const hits: Hit[] = [];
  for (const check of checks) {
    const rows = await tx.allAsync(check.sql, [id]);
    if (rows.length > 0) hits.push({ label: check.label, names: rows.map((r) => String(r.name ?? '')) });
  }
  return hits;
}

interface AuditEntry {
  action: 'delete' | 'restore';
  before: unknown;
  after: unknown;
  description: string;
}

// Same row shape as logOrderModification in routes/orders.ts. Never put wiped or secret values
// (phone, CNIC, passwordHash, ...) in before/after: the audit log would keep what the wipe removed.
async function writeAudit(tx: TransactionClient, def: RecycleTypeDef, id: string, actorId: string, now: string, entry: AuditEntry) {
  await tx.runAsync(
    `INSERT INTO auditLogs (id, userId, action, tableName, recordId, before, after, description, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), actorId, entry.action, def.table, id, JSON.stringify(entry.before), JSON.stringify(entry.after), entry.description, now],
  );
}

// Resolves the type, locks the record in a new transaction and hands the locked row to `fn`.
async function onLockedRow(
  type: string,
  id: string,
  fn: (tx: TransactionClient, def: RecycleTypeDef, row: Row) => Promise<RecycleResult>,
): Promise<RecycleResult> {
  const def = getTypeDef(type);
  if (!def) return { ok: false, status: 400, error: 'Unknown record type' };
  return withTransaction(async (tx) => {
    const row = await tx.getAsync(`SELECT *, ${def.nameSql} AS name FROM ${def.table} WHERE id = ? FOR UPDATE`, [id]);
    if (!row) return notFound(def);
    return fn(tx, def, row);
  });
}

export function softDelete(type: RecycleType, id: string, actorId: string): Promise<RecycleResult> {
  return onLockedRow(type, id, async (tx, def, row) => {
    if (row.purgedAt != null) return notFound(def); // deleted forever: gone as far as anyone can tell
    if (row.deletedAt != null) return conflict('Already in the Recycle Bin');

    const dependents = await findHits(tx, def.liveDependents, id);
    if (dependents.length > 0) {
      return conflict(`Cannot delete: used by ${joinAnd(dependents.map(counted))}. Move or delete ${pronoun(dependents)} first.`);
    }
    const openWork = await findHits(tx, def.openWork, id);
    if (openWork.length > 0) {
      return conflict(`Cannot delete: on ${joinAnd(openWork.map(counted))}. Finish or cancel ${pronoun(openWork)} first.`);
    }

    // Only the mark changes (not isActive, not the name): a restore brings the record back as it was.
    const now = new Date().toISOString();
    await tx.runAsync(`UPDATE ${def.table} SET deletedAt = ?, deletedBy = ? WHERE id = ?`, [now, actorId, id]);
    await writeAudit(tx, def, id, actorId, now, {
      action: 'delete',
      before: { deletedAt: null, deletedBy: null },
      after: { deletedAt: now, deletedBy: actorId },
      description: `[DELETE] ${def.label} "${row.name}" moved to the Recycle Bin`,
    });
    return { ok: true };
  });
}

export function restore(type: RecycleType, id: string, actorId: string): Promise<RecycleResult> {
  return onLockedRow(type, id, async (tx, def, row) => {
    if (!isInBin(row)) return conflict('Not in the Recycle Bin');

    const parents = await findHits(tx, def.binParents, id);
    if (parents.length > 0) {
      const named = parents.map((h) => (h.names.length === 1 ? `${singular(h.label)} ${h.names[0]}` : counted(h)));
      return conflict(`Restore ${joinAnd(named)} first`);
    }

    const unique = def.uniqueColumn;
    const value = unique ? row[unique] : null;
    if (unique && value != null && value !== '') {
      const taken = await tx.getAsync(
        `SELECT id FROM ${def.table} WHERE ${unique} = ? AND deletedAt IS NULL AND id <> ?`,
        [value, id],
      );
      if (taken) {
        return conflict(`The ${UNIQUE_LABELS[unique] ?? unique} "${value}" is now used by another ${def.label.toLowerCase()}`);
      }
    }

    const now = new Date().toISOString();
    await tx.runAsync(`UPDATE ${def.table} SET deletedAt = NULL, deletedBy = NULL WHERE id = ?`, [id]);
    await writeAudit(tx, def, id, actorId, now, {
      action: 'restore',
      before: { deletedAt: row.deletedAt, deletedBy: row.deletedBy ?? null },
      after: { deletedAt: null, deletedBy: null },
      description: `[RESTORE] ${def.label} "${row.name}" restored from the Recycle Bin`,
    });
    return { ok: true };
  });
}

export function deleteForever(type: RecycleType, id: string, actorId: string): Promise<RecycleResult> {
  return onLockedRow(type, id, async (tx, def, row) => {
    if (!isInBin(row)) return conflict('Not in the Recycle Bin');

    const children = await findHits(tx, def.binChildren, id);
    if (children.length > 0) {
      return conflict(`Delete forever or restore ${joinAnd(children.map(counted))} first`);
    }

    // A parent must never be removed or tombstoned under a live child (same check as softDelete).
    const dependents = await findHits(tx, def.liveDependents, id);
    if (dependents.length > 0) {
      return conflict(`Cannot delete: used by ${joinAnd(dependents.map(counted))}. Move or delete ${pronoun(dependents)} first.`);
    }

    let references = 0;
    for (const check of def.history) {
      const counts = await tx.getAsync(check.sql, [id]);
      references += Number(counts?.n ?? 0); // COUNT(*) comes back from pg as a string
    }

    const now = new Date().toISOString();
    const name = String(row.name ?? '');

    if (references === 0) {
      for (const child of def.plainChildren) {
        await tx.runAsync(`DELETE FROM ${child.table} WHERE ${child.column} = ?`, [id]);
      }
      await tx.runAsync(`DELETE FROM ${def.table} WHERE id = ?`, [id]);
      await writeAudit(tx, def, id, actorId, now, {
        action: 'delete',
        before: { name },
        after: null,
        description: `[DELETE_FOREVER] ${def.label} "${name}" removed (nothing referred to it)`,
      });
      return { ok: true, outcome: 'removed' };
    }

    // History points at it: keep a tombstone so history keeps the name, wipe the rest.
    const changes: Record<string, unknown> = { ...def.wipe };
    if (def.type === 'users') changes.username = `deleted-${id}`; // frees the username for reuse
    const tombstoneName = def.nameColumn ? `${row[def.nameColumn]}${TOMBSTONE_SUFFIX}` : name;
    if (def.nameColumn) changes[def.nameColumn] = tombstoneName;
    changes.purgedAt = now;

    const columns = Object.keys(changes);
    await tx.runAsync(
      `UPDATE ${def.table} SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((c) => changes[c]), id],
    );
    await writeAudit(tx, def, id, actorId, now, {
      action: 'delete',
      before: { name, purgedAt: null },
      after: { name: tombstoneName, purgedAt: now, wiped: columns.filter((c) => c !== def.nameColumn && c !== 'purgedAt') },
      description: `[DELETE_FOREVER] ${def.label} "${name}" tombstoned as "${tombstoneName}" (${references} history references keep it)`,
    });
    return { ok: true, outcome: 'tombstoned' };
  });
}

const toIso = (value: unknown): string => (value instanceof Date ? value.toISOString() : String(value));

// Non-zero history counts per label. Labels can repeat (orders.createdBy and orders.completedBy
// are both "orders"); those count the same orders, so the label takes the larger count, not the sum.
async function usage(def: RecycleTypeDef, id: string): Promise<BinEntry['usedBy']> {
  const byLabel = new Map<string, number>();
  for (const check of def.history) {
    const counts = await getAsync(check.sql, [id]);
    byLabel.set(check.label, Math.max(byLabel.get(check.label) ?? 0, Number(counts?.n ?? 0)));
  }
  return [...byLabel].filter(([, count]) => count > 0).map(([label, count]) => ({ label, count }));
}

// Everything in the bin (deleted, not yet deleted forever), newest first; one type or all.
// An unknown type matches nothing.
export async function listBin(type?: RecycleType): Promise<BinEntry[]> {
  const defs = type === undefined ? Object.values(RECYCLE_TYPES) : [getTypeDef(type)].filter((d): d is RecycleTypeDef => d !== null);
  const entries: BinEntry[] = [];

  for (const def of defs) {
    const rows = await allAsync(
      `SELECT t.id, ${def.nameSql} AS name, t.deletedAt, t.deletedBy FROM ${def.table} t
       WHERE t.deletedAt IS NOT NULL AND t.purgedAt IS NULL`,
    );
    for (const row of rows) {
      entries.push({
        type: def.type,
        typeLabel: def.label,
        id: row.id,
        name: String(row.name ?? ''),
        deletedAt: toIso(row.deletedAt),
        deletedBy: row.deletedBy ?? null,
        deletedByName: null,
        usedBy: await usage(def, row.id),
      });
    }
  }

  const deleterIds = [...new Set(entries.map((e) => e.deletedBy).filter((v): v is string => !!v))];
  if (deleterIds.length > 0) {
    const deleters = await allAsync(
      `SELECT id, fullName FROM users WHERE id IN (${deleterIds.map(() => '?').join(', ')})`,
      deleterIds,
    );
    const names = new Map<string, string>(deleters.map((u) => [u.id, u.fullName]));
    for (const entry of entries) entry.deletedByName = entry.deletedBy ? names.get(entry.deletedBy) ?? null : null;
  }

  return entries.sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt));
}
