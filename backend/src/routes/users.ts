import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { runAsync, getAsync, allAsync } from '../db/database.js';

export const userRoutes = express.Router();

const getAdminUser = async (adminUserId: string) => {
  if (!adminUserId) return null;
  return getAsync(
    `SELECT u.id, r.name as roleName
     FROM users u
     JOIN roles r ON u.roleId = r.id
     WHERE u.id = ?`,
    [adminUserId]
  );
};

const ensureAdmin = async (adminUserId: string) => {
  const admin = await getAdminUser(adminUserId);
  if (!admin) {
    return { status: 404, error: 'Admin user not found' };
  }
  if (String(admin.roleName).toLowerCase() !== 'admin') {
    return { status: 403, error: 'Only admins can manage users' };
  }
  return null;
};

// Get all users
userRoutes.get('/', async (req, res) => {
  try {
    // Deleted users stay in the list (flagged by deletedAt) so reports can still show their names.
    const users = await allAsync(`
      SELECT u.id, u.username, u.fullName, u.roleId, u.isActive, u.deletedAt, u.createdAt, u.updatedAt, r.name as roleName
      FROM users u
      JOIN roles r ON u.roleId = r.id
      ORDER BY u.createdAt DESC
    `);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get user by ID
userRoutes.get('/:id', async (req, res) => {
  try {
    const user = await getAsync(`
      SELECT u.id, u.username, u.fullName, u.roleId, u.isActive, u.deletedAt, u.createdAt, u.updatedAt, r.name as roleName
      FROM users u
      JOIN roles r ON u.roleId = r.id
      WHERE u.id = ?
    `, [req.params.id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create user
userRoutes.post('/', async (req, res) => {
  try {
    const { username, password, fullName, roleId, isActive, adminUserId } = req.body;

    if (!username || !password || !fullName || !roleId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!adminUserId) {
      return res.status(400).json({ error: 'Admin user is required' });
    }

    const adminCheck = await ensureAdmin(adminUserId);
    if (adminCheck) {
      return res.status(adminCheck.status).json({ error: adminCheck.error });
    }

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO users (id, username, passwordHash, fullName, roleId, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, hashedPassword, fullName, roleId, isActive !== false ? 1 : 0, now, now]
    );

    const user = await getAsync('SELECT id, username, fullName, roleId, isActive, createdAt, updatedAt FROM users WHERE id = ?', [id]);
    res.status(201).json(user);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: message });
  }
});

// Update user
userRoutes.put('/:id', async (req, res) => {
  try {
    const { fullName, roleId, isActive, adminUserId } = req.body;
    const now = new Date().toISOString();

    if (!adminUserId) {
      return res.status(400).json({ error: 'Admin user is required' });
    }

    const adminCheck = await ensureAdmin(adminUserId);
    if (adminCheck) {
      return res.status(adminCheck.status).json({ error: adminCheck.error });
    }

    const user = await getAsync('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await runAsync(
      `UPDATE users SET fullName = ?, roleId = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
      [fullName || user.fullName, roleId || user.roleId, isActive !== undefined ? (isActive ? 1 : 0) : user.isActive, now, req.params.id]
    );

    const updated = await getAsync('SELECT id, username, fullName, roleId, isActive, createdAt, updatedAt FROM users WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Change password
userRoutes.post('/:id/change-password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing password fields' });
    }

    const user = await getAsync('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid old password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const now = new Date().toISOString();

    await runAsync('UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?', [hashedPassword, now, req.params.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Admin reset password
userRoutes.post('/:id/reset-password', async (req, res) => {
  try {
    const { adminUserId, newPassword } = req.body;

    if (!adminUserId || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const admin = await getAsync(
      `SELECT u.id, r.name as roleName
       FROM users u
       JOIN roles r ON u.roleId = r.id
       WHERE u.id = ?`,
      [adminUserId]
    );

    if (!admin) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    if (String(admin.roleName).toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Only admins can reset passwords' });
    }

    const targetUser = await getAsync('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const now = new Date().toISOString();

    await runAsync('UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?', [
      hashedPassword,
      now,
      req.params.id,
    ]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete user
userRoutes.delete('/:id', async (req, res) => {
  try {
    const adminUserId =
      (req.body?.adminUserId as string | undefined) ||
      (req.query?.adminUserId as string | undefined) ||
      (req.headers['x-admin-user-id'] as string | undefined);

    if (!adminUserId) {
      return res.status(400).json({ error: 'Admin user is required' });
    }

    const adminCheck = await ensureAdmin(adminUserId);
    if (adminCheck) {
      return res.status(adminCheck.status).json({ error: adminCheck.error });
    }

    if (adminUserId === req.params.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const user = await getAsync(
      `SELECT u.id, u.username, r.name as roleName
       FROM users u
       JOIN roles r ON u.roleId = r.id
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (String(user.roleName).toLowerCase() === 'admin') {
      return res.status(403).json({ error: 'Admin users cannot be deleted' });
    }

    // Soft delete. Orders, payments, register sessions and the audit log all reference the user
    // (foreign keys), so a hard DELETE fails for anyone who ever logged in, and would erase who
    // took which order. The user can no longer log in (inactive, renamed), the username is freed
    // for a new account, and reports still resolve the name from the kept row.
    const now = new Date().toISOString();
    // isActive is bound, not written as a literal: Postgres rejects the integer 0 for a boolean column.
    await runAsync(
      'UPDATE users SET isActive = ?, deletedAt = ?, username = ?, updatedAt = ? WHERE id = ?',
      [false, now, `${user.username}.deleted.${Date.now()}`, now, req.params.id]
    );
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
