import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { initWebSocket, getConnectedClientsCount } from './websocket.js';

// Route imports
import { userRoutes } from './routes/users.js';
import { roleRoutes } from './routes/roles.js';
import { categoryRoutes } from './routes/categories.js';
import { menuItemRoutes } from './routes/menuItems.js';
import { variantRoutes } from './routes/variants.js';
import { dealRoutes } from './routes/deals.js';
import { employeeRoutes } from './routes/employees.js';
import { staffRoutes } from './routes/staff.js';
import { expenseRoutes } from './routes/expenses.js';
import { customerRoutes } from './routes/customers.js';
import { orderRoutes } from './routes/orders.js';
import { orderItemRoutes } from './routes/orderItems.js';
import { settingsRoutes } from './routes/settings.js';
import { registerSessionRoutes } from './routes/registerSessions.js';
import { paymentRoutes } from './routes/payments.js';
import { reportRoutes } from './routes/reports.js';
import { maintenanceRoutes } from './routes/maintenance.js';
import { auditLogRoutes } from './routes/auditLogs.js';
import { initializeDatabase } from './db/migrate.js';
import { logger } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});
const app = express();
const PORT = process.env.PORT || 3001;
const DEBUG = process.env.DEBUG === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (optional)
if (DEBUG) {
  app.use((req, res, next) => {
    logger.debug(`[${req.method}] ${req.path}`, {
      body: req.body,
      query: req.query,
    });
    next();
  });
}

// Initialize database
await initializeDatabase();


// Routes
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/menu-items', menuItemRoutes);
app.use('/api/variants', variantRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/order-items', orderItemRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/register-sessions', registerSessionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/audit-logs', auditLogRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    debug: DEBUG,
    timestamp: new Date().toISOString(),
    connectedClients: getConnectedClientsCount(),
  });
});

// API 404 handler — must come after all API routes but before the SPA catch-all
// so unmatched /api/* requests return JSON instead of index.html
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Serve frontend (production)
const frontendPath = path.resolve(__dirname, '../../dist');
const shouldServeFrontend = NODE_ENV === 'production' || process.env.SERVE_FRONTEND === 'true';

if (shouldServeFrontend) {
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  } else {
    logger.warn('Frontend build not found. Run the frontend build to serve the UI.', { frontendPath });
  }
}

// Create HTTP server and attach WebSocket
const server = createServer(app);
initWebSocket(server);

// Start server
server.listen(PORT, () => {
  console.log(`\n🚀 POS Backend running on http://localhost:${PORT}`);
  console.log(`⚙️  Environment: ${NODE_ENV.toUpperCase()}`);
  console.log('📦 Database: PostgreSQL (DATABASE_URL)');
  console.log(`🔄 WebSocket: Enabled on ws://localhost:${PORT}/api/ws`);
  console.log(`🔍 Debug mode: ${DEBUG ? 'ENABLED' : 'DISABLED'} (set DEBUG=true in .env to enable)\n`);
  logger.info(`Backend server started in ${NODE_ENV} mode`);
});
