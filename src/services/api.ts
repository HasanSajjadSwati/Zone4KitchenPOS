// API Service for backend communication
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const raw = await response.text();

      if (!response.ok) {
        let message = response.statusText;
        if (isJson && raw) {
          try {
            const error = JSON.parse(raw);
            message = error.error || error.message || message;
          } catch {
            message = raw;
          }
        } else if (raw) {
          message = raw;
        }
        throw new Error(message);
      }

      if (!raw) {
        return null;
      }

      if (!isJson) {
        throw new Error(`Unexpected response format from ${url} (expected JSON).`);
      }

      try {
        return JSON.parse(raw);
      } catch {
        throw new Error(`Invalid JSON response from ${url}.`);
      }
    } catch (error) {
      console.error(`API Error [${options.method || 'GET'} ${endpoint}]:`, error);
      throw error;
    }
  }

  // Generic CRUD operations
  async get(endpoint: string) {
    return this.request(endpoint);
  }

  async post(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }

  // Specific resource endpoints

  // Users
  async getUsers() {
    return this.get('/users');
  }

  async getUser(id: string) {
    return this.get(`/users/${id}`);
  }

  async createUser(data: any) {
    return this.post('/users', data);
  }

  async updateUser(id: string, data: any) {
    return this.put(`/users/${id}`, data);
  }

  async deleteUser(id: string, adminUserId?: string) {
    const suffix = adminUserId ? `?adminUserId=${encodeURIComponent(adminUserId)}` : '';
    return this.delete(`/users/${id}${suffix}`);
  }

  async changePassword(id: string, oldPassword: string, newPassword: string) {
    return this.post(`/users/${id}/change-password`, { oldPassword, newPassword });
  }

  async resetUserPassword(id: string, adminUserId: string, newPassword: string) {
    return this.post(`/users/${id}/reset-password`, { adminUserId, newPassword });
  }

  // Audit logs
  async getAuditLogs(limit: number = 100, offset: number = 0, adminUserId?: string) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (adminUserId) {
      params.set('adminUserId', adminUserId);
    }
    return this.get(`/audit-logs?${params.toString()}`);
  }

  async createAuditLog(data: any) {
    return this.post('/audit-logs', data);
  }

  // Roles
  async getRoles() {
    return this.get('/roles');
  }

  async getRole(id: string) {
    return this.get(`/roles/${id}`);
  }

  async createRole(data: any) {
    return this.post('/roles', data);
  }

  async updateRole(id: string, data: any) {
    return this.put(`/roles/${id}`, data);
  }

  async deleteRole(id: string) {
    return this.delete(`/roles/${id}`);
  }

  // Categories
  async getCategories() {
    return this.get('/categories');
  }

  async getCategory(id: string) {
    return this.get(`/categories/${id}`);
  }

  async createCategory(data: any) {
    return this.post('/categories', data);
  }

  async updateCategory(id: string, data: any) {
    return this.put(`/categories/${id}`, data);
  }

  async deleteCategory(id: string) {
    return this.delete(`/categories/${id}`);
  }

  // Menu Items
  async getMenuItems() {
    return this.get('/menu-items');
  }

  async getMenuItem(id: string) {
    return this.get(`/menu-items/${id}`);
  }

  async createMenuItem(data: any) {
    return this.post('/menu-items', data);
  }

  async updateMenuItem(id: string, data: any) {
    return this.put(`/menu-items/${id}`, data);
  }

  async deleteMenuItem(id: string) {
    return this.delete(`/menu-items/${id}`);
  }

  // Menu Item Variants
  async getMenuItemVariants(menuItemId: string) {
    return this.get(`/menu-items/${menuItemId}/variants`);
  }

  async addMenuItemVariant(menuItemId: string, data: any) {
    return this.post(`/menu-items/${menuItemId}/variants`, data);
  }

  async updateMenuItemVariant(menuItemId: string, variantId: string, data: any) {
    return this.put(`/menu-items/${menuItemId}/variants/${variantId}`, data);
  }

  async deleteMenuItemVariant(menuItemId: string, variantId: string) {
    return this.delete(`/menu-items/${menuItemId}/variants/${variantId}`);
  }

  // Variants
  async getVariants() {
    return this.get('/variants');
  }

  async getVariant(id: string) {
    return this.get(`/variants/${id}`);
  }

  async createVariant(data: any) {
    return this.post('/variants', data);
  }

  async updateVariant(id: string, data: any) {
    return this.put(`/variants/${id}`, data);
  }

  async deleteVariant(id: string) {
    return this.delete(`/variants/${id}`);
  }

  // Variant Options
  async getVariantOptions(variantId: string) {
    return this.get(`/variants/${variantId}/options`);
  }

  async createVariantOption(variantId: string, data: any) {
    return this.post(`/variants/${variantId}/options`, data);
  }

  async updateVariantOption(variantId: string, optionId: string, data: any) {
    return this.put(`/variants/${variantId}/options/${optionId}`, data);
  }

  async deleteVariantOption(variantId: string, optionId: string) {
    return this.delete(`/variants/${variantId}/options/${optionId}`);
  }

  // Deals
  async getDeals() {
    return this.get('/deals');
  }

  async getDeal(id: string) {
    return this.get(`/deals/${id}`);
  }

  async createDeal(data: any) {
    return this.post('/deals', data);
  }

  async updateDeal(id: string, data: any) {
    return this.put(`/deals/${id}`, data);
  }

  async deleteDeal(id: string) {
    return this.delete(`/deals/${id}`);
  }

  // Deal Items
  async getDealItems(dealId: string) {
    return this.get(`/deals/${dealId}/items`);
  }

  async addDealItem(dealId: string, data: any) {
    return this.post(`/deals/${dealId}/items`, data);
  }

  async updateDealItem(dealId: string, itemId: string, data: any) {
    return this.put(`/deals/${dealId}/items/${itemId}`, data);
  }

  async deleteDealItem(dealId: string, itemId: string) {
    return this.delete(`/deals/${dealId}/items/${itemId}`);
  }

  // Deal Variants
  async getDealVariants(dealId: string) {
    return this.get(`/deals/${dealId}/variants`);
  }

  async setDealVariants(dealId: string, variants: any[]) {
    return this.put(`/deals/${dealId}/variants`, { variants });
  }

  async addDealVariant(dealId: string, data: any) {
    return this.post(`/deals/${dealId}/variants`, data);
  }

  async updateDealVariant(dealId: string, variantId: string, data: any) {
    return this.put(`/deals/${dealId}/variants/${variantId}`, data);
  }

  async deleteDealVariant(dealId: string, variantId: string) {
    return this.delete(`/deals/${dealId}/variants/${variantId}`);
  }

  // Customers
  async getCustomers() {
    return this.get('/customers');
  }

  async getCustomer(id: string) {
    return this.get(`/customers/${id}`);
  }

  async getCustomerByPhone(phone: string) {
    return this.get(`/customers/phone/${phone}`);
  }

  async createCustomer(data: any) {
    return this.post('/customers', data);
  }

  async updateCustomer(id: string, data: any) {
    return this.put(`/customers/${id}`, data);
  }

  async deleteCustomer(id: string) {
    return this.delete(`/customers/${id}`);
  }

  // Orders
  async getOrders(filters?: Record<string, string>) {
    let endpoint = '/orders';
    if (filters) {
      const params = new URLSearchParams(filters);
      endpoint += `?${params.toString()}`;
    }
    const response = await this.get(endpoint);
    // Backend returns { orders: [...], total: number }, extract the array
    return Array.isArray(response) ? response : (response?.orders || []);
  }

  async getOrder(id: string) {
    return this.get(`/orders/${id}`);
  }

  async createOrder(data: any) {
    return this.post('/orders', data);
  }

  async updateOrder(id: string, data: any) {
    return this.put(`/orders/${id}`, data);
  }

  async addOrderItem(orderId: string, data: any) {
    return this.post(`/orders/${orderId}/items`, data);
  }

  async getOrderItems(orderId: string) {
    return this.get(`/orders/${orderId}/items`);
  }

  async getOrderItemsBulk(filters?: Record<string, string>) {
    let endpoint = '/order-items';
    if (filters) {
      const params = new URLSearchParams(filters);
      endpoint += `?${params.toString()}`;
    }
    try {
      return await this.get(endpoint);
    } catch (error) {
      // Fallback for older backends that don't support /order-items
      const orderIds: string[] = [];
      const orderIdsParam = filters?.orderIds;

      if (orderIdsParam) {
        orderIds.push(
          ...orderIdsParam
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        );
      } else {
        const orderFilters: Record<string, string> = {};
        const allowedOrderFilters = [
          'startDate',
          'endDate',
          'status',
          'orderType',
          'registerSessionId',
          'customerId',
        ];
        for (const key of allowedOrderFilters) {
          const value = filters?.[key];
          if (value) {
            orderFilters[key] = value;
          }
        }

        const orders = await this.getOrders(
          Object.keys(orderFilters).length > 0 ? orderFilters : undefined
        );
        for (const order of orders) {
          if (order?.id) orderIds.push(order.id);
        }
      }

      const allItems: any[] = [];
      for (const id of orderIds) {
        const items = await this.getOrderItems(id);
        allItems.push(...items);
      }

      return allItems;
    }
  }

  async updateOrderItem(orderId: string, itemId: string, data: any) {
    return this.put(`/orders/${orderId}/items/${itemId}`, data);
  }

  async deleteOrderItem(orderId: string, itemId: string) {
    return this.delete(`/orders/${orderId}/items/${itemId}`);
  }

  async updateDeliveryStatus(orderId: string, deliveryStatus: string) {
    return this.put(`/orders/${orderId}/delivery-status`, { deliveryStatus });
  }

  // Past Orders
  async getPastOrders(filters?: Record<string, string>) {
    let endpoint = '/past-orders';
    if (filters) {
      const params = new URLSearchParams(filters);
      endpoint += `?${params.toString()}`;
    }
    return this.get(endpoint);
  }

  async getPastOrder(id: string) {
    return this.get(`/past-orders/${id}`);
  }

  async getPastOrderItems(orderId: string) {
    return this.get(`/past-orders/${orderId}/items`);
  }

  async migrateOrdersToPast(olderThanDays: number) {
    return this.post('/past-orders/migrate', { olderThanDays });
  }

  async getMigrationPreview(olderThanDays: number) {
    return this.get(`/past-orders/migrate/preview?olderThanDays=${olderThanDays}`);
  }

  // Settings
  async getSettings() {
    return this.get('/settings');
  }

  async updateSettings(data: any) {
    return this.put('/settings', data);
  }

  // Maintenance
  async wipeAllData(payload: { keepSettings?: boolean; keepUsers?: boolean } = {}) {
    return this.post('/maintenance/wipe-all', payload);
  }

  // Register Sessions
  async getRegisterSessions() {
    return this.get('/register-sessions');
  }

  async getRegisterSession(id: string) {
    return this.get(`/register-sessions/${id}`);
  }

  async createRegisterSession(data: any) {
    return this.post('/register-sessions', data);
  }

  async updateRegisterSession(id: string, data: any) {
    return this.put(`/register-sessions/${id}`, data);
  }

  async closeRegisterSession(id: string, data: any) {
    return this.post(`/register-sessions/${id}/close`, data);
  }

  async getActiveRegisterSession() {
    return this.get('/register-sessions/status/active');
  }

  // Payments
  async getPayments(filters?: Record<string, string>) {
    let endpoint = '/payments';
    if (filters) {
      const params = new URLSearchParams(filters);
      endpoint += `?${params.toString()}`;
    }
    return this.get(endpoint);
  }

  async getPayment(id: string) {
    return this.get(`/payments/${id}`);
  }

  async getPaymentsByOrder(orderId: string) {
    return this.get(`/payments/order/${orderId}`);
  }

  async createPayment(data: any) {
    return this.post('/payments', data);
  }

  async updatePayment(id: string, data: any) {
    return this.put(`/payments/${id}`, data);
  }

  async deletePayment(id: string) {
    return this.delete(`/payments/${id}`);
  }

  // Reports (server-side aggregation)
  async getSalesSummaryReport(filters?: Record<string, string>) {
    let endpoint = '/reports/sales-summary';
    if (filters) {
      const params = new URLSearchParams(filters);
      endpoint += `?${params.toString()}`;
    }
    return this.get(endpoint);
  }

  async getDailySalesReport(filters?: Record<string, string>) {
    let endpoint = '/reports/daily-sales';
    if (filters) {
      const params = new URLSearchParams(filters);
      endpoint += `?${params.toString()}`;
    }
    return this.get(endpoint);
  }

  async getItemSalesReport(filters?: Record<string, string>) {
    let endpoint = '/reports/item-sales';
    if (filters) {
      const params = new URLSearchParams(filters);
      endpoint += `?${params.toString()}`;
    }
    return this.get(endpoint);
  }

  async getDealSalesReport(filters?: Record<string, string>) {
    let endpoint = '/reports/deal-sales';
    if (filters) {
      const params = new URLSearchParams(filters);
      endpoint += `?${params.toString()}`;
    }
    return this.get(endpoint);
  }

  async getCategorySalesReport(filters?: Record<string, string>) {
    let endpoint = '/reports/category-sales';
    if (filters) {
      const params = new URLSearchParams(filters);
      endpoint += `?${params.toString()}`;
    }
    return this.get(endpoint);
  }

  // Waiters
  async getWaiters() {
    return this.get('/staff/waiters');
  }

  async getWaiter(id: string) {
    return this.get(`/staff/waiters/${id}`);
  }

  async createWaiter(data: any) {
    return this.post('/staff/waiters', data);
  }

  async updateWaiter(id: string, data: any) {
    return this.put(`/staff/waiters/${id}`, data);
  }

  async deleteWaiter(id: string) {
    return this.delete(`/staff/waiters/${id}`);
  }

  // Riders
  async getRiders() {
    return this.get('/staff/riders');
  }

  async getRider(id: string) {
    return this.get(`/staff/riders/${id}`);
  }

  async createRider(data: any) {
    return this.post('/staff/riders', data);
  }

  async updateRider(id: string, data: any) {
    return this.put(`/staff/riders/${id}`, data);
  }

  async deleteRider(id: string) {
    return this.delete(`/staff/riders/${id}`);
  }

  // Dining Tables
  async getDiningTables() {
    return this.get('/staff/tables');
  }

  async getDiningTable(id: string) {
    return this.get(`/staff/tables/${id}`);
  }

  async createDiningTable(data: any) {
    return this.post('/staff/tables', data);
  }

  async updateDiningTable(id: string, data: any) {
    return this.put(`/staff/tables/${id}`, data);
  }

  async deleteDiningTable(id: string) {
    return this.delete(`/staff/tables/${id}`);
  }

  // Expenses
  async getExpenses(filters?: { startDate?: string; endDate?: string; category?: string; registerSessionId?: string }) {
    let endpoint = '/expenses';
    if (filters) {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.category) params.append('category', filters.category);
      if (filters.registerSessionId) params.append('registerSessionId', filters.registerSessionId);
      const queryString = params.toString();
      if (queryString) endpoint += `?${queryString}`;
    }
    return this.get(endpoint);
  }

  async getExpense(id: string) {
    return this.get(`/expenses/${id}`);
  }

  async createExpense(data: any) {
    return this.post('/expenses', data);
  }

  async updateExpense(id: string, data: any) {
    return this.put(`/expenses/${id}`, data);
  }

  async deleteExpense(id: string) {
    return this.delete(`/expenses/${id}`);
  }

  async getExpenseSummaryByCategory(filters?: { startDate?: string; endDate?: string }) {
    let endpoint = '/expenses/summary/by-category';
    if (filters) {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      const queryString = params.toString();
      if (queryString) endpoint += `?${queryString}`;
    }
    return this.get(endpoint);
  }

  // Employees
  async getEmployees() {
    return this.get('/employees');
  }

  async getEmployee(id: string) {
    return this.get(`/employees/${id}`);
  }

  async createEmployee(data: any) {
    return this.post('/employees', data);
  }

  async updateEmployee(id: string, data: any) {
    return this.put(`/employees/${id}`, data);
  }

  async deleteEmployee(id: string) {
    return this.delete(`/employees/${id}`);
  }

  // Employee Loans
  async getAllLoans() {
    return this.get('/employees/loans/all');
  }

  async getOutstandingLoans() {
    return this.get('/employees/loans/outstanding');
  }

  async getEmployeeLoans(employeeId: string) {
    return this.get(`/employees/${employeeId}/loans`);
  }

  async getLoan(loanId: string) {
    return this.get(`/employees/loans/${loanId}`);
  }

  async createLoan(employeeId: string, data: any) {
    return this.post(`/employees/${employeeId}/loans`, data);
  }

  async updateLoan(loanId: string, data: any) {
    return this.put(`/employees/loans/${loanId}`, data);
  }

  async recordLoanPayment(loanId: string, paymentAmount: number) {
    return this.post(`/employees/loans/${loanId}/payment`, { paymentAmount });
  }

  async cancelLoan(loanId: string) {
    return this.post(`/employees/loans/${loanId}/cancel`, {});
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl.replace('/api', '')}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const apiClient = new APIClient();
