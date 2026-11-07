// Tables whose rows are soft-deleted into the Recycle Bin (camelCase, as in db/schema.ts).
export const RECYCLE_TABLES = [
  'users',
  'customers',
  'waiters',
  'riders',
  'diningTables',
  'employees',
  'roles',
  'categories',
  'variants',
  'menuItems',
  'deals',
  'expenses',
] as const;

export const TOMBSTONE_SUFFIX = ' (Deleted)';
export const DELETED_ITEMS_LABEL = 'Deleted items (name not recorded)';
