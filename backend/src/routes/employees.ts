import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync, convertBooleans, convertBooleansArray } from '../db/database.js';

export const employeeRoutes = express.Router();

// Get all employees
employeeRoutes.get('/', async (req, res) => {
  try {
    const employees = await allAsync('SELECT * FROM employees ORDER BY name');
    res.json(convertBooleansArray(employees));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get employee by ID
employeeRoutes.get('/:id', async (req, res) => {
  try {
    const employee = await getAsync('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(convertBooleans(employee));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create employee
employeeRoutes.post('/', async (req, res) => {
  try {
    const { id: providedId, name, phone, cnic, joiningDate, designation, salary, isActive, notes } = req.body;

    if (!name || salary === undefined) {
      return res.status(400).json({ error: 'Missing required fields (name, salary)' });
    }

    // Use provided ID or generate a new one
    const id = providedId || uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO employees (id, name, phone, cnic, joiningDate, designation, salary, isActive, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, phone || null, cnic || null, joiningDate || now, designation || null, salary, isActive !== false ? 1 : 0, notes || null, now, now]
    );

    const employee = await getAsync('SELECT * FROM employees WHERE id = ?', [id]);
    res.status(201).json(convertBooleans(employee));
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'CNIC already exists' });
    }
    res.status(500).json({ error: message });
  }
});

// Update employee
employeeRoutes.put('/:id', async (req, res) => {
  try {
    const { name, phone, cnic, joiningDate, designation, salary, isActive, notes } = req.body;
    const now = new Date().toISOString();

    const employee = await getAsync('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    await runAsync(
      `UPDATE employees SET name = ?, phone = ?, cnic = ?, joiningDate = ?, designation = ?, salary = ?, isActive = ?, notes = ?, updatedAt = ? WHERE id = ?`,
      [
        name || employee.name,
        phone !== undefined ? phone : employee.phone,
        cnic !== undefined ? cnic : employee.cnic,
        joiningDate || employee.joiningDate,
        designation !== undefined ? designation : employee.designation,
        salary !== undefined ? salary : employee.salary,
        isActive !== undefined ? (isActive ? 1 : 0) : employee.isActive,
        notes !== undefined ? notes : employee.notes,
        now,
        req.params.id
      ]
    );

    const updated = await getAsync('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    res.json(convertBooleans(updated));
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'CNIC already exists' });
    }
    res.status(500).json({ error: message });
  }
});

// Delete employee
employeeRoutes.delete('/:id', async (req, res) => {
  try {
    const employee = await getAsync('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check for active loans
    const activeLoans = await allAsync(
      'SELECT * FROM employeeLoans WHERE employeeId = ? AND status = ?',
      [req.params.id, 'active']
    );

    if (activeLoans.length > 0) {
      return res.status(400).json({ error: 'Cannot delete employee with active loans. Please settle or cancel loans first.' });
    }

    await runAsync('DELETE FROM employees WHERE id = ?', [req.params.id]);
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Employee Loans Routes

// Get all loans
employeeRoutes.get('/loans/all', async (req, res) => {
  try {
    const loans = await allAsync(
      `SELECT el.*, e.name as employeeName
       FROM employeeLoans el
       JOIN employees e ON el.employeeId = e.id
       ORDER BY el.issueDate DESC`
    );
    res.json(convertBooleansArray(loans));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get outstanding loans
employeeRoutes.get('/loans/outstanding', async (req, res) => {
  try {
    const loans = await allAsync(
      `SELECT el.*, e.name as employeeName
       FROM employeeLoans el
       JOIN employees e ON el.employeeId = e.id
       WHERE el.status = 'active'
       ORDER BY el.issueDate DESC`
    );
    res.json(convertBooleansArray(loans));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get loans for a specific employee
employeeRoutes.get('/:id/loans', async (req, res) => {
  try {
    const loans = await allAsync(
      'SELECT * FROM employeeLoans WHERE employeeId = ? ORDER BY issueDate DESC',
      [req.params.id]
    );
    res.json(convertBooleansArray(loans));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get loan by ID
employeeRoutes.get('/loans/:loanId', async (req, res) => {
  try {
    const loan = await getAsync('SELECT * FROM employeeLoans WHERE id = ?', [req.params.loanId]);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    res.json(convertBooleans(loan));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create loan
employeeRoutes.post('/:id/loans', async (req, res) => {
  try {
    const { amount, issueDate, reason, totalInstallments, notes, issuedBy } = req.body;
    const { id: employeeId } = req.params;

    if (!amount || !totalInstallments || !issuedBy) {
      return res.status(400).json({ error: 'Missing required fields (amount, totalInstallments, issuedBy)' });
    }

    // Verify employee exists
    const employee = await getAsync('SELECT * FROM employees WHERE id = ?', [employeeId]);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const installmentAmount = amount / totalInstallments;

    await runAsync(
      `INSERT INTO employeeLoans (id, employeeId, amount, issueDate, reason, totalInstallments, installmentAmount, paidInstallments, remainingAmount, status, issuedBy, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, employeeId, amount, issueDate || now, reason || null, totalInstallments, installmentAmount, 0, amount, 'active', issuedBy, notes || null, now, now]
    );

    const loan = await getAsync('SELECT * FROM employeeLoans WHERE id = ?', [id]);
    res.status(201).json(convertBooleans(loan));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update loan (for recording payments)
employeeRoutes.put('/loans/:loanId', async (req, res) => {
  try {
    const { paidInstallments, remainingAmount, status, notes } = req.body;
    const now = new Date().toISOString();

    const loan = await getAsync('SELECT * FROM employeeLoans WHERE id = ?', [req.params.loanId]);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    await runAsync(
      `UPDATE employeeLoans SET paidInstallments = ?, remainingAmount = ?, status = ?, notes = ?, updatedAt = ? WHERE id = ?`,
      [
        paidInstallments !== undefined ? paidInstallments : loan.paidInstallments,
        remainingAmount !== undefined ? remainingAmount : loan.remainingAmount,
        status || loan.status,
        notes !== undefined ? notes : loan.notes,
        now,
        req.params.loanId
      ]
    );

    const updated = await getAsync('SELECT * FROM employeeLoans WHERE id = ?', [req.params.loanId]);
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Record loan payment
employeeRoutes.post('/loans/:loanId/payment', async (req, res) => {
  try {
    const { paymentAmount } = req.body;

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const loan = await getAsync('SELECT * FROM employeeLoans WHERE id = ?', [req.params.loanId]);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    if (loan.status !== 'active') {
      return res.status(400).json({ error: 'Cannot record payment for inactive loan' });
    }

    const newRemainingAmount = Math.max(0, loan.remainingAmount - paymentAmount);
    const installmentsPaid = Math.floor((loan.amount - newRemainingAmount) / loan.installmentAmount);
    const newStatus = newRemainingAmount === 0 ? 'paid' : 'active';
    const now = new Date().toISOString();

    await runAsync(
      `UPDATE employeeLoans SET paidInstallments = ?, remainingAmount = ?, status = ?, updatedAt = ? WHERE id = ?`,
      [installmentsPaid, newRemainingAmount, newStatus, now, req.params.loanId]
    );

    const updated = await getAsync('SELECT * FROM employeeLoans WHERE id = ?', [req.params.loanId]);
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Cancel loan
employeeRoutes.post('/loans/:loanId/cancel', async (req, res) => {
  try {
    const loan = await getAsync('SELECT * FROM employeeLoans WHERE id = ?', [req.params.loanId]);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const now = new Date().toISOString();

    await runAsync(
      `UPDATE employeeLoans SET status = 'cancelled', updatedAt = ? WHERE id = ?`,
      [now, req.params.loanId]
    );

    const updated = await getAsync('SELECT * FROM employeeLoans WHERE id = ?', [req.params.loanId]);
    res.json(convertBooleans(updated));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
