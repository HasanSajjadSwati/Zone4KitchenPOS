import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  ShoppingCartIcon,
  RectangleStackIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  BanknotesIcon,
  UsersIcon,
  PlusCircleIcon,
  ListBulletIcon,
  GiftIcon,
  CreditCardIcon,
  DocumentTextIcon,
  ReceiptPercentIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/stores/authStore';
import { logout } from '@/services/authService';
import { useTheme } from '@/contexts/ThemeContext';
import logo from '@/assets/logo.svg';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  resource?: string;
  action?: string;
}

interface NavSection {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    orders: true,
    'menu-management': true,
    'people-management': true,
    financial: true,
    reports: true,
  });
  const currentUser = useAuthStore((state) => state.currentUser);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const { isDark, toggleTheme } = useTheme();

  const canAccess = (resource: string, action: string = 'read') => hasPermission(resource, action);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  const navigationSections: NavSection[] = [
    {
      name: 'Orders',
      icon: ShoppingCartIcon,
      items: [
        { name: 'New Order', href: '/orders/new', icon: PlusCircleIcon, resource: 'orders', action: 'create' },
        { name: 'Order List', href: '/orders', icon: ListBulletIcon, resource: 'orders', action: 'read' },
      ],
    },
    {
      name: 'Menu Management',
      icon: RectangleStackIcon,
      items: [
        { name: 'Categories', href: '/menu/categories', icon: RectangleStackIcon, resource: 'menu', action: 'read' },
        { name: 'Items', href: '/menu/items', icon: ShoppingCartIcon, resource: 'menu', action: 'read' },
        { name: 'Variants', href: '/menu/variants', icon: Cog6ToothIcon, resource: 'menu', action: 'read' },
        { name: 'Deals', href: '/menu/deals', icon: GiftIcon, resource: 'menu', action: 'read' },
      ],
    },
    {
      name: 'People Management',
      icon: UserGroupIcon,
      items: [
        { name: 'Customers', href: '/customers', icon: UsersIcon, resource: 'orders', action: 'read' },
        { name: 'Employees', href: '/employees', icon: UserGroupIcon, resource: 'employees', action: 'read' },
        { name: 'Employee Loans', href: '/employee-loans', icon: CreditCardIcon, resource: 'employee_loans', action: 'read' },
        { name: 'Staff (Waiters/Riders)', href: '/staff', icon: UserGroupIcon, resource: 'staff', action: 'read' },
      ],
    },
    {
      name: 'Financial',
      icon: BanknotesIcon,
      items: [
        { name: 'Register', href: '/register', icon: BanknotesIcon, resource: 'register', action: 'read' },
        { name: 'Expenses', href: '/expenses', icon: CurrencyDollarIcon, resource: 'expenses', action: 'read' },
      ],
    },
    {
      name: 'Reports',
      icon: ChartBarIcon,
      items: [
        { name: 'Sales Summary', href: '/reports/sales-summary', icon: ChartBarIcon, resource: 'reports', action: 'read' },
        { name: 'Item Sales', href: '/reports/item-sales', icon: ChartBarIcon, resource: 'reports', action: 'read' },
        { name: 'Cancelled Orders', href: '/reports/cancelled-orders', icon: ClipboardDocumentListIcon, resource: 'reports', action: 'read' },
        { name: 'Order Details', href: '/reports/orders-detailed', icon: DocumentTextIcon, resource: 'reports', action: 'read' },
        { name: 'Discounts', href: '/reports/discounts', icon: ReceiptPercentIcon, resource: 'reports', action: 'read' },
        { name: 'Employee Loans', href: '/reports/employee-loans', icon: DocumentTextIcon, resource: 'reports', action: 'read' },
        { name: 'Daily Expense', href: '/reports/daily-expense', icon: DocumentTextIcon, resource: 'reports', action: 'read' },
        { name: 'Customer Details', href: '/reports/customer-detailed', icon: DocumentTextIcon, resource: 'reports', action: 'read' },
      ],
    },
  ];

  const filteredSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.resource || canAccess(item.resource, item.action || 'read')),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center">
              <img src={logo} alt="Zone4Kitchen" className="h-10 w-auto" />
            </div>
            <button
              className="lg:hidden text-gray-600"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {/* Dashboard */}
            <Link
              to="/"
              className={`flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors ${
                location.pathname === '/' ? 'bg-blue-50 text-blue-600' : ''
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <HomeIcon className="w-5 h-5 mr-3" />
              Dashboard
            </Link>

            {/* Sections */}
            {filteredSections.map((section) => {
              const sectionKey = section.name.toLowerCase().replace(/\s+/g, '-');
              const isExpanded = expandedSections[sectionKey];
              const isActive = section.items.some((item) => location.pathname === item.href);

              return (
                <div key={section.name} className="space-y-1">
                  <button
                    onClick={() => toggleSection(sectionKey)}
                    className={`flex items-center justify-between w-full px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors ${
                      isActive ? 'bg-gray-50 font-medium' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <section.icon className="w-5 h-5 mr-3" />
                      {section.name}
                    </div>
                    {isExpanded ? (
                      <ChevronDownIcon className="w-4 h-4" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="ml-4 space-y-1">
                      {section.items.map((item) => (
                        <Link
                          key={item.href}
                          to={item.href}
                          className={`flex items-center px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors ${
                            location.pathname === item.href
                              ? 'bg-blue-50 text-blue-600 font-medium'
                              : ''
                          }`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <item.icon className="w-4 h-4 mr-3" />
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Settings */}
            {canAccess('settings', 'read') && (
              <Link
                to="/settings"
                className={`flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors ${
                  location.pathname === '/settings' ? 'bg-blue-50 text-blue-600' : ''
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Cog6ToothIcon className="w-5 h-5 mr-3" />
                Settings
              </Link>
            )}
          </nav>

          {/* User section */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold">
                  {currentUser?.fullName.charAt(0)}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  {currentUser?.fullName}
                </p>
                <p className="text-xs text-gray-500">{currentUser?.username}</p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center w-full px-4 py-2 mb-1 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isDark ? (
                <SunIcon className="w-5 h-5 mr-3" />
              ) : (
                <MoonIcon className="w-5 h-5 mr-3" />
              )}
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftOnRectangleIcon className="w-5 h-5 mr-3" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center h-16 px-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 mr-4"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <img src={logo} alt="Zone4Kitchen" className="h-8 w-auto flex-1" />
          <button
            onClick={toggleTheme}
            className="text-gray-600 ml-4"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
          </button>
        </header>


        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
