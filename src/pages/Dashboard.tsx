import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCartIcon,
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Card, Button } from '@/components/ui';
import { db } from '@/db';
import { formatCurrency } from '@/utils/validation';
import { startOfToday, endOfToday } from 'date-fns';

interface DashboardStats {
  todayOrders: number;
  todaySales: number;
  openOrders: number;
  completedToday: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    todayOrders: 0,
    todaySales: 0,
    openOrders: 0,
    completedToday: 0,
  });
  const [activeSession, setActiveSession] = useState<any>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const today = startOfToday();
    const todayEnd = endOfToday();

    // Get today's orders
    const todayOrders = await db.orders
      .where('createdAt')
      .between(today, todayEnd)
      .toArray();

    // Get open orders
    const openOrders = await db.orders
      .where('status')
      .equals('open')
      .count();

    // Calculate stats
    const todaySales = todayOrders
      .filter((o) => o.status === 'completed')
      .reduce((sum, o) => sum + o.total, 0);

    const completedToday = todayOrders.filter((o) => o.status === 'completed').length;

    setStats({
      todayOrders: todayOrders.length,
      todaySales,
      openOrders,
      completedToday,
    });

    // Check for active register session
    const session = await db.registerSessions
      .where('status')
      .equals('open')
      .first();
    setActiveSession(session);
  };

  const statCards = [
    {
      name: "Today's Orders",
      value: stats.todayOrders,
      icon: ShoppingCartIcon,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      name: "Today's Sales",
      value: formatCurrency(stats.todaySales),
      icon: BanknotesIcon,
      color: 'bg-green-100 text-green-600',
    },
    {
      name: 'Open Orders',
      value: stats.openOrders,
      icon: ClockIcon,
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      name: 'Completed Today',
      value: stats.completedToday,
      icon: CheckCircleIcon,
      color: 'bg-purple-100 text-purple-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-3">
          {activeSession ? (
            <Link to="/register">
              <Button variant="secondary">View Register</Button>
            </Link>
          ) : (
            <Link to="/register">
              <Button variant="primary">Open Register</Button>
            </Link>
          )}
          <Link to="/orders/new">
            <Button variant="success">New Order</Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.name} padding="lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!activeSession && (
        <Card padding="lg" className="bg-yellow-50 border-yellow-200">
          <div className="flex items-center">
            <ClockIcon className="w-6 h-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="font-semibold text-yellow-900">No Active Register Session</h3>
              <p className="text-sm text-yellow-700">
                Please open a register session to start taking orders.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <Card padding="lg">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/orders">
            <Button variant="secondary" className="w-full">
              View Orders
            </Button>
          </Link>
          <Link to="/menu/categories">
            <Button variant="secondary" className="w-full">
              Manage Menu
            </Button>
          </Link>
          <Link to="/reports/sales-summary">
            <Button variant="secondary" className="w-full">
              View Reports
            </Button>
          </Link>
          <Link to="/settings">
            <Button variant="secondary" className="w-full">
              Settings
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};
