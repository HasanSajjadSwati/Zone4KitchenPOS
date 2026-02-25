export const TABLES = [
  'users', 'roles', 'categories', 'menuItems', 'variants', 'variantOptions',
  'menuItemVariants', 'deals', 'dealItems', 'dealVariants', 'customers',
  'waiters', 'riders', 'diningTables', 'registerSessions', 'orders',
  'orderItems', 'payments', 'kotPrints', 'auditLogs', 'settings',
  'uploadQueue', 'employees', 'employeeLoans', 'expenses', 'riderReceipts',
  'pastOrders', 'pastOrderItems', 'pastPayments'
];

export const WIPE_TABLE_SEQUENCE = [
  'pastOrderItems',
  'pastPayments',
  'pastOrders',
  'orderItems',
  'payments',
  'kotPrints',
  'orders',
  // Note: registerSessions is intentionally excluded from wipe to preserve historical register data
  'menuItemVariants',
  'variantOptions',
  'dealVariants',
  'dealItems',
  'menuItems',
  'deals',
  'categories',
  'variants',
  'customers',
  'riderReceipts',
  'waiters',
  'riders',
  'diningTables',
  'uploadQueue',
  'employeeLoans',
  'expenses',
  'employees',
  'auditLogs',
  'settings',
  'users',
  'roles'
];
