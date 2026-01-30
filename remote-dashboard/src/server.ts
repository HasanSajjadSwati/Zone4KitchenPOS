import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

// Import routes
import { ordersRoute } from './routes/orders.js';
import { customersRoute } from './routes/customers.js';
import { menuRoute } from './routes/menu.js';
import { settingsRoute } from './routes/settings.js';
import { statsRoute } from './routes/stats.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.DASHBOARD_PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Serve static files (built React frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Middleware to verify JWT token
export function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Login endpoint
app.post('/api/auth/login', (req: any, res: any) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Simple authentication (in production, verify against database)
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, {
      expiresIn: '24h',
    });
    return res.json({
      success: true,
      token,
      user: { username, role: 'admin' },
    });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

// Logout endpoint
app.post('/api/auth/logout', (req: any, res: any) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// Verify token endpoint
app.get('/api/auth/verify', authenticateToken, (req: any, res: any) => {
  res.json({ valid: true, user: req.user });
});

// Protected routes
app.use('/api/orders', authenticateToken, ordersRoute);
app.use('/api/customers', authenticateToken, customersRoute);
app.use('/api/menu', authenticateToken, menuRoute);
app.use('/api/settings', authenticateToken, settingsRoute);
app.use('/api/stats', authenticateToken, statsRoute);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Serve React app for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n📊 POS Remote Dashboard running on http://localhost:${PORT}`);
  console.log(`🔐 Authentication required - use admin credentials to login\n`);
});

export default app;
