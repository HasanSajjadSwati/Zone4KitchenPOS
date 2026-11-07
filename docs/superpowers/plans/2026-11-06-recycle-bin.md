# Recycle Bin and safe deletes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every delete for the 12 in-scope types works, admins can restore or delete forever from a Recycle Bin, and no sales report changes because of a delete.

**Architecture:** Rows are never physically removed while anything points at them. One backend registry describes, per type, the SQL that answers "who uses this / who is its parent / what must be wiped"; one service implements delete, restore and delete forever on top of it; every existing DELETE route delegates to that service. List endpoints hide deleted rows by default (`?includeDeleted=true` opts in); fetch-by-id never hides them, so history keeps resolving names.

**Tech Stack:** Express + `pg` (PostgreSQL 16), React + TypeScript (Vite), vitest. Branch `feat/recycle-bin` cut from `fix/full-table-downloads-audit-user-delete` (PR #2, open and already deployed).

**Spec:** `docs/superpowers/specs/2026-11-06-recycle-bin-design.md`

## Global Constraints

- Tombstone name suffix, exactly: `" (Deleted)"` (e.g. `Fahad (Deleted)`).
- Unlinked-sales line label, exactly: `Deleted items (name not recorded)`. One constant on each side: `backend/src/constants/recycle.ts` and `src/constants/recycle.ts`, both exporting `DELETED_ITEMS_LABEL`.
- In-scope types (registry keys): `users, customers, waiters, riders, diningTables, employees, roles, categories, variants, menuItems, deals, expenses`.
- New columns on each of those 12 tables: `deletedAt TIMESTAMPTZ`, `deletedBy TEXT`, `purgedAt TIMESTAMPTZ`. Declare them in `backend/src/db/schema.ts` too, or `database.ts` returns them lowercase.
- Postgres booleans: write `TRUE`/`FALSE` or bind JS booleans, never `0/1`.
- Audit rows: `action` must be one of the CHECK list; use `delete` with description prefix `[DELETE]` / `[DELETE_FOREVER]`, and `restore` with `[RESTORE]`. `userId` is the token user (`res.locals.authUser.id`).
- Admin = the token user's role name, case-insensitive `admin`, read from the database. Never trust a client-sent `adminUserId` for Recycle Bin endpoints.
- "Open work" = `orders.status = 'open'`.
- Every SQL statement added must be run against a real Postgres (Task 9) before deploy; vitest fakes cannot catch type or casing errors.

## Review Focus

- **Two admins act on the same bin item at once** (one restores while the other deletes forever): the second action must answer 409 "no longer in the Recycle Bin", never tombstone a restored row. Test in Task 3.
- **Deleting something already deleted, or restoring something live**: 409, and no second audit row. Test in Task 3.
- **Logged-in staff deleted mid-shift**: their next API call fails (401) within 30 s, not at token expiry. Test in Task 6.
- **New customer with a deleted customer's phone**: allowed, and phone lookup on a new order finds the live one, never the deleted one. Test in Task 4.
- **Expense deleted inside an open register session**: the session's expense total and expense reports drop it, sales reports do not move. Test in Task 4.

---

### Task 1: Schema, migration and existing data

**Files:**
- Modify: `backend/src/db/schema.ts` (12 `CREATE TABLE` blocks)
- Modify: `backend/src/db/migrate.ts` (after the existing `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` block; replace the single `users.deletedAt` line added in PR #2)
- Modify: `backend/src/db/database.ts` (export `normalizeRowKeys` for the test)
- Create: `backend/src/constants/recycle.ts`, `backend/src/db/migrate.test.ts`, `backend/src/db/database.test.ts`

**Interfaces:**
- Produces: `RECYCLE_TABLES: readonly string[]` (the 12 table names, camelCase as in schema.ts) and `DELETED_ITEMS_LABEL`, `TOMBSTONE_SUFFIX = ' (Deleted)'` in `backend/src/constants/recycle.ts`; exported `normalizeRowKeys(row)`.

- [ ] **Step 1: Write failing tests**
  - `database.test.ts › maps the new soft-delete columns to camelCase`: `normalizeRowKeys({ deletedat: 'x', deletedby: 'u', purgedat: null })` equals `{ deletedAt: 'x', deletedBy: 'u', purgedAt: null }` (mock `pg` so no pool connects).
  - `migrate.test.ts › adds deletedAt, deletedBy and purgedAt to every recycle table`: capture `runAsync` SQL from `initializeDatabase()`; for each of `RECYCLE_TABLES` expect three `ADD COLUMN IF NOT EXISTS` statements.
  - `migrate.test.ts › makes the five unique names unique only among live rows`: expects `DROP CONSTRAINT IF EXISTS` for `users_username_key, customers_phone_key, diningtables_tablenumber_key, employees_cnic_key, roles_name_key` and a `CREATE UNIQUE INDEX IF NOT EXISTS … WHERE deletedAt IS NULL` on `users(username)`, `customers(phone)`, `diningTables(tableNumber)`, `employees(cnic)`, `roles(name)`.
  - `migrate.test.ts › restores usernames renamed by the first user soft delete`: expects `UPDATE users SET username = split_part(username, '.deleted.', 1) WHERE deletedAt IS NOT NULL AND username LIKE '%.deleted.%'`, issued after the unique index statements.
- [ ] **Step 2: Run** `npx vitest run backend/src/db` → FAIL.
- [ ] **Step 3: Implement** constants, schema columns, migration statements (all idempotent; order: columns → drop constraints → partial indexes → username restore), export `normalizeRowKeys`.
- [ ] **Step 4: Run** `npx vitest run backend/src/db` → PASS; `cd backend && npx tsc --noEmit` → clean.
- [ ] **Step 5: Commit** `feat(db): soft-delete columns and live-only unique names`.

### Task 2: Recycle registry

**Files:**
- Create: `backend/src/recycle/registry.ts`, `backend/src/recycle/registry.test.ts`

**Interfaces:**
- Produces:

```ts
export type RecycleType = 'users' | 'customers' | 'waiters' | 'riders' | 'diningTables' | 'employees'
  | 'roles' | 'categories' | 'variants' | 'menuItems' | 'deals' | 'expenses';
export interface NamedCheck { label: string; sql: string }   // sql: one `?` = the record id
export interface RecycleTypeDef {
  type: RecycleType;
  table: string;                 // e.g. 'diningTables'
  label: string;                 // singular, e.g. 'Dining table'
  nameSql: string;               // SQL expression for the display name, e.g. 'fullName', 'tableNumber'
  nameColumn: string | null;     // column that receives TOMBSTONE_SUFFIX; null for expenses
  uniqueColumn: string | null;   // username | phone | tableNumber | cnic | name | null
  history: NamedCheck[];         // COUNT(*) AS n of rows pointing at it → tombstone instead of remove
  liveDependents: NamedCheck[];  // rows returning name: live rows that block a normal delete
  openWork: NamedCheck[];        // rows returning name (order number): unfinished work that blocks a delete
  binParents: NamedCheck[];      // rows returning name: parents still in the bin → restore refused
  binChildren: NamedCheck[];     // rows returning name: children still in the bin → delete forever refused
  plainChildren: { table: string; column: string }[]; // removed with the row on a real removal
  wipe: Record<string, string | number | null>;       // column → value on tombstone
}
export const RECYCLE_TYPES: Record<RecycleType, RecycleTypeDef>;
export function getTypeDef(type: string): RecycleTypeDef | null;
```

Values the spec pins (copy exactly):
- `history` per type — users: `orders.createdBy`, `orders.completedBy`, `pastOrders.createdBy`, `pastOrders.completedBy`, `payments.receivedBy`, `pastPayments.receivedBy`, `auditLogs.userId`, `registerSessions.openedBy`, `registerSessions.closedBy`, `expenses.createdBy`, `kotPrints.printedBy`, `riderReceipts.printedBy`, `employeeLoans.issuedBy`; customers/waiters/riders/diningTables: `orders.<customerId|waiterId|riderId|tableId>` and the same column on `pastOrders`; employees: `employeeLoans.employeeId`; roles: `users.roleId`; categories: `categories.parentId`, `menuItems.categoryId`, `deals.categoryId`; variants: `menuItemVariants.variantId`, `dealVariants.variantId`; menuItems: `orderItems.menuItemId`, `pastOrderItems.menuItemId`, `dealItems.menuItemId`; deals: `orderItems.dealId`, `pastOrderItems.dealId`; expenses: none.
- `liveDependents` — categories: live menu items, live deals, live subcategories; variants: live menu items via `menuItemVariants`, live deals via `dealVariants`; roles: live users; menuItems: live deals via `dealItems`. ("Live" = `deletedAt IS NULL`.)
- `openWork` — diningTables/waiters/riders/customers: open orders with that id; menuItems/deals: open orders with an order item of that id; employees: the outstanding-loan condition currently used by `DELETE /api/employees/:id` (read it there and move it here).
- `binParents` — menuItems: category; deals: category, menu items in `dealItems`, variants in `dealVariants`; categories: parent category; users: role; menuItems also: variants in `menuItemVariants`. ("In the bin" = `deletedAt IS NOT NULL AND purgedAt IS NULL`.)
- `binChildren` — the inverse of `binParents`.
- `plainChildren` — menuItems: `menuItemVariants.menuItemId`; deals: `dealItems.dealId`, `dealVariants.dealId`; variants: `variantOptions.variantId`.
- `wipe` — users: `username` → `'deleted-' || id` (set in the service), `passwordHash` → `'!'` (bcrypt never matches it); customers: `phone ''`, `address null`, `notes null`; waiters, riders: `phone null`; employees: `phone null`, `cnic null`, `salary 0`, `notes null`; categories/variants: none; menuItems/deals: `description null`.

- [ ] **Step 1: Write failing tests** — `registry.test.ts`: `defines all 12 types`; `every check has exactly one ? placeholder`; `getTypeDef('nope')` is `null`; `only expenses has no name column`; `history for users covers the 13 columns listed in the plan` (compare a set of `table.column` parsed from the SQL).
- [ ] **Step 2: Run** `npx vitest run backend/src/recycle/registry.test.ts` → FAIL.
- [ ] **Step 3: Implement** `registry.ts`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(recycle): registry of what each type depends on`.

### Task 3: Recycle service

**Files:**
- Create: `backend/src/recycle/recycleService.ts`, `backend/src/recycle/recycleService.test.ts`
- Modify: `backend/src/db/database.ts` only if `withTransaction`'s client lacks `allAsync` (add it)

**Interfaces:**
- Consumes: `RECYCLE_TYPES`, `getTypeDef` (Task 2); `TOMBSTONE_SUFFIX` (Task 1); `withTransaction` from `database.ts`.
- Produces:

```ts
export type RecycleResult =
  | { ok: true; outcome?: 'removed' | 'tombstoned' }
  | { ok: false; status: 400 | 404 | 409; error: string };
export function softDelete(type: RecycleType, id: string, actorId: string): Promise<RecycleResult>;
export function restore(type: RecycleType, id: string, actorId: string): Promise<RecycleResult>;
export function deleteForever(type: RecycleType, id: string, actorId: string): Promise<RecycleResult>;
export interface BinEntry { type: RecycleType; typeLabel: string; id: string; name: string; deletedAt: string;
  deletedBy: string | null; deletedByName: string | null; usedBy: { label: string; count: number }[] }
export function listBin(type?: RecycleType): Promise<BinEntry[]>;
```

Behaviour (each mutating call runs in one transaction and locks the row with `SELECT … FOR UPDATE`, then re-checks state):
- `softDelete`: 404 if missing; 409 `"Already in the Recycle Bin"` if `deletedAt` set; 409 naming up to 5 rows (and the total) if any `liveDependents` or `openWork` returns rows, e.g. `Cannot delete: used by 12 live menu items (Zinger, Fries, …). Move or delete them first.` / `Cannot delete: on 3 open orders (ORD-01021, …). Finish or cancel them first.`; otherwise set `deletedAt = now`, `deletedBy = actorId`, audit `[DELETE]`.
- `restore`: 409 `"Not in the Recycle Bin"` unless `deletedAt` set and `purgedAt` null; 409 naming deleted parents (`Restore category Drinks first`); 409 if `uniqueColumn` value is taken by a live row (`The username "fahad" is now used by another user`); otherwise clear `deletedAt`/`deletedBy`, audit `[RESTORE]` with action `restore`.
- `deleteForever`: same "in the bin" guard; 409 naming `binChildren`; sum `history` counts; 0 → delete `plainChildren` rows then the row, outcome `removed`; >0 → append `TOMBSTONE_SUFFIX` to `nameColumn`, apply `wipe`, set `purgedAt = now`, outcome `tombstoned`; audit `[DELETE_FOREVER]` stating the outcome.
- `listBin`: rows with `deletedAt IS NOT NULL AND purgedAt IS NULL` across all types (or one), newest first, `usedBy` = non-zero `history` counts, `deletedByName` from `users.fullName`.

- [ ] **Step 1: Write failing tests** (fake `database.js` with an in-memory store per table that also enforces "boolean columns reject integers", as `orders.test.ts` does): `soft-deletes a waiter with history and keeps the row`; `refuses a category used by live menu items, naming them`; `refuses a dining table on an open order, naming the order`; `refuses a second delete of the same row (409) and writes one audit row`; `restore clears the mark`; `restore refuses while the category is in the bin`; `restore refuses when the username is now taken`; `restore of a live row is 409`; `delete forever of an unused table removes it`; `delete forever of a menu item with sales tombstones it as "Zinger (Deleted)", clears description, keeps it out of listBin`; `delete forever removes plainChildren on removal only`; `delete forever refuses while its menu items are in the bin`; `delete forever after a concurrent restore answers 409` (restore first, then deleteForever on the same id); `listBin returns usedBy counts and the deleter's name`; `user tombstone frees the username and makes the password unusable`.
- [ ] **Step 2: Run** `npx vitest run backend/src/recycle` → FAIL.
- [ ] **Step 3: Implement** `recycleService.ts`.
- [ ] **Step 4: Run** → PASS; backend `tsc` clean.
- [ ] **Step 5: Commit** `feat(recycle): delete, restore and delete forever`.

### Task 4: Existing routes use the service; lists hide deleted rows

**Files:**
- Modify: DELETE and list GET handlers in `backend/src/routes/{users,customers,staff,employees,roles,categories,variants,menuItems,deals,expenses}.ts`
- Modify: every server-side expense sum (`grep -rn "FROM expenses" backend/src` — summary route, register-session close)
- Create: `backend/src/recycle/liveFilter.ts`, `backend/src/routes/softDeleteRoutes.test.ts`
- Modify: `backend/src/routes/users.test.ts` (rename-based assertions are replaced)

**Interfaces:**
- Consumes: `softDelete` (Task 3).
- Produces: `liveOnly(req: Request, alias?: string): string` → `''` when `req.query.includeDeleted === 'true'`, else `"<alias.>deletedAt IS NULL"`; list routes AND it into their WHERE.

Rules: each DELETE handler keeps its current permission checks, then returns `softDelete(type, req.params.id, res.locals.authUser.id)` as HTTP status + `{ error }` or `{ message: 'Moved to the Recycle Bin' }`. The menuItems and deals handlers no longer touch `orderItems`/`pastOrderItems`, `menuItemVariants`, `dealItems`, `dealVariants`. The users handler drops the rename. `GET …/:id` stays unfiltered. `GET /customers/phone/:phone` returns only a live customer. Expense list, summary and register-session expense totals exclude deleted expenses.

- [ ] **Step 1: Write failing tests** — `softDeleteRoutes.test.ts`, parametrised over the 12 DELETE endpoints with `softDelete` mocked: `DELETE <path> calls softDelete(<type>, id, token user)` and maps `{ok:false,status:409}` to 409. Plus: `GET /api/waiters omits deleted rows`; `GET /api/waiters?includeDeleted=true includes them`; `GET /api/menu-items/:id returns a deleted item`; `phone lookup ignores a deleted customer with the same phone`; `menu item delete no longer unlinks order items` (assert no `UPDATE orderItems` SQL); `expense summary excludes deleted expenses`.
- [ ] **Step 2: Run** `npx vitest run backend/src/routes` → FAIL.
- [ ] **Step 3: Implement** `liveFilter.ts` and the route changes.
- [ ] **Step 4: Run** full `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `fix: every delete moves the record to the Recycle Bin`.

### Task 5: Recycle Bin API

**Files:**
- Create: `backend/src/auth/requireAdmin.ts`, `backend/src/routes/recycleBin.ts`, `backend/src/routes/recycleBin.test.ts`
- Modify: `backend/src/server.ts` (mount `/api/recycle-bin`)

**Interfaces:**
- Consumes: `listBin`, `restore`, `deleteForever`, `getTypeDef`.
- Produces: `requireAdmin` Express middleware (403 `{ error: 'Admins only' }`); routes `GET /api/recycle-bin?type=` → `BinEntry[]`; `POST /api/recycle-bin/:type/:id/restore`; `DELETE /api/recycle-bin/:type/:id` → `{ outcome }`. Unknown type → 400.

- [ ] **Step 1: Write failing tests**: `non-admin gets 403 even when sending adminUserId of an admin`; `admin lists the bin`; `restore and delete forever pass the token user as actor`; `unknown type is 400`; `service 409 is passed through with its message`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(recycle): admin-only Recycle Bin API`.

### Task 6: Deleted records cannot start new work

**Files:**
- Modify: `backend/src/routes/auth.ts` (login `WHERE username = ? AND deletedAt IS NULL`)
- Create: `backend/src/auth/requireLiveUser.ts` (+ test); Modify: `backend/src/server.ts` (mount after `requireAuth`)
- Modify: `backend/src/routes/orders.ts` (`recordExists` → also requires `deletedAt IS NULL` for create/update of `tableId, waiterId, riderId, customerId`; `POST /:id/items` rejects a deleted `menuItemId`/`dealId` with 400)
- Test: `backend/src/routes/orders.test.ts`, `backend/src/auth/auth.test.ts`

**Interfaces:**
- Produces: `requireLiveUser(lookup?: (id: string) => Promise<boolean>)` middleware; skips public paths like `requireAuth`; 401 `{ error: 'Authentication required' }` when the token user is missing, inactive or deleted; caches each verdict 30 s.

- [ ] **Step 1: Write failing tests**: `login refuses a deleted user and finds the live user with the same username`; `a deleted user's token is rejected on the next request after the cache window`; `adding a deleted menu item to an order is 400`; `creating an order with a deleted waiter is 400`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** full suite → PASS.
- [ ] **Step 5: Commit** `fix: deleted users and records cannot be used for new work`.

### Task 7: Reports keep every sale

**Files:**
- Modify: `backend/src/routes/reports.ts` (`/item-sales`, `/deal-sales`, `/category-sales`, `/category-sales-detailed`)
- Modify: `src/services/reportService.ts` (client paths at the `db.menuItems/deals/categories.toArray()` sites listed in Task 8)
- Test: `backend/src/routes/reports.test.ts`, `src/services/reportService.test.ts` (create)

Rules: switch the item/category joins to `LEFT JOIN`; rows with a NULL item (item sales, category reports) or NULL deal (deal sales) are grouped into one row named `DELETED_ITEMS_LABEL` (id `null`). Category reports include only `itemType = 'menu_item'` lines, as today. `/category-sales-detailed` builds its tree from all categories, keeping a deleted or inactive category only if it or a subcategory has sales in the range, and appends one major entry named `DELETED_ITEMS_LABEL` (no subcategories) when unlinked sales exist. Client register-session versions do the same.

- [ ] **Step 1: Write failing tests**: `item sales returns a "Deleted items (name not recorded)" row for unlinked lines`; `deal sales does the same for deals`; `category sales counts unlinked menu-item lines under the label and never deal lines`; `detailed category tree keeps a deleted category that had sales and drops one that had none`; `item sales of a tombstoned item keeps its rows under "Zinger (Deleted)"`; client: `session item sales adds the label row with the same totals the server computes`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `fix(reports): count deleted and unlinked items`.

### Task 8: Client — history sees deleted rows, lists don't, Recycle Bin tab

**Files:**
- Modify: `src/services/api.ts` (list methods take `opts?: { includeDeleted?: boolean }`: `getUsers, getCustomers, getWaiters, getRiders, getDiningTables, getEmployees, getRoles, getCategories, getVariants, getMenuItems, getDeals`; add `getRecycleBin(type?)`, `restoreRecycleItem(type, id)`, `deleteRecycleItemForever(type, id)`)
- Modify: `src/db/index.ts` (add `toArrayWithDeleted()` to `users, waiters, riders, categories, menuItems, deals`)
- Modify history consumers to use `toArrayWithDeleted()`: `src/services/reportService.ts` (the `db.*.toArray()` calls at ~522, 523, 593, 762, 763, 841, 893, 947, 997, 1219, 1220, 1331, 1533, 1534), `src/components/OrderDetailModal.tsx`, `src/pages/Orders/PastOrders.tsx`
- Modify: `src/db/types.ts` (`SoftDeletable { deletedAt?: string | null; deletedBy?: string | null; purgedAt?: string | null }` extended by the 12 entity types)
- Modify: `src/services/settingsService.ts` + its test (drop the client-side `deletedAt` filter; the server now excludes)
- Create: `src/constants/recycle.ts`, `src/services/recycleBinService.ts` (+ test), `src/pages/Settings/RecycleBin.tsx`
- Modify: `src/pages/Settings/Settings.tsx` (`TabType` gains `'recycle'`; tab `Recycle Bin` shown only when `isAdmin`)

UI (my calls within the spec): a type filter (All + 12 types), a name search, a table with Type, Name, Deleted, Deleted by, Used by, and Restore / Delete forever buttons. Delete forever confirm text: `"<name>" is used by <usedBy>. It will stay on that history as "<name> (Deleted)" and cannot be restored.` or, when unused, `"<name>" is not used anywhere and will be removed completely.` Show the server's 409 message verbatim in an alert.

- [ ] **Step 1: Write failing tests**: `api getMenuItems({ includeDeleted: true }) requests ?includeDeleted=true`; `db.menuItems.toArrayWithDeleted() asks for deleted rows`; `recycleBinService.restore calls POST /recycle-bin/menuItems/<id>/restore`; `reportService waiter performance resolves a deleted waiter's name`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** full suite, `npx tsc --noEmit -p .`, `npx vite build --outDir <scratch>` → all green.
- [ ] **Step 5: Commit** `feat(recycle): Recycle Bin tab and deleted-aware history`.

### Task 9: Prove it on a copy of production, then deploy

**Files:**
- Create: `backend/scripts/verify-recycle-bin.mjs` (talks to a running instance over HTTP)

- [ ] **Step 1: Build a scratch copy.** On the VPS: `createdb pos_verify` and `pg_restore -d pos_verify` from a fresh `pg_dump -Fc` of production (take it into a new `/root/pos-backups/<date>-pre-recycle-bin/`, which is also the deploy backup).
- [ ] **Step 2: Run the new build against it** on port 3099 with `DATABASE_URL` pointing at `pos_verify`, `NODE_ENV=production`, same `AUTH_SECRET`; the startup migration runs on the copy. Check its log for errors and that the six usernames are back.
- [ ] **Step 3: Run the script.** It logs in as an existing admin (token minted with the copy's admin user id), captures every sales report endpoint (`sales-summary, daily-sales, item-sales, item-variant-sales, deal-sales, category-sales, category-sales-detailed`) for: today, the last 30 days, all time; then deletes and deletes forever a user, a customer, a waiter, a menu item, a deal and a category with heavy history (picking ones without open orders); restores one other; recaptures; and diffs. Pass = identical rows and totals, differences limited to the `(Deleted)` suffix on forever-deleted names; plus each item/deal/category report total equals the matching `orderItems + pastOrderItems` sum computed directly in SQL.
- [ ] **Step 4: Exercise the bin rules** against the copy: a 409 for a category with live items, a 409 for a table on an open order, restore of a child whose parent is in the bin refused, non-admin 403.
- [ ] **Step 5: Tear down** the port-3099 process and `dropdb pos_verify`.
- [ ] **Step 6: Deploy** exactly as in PR #2: build beside live (`dist.new`), compare changed files, swap, `pm2 restart pos-backend`, health check, error-log byte check, verify the six usernames and the bin on production with a read-only GET.
- [ ] **Step 7: Commit and push** `feat/recycle-bin`, open a PR against `main` stacked on PR #2 (or retarget after PR #2 merges). Update the memory note.
