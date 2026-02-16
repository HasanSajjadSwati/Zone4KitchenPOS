// User and Role Types
export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'export')[];
}

export interface Role {
  id: string;
  name: 'Admin' | 'Manager' | 'Cashier';
  permissions: Permission[];
  createdAt: Date;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  roleId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Menu Types
export interface Category {
  id: string;
  name: string;
  type: 'major' | 'sub';
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isDealOnly: boolean;
  hasVariants: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type SelectionMode = 'single' | 'multiple' | 'all';

export interface Variant {
  id: string;
  name: string;
  type: 'size' | 'flavour' | 'custom';
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface VariantOption {
  id: string;
  variantId: string;
  name: string;
  priceModifier: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface MenuItemVariant {
  id: string;
  menuItemId: string;
  variantId: string;
  isRequired: boolean;
  selectionMode: SelectionMode;
  availableOptionIds: string[]; // Which specific options from this variant are available
  createdAt: Date;
}

export interface Deal {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  categoryId: string | null;
  isActive: boolean;
  hasVariants: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DealItem {
  id: string;
  dealId: string;
  menuItemId: string;
  quantity: number;
  requiresVariantSelection: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface DealVariant {
  id: string;
  dealId: string;
  variantId: string;
  isRequired: boolean;
  selectionMode: SelectionMode;
  availableOptionIds: string[]; // Which specific options from this variant are available
  createdAt: Date;
}

// Customer and Staff Types
export interface Customer {
  id: string;
  phone: string;
  name: string;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastOrderAt: Date | null;
  totalOrders: number;
}

export interface Waiter {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TableRecord {
  id: string;
  tableNumber: string;
  capacity: number;
  isActive: boolean;
  createdAt: Date;
}

// Delivery Status Type
export type DeliveryStatus = 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered';

// Register and Order Types
export interface RegisterSession {
  id: string;
  openedBy: string;
  closedBy: string | null;
  openedAt: Date;
  closedAt: Date | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  cashDifference: number | null;
  totalSales: number;
  totalOrders: number;
  notes: string | null;
  status: 'open' | 'closed';
}

export interface VariantSelection {
  variantId: string;
  variantName: string;
  optionId: string;
  optionName: string;
  priceModifier: number;
  // For multi-select and all mode support
  selectedOptions?: Array<{
    optionId: string;
    optionName: string;
    priceModifier: number;
  }>;
}

export interface DealItemBreakdown {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  selectedVariants: VariantSelection[];
}

export interface Order {
  id: string;
  orderNumber: string;
  registerSessionId: string;
  orderType: 'dine_in' | 'take_away' | 'delivery';
  orderSource: 'pos' | 'website';

  // Dine In fields
  tableId: string | null;
  waiterId: string | null;

  // Take Away fields
  customerName: string | null;
  customerPhone: string | null;

  // Delivery fields
  customerId: string | null;
  riderId: string | null;
  deliveryAddress: string | null;
  deliveryCharge: number;

  // Order details
  subtotal: number;
  discountType: 'percentage' | 'fixed' | null;
  discountValue: number;
  discountReference: string | null;
  discountAmount: number;
  total: number;

  // Status
  status: 'open' | 'completed' | 'cancelled';
  deliveryStatus: 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | null;
  isPaid: boolean;
  notes: string | null;

  // KOT tracking
  lastKotPrintedAt: Date | null;
  kotPrintCount: number;

  // Audit
  createdBy: string;
  completedBy: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  itemType: 'menu_item' | 'deal';
  menuItemId: string | null;
  dealId: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;

  // Variant selections
  selectedVariants: VariantSelection[];

  // For deals: breakdown
  dealBreakdown: DealItemBreakdown[] | null;

  // KOT tracking
  addedAt: Date;
  lastPrintedAt: Date | null;

  createdAt: Date;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: 'cash' | 'card' | 'online' | 'other';
  reference: string | null;
  paidAt: Date;
  receivedBy: string;
  notes: string | null;
  createdAt: Date;
}

export interface KOTPrint {
  id: string;
  orderId: string;
  printNumber: number;
  majorCategory: string | null;
  itemIds: string[];
  printedBy: string;
  printedAt: Date;
  createdAt: Date;
}

// System Types
export interface AuditLog {
  id: string;
  userId: string;
  action: 'create' | 'update' | 'delete' | 'print' | 'export' | 'login' | 'logout' | 'wipe' | 'import';
  tableName: string;
  recordId: string;
  before: any | null;
  after: any | null;
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface Settings {
  id: string;

  // KOT settings
  kotSplitByMajorCategory: boolean;
  kotIncludeVariants: boolean;
  kotIncludeDealBreakdown: boolean;

  // Business info
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
  taxRate: number;

  // Printing
  receiptFooter: string | null;
  printAllIncludeKOT?: boolean;
  printAllIncludeCustomer?: boolean;
  printAllIncludeCounter?: boolean;
  printAllIncludeRider?: boolean;

  // Expense categories
  expenseCategories?: string[];

  // Website settings
  websiteEnabled?: boolean;
  whatsappNumber?: string;

  updatedAt: Date;
  updatedBy: string;
}

export interface UploadQueueItem {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  createdAt: Date;
  attempts: number;
  lastAttemptAt: Date | null;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  errorMessage: string | null;
  uploadedAt: Date | null;
}

// Display/UI Types
export interface KOTItemDisplay {
  id: string;
  name: string;
  quantity: number;
  variants: string[];
  breakdown?: {
    name: string;
    quantity: number;
    variants: string[];
  }[];
  notes: string | null;
}

export interface KOTTicket {
  orderNumber: string;
  orderType: string;
  table: string | null;
  category: string | null;
  items: KOTItemDisplay[];
  printTime: Date;
  printNumber: number;
}

// Employee Management Types
export interface Employee {
  id: string;
  name: string;
  phone: string;
  cnic: string | null; // National ID (13 digits) - optional
  joiningDate: Date;
  designation: string;
  salary: number;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeLoan {
  id: string;
  employeeId: string;
  amount: number;
  issueDate: Date;
  reason: string | null;
  totalInstallments: number;
  installmentAmount: number;
  paidInstallments: number;
  remainingAmount: number;
  status: 'active' | 'paid' | 'cancelled';
  issuedBy: string; // userId
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Expense Management Types
export interface Expense {
  id: string;
  date: Date;
  category: string;
  amount: number;
  description: string;
  receiptNumber: string | null;
  paidTo: string | null;
  paymentMethod: 'cash' | 'card' | 'online' | 'other';
  registerSessionId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Rider Receipt Tracking
export interface RiderReceipt {
  id: string;
  orderId: string;
  printedAt: Date;
  printedBy: string;
  createdAt: Date;
}
