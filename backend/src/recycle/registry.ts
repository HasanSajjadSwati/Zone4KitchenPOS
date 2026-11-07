// What each Recycle Bin type depends on. The recycle service runs these SQL checks (one `?` = record id).
// Definitions: live = deletedAt IS NULL; in the bin = deletedAt IS NOT NULL AND purgedAt IS NULL.

export type RecycleType = 'users' | 'customers' | 'waiters' | 'riders' | 'diningTables' | 'employees'
  | 'roles' | 'categories' | 'variants' | 'menuItems' | 'deals' | 'expenses';

export interface NamedCheck { label: string; sql: string }

export interface RecycleTypeDef {
  type: RecycleType;
  table: string;
  label: string;
  nameSql: string;
  nameColumn: string | null;
  uniqueColumn: string | null;
  history: NamedCheck[];
  liveDependents: NamedCheck[];
  openWork: NamedCheck[];
  binParents: NamedCheck[];
  binChildren: NamedCheck[];
  plainChildren: { table: string; column: string }[];
  wipe: Record<string, string | number | null>;
}

const LIVE = 'deletedAt IS NULL';
const inBin = (a = ''): string => { const p = a ? a + '.' : ''; return `${p}deletedAt IS NOT NULL AND ${p}purgedAt IS NULL`; };

const hist = (table: string, column: string, label: string = table): NamedCheck => ({
  label,
  sql: `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`,
});

// orders + pastOrders rows that reference the record through `column`.
const orderHistory = (column: string): NamedCheck[] => [
  hist('orders', column),
  hist('pastOrders', column, 'archived orders'),
];

const openOrdersBy = (column: string): NamedCheck => ({
  label: 'open orders',
  sql: `SELECT orderNumber AS name FROM orders WHERE ${column} = ? AND status = 'open'`,
});

const openOrdersWithItem = (column: 'menuItemId' | 'dealId'): NamedCheck => ({
  label: 'open orders',
  sql: `SELECT DISTINCT o.orderNumber AS name FROM orders o JOIN orderItems oi ON oi.orderId = o.id WHERE oi.${column} = ? AND o.status = 'open'`,
});

const USERS_HISTORY: Array<[string, string]> = [
  ['orders', 'createdBy'], ['orders', 'completedBy'],
  ['pastOrders', 'createdBy'], ['pastOrders', 'completedBy'],
  ['payments', 'receivedBy'], ['pastPayments', 'receivedBy'],
  ['auditLogs', 'userId'],
  ['registerSessions', 'openedBy'], ['registerSessions', 'closedBy'],
  ['expenses', 'createdBy'],
  ['kotPrints', 'printedBy'], ['riderReceipts', 'printedBy'],
  ['employeeLoans', 'issuedBy'],
];

