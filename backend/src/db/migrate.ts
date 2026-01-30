import { runAsync, allAsync } from './database.js';
import { postgresSchema } from './schema-postgres.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

export async function initializeDatabase() {
  try {
    // Execute schema
    const statements = postgresSchema.split(';').filter(s => s.trim());
    logger.info(`Executing ${statements.length} schema statements`);
    for (const statement of statements) {
      await runAsync(statement);
    }
    console.log('✓ Database schema created');
    logger.info('Database schema created successfully');

    // Check if roles exist
    const rolesCount = await allAsync('SELECT COUNT(*) as count FROM roles');
    const existingRoles = Number(rolesCount[0]?.count ?? 0);
    logger.info(`Found ${existingRoles} existing roles`);
    if (existingRoles === 0) {
      logger.info('Creating default roles');
      // Create default roles
      const adminRoleId = uuidv4();
      const managerRoleId = uuidv4();
      const cashierRoleId = uuidv4();

      const adminPermissions = JSON.stringify([
        { resource: 'orders', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'menu', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'reports', actions: ['read', 'export'] },
        { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'settings', actions: ['read', 'update', 'delete'] },
        { resource: 'register', actions: ['create', 'read', 'update'] },
        { resource: 'staff', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'audit', actions: ['read'] },
        { resource: 'discounts', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'employees', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'employee_loans', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'expenses', actions: ['create', 'read', 'update', 'delete'] },
      ]);

      const managerPermissions = JSON.stringify([
        { resource: 'orders', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'menu', actions: ['create', 'read', 'update'] },
        { resource: 'reports', actions: ['read', 'export'] },
        { resource: 'users', actions: ['read'] },
        { resource: 'settings', actions: ['read'] },
        { resource: 'register', actions: ['create', 'read', 'update'] },
        { resource: 'staff', actions: ['create', 'read', 'update'] },
        { resource: 'audit', actions: ['read'] },
        { resource: 'discounts', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'employees', actions: ['read'] },
        { resource: 'employee_loans', actions: ['create', 'read'] },
        { resource: 'expenses', actions: ['create', 'read'] },
      ]);

      const cashierPermissions = JSON.stringify([
        { resource: 'orders', actions: ['create', 'read', 'update'] },
        { resource: 'menu', actions: ['read'] },
        { resource: 'register', actions: ['create', 'read'] },
        { resource: 'staff', actions: ['read'] },
      ]);

      await runAsync(
        'INSERT INTO roles (id, name, permissions) VALUES (?, ?, ?)',
        [adminRoleId, 'Admin', adminPermissions]
      );
      await runAsync(
        'INSERT INTO roles (id, name, permissions) VALUES (?, ?, ?)',
        [managerRoleId, 'Manager', managerPermissions]
      );
      await runAsync(
        'INSERT INTO roles (id, name, permissions) VALUES (?, ?, ?)',
        [cashierRoleId, 'Cashier', cashierPermissions]
      );

      console.log('✓ Default roles created');

      // Create admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await runAsync(
        `INSERT INTO users (id, username, passwordHash, fullName, roleId, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          'admin',
          hashedPassword,
          'System Administrator',
          adminRoleId,
          1,
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );
      console.log('✓ Admin user created (username: admin, password: admin123)');

      // Create default settings
      await runAsync(
        `INSERT INTO settings (id, restaurantName, updatedAt)
         VALUES (?, ?, ?)`,
        ['default', 'My Restaurant', new Date().toISOString()]
      );
      console.log('✓ Default settings created');
    }

    console.log('✓ Database initialization complete');
    logger.info('Database initialization completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    logger.error('Database migration failed', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase().then(() => {
    process.exit(0);
  }).catch(() => {
    process.exit(1);
  });
}
