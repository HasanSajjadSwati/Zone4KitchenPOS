import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Layout } from '@/components/Layout';
import { Categories } from '@/pages/Menu/Categories';
import { MenuItems } from '@/pages/Menu/MenuItems';
import { Variants } from '@/pages/Menu/Variants';
import { Deals } from '@/pages/Menu/Deals';
import { StaffManagement } from '@/pages/Staff/StaffManagement';
import { RegisterManagement } from '@/pages/Register/RegisterManagement';
import { CustomerManagement } from '@/pages/Customers/CustomerManagement';
import { CreateOrder } from '@/pages/Orders/CreateOrder';
import { OrderList } from '@/pages/Orders/OrderList';
import { SalesSummary } from '@/pages/Reports/SalesSummary';
import { ItemSales } from '@/pages/Reports/ItemSales';
import { CancelledOrdersReport } from '@/pages/Reports/CancelledOrdersReport';
import { DailyExpenseReport } from '@/pages/Reports/DailyExpenseReport';
import { DiscountReport } from '@/pages/Reports/DiscountReport';
import { EmployeeLoanReport } from '@/pages/Reports/EmployeeLoanReport';
import { CustomerDetailedReport } from '@/pages/Reports/CustomerDetailedReport';
import { OrderDetailedReport } from '@/pages/Reports/OrderDetailedReport';
import { EmployeeManagement } from '@/pages/Employees/EmployeeManagement';
import { EmployeeLoanManagement } from '@/pages/Employees/EmployeeLoanManagement';
import { ExpenseManagement } from '@/pages/Expenses/ExpenseManagement';
import { Settings } from '@/pages/Settings/Settings';
import { DialogProvider } from '@/components/DialogProvider';
import { SyncProvider } from '@/contexts/SyncContext';
import { restoreSession } from '@/services/authService';

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RequirePermission({
  children,
  resource,
  action = 'read',
}: {
  children: React.ReactNode;
  resource: string;
  action?: string;
}) {
  const hasPermission = useAuthStore((state) => state.hasPermission(resource, action));

  if (!hasPermission) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  useEffect(() => {
    // Backend API is already configured via environment variables
    // No initialization needed - frontend communicates directly with backend
    restoreSession().catch(() => {});
    console.log('✓ App initialized - Backend API ready');
  }, []);

  return (
    <BrowserRouter>
      <DialogProvider />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <SyncProvider>
                <Layout>
                  <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route
                    path="/menu/categories"
                    element={
                      <RequirePermission resource="menu">
                        <Categories />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/menu/items"
                    element={
                      <RequirePermission resource="menu">
                        <MenuItems />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/menu/variants"
                    element={
                      <RequirePermission resource="menu">
                        <Variants />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/menu/deals"
                    element={
                      <RequirePermission resource="menu">
                        <Deals />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/staff"
                    element={
                      <RequirePermission resource="staff">
                        <StaffManagement />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      <RequirePermission resource="register">
                        <RegisterManagement />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/customers"
                    element={
                      <RequirePermission resource="orders">
                        <CustomerManagement />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/employees"
                    element={
                      <RequirePermission resource="employees">
                        <EmployeeManagement />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/employee-loans"
                    element={
                      <RequirePermission resource="employee_loans">
                        <EmployeeLoanManagement />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/expenses"
                    element={
                      <RequirePermission resource="expenses">
                        <ExpenseManagement />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/orders/new"
                    element={
                      <RequirePermission resource="orders" action="create">
                        <CreateOrder />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/orders"
                    element={
                      <RequirePermission resource="orders">
                        <OrderList />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/reports/sales-summary"
                    element={
                      <RequirePermission resource="reports">
                        <SalesSummary />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/reports/item-sales"
                    element={
                      <RequirePermission resource="reports">
                        <ItemSales />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/reports/cancelled-orders"
                    element={
                      <RequirePermission resource="reports">
                        <CancelledOrdersReport />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/reports/discounts"
                    element={
                      <RequirePermission resource="reports">
                        <DiscountReport />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/reports/employee-loans"
                    element={
                      <RequirePermission resource="reports">
                        <EmployeeLoanReport />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/reports/daily-expense"
                    element={
                      <RequirePermission resource="reports">
                        <DailyExpenseReport />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/reports/customer-detailed"
                    element={
                      <RequirePermission resource="reports">
                        <CustomerDetailedReport />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/reports/orders-detailed"
                    element={
                      <RequirePermission resource="reports">
                        <OrderDetailedReport />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <RequirePermission resource="settings">
                        <Settings />
                      </RequirePermission>
                    }
                  />
                </Routes>
              </Layout>
            </SyncProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  </BrowserRouter>
);
}

export default App;
