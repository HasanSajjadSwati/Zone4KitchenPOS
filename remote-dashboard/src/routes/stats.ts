import express from 'express';
import { getAllDocuments, getDatabaseInfo } from '../services/couchdbService.js';

export const statsRoute = express.Router();

// Get dashboard stats
statsRoute.get('/', async (req, res) => {
  try {
    const orders = await getAllDocuments('orders');
    const customers = await getAllDocuments('customers');
    const dbInfo = await getDatabaseInfo();

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter((o: any) => {
      const orderDate = new Date(o.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });

    const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const todayRevenue = todayOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

    const stats = {
      totalOrders: orders.length,
      todayOrders: todayOrders.length,
      totalCustomers: customers.length,
      totalRevenue,
      todayRevenue,
      averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
      database: {
        name: dbInfo.name,
        documentsCount: dbInfo.documentsCount,
      },
    };

    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get sales by date
statsRoute.get('/sales/daily', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const orders = await getAllDocuments('order');

    const salesByDate: { [key: string]: number } = {};

    orders.forEach((order: any) => {
      const date = new Date(order.createdAt).toISOString().split('T')[0];
      if (!salesByDate[date]) {
        salesByDate[date] = 0;
      }
      salesByDate[date] += order.total || 0;
    });

    const result = Object.entries(salesByDate)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-parseInt(days as string));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get top selling items
statsRoute.get('/top-items', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const orders = await getAllDocuments('orders');
    const menuItems = await getAllDocuments('menuItems');

    const itemSales: { [key: string]: { count: number; revenue: number; name: string } } = {};

    orders.forEach((order: any) => {
      if (order.items) {
        order.items.forEach((item: any) => {
          const menuItemId = item.menuItemId || item.id;
          if (!menuItemId) return;

          if (!itemSales[menuItemId]) {
            const menuItem = menuItems.find((m: any) => m._id === menuItemId || m.id === menuItemId);
            itemSales[menuItemId] = {
              count: 0,
              revenue: 0,
              name: menuItem?.name || item.name || 'Unknown',
            };
          }
          itemSales[menuItemId].count += item.quantity || 1;
          itemSales[menuItemId].revenue += (item.totalPrice || item.price || 0);
        });
      }
    });

    const result = Object.entries(itemSales)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, parseInt(limit as string));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get customer stats
statsRoute.get('/customers', async (req, res) => {
  try {
    const customers = await getAllDocuments('customers');
    const orders = await getAllDocuments('orders');

    const stats = customers.map((customer: any) => {
      const customerOrders = orders.filter((o: any) => o.customerId === customer._id);
      const totalSpent = customerOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

      return {
        ...customer,
        orderCount: customerOrders.length,
        totalSpent,
        averageOrder: customerOrders.length > 0 ? totalSpent / customerOrders.length : 0,
      };
    });

    // Sort by total spent
    stats.sort((a: any, b: any) => b.totalSpent - a.totalSpent);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
