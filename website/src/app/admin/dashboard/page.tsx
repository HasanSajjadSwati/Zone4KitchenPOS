'use client';

import { useEffect, useState } from 'react';
import {
  ShoppingBag,
  DollarSign,
  Users,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface Stats {
  todayOrders: number;
  todayRevenue: number;
  totalCustomers: number;
  pendingOrders: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    todayOrders: 0,
    todayRevenue: 0,
    totalCustomers: 0,
    pendingOrders: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // These would come from your API
      // For now, using placeholder data
      setStats({
        todayOrders: 12,
        todayRevenue: 15500,
        totalCustomers: 156,
        pendingOrders: 3,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: "Today's Orders",
      value: stats.todayOrders,
      icon: ShoppingBag,
      color: 'bg-blue-500',
    },
    {
      label: "Today's Revenue",
      value: `Rs. ${stats.todayRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-green-500',
    },
    {
      label: 'Total Customers',
      value: stats.totalCustomers,
      icon: Users,
      color: 'bg-purple-500',
    },
    {
      label: 'Pending Orders',
      value: stats.pendingOrders,
      icon: TrendingUp,
      color: 'bg-orange-500',
    },
  ];

  const quickLinks = [
    { href: '/admin/dashboard/hero', label: 'Edit Hero Section', description: 'Update homepage banner' },
    { href: '/admin/dashboard/about', label: 'Edit About Section', description: 'Modify about us content' },
    { href: '/admin/dashboard/bank', label: 'Update Bank Details', description: 'Change payment info' },
    { href: '/admin/dashboard/delivery', label: 'Delivery Settings', description: 'Configure delivery options' },
    { href: '/admin/dashboard/announcement', label: 'Announcement Banner', description: 'Set site-wide notice' },
    { href: '/admin/dashboard/hours', label: 'Working Hours', description: 'Update business hours' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-gray-900 mb-6">
        Dashboard
      </h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group"
            >
              <div>
                <p className="font-medium text-gray-900 group-hover:text-primary-600">
                  {link.label}
                </p>
                <p className="text-sm text-gray-500">{link.description}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600" />
            </Link>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">
          Welcome to the Admin Panel
        </h3>
        <p className="text-blue-700">
          Use the sidebar to navigate and manage your website content. All changes
          are saved automatically and will reflect on the live website immediately.
        </p>
      </div>
    </div>
  );
}