export const RECYCLE_TYPES: Record<RecycleType, RecycleTypeDef> = {
  users: {
    type: 'users', table: 'users', label: 'User', nameSql: 'fullName', nameColumn: 'fullName', uniqueColumn: 'username',
    history: USERS_HISTORY.map(([t, c]) => hist(t, c)),
    liveDependents: [],
    openWork: [],
    binParents: [
      { label: 'roles', sql: `SELECT r.name AS name FROM roles r JOIN users u ON u.roleId = r.id WHERE u.id = ? AND ${inBin("r")}` },
    ],
    binChildren: [],
    plainChildren: [],
    // username -> 'deleted-' || id is set by the recycle service (it needs the row id).
    wipe: { passwordHash: '!' },
  },
  customers: {
    type: 'customers', table: 'customers', label: 'Customer', nameSql: 'name', nameColumn: 'name', uniqueColumn: 'phone',
    history: orderHistory('customerId'),
    liveDependents: [],
    openWork: [openOrdersBy('customerId')],
    binParents: [], binChildren: [], plainChildren: [],
    wipe: { phone: '', address: null, notes: null },
  },
  waiters: {
    type: 'waiters', table: 'waiters', label: 'Waiter', nameSql: 'name', nameColumn: 'name', uniqueColumn: null,
    history: orderHistory('waiterId'),
    liveDependents: [],
    openWork: [openOrdersBy('waiterId')],
    binParents: [], binChildren: [], plainChildren: [],
    wipe: { phone: null },
  },
  riders: {
    type: 'riders', table: 'riders', label: 'Rider', nameSql: 'name', nameColumn: 'name', uniqueColumn: null,
    history: orderHistory('riderId'),
    liveDependents: [],
    openWork: [openOrdersBy('riderId')],
    binParents: [], binChildren: [], plainChildren: [],
    wipe: { phone: null },
  },
  diningTables: {
    type: 'diningTables', table: 'diningTables', label: 'Dining table',
    nameSql: 'tableNumber', nameColumn: 'tableNumber', uniqueColumn: 'tableNumber',
    history: orderHistory('tableId'),
    liveDependents: [],
    openWork: [openOrdersBy('tableId')],
    binParents: [], binChildren: [], plainChildren: [],
    wipe: {},
  },
  employees: {
    type: 'employees', table: 'employees', label: 'Employee', nameSql: 'name', nameColumn: 'name', uniqueColumn: 'cnic',
    history: [hist('employeeLoans', 'employeeId')],
    liveDependents: [],
    // DELETE /api/employees/:id blocks on ANY loan row (that is `history` here). A loan still owed is
    // status = 'active', the condition GET /employees/loans/outstanding uses.
    openWork: [{
      label: 'outstanding loans',
      sql: "SELECT 'Loan of Rs ' || remainingAmount AS name FROM employeeLoans WHERE employeeId = ? AND status = 'active'",
    }],
    binParents: [], binChildren: [], plainChildren: [],
    wipe: { phone: null, cnic: null, salary: 0, notes: null },
  },
  roles: {
    type: 'roles', table: 'roles', label: 'Role', nameSql: 'name', nameColumn: 'name', uniqueColumn: 'name',
    history: [hist('users', 'roleId')],
    liveDependents: [
      { label: 'live users', sql: `SELECT fullName AS name FROM users WHERE roleId = ? AND ${LIVE}` },
    ],
    openWork: [],
    binParents: [],
    binChildren: [
      { label: 'users', sql: `SELECT fullName AS name FROM users WHERE roleId = ? AND ${inBin()}` },
    ],
    plainChildren: [],
    wipe: {},
  },
  categories: {
    type: 'categories', table: 'categories', label: 'Category', nameSql: 'name', nameColumn: 'name', uniqueColumn: null,
    history: [
      hist('categories', 'parentId', 'subcategories'),
      hist('menuItems', 'categoryId', 'menu items'),
      hist('deals', 'categoryId'),
    ],
    liveDependents: [
      { label: 'live menu items', sql: `SELECT name FROM menuItems WHERE categoryId = ? AND ${LIVE}` },
      { label: 'live deals', sql: `SELECT name FROM deals WHERE categoryId = ? AND ${LIVE}` },
      { label: 'live subcategories', sql: `SELECT name FROM categories WHERE parentId = ? AND ${LIVE}` },
    ],
    openWork: [],
    binParents: [
      { label: 'categories', sql: `SELECT p.name AS name FROM categories p JOIN categories c ON c.parentId = p.id WHERE c.id = ? AND ${inBin("p")}` },
    ],
    binChildren: [
      { label: 'menu items', sql: `SELECT name FROM menuItems WHERE categoryId = ? AND ${inBin()}` },
      { label: 'deals', sql: `SELECT name FROM deals WHERE categoryId = ? AND ${inBin()}` },
      { label: 'subcategories', sql: `SELECT name FROM categories WHERE parentId = ? AND ${inBin()}` },
    ],
    plainChildren: [],
    wipe: {},
  },
  variants: {
    type: 'variants', table: 'variants', label: 'Variant', nameSql: 'name', nameColumn: 'name', uniqueColumn: null,
    history: [
      hist('menuItemVariants', 'variantId', 'menu item links'),
      hist('dealVariants', 'variantId', 'deal links'),
    ],
    liveDependents: [
      { label: 'live menu items', sql: `SELECT m.name AS name FROM menuItems m JOIN menuItemVariants mv ON mv.menuItemId = m.id WHERE mv.variantId = ? AND m.${LIVE}` },
      { label: 'live deals', sql: `SELECT d.name AS name FROM deals d JOIN dealVariants dv ON dv.dealId = d.id WHERE dv.variantId = ? AND d.${LIVE}` },
    ],
    openWork: [],
    binParents: [],
    binChildren: [
      { label: 'menu items', sql: `SELECT m.name AS name FROM menuItems m JOIN menuItemVariants mv ON mv.menuItemId = m.id WHERE mv.variantId = ? AND ${inBin("m")}` },
      { label: 'deals', sql: `SELECT d.name AS name FROM deals d JOIN dealVariants dv ON dv.dealId = d.id WHERE dv.variantId = ? AND ${inBin("d")}` },
    ],
    plainChildren: [{ table: 'variantOptions', column: 'variantId' }],
    wipe: {},
  },
  menuItems: {
    type: 'menuItems', table: 'menuItems', label: 'Menu item', nameSql: 'name', nameColumn: 'name', uniqueColumn: null,
    history: [
      hist('orderItems', 'menuItemId', 'order items'),
      hist('pastOrderItems', 'menuItemId', 'archived order items'),
      hist('dealItems', 'menuItemId', 'deal items'),
    ],
    liveDependents: [
      { label: 'live deals', sql: `SELECT d.name AS name FROM deals d JOIN dealItems di ON di.dealId = d.id WHERE di.menuItemId = ? AND d.${LIVE}` },
    ],
    openWork: [openOrdersWithItem('menuItemId')],
    binParents: [
      { label: 'categories', sql: `SELECT c.name AS name FROM categories c JOIN menuItems m ON m.categoryId = c.id WHERE m.id = ? AND ${inBin("c")}` },
      { label: 'variants', sql: `SELECT v.name AS name FROM variants v JOIN menuItemVariants mv ON mv.variantId = v.id WHERE mv.menuItemId = ? AND ${inBin("v")}` },
    ],
    binChildren: [
      { label: 'deals', sql: `SELECT d.name AS name FROM deals d JOIN dealItems di ON di.dealId = d.id WHERE di.menuItemId = ? AND ${inBin("d")}` },
    ],
    plainChildren: [{ table: 'menuItemVariants', column: 'menuItemId' }],
    wipe: { description: null },
  },
  deals: {
    type: 'deals', table: 'deals', label: 'Deal', nameSql: 'name', nameColumn: 'name', uniqueColumn: null,
    history: [
      hist('orderItems', 'dealId', 'order items'),
      hist('pastOrderItems', 'dealId', 'archived order items'),
    ],
    liveDependents: [],
    openWork: [openOrdersWithItem('dealId')],
    binParents: [
      { label: 'categories', sql: `SELECT c.name AS name FROM categories c JOIN deals d ON d.categoryId = c.id WHERE d.id = ? AND ${inBin("c")}` },
      { label: 'menu items', sql: `SELECT m.name AS name FROM menuItems m JOIN dealItems di ON di.menuItemId = m.id WHERE di.dealId = ? AND ${inBin("m")}` },
      { label: 'variants', sql: `SELECT v.name AS name FROM variants v JOIN dealVariants dv ON dv.variantId = v.id WHERE dv.dealId = ? AND ${inBin("v")}` },
    ],
    binChildren: [],
    plainChildren: [{ table: 'dealItems', column: 'dealId' }, { table: 'dealVariants', column: 'dealId' }],
    wipe: { description: null },
  },
  expenses: {
    type: 'expenses', table: 'expenses', label: 'Expense',
    nameSql: "category || ' - Rs ' || amount", nameColumn: null, uniqueColumn: null,
    history: [], liveDependents: [], openWork: [], binParents: [], binChildren: [], plainChildren: [],
    wipe: {},
  },
};

export function getTypeDef(type: string): RecycleTypeDef | null {
  return Object.prototype.hasOwnProperty.call(RECYCLE_TYPES, type) ? RECYCLE_TYPES[type as RecycleType] : null;
}
