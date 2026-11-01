// One-off repair for orders that were paid twice before the overpayment guard existed.
//
// For each over-paid order it removes the most recent payments, but only while the earlier
// payments still cover the order total, so no order is ever left under-paid. Every removed row
// is first copied to removed_duplicate_payments and an auditLogs row is written for it.
// Covers both live payments and archived pastPayments. Runs in one transaction.
//
//   node scripts/remove-duplicate-payments.mjs           # dry run: prints the plan, changes nothing
//   node scripts/remove-duplicate-payments.mjs --apply   # commits the removal
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
const apply = process.argv.includes('--apply');
const useSsl = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
});

const TOLERANCE = 0.01;
const SOURCES = [
  { payments: 'payments', orders: 'orders' },
  { payments: 'pastPayments', orders: 'pastOrders' },
];

// Surplus payments: walking back from the latest, a payment is surplus while the payments
// made before it still add up to the order total.
const surplusSql = ({ payments, orders }) => `
  SELECT p.id, p.orderId, o.orderNumber, o.total, p.amount, p.createdAt,
         SUM(p.amount) OVER (PARTITION BY p.orderId) AS paid,
         SUM(p.amount) OVER (PARTITION BY p.orderId ORDER BY p.createdAt DESC, p.id DESC) AS fromLatest
  FROM ${payments} p JOIN ${orders} o ON o.id = p.orderId`;

await client.connect();
try {
  await client.query('BEGIN');
  await client.query(`CREATE TABLE IF NOT EXISTS removed_duplicate_payments AS
    SELECT p.*, ''::text AS sourceTable, now() AS removedAt FROM payments p WHERE false`);

  const summary = [];
  for (const source of SOURCES) {
    const { rows } = await client.query(
      `SELECT id, orderNumber, total, amount, createdAt FROM (${surplusSql(source)}) s
       WHERE paid > total + $1 AND paid - fromLatest >= total - $1
       ORDER BY createdAt`,
      [TOLERANCE]
    );
    if (rows.length === 0) {
      summary.push({ table: source.payments, removed: 0, amount: 0 });
      continue;
    }

    const ids = rows.map((r) => r.id);
    await client.query(
      `INSERT INTO removed_duplicate_payments SELECT p.*, $2, now() FROM ${source.payments} p WHERE p.id = ANY($1)`,
      [ids, source.payments]
    );
    await client.query(
      `INSERT INTO auditLogs (id, userId, action, tableName, recordId, before, after, description, createdAt)
       SELECT gen_random_uuid()::text, p.receivedBy, 'delete', $2, p.id, row_to_json(p)::text, NULL,
              '[DUPLICATE_PAYMENT_REMOVED] Surplus payment of ' || p.amount || ' removed; order was already fully paid',
              now()
       FROM ${source.payments} p WHERE p.id = ANY($1)`,
      [ids, source.payments]
    );
    const deleted = await client.query(`DELETE FROM ${source.payments} WHERE id = ANY($1)`, [ids]);

    const amount = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    summary.push({ table: source.payments, removed: deleted.rowCount, amount });
    console.log(`\n${source.payments}: removing ${deleted.rowCount} surplus payments`);
    console.table(rows.map((r) => ({ order: r.ordernumber, total: Number(r.total), removed: Number(r.amount), createdAt: r.createdat })));
  }

  // Nothing may be left over-paid by this script.
  for (const { payments, orders } of SOURCES) {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM (SELECT o.id FROM ${payments} p JOIN ${orders} o ON o.id = p.orderId
       GROUP BY o.id, o.total HAVING SUM(p.amount) > o.total + $1) x`,
      [TOLERANCE]
    );
    if (rows[0].n !== 0) throw new Error(`${payments}: ${rows[0].n} orders still over-paid after cleanup; rolled back`);
  }

  console.log('\nSummary:');
  console.table(summary);
  await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  console.log(apply ? 'APPLIED: changes committed.' : 'DRY RUN: rolled back, nothing changed. Re-run with --apply to commit.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error('Rolled back:', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
