import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync, convertBooleans, convertBooleansArray } from '../db/database.js';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { broadcastSync, broadcastWebsiteOrder } from '../websocket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'zone4kitchen-secret-key-change-in-production';
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Multer setup for payment screenshots
const uploadsDir = path.resolve(__dirname, '../../uploads/payment-screenshots');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
    }
  },
});

// OTP storage (in-memory for now, should use Redis in production)
const otpStore: Map<string, { otp: string; expiresAt: number }> = new Map();

// Generate OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Verify JWT middleware
function verifyToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export const websiteRoutes = express.Router();

// ==================== AUTH ROUTES ====================

// Request OTP
websiteRoutes.post('/auth/request-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Check if customer exists
    const customer = await getAsync('SELECT * FROM customers WHERE phone = ?', [phone]);
    
    // Generate OTP
    const otp = generateOTP();
    otpStore.set(phone, { otp, expiresAt: Date.now() + OTP_EXPIRY });

    // In production, send OTP via SMS
    console.log(`[OTP] ${phone}: ${otp}`); // For development only

    res.json({ 
      success: true, 
      exists: !!customer,
      message: 'OTP sent successfully',
      // Remove this in production!
      devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Verify OTP and Login
websiteRoutes.post('/auth/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required' });
    }

    const stored = otpStore.get(phone);
    if (!stored) {
      return res.status(400).json({ error: 'OTP not found. Please request a new one.' });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    // For development, accept any 6-digit OTP or the correct one
    const isValidOtp = process.env.NODE_ENV === 'development' 
      ? (otp === stored.otp || otp === '123456')
      : otp === stored.otp;

    if (!isValidOtp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    otpStore.delete(phone);

    // Get customer
    const customer = await getAsync('SELECT * FROM customers WHERE phone = ?', [phone]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found. Please register.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: customer.id, phone: customer.phone },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      user: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Register new customer
websiteRoutes.post('/auth/register', async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    // Check if already exists
    const existing = await getAsync('SELECT * FROM customers WHERE phone = ?', [phone]);
    if (existing) {
      return res.status(409).json({ error: 'Customer already exists' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO customers (id, phone, name, address, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, phone, name, address || null, now, now]
    );

    const customer = await getAsync('SELECT * FROM customers WHERE id = ?', [id]);

    // Generate JWT
    const token = jwt.sign(
      { id: customer.id, phone: customer.phone },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      user: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get current user
websiteRoutes.get('/auth/me', verifyToken, async (req: any, res) => {
  try {
    const customer = await getAsync('SELECT * FROM customers WHERE id = ?', [req.user.id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update profile
websiteRoutes.put('/auth/profile', verifyToken, async (req: any, res) => {
  try {
    const { name, address } = req.body;
    const now = new Date().toISOString();

    await runAsync(
      `UPDATE customers SET name = COALESCE(?, name), address = COALESCE(?, address), updatedAt = ? WHERE id = ?`,
      [name || null, address || null, now, req.user.id]
    );

    const customer = await getAsync('SELECT * FROM customers WHERE id = ?', [req.user.id]);
    
    res.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== MENU ROUTES ====================

// Get all active menu items (public)
websiteRoutes.get('/menu', async (req, res) => {
  try {
    const items = await allAsync(
      `SELECT mi.*, c.name as categoryName 
       FROM menuItems mi 
       LEFT JOIN categories c ON mi.categoryId = c.id 
       WHERE mi.isActive = true 
       ORDER BY c.sortOrder, mi.name`
    );

    // Get variants for items that have them
    const itemsWithVariants = await Promise.all(
      convertBooleansArray(items).map(async (item: any) => {
        if (item.hasVariants) {
          const variants = await allAsync(
            `SELECT mv.*, v.name as variantName, v.type as variantType
             FROM menuItemVariants mv
             JOIN variants v ON mv.variantId = v.id
             WHERE mv.menuItemId = ?`,
            [item.id]
          );

          // Get options for each variant
          const variantsWithOptions = await Promise.all(
            variants.map(async (v: any) => {
              const options = await allAsync(
                `SELECT * FROM variantOptions WHERE variantId = ? AND isActive = true ORDER BY sortOrder`,
                [v.variantId]
              );
              return {
                ...convertBooleans(v),
                availableOptionIds: v.availableOptionIds ? JSON.parse(v.availableOptionIds) : [],
                options: convertBooleansArray(options),
              };
            })
          );

          return { ...item, variants: variantsWithOptions };
        }
        return item;
      })
    );

    res.json(itemsWithVariants);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get menu item by ID (public)
websiteRoutes.get('/menu/:id', async (req, res) => {
  try {
    const item = await getAsync(
      'SELECT mi.*, c.name as categoryName FROM menuItems mi LEFT JOIN categories c ON mi.categoryId = c.id WHERE mi.id = ? AND mi.isActive = true',
      [req.params.id]
    );

    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const result = convertBooleans(item);

    if (result.hasVariants) {
      const variants = await allAsync(
        `SELECT mv.*, v.name as variantName, v.type as variantType
         FROM menuItemVariants mv
         JOIN variants v ON mv.variantId = v.id
         WHERE mv.menuItemId = ?`,
        [req.params.id]
      );

      const variantsWithOptions = await Promise.all(
        variants.map(async (v: any) => {
          const options = await allAsync(
            `SELECT * FROM variantOptions WHERE variantId = ? AND isActive = true ORDER BY sortOrder`,
            [v.variantId]
          );
          return {
            ...convertBooleans(v),
            availableOptionIds: v.availableOptionIds ? JSON.parse(v.availableOptionIds) : [],
            options: convertBooleansArray(options),
          };
        })
      );

      result.variants = variantsWithOptions;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get categories (public)
websiteRoutes.get('/categories', async (req, res) => {
  try {
    const categories = await allAsync(
      'SELECT * FROM categories WHERE isActive = true ORDER BY sortOrder, name'
    );
    res.json(convertBooleansArray(categories));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get variants (public)
websiteRoutes.get('/variants', async (req, res) => {
  try {
    const variants = await allAsync(
      'SELECT * FROM variants WHERE isActive = true ORDER BY sortOrder'
    );

    const variantsWithOptions = await Promise.all(
      variants.map(async (v: any) => {
        const options = await allAsync(
          'SELECT * FROM variantOptions WHERE variantId = ? AND isActive = true ORDER BY sortOrder',
          [v.id]
        );
        return {
          ...convertBooleans(v),
          options: convertBooleansArray(options),
        };
      })
    );

    res.json(variantsWithOptions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== DEALS ROUTES ====================

// Get all active deals (public)
websiteRoutes.get('/deals', async (req, res) => {
  try {
    const deals = await allAsync(
      'SELECT * FROM deals WHERE isActive = true ORDER BY createdAt DESC'
    );
    res.json(convertBooleansArray(deals));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get deal by ID with items (public)
websiteRoutes.get('/deals/:id', async (req, res) => {
  try {
    const deal = await getAsync('SELECT * FROM deals WHERE id = ? AND isActive = true', [req.params.id]);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const items = await allAsync(
      `SELECT di.*, mi.name as menuItemName, mi.price as menuItemPrice 
       FROM dealItems di 
       JOIN menuItems mi ON di.menuItemId = mi.id 
       WHERE di.dealId = ? 
       ORDER BY di.sortOrder`,
      [req.params.id]
    );

    const variants = await allAsync(
      `SELECT dv.*, v.name as variantName
       FROM dealVariants dv
       JOIN variants v ON dv.variantId = v.id
       WHERE dv.dealId = ?`,
      [req.params.id]
    );

    res.json(convertBooleans({
      ...deal,
      items: convertBooleansArray(items),
      variants: variants.map((v: any) => convertBooleans({
        ...v,
        availableOptionIds: v.availableOptionIds ? JSON.parse(v.availableOptionIds) : []
      }))
    }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== ORDER ROUTES ====================

// Helper to generate order number
async function generateWebsiteOrderNumber(): Promise<string> {
  try {
    const result = await getAsync(`
      SELECT orderNumber FROM (
        SELECT orderNumber FROM orders
        UNION ALL
        SELECT orderNumber FROM pastOrders
      ) combined
      ORDER BY CAST(SUBSTR(orderNumber, 5) AS INTEGER) DESC
      LIMIT 1
    `);

    if (result && result.orderNumber) {
      const match = result.orderNumber.match(/ORD-(\d+)/);
      if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        return `ORD-${String(nextNum).padStart(5, '0')}`;
      }
    }
  } catch (error) {
    console.error('Error generating order number:', error);
  }
  return `ORD-${String(Date.now()).slice(-5)}`;
}

// Create order (with optional payment screenshot)
websiteRoutes.post('/orders', upload.single('paymentScreenshot'), async (req: any, res) => {
  try {
    let orderData = req.body;
    
    // If order data is sent as JSON string (with file upload)
    if (typeof orderData.order === 'string') {
      orderData = JSON.parse(orderData.order);
    }

    const {
      orderType,
      customerName,
      customerPhone,
      deliveryAddress,
      notes,
      paymentMethod,
      items,
    } = orderData;

    // Validation
    if (!customerName || !customerPhone || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (orderType === 'delivery' && !deliveryAddress) {
      return res.status(400).json({ error: 'Delivery address is required for delivery orders' });
    }

    const orderId = uuidv4();
    const orderNumber = await generateWebsiteOrderNumber();
    const now = new Date().toISOString();

    // Find or create customer
    let customer = await getAsync('SELECT * FROM customers WHERE phone = ?', [customerPhone]);
    if (!customer) {
      const customerId = uuidv4();
      await runAsync(
        `INSERT INTO customers (id, phone, name, address, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [customerId, customerPhone, customerName, deliveryAddress || null, now, now]
      );
      customer = await getAsync('SELECT * FROM customers WHERE id = ?', [customerId]);
    }

    // Calculate totals
    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of items) {
      let unitPrice = item.unitPrice;
      let variantTotal = 0;

      // Calculate variant price modifiers
      if (item.selectedVariants && Array.isArray(item.selectedVariants)) {
        for (const sv of item.selectedVariants) {
          variantTotal += sv.priceModifier || 0;
        }
      }

      const totalPrice = (unitPrice + variantTotal) * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        id: uuidv4(),
        orderId,
        itemType: item.itemType,
        menuItemId: item.menuItemId || null,
        dealId: item.dealId || null,
        quantity: item.quantity,
        unitPrice: unitPrice + variantTotal,
        totalPrice,
        notes: item.notes || null,
        selectedVariants: item.selectedVariants ? JSON.stringify(item.selectedVariants) : null,
        createdAt: now,
      });
    }

    const deliveryCharge = orderType === 'delivery' ? 150 : 0;
    const total = subtotal + deliveryCharge;

    // Get a system user for website orders (use admin or first available user)
    const systemUser = await getAsync(
      `SELECT id FROM users WHERE username = 'admin' OR roleId IN (SELECT id FROM roles WHERE name = 'Admin') LIMIT 1`
    );
    if (!systemUser) {
      return res.status(500).json({ error: 'System configuration error: No admin user found' });
    }

    // Get or create a "Website" register session for online orders
    let registerSession = await getAsync(
      `SELECT * FROM registerSessions WHERE status = 'open' ORDER BY openedAt DESC LIMIT 1`
    );

    if (!registerSession) {
      // Create a placeholder session for website orders
      const sessionId = uuidv4();
      await runAsync(
        `INSERT INTO registerSessions (id, openedBy, openedAt, openingCash, status)
         VALUES (?, ?, ?, 0, 'open')`,
        [sessionId, systemUser.id, now]
      );
      registerSession = { id: sessionId };
    }

    // Create order
    await runAsync(
      `INSERT INTO orders (
        id, orderNumber, registerSessionId, orderType, customerId, customerName, customerPhone,
        deliveryAddress, deliveryCharge, subtotal, total, status, deliveryStatus, isPaid, notes,
        createdBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 'pending', ?, ?, ?, ?, ?)`,
      [
        orderId, orderNumber, registerSession.id, orderType, customer.id, customerName, customerPhone,
        deliveryAddress || null, deliveryCharge, subtotal, total, paymentMethod === 'bank_transfer' ? 0 : 0,
        notes || null, systemUser.id, now, now
      ]
    );

    // Insert order items
    for (const orderItem of orderItems) {
      await runAsync(
        `INSERT INTO orderItems (id, orderId, itemType, menuItemId, dealId, quantity, unitPrice, totalPrice, notes, selectedVariants, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderItem.id, orderItem.orderId, orderItem.itemType, orderItem.menuItemId, orderItem.dealId,
          orderItem.quantity, orderItem.unitPrice, orderItem.totalPrice, orderItem.notes,
          orderItem.selectedVariants, orderItem.createdAt
        ]
      );
    }

    // Handle payment screenshot
    if (req.file) {
      const screenshotPath = `/uploads/payment-screenshots/${req.file.filename}`;
      // Store reference (you might want a separate table for this)
      await runAsync(
        `UPDATE orders SET notes = COALESCE(notes || ' | ', '') || 'Payment Screenshot: ' || ? WHERE id = ?`,
        [screenshotPath, orderId]
      );
    }

    // Update customer order count
    await runAsync(
      `UPDATE customers SET totalOrders = totalOrders + 1, lastOrderAt = ? WHERE id = ?`,
      [now, customer.id]
    );

    // Get created order with items
    const createdOrder = await getAsync('SELECT * FROM orders WHERE id = ?', [orderId]);
    const createdItems = await allAsync('SELECT * FROM orderItems WHERE orderId = ?', [orderId]);

    // Notify POS system via WebSocket (standard sync event)
    broadcastSync('orders', 'create', orderId);
    
    // Send detailed website order notification for popup
    broadcastWebsiteOrder({
      orderId,
      orderNumber,
      customerName,
      customerPhone,
      orderType,
      total,
    });

    res.status(201).json({
      ...convertBooleans(createdOrder),
      items: convertBooleansArray(createdItems),
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get order by ID (public - for tracking)
websiteRoutes.get('/orders/:id', async (req, res) => {
  try {
    const order = await getAsync('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await allAsync(
      `SELECT oi.*, 
       COALESCE(mi.name, d.name) as name
       FROM orderItems oi
       LEFT JOIN menuItems mi ON oi.menuItemId = mi.id
       LEFT JOIN deals d ON oi.dealId = d.id
       WHERE oi.orderId = ?`,
      [req.params.id]
    );

    res.json({
      ...convertBooleans(order),
      items: items.map((item: any) => ({
        ...convertBooleans(item),
        selectedVariants: item.selectedVariants ? JSON.parse(item.selectedVariants) : null,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Track order by order number or ID
websiteRoutes.get('/orders/track/:identifier', async (req, res) => {
  try {
    const identifier = req.params.identifier;
    
    // Try to find by order number first, then by ID
    let order = await getAsync('SELECT * FROM orders WHERE orderNumber = ?', [identifier]);
    if (!order) {
      order = await getAsync('SELECT * FROM orders WHERE id = ?', [identifier]);
    }
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await allAsync(
      `SELECT oi.*, 
       COALESCE(mi.name, d.name) as name
       FROM orderItems oi
       LEFT JOIN menuItems mi ON oi.menuItemId = mi.id
       LEFT JOIN deals d ON oi.dealId = d.id
       WHERE oi.orderId = ?`,
      [order.id]
    );

    res.json({
      ...convertBooleans(order),
      items: items.map((item: any) => ({
        ...convertBooleans(item),
        selectedVariants: item.selectedVariants ? JSON.parse(item.selectedVariants) : null,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get my orders (authenticated)
websiteRoutes.get('/orders/my-orders', verifyToken, async (req: any, res) => {
  try {
    const orders = await allAsync(
      'SELECT * FROM orders WHERE customerId = ? ORDER BY createdAt DESC',
      [req.user.id]
    );

    const ordersWithItems = await Promise.all(
      orders.map(async (order: any) => {
        const items = await allAsync(
          `SELECT oi.*, COALESCE(mi.name, d.name) as name
           FROM orderItems oi
           LEFT JOIN menuItems mi ON oi.menuItemId = mi.id
           LEFT JOIN deals d ON oi.dealId = d.id
           WHERE oi.orderId = ?`,
          [order.id]
        );

        return {
          ...convertBooleans(order),
          items: items.map((item: any) => ({
            ...convertBooleans(item),
            selectedVariants: item.selectedVariants ? JSON.parse(item.selectedVariants) : null,
          })),
        };
      })
    );

    res.json(ordersWithItems);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== SETTINGS ROUTES ====================

// Admin verification middleware (reuse existing POS auth)
function verifyAdminToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    // Admin tokens should have isAdmin or role check
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
}

// Get all website settings (public)
websiteRoutes.get('/settings', async (req, res) => {
  try {
    const settings = await allAsync('SELECT * FROM websiteSettings', []);
    const settingsObj: Record<string, any> = {};
    
    settings.forEach((s: any) => {
      try {
        settingsObj[s.id] = JSON.parse(s.value);
      } catch {
        settingsObj[s.id] = s.value;
      }
    });

    // Return with defaults for missing settings
    res.json({
      hero: settingsObj['hero'] || {
        title: 'Delicious Food, Delivered Fresh',
        subtitle: 'Experience the authentic taste of Pakistani cuisine, made with love and delivered to your doorstep.',
        backgroundImage: null,
        ctaText: 'Order Now',
        ctaLink: '/menu',
      },
      about: settingsObj['about'] || {
        title: 'About Zone 4 Kitchen',
        description: 'We serve authentic Pakistani cuisine with fresh ingredients and traditional recipes.',
        image: null,
      },
      contact: settingsObj['contact'] || {
        phone: '03084559944',
        email: 'info@zone4kitchen.com',
        address: 'Jinnah Ave, Mohran Jejan, Islamabad, Pakistan',
        whatsapp: '923084559944',
      },
      bankDetails: settingsObj['bank-details'] || {
        bankName: 'Bank Al Habib',
        accountTitle: 'Zone 4 Kitchen',
        accountNumber: '1234567890123',
        iban: 'PK00BAHL0000001234567890123',
        instructions: 'Please transfer the exact amount and upload the payment screenshot.',
      },
      delivery: settingsObj['delivery'] || {
        fee: 150,
        minimumOrder: 500,
        freeDeliveryThreshold: 2000,
        estimatedTime: '30-45 min',
        isEnabled: true,
      },
      workingHours: settingsObj['working-hours'] || {
        monday: { open: '11:00', close: '23:00', closed: false },
        tuesday: { open: '11:00', close: '23:00', closed: false },
        wednesday: { open: '11:00', close: '23:00', closed: false },
        thursday: { open: '11:00', close: '23:00', closed: false },
        friday: { open: '11:00', close: '23:00', closed: false },
        saturday: { open: '12:00', close: '00:00', closed: false },
        sunday: { open: '12:00', close: '00:00', closed: false },
      },
      announcement: settingsObj['announcement'] || {
        text: '',
        isActive: false,
        type: 'info',
      },
      social: settingsObj['social'] || {
        facebook: '',
        instagram: '',
        twitter: '',
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get single setting (public)
websiteRoutes.get('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const setting = await getAsync('SELECT * FROM websiteSettings WHERE id = ?', [key]);
    
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    try {
      res.json(JSON.parse(setting.value));
    } catch {
      res.json(setting.value);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update setting (admin only)
websiteRoutes.put('/admin/settings/:key', verifyAdminToken, async (req, res) => {
  try {
    const { key } = req.params;
    const value = JSON.stringify(req.body);
    
    await runAsync(
      `INSERT INTO websiteSettings (id, value, updatedAt) 
       VALUES (?, ?, datetime('now')) 
       ON CONFLICT(id) DO UPDATE SET value = ?, updatedAt = datetime('now')`,
      [key, value, value]
    );
    
    res.json({ success: true, message: 'Setting updated' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get bank details
websiteRoutes.get('/settings/bank-details', async (req, res) => {
  try {
    const settings = await getAsync('SELECT * FROM websiteSettings WHERE id = ?', ['bank-details']);
    if (!settings) {
      // Return default
      return res.json({
        bankName: 'Bank Al Habib',
        accountTitle: 'Zone 4 Kitchen',
        accountNumber: '1234567890123',
        iban: 'PK00BAHL0000001234567890123',
        instructions: 'Please transfer the exact amount and upload the payment screenshot.',
      });
    }
    res.json(JSON.parse(settings.value));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
