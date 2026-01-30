import express from 'express';
import {
  getAllDocuments,
  getDocument,
} from '../services/couchdbService.js';

export const ordersRoute = express.Router();

// Get all orders
ordersRoute.get('/', async (req, res) => {
  try {
    const orders = await getAllDocuments('orders');
    // Sort by date descending
    orders.sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get order by ID
ordersRoute.get('/:id', async (req, res) => {
  try {
    const order = await getDocument(req.params.id);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get orders by date range
ordersRoute.get('/date-range', async (req, res) => {
  try {
    const { start, end } = req.query;
    const orders = await getAllDocuments('orders');

    if (start && end) {
      const filtered = orders.filter((order: any) => {
        const orderDate = new Date(order.createdAt).getTime();
        const startDate = new Date(start as string).getTime();
        const endDate = new Date(end as string).getTime();
        return orderDate >= startDate && orderDate <= endDate;
      });
      return res.json(filtered);
    }

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
