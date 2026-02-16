import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  BellIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/stores/authStore';
import { logout } from '@/services/authService';
import { useTheme } from '@/contexts/ThemeContext';
import { syncService, type WebsiteOrderEvent } from '@/services/syncService';
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

  // ─── Website Order Notifications ────────────────────────────────
  const [notifications, setNotifications] = useState<(WebsiteOrderEvent & { read: boolean })[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [toastQueue, setToastQueue] = useState<WebsiteOrderEvent[]>([]);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const notifBellRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Create notification sound using Web Audio API
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Play two-tone chime
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      playTone(880, 0, 0.15);
      playTone(1100, 0.15, 0.15);
      playTone(1320, 0.3, 0.3);
    } catch {
      // Audio not available
    }
  }, []);

  useEffect(() => {
    const unsub = syncService.onWebsiteOrder((order) => {
      // Add to persistent notification list
      setNotifications((prev) => [{ ...order, read: false }, ...prev].slice(0, 50));
      // Add to toast queue (auto-dismiss after 8s)
      setToastQueue((prev) => [order, ...prev]);
      setTimeout(() => {
        setToastQueue((prev) => prev.filter((o) => o.orderId !== order.orderId));
      }, 8000);
      playNotificationSound();
    });
    return unsub;
  }, [playNotificationSound]);

  // Close notification panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedInPanel = notifPanelRef.current?.contains(target);
      const clickedInBell = notifBellRef.current?.contains(target);
      if (!clickedInPanel && !clickedInBell) {
        setShowNotifPanel(false);
      }
    };
    if (showNotifPanel) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifPanel]);

  const markAsRead = useCallback((orderId: string) => {
    setNotifications((prev) => prev.map((n) => n.orderId === orderId ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setShowNotifPanel(false);
  }, []);

  const dismissToast = useCallback((orderId: string) => {
    setToastQueue((prev) => prev.filter((o) => o.orderId !== orderId));
  }, []);

  const viewOrderFromNotif = useCallback((orderId: string) => {
    markAsRead(orderId);
    setShowNotifPanel(false);
    setToastQueue((prev) => prev.filter((o) => o.orderId !== orderId));
    navigate('/orders');
  }, [navigate, markAsRead]);

  const formatTimeAgo = useCallback((timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }, []);

  // ─── Notification Bell Component ─────────────────────────────────
  const NotificationBell = () => (
    <div className="relative" ref={notifBellRef}>
      <button
        onClick={() => setShowNotifPanel((prev) => !prev)}
        className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 flex items-center justify-center px-1 text-[11px] font-bold text-white bg-red-500 rounded-full animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );

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
              className={`flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors dark:text-gray-200 dark:hover:bg-gray-700 ${
                location.pathname === '/' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-200' : ''
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
                      className={`flex items-center justify-between w-full px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors dark:text-gray-200 dark:hover:bg-gray-700 ${
                        isActive ? 'bg-gray-50 font-medium dark:bg-gray-800' : ''
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
                          className={`flex items-center px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-gray-700 ${
                            location.pathname === item.href
                              ? 'bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/40 dark:text-blue-200'
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
                className={`flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors dark:text-gray-200 dark:hover:bg-gray-700 ${
                  location.pathname === '/settings' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-200' : ''
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
              className="flex items-center w-full px-4 py-2 mb-1 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-200 dark:hover:bg-gray-700"
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
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <ArrowLeftOnRectangleIcon className="w-5 h-5 mr-3" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center h-16 px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          {/* Mobile: hamburger + logo */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 dark:text-gray-300 mr-4"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <img src={logo} alt="Zone4Kitchen" className="lg:hidden h-8 w-auto" />
          {/* Spacer */}
          <div className="flex-1" />
          {/* Right actions */}
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
          </div>
        </header>


        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {children}
          </div>
        </main>
      </div>



      {/* ═══ Notification Panel Overlay ═══ */}
      {showNotifPanel && (
        <div ref={notifPanelRef} className="fixed top-16 right-4 z-[9999] w-96 max-h-[500px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-2">
              <BellIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 px-1.5 py-0.5 rounded-full font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium px-2 py-1 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 font-medium px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <BellIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Website orders will appear here</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.orderId}
                  className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors ${
                    !notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                  onClick={() => viewOrderFromNotif(notif.orderId)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${!notif.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {notif.orderNumber}
                          </span>
                          <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-1.5 py-0.5 rounded font-medium flex-shrink-0 capitalize">
                            {notif.orderType.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                          {formatTimeAgo(notif.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                        {notif.customerName} &middot; {notif.customerPhone}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {notif.itemCount} item{notif.itemCount !== 1 ? 's' : ''}
                        </span>
                        <span className="text-sm font-bold text-green-600 dark:text-green-400">
                          Rs. {notif.total.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══ Website Order Toast Notifications ═══ */}
      {toastQueue.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
          {toastQueue.map((order) => (
            <div
              key={order.orderId}
              className="pointer-events-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-l-4 border-green-500 p-4"
              style={{ animation: 'slideInRight 0.4s ease-out' }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">🌐</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">New Website Order!</span>
                    <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-1.5 py-0.5 rounded font-medium">
                      {order.orderNumber}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{order.customerName}</span>
                    {' · '}
                    <span className="capitalize">{order.orderType.replace('_', ' ')}</span>
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      Rs. {order.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => viewOrderFromNotif(order.orderId)}
                      className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                    >
                      View Orders
                    </button>
                    <button
                      onClick={() => dismissToast(order.orderId)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => dismissToast(order.orderId)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-in animation style */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
