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
import { EmployeeManagement } from '@/pages/Employees/EmployeeManagement';
import { EmployeeLoanManagement } from '@/pages/Employees/EmployeeLoanManagement';
import { ExpenseManagement } from '@/pages/Expenses/ExpenseManagement';
import { Settings } from '@/pages/Settings/Settings';
import { DialogProvider } from '@/components/DialogProvider';
import { restoreSession } from '@/services/authService';

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/menu/categories" element={<Categories />} />
                  <Route path="/menu/items" element={<MenuItems />} />
                  <Route path="/menu/variants" element={<Variants />} />
                  <Route path="/menu/deals" element={<Deals />} />
                  <Route path="/staff" element={<StaffManagement />} />
                  <Route path="/register" element={<RegisterManagement />} />
                  <Route path="/customers" element={<CustomerManagement />} />
                  <Route path="/employees" element={<EmployeeManagement />} />
                  <Route path="/employee-loans" element={<EmployeeLoanManagement />} />
                  <Route path="/expenses" element={<ExpenseManagement />} />
                  <Route path="/orders/new" element={<CreateOrder />} />
                  <Route path="/orders" element={<OrderList />} />
                  <Route path="/reports/sales-summary" element={<SalesSummary />} />
                  <Route path="/reports/item-sales" element={<ItemSales />} />
                  <Route path="/reports/cancelled-orders" element={<CancelledOrdersReport />} />
                  <Route path="/reports/discounts" element={<DiscountReport />} />
                  <Route path="/reports/employee-loans" element={<EmployeeLoanReport />} />
                  <Route path="/reports/daily-expense" element={<DailyExpenseReport />} />
                  <Route path="/reports/customer-detailed" element={<CustomerDetailedReport />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
