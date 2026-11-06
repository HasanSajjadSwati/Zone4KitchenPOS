// Recycle Bin proof run. Talks to a RUNNING server over HTTP and to its database over SQL.
//
//   cd backend
//   VERIFY_DATABASE_URL=postgres://.../pos_verify ADMIN_TOKEN=<jwt> ADMIN_ID=<admin user id> \
//   STAFF_TOKEN=<jwt of a live non-admin user> BASE_URL=http://127.0.0.1:3099 \
//   [OUT_DIR=./verify-out] node scripts/verify-recycle-bin.mjs
//
// It MUTATES data through the API (soft deletes, delete forever, restore), so it refuses to start
// unless the database is named exactly `pos_verify` and BASE_URL is not on port 3033 (production).
//
// What it proves: deleting anything, normally or forever, leaves every sales report unchanged
// (apart from the "(Deleted)" suffix on the names of records deleted forever), and the report
// totals equal a direct SQL sum over orderItems + pastOrderItems.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { compareReports, TOMBSTONE_SUFFIX } from './compareReports.mjs';

// ---------- safety: before anything else ----------
const { VERIFY_DATABASE_URL, ADMIN_TOKEN, ADMIN_ID, STAFF_TOKEN } = process.env;
const BASE_URL = (process.env.BASE_URL || '').replace(/\/+$/, '');
const OUT_DIR = path.resolve(process.env.OUT_DIR || './verify-out');

