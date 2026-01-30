import express from 'express';
import {
  getAllDocuments,
  getDocument,
} from '../services/couchdbService.js';

export const customersRoute = express.Router();

// Get all customers
customersRoute.get('/', async (req, res) => {
  try {
    const customers = await getAllDocuments('customers');
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get customer by ID
customersRoute.get('/:id', async (req, res) => {
  try {
    const customer = await getDocument(req.params.id);
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Search customers by name
customersRoute.get('/search/:name', async (req, res) => {
  try {
    const customers = await getAllDocuments('customers');
    const filtered = customers.filter((c: any) =>
      c.name?.toLowerCase().includes((req.params.name as string).toLowerCase())
    );
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
