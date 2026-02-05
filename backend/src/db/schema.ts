// Base schema for POS system
export const schema = `
-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  permissions TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  fullName TEXT NOT NULL,
  roleId TEXT NOT NULL,
  isActive BOOLEAN DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (roleId) REFERENCES roles(id)
);

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('major', 'sub')),
  parentId TEXT,
  sortOrder INTEGER DEFAULT 0,
  isActive BOOLEAN DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parentId) REFERENCES categories(id)
);

-- Menu Items Table
CREATE TABLE IF NOT EXISTS menuItems (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  categoryId TEXT NOT NULL,
  price REAL NOT NULL,
  description TEXT,
  isActive BOOLEAN DEFAULT 1,
  isDealOnly BOOLEAN DEFAULT 0,
  hasVariants BOOLEAN DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoryId) REFERENCES categories(id)
);

-- Variants Table
CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('size', 'flavour', 'custom')),
  sortOrder INTEGER DEFAULT 0,
  isActive BOOLEAN DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Variant Options Table
CREATE TABLE IF NOT EXISTS variantOptions (
  id TEXT PRIMARY KEY,
  variantId TEXT NOT NULL,
  name TEXT NOT NULL,
  priceModifier REAL DEFAULT 0,
  sortOrder INTEGER DEFAULT 0,
  isActive BOOLEAN DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (variantId) REFERENCES variants(id)
);

-- Menu Item Variants Table
CREATE TABLE IF NOT EXISTS menuItemVariants (
  id TEXT PRIMARY KEY,
  menuItemId TEXT NOT NULL,
  variantId TEXT NOT NULL,
  isRequired BOOLEAN DEFAULT 0,
  selectionMode TEXT DEFAULT 'single' CHECK(selectionMode IN ('single', 'multiple', 'all')),
  availableOptionIds TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menuItemId) REFERENCES menuItems(id),
  FOREIGN KEY (variantId) REFERENCES variants(id),
  UNIQUE(menuItemId, variantId)
);

-- Deals Table
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  categoryId TEXT,
  isActive BOOLEAN DEFAULT 1,
  hasVariants BOOLEAN DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoryId) REFERENCES categories(id)
);

-- Deal Items Table
CREATE TABLE IF NOT EXISTS dealItems (
  id TEXT PRIMARY KEY,
  dealId TEXT NOT NULL,
  menuItemId TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  requiresVariantSelection BOOLEAN DEFAULT 0,
  sortOrder INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dealId) REFERENCES deals(id),
  FOREIGN KEY (menuItemId) REFERENCES menuItems(id)
);

-- Deal Variants Table
CREATE TABLE IF NOT EXISTS dealVariants (
  id TEXT PRIMARY KEY,
  dealId TEXT NOT NULL,
  variantId TEXT NOT NULL,
  isRequired BOOLEAN DEFAULT 0,
  selectionMode TEXT DEFAULT 'single' CHECK(selectionMode IN ('single', 'multiple', 'all')),
  availableOptionIds TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dealId) REFERENCES deals(id),
  FOREIGN KEY (variantId) REFERENCES variants(id),
  UNIQUE(dealId, variantId)
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  lastOrderAt DATETIME,
  totalOrders INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Waiters Table
CREATE TABLE IF NOT EXISTS waiters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  isActive BOOLEAN DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Riders Table
CREATE TABLE IF NOT EXISTS riders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  isActive BOOLEAN DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dining Tables Table
CREATE TABLE IF NOT EXISTS diningTables (
  id TEXT PRIMARY KEY,
  tableNumber TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL,
  isActive BOOLEAN DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Register Sessions Table
CREATE TABLE IF NOT EXISTS registerSessions (
  id TEXT PRIMARY KEY,
  openedBy TEXT NOT NULL,
  closedBy TEXT,
  openedAt DATETIME NOT NULL,
  closedAt DATETIME,
  openingCash REAL NOT NULL,
  closingCash REAL,
  expectedCash REAL,
  cashDifference REAL,
  totalSales REAL DEFAULT 0,
  totalOrders INTEGER DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL CHECK(status IN ('open', 'closed')),
  FOREIGN KEY (openedBy) REFERENCES users(id),
  FOREIGN KEY (closedBy) REFERENCES users(id)
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  orderNumber TEXT NOT NULL UNIQUE,
  registerSessionId TEXT NOT NULL,
  orderType TEXT NOT NULL CHECK(orderType IN ('dine_in', 'take_away', 'delivery')),
  tableId TEXT,
  waiterId TEXT,
  customerName TEXT,
  customerPhone TEXT,
  customerId TEXT,
  riderId TEXT,
  deliveryAddress TEXT,
  deliveryCharge REAL DEFAULT 0,
  subtotal REAL NOT NULL,
  discountType TEXT CHECK(discountType IN ('percentage', 'fixed', NULL)),
  discountValue REAL DEFAULT 0,
  discountReference TEXT,
  discountAmount REAL DEFAULT 0,
  total REAL NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('open', 'completed', 'cancelled')),
  deliveryStatus TEXT CHECK(deliveryStatus IN ('pending', 'preparing', 'ready', 'out_for_delivery', 'delivered', NULL)),
  isPaid BOOLEAN DEFAULT 0,
  notes TEXT,
  lastKotPrintedAt DATETIME,
  kotPrintCount INTEGER DEFAULT 0,
  createdBy TEXT NOT NULL,
  completedBy TEXT,
  cancellationReason TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  completedAt DATETIME,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (registerSessionId) REFERENCES registerSessions(id),
  FOREIGN KEY (tableId) REFERENCES diningTables(id),
  FOREIGN KEY (waiterId) REFERENCES waiters(id),
  FOREIGN KEY (customerId) REFERENCES customers(id),
  FOREIGN KEY (riderId) REFERENCES riders(id),
  FOREIGN KEY (createdBy) REFERENCES users(id),
  FOREIGN KEY (completedBy) REFERENCES users(id)
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS orderItems (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL,
  itemType TEXT NOT NULL CHECK(itemType IN ('menu_item', 'deal')),
  menuItemId TEXT,
  dealId TEXT,
  quantity INTEGER NOT NULL,
  unitPrice REAL NOT NULL,
  totalPrice REAL NOT NULL,
  notes TEXT,
  selectedVariants TEXT,
  dealBreakdown TEXT,
  addedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  lastPrintedAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orderId) REFERENCES orders(id),
  FOREIGN KEY (menuItemId) REFERENCES menuItems(id),
  FOREIGN KEY (dealId) REFERENCES deals(id)
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('cash', 'card', 'online', 'other')),
  reference TEXT,
  paidAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  receivedBy TEXT NOT NULL,
  notes TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orderId) REFERENCES orders(id),
  FOREIGN KEY (receivedBy) REFERENCES users(id)
);

-- KOT Prints Table
CREATE TABLE IF NOT EXISTS kotPrints (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL,
  printNumber INTEGER NOT NULL,
  majorCategory TEXT,
  itemIds TEXT,
  printedBy TEXT NOT NULL,
  printedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orderId) REFERENCES orders(id),
  FOREIGN KEY (printedBy) REFERENCES users(id)
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS auditLogs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete', 'print', 'export', 'login', 'logout', 'wipe', 'import')),
  tableName TEXT NOT NULL,
  recordId TEXT,
  before TEXT,
  after TEXT,
  description TEXT,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  kotSplitByMajorCategory BOOLEAN DEFAULT 0,
  kotIncludeVariants BOOLEAN DEFAULT 1,
  kotIncludeDealBreakdown BOOLEAN DEFAULT 1,
  restaurantName TEXT,
  restaurantAddress TEXT,
  restaurantPhone TEXT,
  taxRate REAL DEFAULT 0,
  deliveryCharge REAL DEFAULT 0,
  receiptFooter TEXT,
  printAllIncludeKOT BOOLEAN DEFAULT 1,
  printAllIncludeCustomer BOOLEAN DEFAULT 1,
  printAllIncludeCounter BOOLEAN DEFAULT 0,
  printAllIncludeRider BOOLEAN DEFAULT 0,
  expenseCategories TEXT,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedBy TEXT
);

-- Upload Queue Table
CREATE TABLE IF NOT EXISTS uploadQueue (
  id TEXT PRIMARY KEY,
  filePath TEXT NOT NULL,
  fileName TEXT NOT NULL,
  fileSize INTEGER NOT NULL,
  attempts INTEGER DEFAULT 0,
  lastAttemptAt DATETIME,
  status TEXT NOT NULL CHECK(status IN ('pending', 'uploading', 'success', 'failed')),
  errorMessage TEXT,
  uploadedAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  cnic TEXT UNIQUE,
  joiningDate DATETIME NOT NULL,
  designation TEXT,
  salary REAL NOT NULL,
  isActive BOOLEAN DEFAULT 1,
  notes TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Employee Loans Table
CREATE TABLE IF NOT EXISTS employeeLoans (
  id TEXT PRIMARY KEY,
  employeeId TEXT NOT NULL,
  amount REAL NOT NULL,
  issueDate DATETIME NOT NULL,
  reason TEXT,
  totalInstallments INTEGER NOT NULL,
  installmentAmount REAL NOT NULL,
  paidInstallments INTEGER DEFAULT 0,
  remainingAmount REAL NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'paid', 'cancelled')),
  issuedBy TEXT NOT NULL,
  notes TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(id),
  FOREIGN KEY (issuedBy) REFERENCES users(id)
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  date DATETIME NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  receiptNumber TEXT,
  paidTo TEXT,
  paymentMethod TEXT NOT NULL CHECK(paymentMethod IN ('cash', 'card', 'online', 'other')),
  registerSessionId TEXT,
  createdBy TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (registerSessionId) REFERENCES registerSessions(id),
  FOREIGN KEY (createdBy) REFERENCES users(id)
);

-- Rider Receipts Table
CREATE TABLE IF NOT EXISTS riderReceipts (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL,
  printedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  printedBy TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orderId) REFERENCES orders(id),
  FOREIGN KEY (printedBy) REFERENCES users(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_roleId ON users(roleId);
CREATE INDEX IF NOT EXISTS idx_categories_parentId ON categories(parentId);
CREATE INDEX IF NOT EXISTS idx_menuItems_categoryId ON menuItems(categoryId);
CREATE INDEX IF NOT EXISTS idx_variantOptions_variantId ON variantOptions(variantId);
CREATE INDEX IF NOT EXISTS idx_menuItemVariants_menuItemId ON menuItemVariants(menuItemId);
CREATE INDEX IF NOT EXISTS idx_menuItemVariants_variantId ON menuItemVariants(variantId);
CREATE INDEX IF NOT EXISTS idx_dealItems_dealId ON dealItems(dealId);
CREATE INDEX IF NOT EXISTS idx_dealVariants_dealId ON dealVariants(dealId);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_orders_orderNumber ON orders(orderNumber);
CREATE INDEX IF NOT EXISTS idx_orders_registerSessionId ON orders(registerSessionId);
CREATE INDEX IF NOT EXISTS idx_orders_customerId ON orders(customerId);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);
CREATE INDEX IF NOT EXISTS idx_orders_completedAt ON orders(completedAt);
CREATE INDEX IF NOT EXISTS idx_orderItems_orderId ON orderItems(orderId);
CREATE INDEX IF NOT EXISTS idx_payments_orderId ON payments(orderId);
CREATE INDEX IF NOT EXISTS idx_kotPrints_orderId ON kotPrints(orderId);
CREATE INDEX IF NOT EXISTS idx_auditLogs_userId ON auditLogs(userId);
CREATE INDEX IF NOT EXISTS idx_auditLogs_tableName ON auditLogs(tableName);
CREATE INDEX IF NOT EXISTS idx_auditLogs_createdAt ON auditLogs(createdAt);
CREATE INDEX IF NOT EXISTS idx_employees_isActive ON employees(isActive);
CREATE INDEX IF NOT EXISTS idx_employeeLoans_employeeId ON employeeLoans(employeeId);
CREATE INDEX IF NOT EXISTS idx_employeeLoans_status ON employeeLoans(status);
CREATE INDEX IF NOT EXISTS idx_expenses_registerSessionId ON expenses(registerSessionId);
CREATE INDEX IF NOT EXISTS idx_riderReceipts_orderId ON riderReceipts(orderId);

-- Composite indexes for report queries performance
CREATE INDEX IF NOT EXISTS idx_orders_status_completedAt ON orders(status, completedAt);
CREATE INDEX IF NOT EXISTS idx_orders_status_createdAt ON orders(status, createdAt);
CREATE INDEX IF NOT EXISTS idx_orderItems_orderId_itemType ON orderItems(orderId, itemType);
CREATE INDEX IF NOT EXISTS idx_orderItems_menuItemId ON orderItems(menuItemId);
CREATE INDEX IF NOT EXISTS idx_orderItems_dealId ON orderItems(dealId);
CREATE INDEX IF NOT EXISTS idx_payments_orderId_method ON payments(orderId, method);
`;