function abort(msg) {
  console.error(`ABORT: ${msg}`);
  process.exit(2);
}
(function safetyChecks() {
  for (const [k, v] of Object.entries({ VERIFY_DATABASE_URL, ADMIN_TOKEN, ADMIN_ID, STAFF_TOKEN, BASE_URL })) {
    if (!v) abort(`${k} is required`);
  }
  let dbName;
  try {
    dbName = decodeURIComponent(new URL(VERIFY_DATABASE_URL).pathname.replace(/^\//, ''));
  } catch {
    abort('VERIFY_DATABASE_URL is not a valid URL');
  }
  if (dbName !== 'pos_verify') abort(`database name must be exactly "pos_verify", got "${dbName}"`);
  let base;
  try {
    base = new URL(BASE_URL);
  } catch {
    abort('BASE_URL is not a valid URL');
  }
  if (base.port === '3033') abort('BASE_URL uses port 3033 (production)');
})();

// ---------- helpers: results ----------
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  const extra = !ok && detail ? `\n        ${String(detail).split('\n').join('\n        ')}` : '';
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra}`);
  return ok;
}
const info = (msg) => console.log(`      ${msg}`);
const heading = (msg) => console.log(`\n=== ${msg} ===`);

// ---------- helpers: http ----------
async function api(method, urlPath, token = ADMIN_TOKEN, body) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { status: res.status, body: json, text };
}
const errOf = (r) => (r.body && r.body.error) || r.text.slice(0, 300);

// ---------- helpers: sql ----------
const db = new pg.Client({ connectionString: VERIFY_DATABASE_URL });
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const num = (v) => (v === null || v === undefined ? 0 : Number(v));

// ---------- reports ----------
const ENDPOINTS = ['sales-summary', 'daily-sales', 'item-sales', 'item-variant-sales', 'deal-sales', 'category-sales', 'category-sales-detailed'];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = new Date();
const ago30 = new Date(today.getTime() - 30 * 86400000);
const RANGES = {
  today: { startDate: ymd(today), endDate: ymd(today) },
  last30days: { startDate: ymd(ago30), endDate: ymd(today) },
  allTime: {}, // dates omitted: buildDateFilters adds no condition
};

async function capture(label) {
  const snap = {};
  for (const [rangeName, params] of Object.entries(RANGES)) {
    snap[rangeName] = {};
    for (const ep of ENDPOINTS) {
      const qs = new URLSearchParams(params).toString();
      const r = await api('GET', `/api/reports/${ep}${qs ? `?${qs}` : ''}`);
      if (r.status !== 200) throw new Error(`report ${ep} (${rangeName}) answered ${r.status}: ${errOf(r)}`);
      snap[rangeName][ep] = r.body;
    }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `capture-${label}.json`), JSON.stringify(snap, null, 2));
  return snap;
}

function compareSnaps(name, before, after, renamed = new Set()) {
  const diffs = [];
  for (const rangeName of Object.keys(RANGES)) {
    for (const ep of ENDPOINTS) {
      for (const d of compareReports(before[rangeName][ep], after[rangeName][ep], renamed, `${rangeName}/${ep}`)) diffs.push(d);
    }
  }
  const shown = diffs.slice(0, 15)
    .map((d) => `${d.path}: ${d.reason}\n  before=${JSON.stringify(d.before)}\n  after =${JSON.stringify(d.after)}`)
    .join('\n');
  const more = diffs.length > 15 ? `\n... and ${diffs.length - 15} more` : '';
  return check(name, diffs.length === 0, `${diffs.length} difference(s)\n${shown}${more}`);
}

// ---------- totals check ----------
const dayStart = (d) => new Date(`${d}T00:00:00`).toISOString();
const dayEnd = (d) => { const x = new Date(`${d}T00:00:00`); x.setHours(23, 59, 59, 999); return x.toISOString(); };

// Same filters as the reports: completed orders, one itemType, o.completedAt between the bounds.
async function sqlTotal(itemType, range) {
  const params = [itemType];
  let dateSql = '';
  if (range.startDate) { params.push(dayStart(range.startDate)); dateSql += ` AND o.completedAt >= $${params.length}`; }
  if (range.endDate) { params.push(dayEnd(range.endDate)); dateSql += ` AND o.completedAt <= $${params.length}`; }
  const rows = await q(
    `SELECT COALESCE(SUM(oi.totalPrice), 0) AS s
       FROM (SELECT orderId, itemType, totalPrice FROM orderItems UNION ALL SELECT orderId, itemType, totalPrice FROM pastOrderItems) oi
       JOIN (SELECT id, status, completedAt FROM orders UNION ALL SELECT id, status, completedAt FROM pastOrders) o ON o.id = oi.orderId
      WHERE o.status = 'completed' AND oi.itemType = $1${dateSql}`,
    params,
  );
  return num(rows[0].s);
}

async function totalsCheck(label, snap) {
  // category-sales reports menu-item lines only, so its direct sum is the menu_item sum too.
  const reports = [['item-sales', 'menu_item'], ['deal-sales', 'deal'], ['category-sales', 'menu_item']];
  for (const [rangeName, range] of Object.entries(RANGES)) {
    for (const [ep, itemType] of reports) {
      const reported = snap[rangeName][ep].reduce((s, r) => s + num(r.totalSales), 0);
      const direct = await sqlTotal(itemType, range);
      check(`totals (${label}) ${ep} / ${rangeName}: report ${reported.toFixed(2)} vs SQL ${direct.toFixed(2)}`,
        Math.abs(reported - direct) <= 0.01, `report=${reported} sql=${direct}`);
    }
  }
}

// ---------- picking test records ----------
const openOrderItemSql = (col, alias) =>
  `EXISTS (SELECT 1 FROM orderItems oi JOIN orders o ON o.id = oi.orderId WHERE oi.${col} = ${alias}.id AND o.status = 'open')`;

// Table / column names below are constants of this script, never user input.
async function pickByOrderColumn(table, col, nameCol, excludeIds = []) {
  const rows = await q(
    `SELECT t.id, t.${nameCol} AS name,
            (SELECT COUNT(*) FROM orders WHERE ${col} = t.id) + (SELECT COUNT(*) FROM pastOrders WHERE ${col} = t.id) AS n
       FROM ${table} t
      WHERE t.deletedAt IS NULL AND t.id <> ALL($1::text[])
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.${col} = t.id AND o.status = 'open')
      ORDER BY n DESC, t.id LIMIT 1`,
    [excludeIds],
  );
  return rows[0] ? { id: rows[0].id, name: rows[0].name, n: num(rows[0].n) } : null;
}

const SALES_UNION = '(SELECT orderId, itemType, menuItemId, dealId, totalPrice FROM orderItems UNION ALL SELECT orderId, itemType, menuItemId, dealId, totalPrice FROM pastOrderItems)';

async function pickMenuItem() {
  const rows = await q(
    `SELECT m.id, m.name, m.categoryId,
            COALESCE((SELECT SUM(x.totalPrice) FROM ${SALES_UNION} x WHERE x.menuItemId = m.id), 0) AS s
       FROM menuItems m
      WHERE m.deletedAt IS NULL
        AND NOT ${openOrderItemSql('menuItemId', 'm')}
        AND NOT EXISTS (SELECT 1 FROM dealItems di JOIN deals d ON d.id = di.dealId WHERE di.menuItemId = m.id AND d.deletedAt IS NULL)
      ORDER BY s DESC, m.id LIMIT 1`,
  );
  return rows[0] ? { id: rows[0].id, name: rows[0].name, categoryId: rows[0].categoryid, sales: num(rows[0].s) } : null;
}

async function pickDeal() {
  const rows = await q(
    `SELECT d.id, d.name, d.categoryId,
            COALESCE((SELECT SUM(x.totalPrice) FROM ${SALES_UNION} x WHERE x.dealId = d.id), 0) AS s
       FROM deals d
      WHERE d.deletedAt IS NULL AND NOT ${openOrderItemSql('dealId', 'd')}
      ORDER BY s DESC, d.id LIMIT 1`,
  );
  return rows[0] ? { id: rows[0].id, name: rows[0].name, categoryId: rows[0].categoryid, sales: num(rows[0].s) } : null;
}

// A category qualifies when it has live items and sales, and nothing can block the scenario:
// no live subcategories, no live deals, and no live item on an open order or in a live deal.
async function pickCategory(excludeIds) {
  const cands = await q(
    `SELECT c.id, c.name,
            (SELECT COUNT(*) FROM menuItems m WHERE m.categoryId = c.id AND m.deletedAt IS NULL) AS live_items,
            COALESCE((SELECT SUM(x.totalPrice) FROM ${SALES_UNION} x JOIN menuItems m ON m.id = x.menuItemId
                       WHERE m.categoryId = c.id AND x.itemType = 'menu_item'), 0) AS s
       FROM categories c
      WHERE c.deletedAt IS NULL AND c.id <> ALL($1::text[])
      ORDER BY live_items ASC, s DESC, c.id`,
    [excludeIds],
  );
  for (const c of cands) {
    if (num(c.live_items) < 1 || num(c.s) <= 0) continue;
    const [{ n: subs }] = await q('SELECT COUNT(*) AS n FROM categories WHERE parentId = $1 AND deletedAt IS NULL', [c.id]);
    const [{ n: deals }] = await q('SELECT COUNT(*) AS n FROM deals WHERE categoryId = $1 AND deletedAt IS NULL', [c.id]);
    const [{ n: blocked }] = await q(
      `SELECT COUNT(*) AS n FROM menuItems m
        WHERE m.categoryId = $1 AND m.deletedAt IS NULL
          AND (${openOrderItemSql('menuItemId', 'm')}
               OR EXISTS (SELECT 1 FROM dealItems di JOIN deals d ON d.id = di.dealId WHERE di.menuItemId = m.id AND d.deletedAt IS NULL))`,
      [c.id],
    );
    if (num(subs) || num(deals) || num(blocked)) continue;
    const items = await q('SELECT id, name FROM menuItems WHERE categoryId = $1 AND deletedAt IS NULL ORDER BY id', [c.id]);
    return { id: c.id, name: c.name, sales: num(c.s), items };
  }
  return null;
}

// ---------- main ----------
const staffUserId = (() => {
  try { return JSON.parse(Buffer.from(STAFF_TOKEN.split('.')[1], 'base64url').toString()).sub; } catch { return null; }
})();

const tombstoned = new Set(); // names of records deleted forever that stayed behind as a tombstone

async function softDelete(label, urlPath) {
  const r = await api('DELETE', urlPath);
  check(`soft delete ${label} -> 200`, r.status === 200, `status ${r.status}: ${errOf(r)}`);
  return r.status === 200;
}

async function deleteForever(type, rec, label) {
  const r = await api('DELETE', `/api/recycle-bin/${type}/${rec.id}`);
  const ok = r.status === 200 && ['removed', 'tombstoned'].includes(r.body?.outcome);
  check(`delete forever ${label} "${rec.name}" -> 200 (${ok ? r.body.outcome : `status ${r.status}`})`, ok, `status ${r.status}: ${errOf(r)}`);
  if (ok && r.body.outcome === 'tombstoned') tombstoned.add(rec.name);
  return ok;
}

async function main() {
  await db.connect();
  const [{ current_database: dbNow }] = await q('SELECT current_database()');
  if (dbNow !== 'pos_verify') abort(`connected database is "${dbNow}", not pos_verify`);
  info(`database ${dbNow}, server ${BASE_URL}, out ${OUT_DIR}`);

  heading('1. Baseline capture');
  const baseline = await capture('0-baseline');
  check('captured 7 reports x 3 ranges', true);
  await totalsCheck('baseline', baseline);

  heading('2. Picking test records');
  const protectedUsers = [ADMIN_ID, ...(staffUserId ? [staffUserId] : [])];
  const userRows = await q(
    `SELECT u.id, u.fullName AS name,
            (SELECT COUNT(*) FROM orders o WHERE o.createdBy = u.id OR o.completedBy = u.id)
          + (SELECT COUNT(*) FROM pastOrders o WHERE o.createdBy = u.id OR o.completedBy = u.id) AS n
       FROM users u JOIN roles r ON r.id = u.roleId
      WHERE u.deletedAt IS NULL AND u.id <> ALL($1::text[]) AND lower(r.name) <> 'admin'
      ORDER BY n DESC, u.id LIMIT 1`,
    [protectedUsers],
  );
  const user = userRows[0] ? { id: userRows[0].id, name: userRows[0].name, n: num(userRows[0].n) } : null;
  const customer = await pickByOrderColumn('customers', 'customerId', 'name');
  const waiter = await pickByOrderColumn('waiters', 'waiterId', 'name');
  const item = await pickMenuItem();
  const deal = await pickDeal();
  const category = await pickCategory([item?.categoryId, deal?.categoryId].filter(Boolean));
  info(`user      ${user ? `${user.name} (${user.id}) orders=${user.n}` : 'NONE'}`);
  info(`customer  ${customer ? `${customer.name} (${customer.id}) orders=${customer.n}` : 'NONE'}`);
  info(`waiter    ${waiter ? `${waiter.name} (${waiter.id}) orders=${waiter.n}` : 'NONE'}`);
  info(`menuItem  ${item ? `${item.name} (${item.id}) sales=${item.sales}` : 'NONE'}`);
  info(`deal      ${deal ? `${deal.name} (${deal.id}) sales=${deal.sales}` : 'NONE'}`);
  info(`category  ${category ? `${category.name} (${category.id}) sales=${category.sales} items=${category.items.map((i) => i.name).join(', ')}` : 'NONE'}`);
  for (const [name, rec] of Object.entries({ user, customer, waiter, menuItem: item, deal, category })) {
    check(`picked a ${name}`, !!rec, `no suitable ${name} found in pos_verify`);
  }

  heading('3. Soft delete');
  const softDone = {};
  if (user) softDone.user = await softDelete(`user ${user.name}`, `/api/users/${user.id}?adminUserId=${encodeURIComponent(ADMIN_ID)}`);
  if (customer) softDone.customer = await softDelete(`customer ${customer.name}`, `/api/customers/${customer.id}`);
  if (waiter) softDone.waiter = await softDelete(`waiter ${waiter.name}`, `/api/staff/waiters/${waiter.id}`);
  if (item) softDone.item = await softDelete(`menu item ${item.name}`, `/api/menu-items/${item.id}`);
  if (deal) softDone.deal = await softDelete(`deal ${deal.name}`, `/api/deals/${deal.id}`);
  compareSnaps('reports identical to baseline after soft delete', baseline, await capture('1-after-softdelete'));

  heading('4. Category scenario');
  const itemsDeleted = [];
  let categoryDeleted = false;
  if (category) {
    const r1 = await api('DELETE', `/api/categories/${category.id}`);
    check('delete category with live items -> 409', r1.status === 409, `status ${r1.status}: ${errOf(r1)}`);
    info(`409 says: ${errOf(r1)}`);
    for (const it of category.items) {
      if (await softDelete(`category item ${it.name}`, `/api/menu-items/${it.id}`)) itemsDeleted.push(it);
    }
    categoryDeleted = await softDelete(`category ${category.name}`, `/api/categories/${category.id}`);
    if (itemsDeleted.length) {
      const r2 = await api('POST', `/api/recycle-bin/menuItems/${itemsDeleted[0].id}/restore`);
      check('restore item whose category is in the bin -> 409 "Restore category ... first"',
        r2.status === 409 && /restore category/i.test(errOf(r2)), `status ${r2.status}: ${errOf(r2)}`);
      info(`409 says: ${errOf(r2)}`);
    }
    const r3 = await api('DELETE', `/api/recycle-bin/categories/${category.id}`);
    check('delete forever category while children are in the bin -> 409', r3.status === 409, `status ${r3.status}: ${errOf(r3)}`);
    info(`409 says: ${errOf(r3)}`);
    compareSnaps('reports identical to baseline after category scenario', baseline, await capture('2-after-category'));
  }

  heading('5. Delete forever (children before parents)');
  if (deal && softDone.deal) await deleteForever('deals', deal, 'deal');
  if (item && softDone.item) await deleteForever('menuItems', item, 'menu item');
  for (const it of itemsDeleted) await deleteForever('menuItems', it, 'category item');
  if (category && categoryDeleted) await deleteForever('categories', category, 'category');
  if (customer && softDone.customer) await deleteForever('customers', customer, 'customer');
  if (waiter && softDone.waiter) await deleteForever('waiters', waiter, 'waiter');
  if (user && softDone.user) await deleteForever('users', user, 'user');
  info(`tombstoned names allowed to gain "${TOMBSTONE_SUFFIX}": ${[...tombstoned].map((n) => JSON.stringify(n)).join(', ') || '(none)'}`);
  const afterForever = await capture('3-after-forever');
  compareSnaps('reports equal baseline after delete forever (only "(Deleted)" name suffix allowed)', baseline, afterForever, tombstoned);

  heading('6. Restore round-trip');
  const candidates = [
    ['riders', 'riderId', 'name', '/api/staff/riders', 'rider', []],
    ['diningTables', 'tableId', 'tableNumber', '/api/staff/tables', 'dining table', []],
    ['waiters', 'waiterId', 'name', '/api/staff/waiters', 'waiter', [waiter?.id].filter(Boolean)],
  ];
  let rt = null;
  for (const [table, col, nameCol, base, label, exclude] of candidates) {
    const rec = await pickByOrderColumn(table, col, nameCol, exclude);
    if (rec && rec.n > 0) { rt = { table, base, label, ...rec }; break; }
  }
  check('picked a record with history for the round trip', !!rt, 'no rider / table / waiter with order history');
  info(rt ? `${rt.label} ${rt.name} (${rt.id}) orders=${rt.n}` : 'NONE');
  let roundTripSnap = afterForever;
  if (rt) {
    if (await softDelete(`${rt.label} ${rt.name}`, `${rt.base}/${rt.id}`)) {
      compareSnaps('reports unchanged after round-trip soft delete', afterForever, await capture('4-roundtrip-deleted'));
      const bin = await api('GET', '/api/recycle-bin');
      check('GET /api/recycle-bin (admin) -> 200 and lists the deleted record',
        bin.status === 200 && Array.isArray(bin.body) && bin.body.some((e) => e.id === rt.id && e.type === rt.table),
        `status ${bin.status}: ${errOf(bin)}`);
      const rs = await api('POST', `/api/recycle-bin/${rt.table}/${rt.id}/restore`);
      check(`restore ${rt.label} via the bin -> 200`, rs.status === 200, `status ${rs.status}: ${errOf(rs)}`);
      const live = await api('GET', `${rt.base}/${rt.id}`);
      check(`${rt.label} is live again (GET by id -> 200)`, live.status === 200 && live.body?.id === rt.id, `status ${live.status}: ${errOf(live)}`);
      const [row] = await q(`SELECT deletedAt FROM ${rt.table} WHERE id = $1`, [rt.id]);
      check(`${rt.label} deletedAt is NULL in the database`, !!row && row.deletedat === null, JSON.stringify(row));
      roundTripSnap = await capture('5-roundtrip-restored');
      compareSnaps('reports unchanged after restore', afterForever, roundTripSnap);
    }
  }

  heading('7. Report totals vs direct SQL');
  await totalsCheck('final', roundTripSnap);

  heading('8. Bin rules');
  const tbl = (await q(
    `SELECT t.id, t.tableNumber AS name FROM diningTables t
      WHERE t.deletedAt IS NULL AND EXISTS (SELECT 1 FROM orders o WHERE o.tableId = t.id AND o.status = 'open') ORDER BY t.id LIMIT 1`,
  ))[0];
  if (!tbl) {
    check('dining table on an open order -> 409 naming the order', false, 'no live table with an open order in pos_verify');
  } else {
    const open = (await q("SELECT orderNumber FROM orders WHERE tableId = $1 AND status = 'open'", [tbl.id])).map((r) => r.ordernumber);
    const r = await api('DELETE', `/api/staff/tables/${tbl.id}`);
    check(`delete table ${tbl.name} on open order(s) ${open.join(', ')} -> 409 naming an order`,
      r.status === 409 && open.some((n) => errOf(r).includes(n)), `status ${r.status}: ${errOf(r)}`);
    info(`409 says: ${errOf(r)}`);
    if (r.status === 200) await api('POST', `/api/recycle-bin/diningTables/${tbl.id}/restore`);
  }
  const sb = await api('GET', '/api/recycle-bin', STAFF_TOKEN);
  check('GET /api/recycle-bin with a non-admin token -> 403', sb.status === 403, `status ${sb.status}: ${errOf(sb)}`);
  const ab = await api('GET', '/api/recycle-bin');
  check('GET /api/recycle-bin with the admin token -> 200', ab.status === 200 && Array.isArray(ab.body), `status ${ab.status}: ${errOf(ab)}`);
}

let crashed = false;
try {
  await main();
} catch (e) {
  crashed = true;
  console.error(`\nUNEXPECTED ERROR: ${e?.stack || e}`);
} finally {
  await db.end().catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== SUMMARY: ${results.length - failed.length}/${results.length} checks passed${crashed ? ', script CRASHED' : ''} ===`);
failed.forEach((f) => console.log(`  FAILED: ${f.name}`));
const pass = failed.length === 0 && !crashed;
console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(pass ? 0 : 1);
