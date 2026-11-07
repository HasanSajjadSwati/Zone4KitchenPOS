// Shown in sales reports for sold lines whose item/deal row no longer exists (or was never recorded).
// Keep in step with backend/src/constants/recycle.ts.
export const DELETED_ITEMS_LABEL = 'Deleted items (name not recorded)';

// Type keys and labels the Recycle Bin filter offers. Keep in step with the server's type registry.
export const RECYCLE_TYPES = [
  { key: 'users', label: 'User' },
  { key: 'customers', label: 'Customer' },
  { key: 'waiters', label: 'Waiter' },
  { key: 'riders', label: 'Rider' },
  { key: 'diningTables', label: 'Dining table' },
  { key: 'employees', label: 'Employee' },
  { key: 'roles', label: 'Role' },
  { key: 'categories', label: 'Category' },
  { key: 'variants', label: 'Variant' },
  { key: 'menuItems', label: 'Menu item' },
  { key: 'deals', label: 'Deal' },
  { key: 'expenses', label: 'Expense' },
] as const;
