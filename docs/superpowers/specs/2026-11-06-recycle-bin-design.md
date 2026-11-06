# Recycle Bin and safe deletes — design

Date: 2026-11-06 · Status: reviewed by a builder check, awaiting owner approval · Repo: Zone4KitchenPOS (React + Express + PostgreSQL, live on one VPS under pm2)

## Why

Deleting things in the POS is broken in two opposite ways:

1. **Most deletes fail.** Every foreign key in the database is `ON DELETE NO ACTION`, and almost everything has history pointing at it. Live counts on 2026-11-06: customers 328 of 350 cannot be deleted, waiters 8/9, riders 11/12, dining tables 2/26, categories 35/37, variants 70/78, roles 3/3, employees 1/5. Users were the same until a first soft-delete fix (PR #2), which works but renames usernames to `name.deleted.<ms>` and still shows deleted users in Settings (the API returns the key as `deletedat`, the screen reads `deletedAt`).
2. **Menu item and deal deletes "succeed" by destroying history.** They set `orderItems.menuItemId` / `dealId` to NULL before deleting, and the item, deal and category sales reports inner-join `menuItems` / `deals` / `categories`, so those sales vanish from the reports. Already lost this way: 1,776 sold lines worth Rs 1,700,496 (deals 1,556 lines / Rs 1,575,936; menu items 220 lines / Rs 124,560), with no item name stored on those lines.

The owner wants deletes that work, can be undone by an admin, can be made permanent by an admin, and **never change what a sales report says**.

## What the owner decided

- **Admins only** use the Recycle Bin.
- Its main job is undoing mistaken deletes (**Restore**); admins also need **Delete forever**.
- Delete forever must work even when history points at the item (option "B"). History keeps the real name, shown as **`Fahad (Deleted)`** — exactly that form.
- **Deleting anything, normally or forever, must not affect sales reports in any manner.**
- The sales already lost get one report line, **"Deleted items (name not recorded)"**, so report totals match real sales again.

## Goals

- Every delete button for the in-scope types below works, including for items with history.
- A deleted item disappears from management lists and pickers (new orders, menu, staff selection) but stays visible, under its real name, on past orders, receipts, register sessions, audit logs and reports.
- Admins can see everything deleted in one place and Restore it, or Delete forever.
- Sales report numbers are identical before and after any delete, restore or delete forever.

## Non-goals

- Deleting orders, order items or payments (they have their own cancel / lock / audit rules).
- Erasing a customer's details from their past orders (orders keep their own copy of customer name and phone; option "C" was not chosen).
- Automatic clearing of the bin after N days.
- Re-attaching the 1,776 already-unlinked sales to their original items (the link and the name are gone).

## Anti-goals (failure even if it "works")

- Any sales report total, row or count changes because something was deleted, restored or deleted forever.
- A past order, receipt or report loses the name of who or what it refers to.
- A deleted user can log in, or a deleted item can be put on a new order.
- A deleted record blocks reusing its username, phone, table number, CNIC or role name.
- A non-admin can see the bin, restore, or delete forever (checked on the server, not only hidden in the UI).

## Scope

In the bin (soft delete + restore + delete forever): **users, customers, waiters, riders, dining tables, employees, roles, categories, variants, menu items, deals, expenses.**

Out of the bin (stay as plain deletes, my call — nothing in history depends on them; orders store their own copy): variant options, a menu item's variant links, deal items, deal variants. They are removed together with their parent on delete forever.

## Behaviour

### Delete (by whoever already has delete permission today)

- The row is kept and marked deleted (who, when). Nothing that points at it is changed or unlinked. In particular menu item and deal deletes **stop** setting `orderItems.menuItemId` / `dealId` to NULL.
- It disappears from management lists, pickers and lookups used for new work (e.g. customer lookup by phone on a new order treats a deleted customer as not found).
- It stays resolvable everywhere history is shown: receipts, order history, register sessions, audit log, and every report.
- A deleted user can no longer log in (and existing logins for that user stop working on the next request — my call).
- **Dependency rule (my call):** a category, variant or role still used by live (not deleted) menu items, deals, subcategories or users cannot be deleted; the error names what uses it ("Used by 12 menu items: …"). Same for a menu item that is part of a live deal. This keeps live menu items from ending up with no category and users with no role.
- **Open work rule (my call):** a record used by unfinished work cannot be deleted until that work is finished or cancelled; the error says where ("On 3 open orders: #ORD-…"). This covers a dining table, waiter, rider or customer on an open order, a menu item or deal on an open order, and (as today) an employee with a loan still outstanding. So open orders never contain a deleted record, and every "add to / save an open order" path can simply reject deleted records like any new order. (38 orders are open on production right now, some possibly stale; the message must name them so they can be closed.)
- Expenses: a deleted expense is excluded from expense lists and expense totals (that is the point of deleting a wrong expense). Sales reports do not include expenses, so they are unaffected.
- Written to the audit log (action `delete`, description tagged `[DELETE]`).

### Recycle Bin (Settings → new "Recycle Bin" tab, admin only)

- Lists every deleted, not-yet-forever-deleted item across all types: type, name, deleted at, deleted by, and what uses it ("Used by 2,322 orders, 1,191 payments" or "Not used anywhere").
- Filter by type and search by name. (Sizes are small — hundreds at most; paging is the builder's call.)
- **Restore:** clears the deleted mark; the item is back exactly as it was. If its unique value (username, phone, table number, CNIC, role name) has since been taken by a live record, restore is refused with a message saying which, and nothing changes. Audit action `restore`.
- **Delete forever:** confirm dialog states the consequence in plain words, then:
  - **Nothing points at it** → the row (and its plain-delete children listed under Scope) is removed from the database.
  - **History points at it** → a tombstone stays so history keeps the name: the display name becomes `<name> (Deleted)`, all personal or sensitive fields are wiped (below), it leaves the bin and can never be restored. Everything pointing at it is untouched, so reports keep the same rows and totals.
  - Audit action `delete`, description tagged `[DELETE_FOREVER]`, recording whether it was removed or tombstoned.

**Things in the bin that depend on each other (my call):** the bin must never produce a live record whose parent is deleted, and never leave a record in the bin pointing at a forever-deleted parent.
- **Restore** is refused while the record's parent is still in the bin, naming the parent ("Restore category Drinks first"). Parent means: a menu item's or deal's category, a subcategory's parent category, a user's role, a menu item or variant that a deal or menu item links to.
- **Delete forever** of a parent is refused while any of its children are still in the bin (not yet forever-deleted), naming them ("Delete forever or restore these 3 menu items first"). Once its children are forever-deleted, the parent follows the normal rule (removed, or tombstoned if a tombstone still points at it).
- Live children are already covered by the dependency rule above.

Wiped on tombstone (display name kept with ` (Deleted)`):

| Type | Name field kept | Wiped |
|---|---|---|
| users | fullName | password (made unusable), username freed |
| customers | name | phone, address, notes |
| waiters, riders | name | phone |
| employees | name | phone, CNIC, salary (to 0), notes |
| dining tables | tableNumber | — |
| roles | name | — |
| categories, variants, menu items, deals | name | description |

(Columns marked NOT NULL get an empty or zero value. Exact handling of the freed username is the builder's call, as long as it can be reused.)

### Reports

- Every report and every history view counts and names deleted and tombstoned records exactly as before. The detailed category report currently builds its tree from `categories WHERE isActive = TRUE`; it must instead include every category that has sales in the range, active, inactive, deleted or tombstoned (my call). Production has 0 inactive categories today, so this changes no current numbers.
- **"Deleted items (name not recorded)"** line, for sold lines whose link is already NULL, so totals add up:
  - item sales report: menu-item lines with NULL `menuItemId` (220 lines, Rs 124,560 all time);
  - deal sales report: deal lines with NULL `dealId` (1,556 lines, Rs 1,575,936 all time);
  - category reports: **menu-item lines only** (my call), because category reports count only `itemType = 'menu_item'` today and live deals never appear in them; adding the deal lines would be the only place deals counted.
- Names are taken from the row as stored, so a tombstoned item shows as `Name (Deleted)` there too. A soft-deleted item shows its plain name.

### Existing data

- The six users deleted on 2026-11-06 get their original usernames back (verified: none clashes with a live user). Their `deletedBy` is unknown and stays empty.
- Users stop being renamed on delete.

## Constraints (things that have already bitten this codebase)

- **Postgres booleans reject integers.** Write `TRUE`/`FALSE` or bind JS booleans; never `= 0/1`.
- **Column-name casing.** Postgres returns lowercase keys; `backend/src/db/database.ts` maps them back to camelCase using the column names declared in `backend/src/db/schema.ts` (plus a small extra map). Every new column must be declared there or the API will send e.g. `deletedat` and the frontend will silently ignore it — exactly the bug that left deleted users visible.
- Schema changes are additive, applied by the startup migration in `backend/src/db/migrate.ts` (`ADD COLUMN IF NOT EXISTS` style), safe to re-run.
- The current unique constraints (`users.username`, `customers.phone`, `diningTables.tableNumber`, `employees.cnic`, `roles.name`) must only apply among non-deleted rows.
- The server's admin checks today trust an `adminUserId` the client sends. The Recycle Bin endpoints must decide "admin" from the logged-in user (`res.locals.authUser`, set from the signed token) looked up in the database.
- Single production server, no CI. Tests: vitest (`npm test` at the repo root runs frontend and backend). Unit tests that fake the database cannot catch SQL-type or column-casing errors; every new statement must also be run against the real database (on production inside a rolled-back transaction, as done for PR #2).

## Proof that reports are unaffected (required before deploy)

On a copy of production data, or on production inside one rolled-back transaction: compute every sales report for several ranges (a recent day, a month, all time), soft-delete and then delete-forever a sample of records with heavy history (a user, a customer, a waiter, a menu item, a deal, a category), recompute, and compare. Rows and totals must be identical; the only allowed difference is the `(Deleted)` suffix on names of forever-deleted records. The "Deleted items (name not recorded)" line must make each report's total equal the sum of the matching order lines.

## Left to the builder

Column and index names; how "deleted" vs "forever-deleted" is stored; endpoint shapes; whether lists filter on the server with an opt-in for history lookups or on the client; Recycle Bin layout and paging; how live sync (websocket) announces deletes and restores; branch strategy (this builds on PR #2, which is open and already deployed).
