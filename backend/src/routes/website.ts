import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync, convertBooleans, convertBooleansArray } from '../db/database.js';
import { broadcastSync, broadcastWebsiteOrder } from '../websocket.js';

export const websiteRoutes = express.Router();

// ─── Public Menu API ───────────────────────────────────────────────

// Get restaurant info (name, phone, address, whatsapp)
websiteRoutes.get('/info', async (_req, res) => {
  try {
    const settings = await getAsync('SELECT * FROM settings WHERE id = ?', ['default']);
    if (!settings) {
      return res.json({
        restaurantName: 'Restaurant',
        restaurantPhone: '',
        restaurantAddress: '',
        whatsappNumber: '',
        deliveryCharge: 0,
      });
    }
    res.json({
      restaurantName: settings.restaurantName || 'Restaurant',
      restaurantPhone: settings.restaurantPhone || '',
      restaurantAddress: settings.restaurantAddress || '',
      whatsappNumber: settings.whatsappNumber || '',
      deliveryCharge: settings.deliveryCharge || 0,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all active categories
websiteRoutes.get('/categories', async (_req, res) => {
  try {
    const categories = await allAsync(
      "SELECT * FROM categories WHERE isActive = TRUE ORDER BY sortOrder, name"
    );
    res.json(convertBooleansArray(categories));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all active menu items (excluding deal-only items)
websiteRoutes.get('/menu-items', async (_req, res) => {
  try {
    const items = await allAsync(
      "SELECT * FROM menuItems WHERE isActive = TRUE AND isDealOnly = FALSE ORDER BY name"
    );

    // For items with price 0 and variants, fetch variant price info
    const itemsWithPrices = await Promise.all(
      items.map(async (item: any) => {
        if (item.price === 0 && item.hasVariants) {
          const variants = await allAsync(
            `SELECT mv.variantId, mv.availableOptionIds
             FROM menuItemVariants mv
             JOIN variants v ON mv.variantId = v.id
             WHERE mv.menuItemId = ? AND v.isActive = TRUE`,
            [item.id]
          );

          let minPrice = Infinity;
          let maxPrice = 0;

          for (const v of variants) {
            const availableOptionIds = v.availableOptionIds
              ? (typeof v.availableOptionIds === 'string' ? JSON.parse(v.availableOptionIds) : v.availableOptionIds)
              : [];

            const allOptions = await allAsync(
              'SELECT priceModifier FROM variantOptions WHERE variantId = ? AND isActive = TRUE',
              [v.variantId]
            );

            const options = availableOptionIds.length > 0
              ? allOptions.filter((o: any) => availableOptionIds.includes(o.id))
              : allOptions;

            for (const opt of options) {
              if (opt.priceModifier > 0) {
                minPrice = Math.min(minPrice, opt.priceModifier);
                maxPrice = Math.max(maxPrice, opt.priceModifier);
              }
            }
          }

          return convertBooleans({
            ...item,
            minVariantPrice: minPrice === Infinity ? 0 : minPrice,
            maxVariantPrice: maxPrice,
          });
        }
        return convertBooleans(item);
      })
    );

    res.json(itemsWithPrices);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get menu item with variants
websiteRoutes.get('/menu-items/:id', async (req, res) => {
  try {
    const item = await getAsync(
      'SELECT * FROM menuItems WHERE id = ? AND isActive = TRUE',
      [req.params.id]
    );
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const variants = await allAsync(
      `SELECT mv.*, v.name as variantName, v.type as variantType
       FROM menuItemVariants mv
       JOIN variants v ON mv.variantId = v.id
       WHERE mv.menuItemId = ? AND v.isActive = TRUE`,
      [req.params.id]
    );

    // Get options for each variant
    const variantsWithOptions = await Promise.all(
      variants.map(async (v: any) => {
        const availableOptionIds = v.availableOptionIds
          ? (typeof v.availableOptionIds === 'string' ? JSON.parse(v.availableOptionIds) : v.availableOptionIds)
          : [];

        const allOptions = await allAsync(
      'SELECT * FROM variantOptions WHERE variantId = ? AND isActive = TRUE ORDER BY sortOrder',
          [v.variantId]
        );

        const options = availableOptionIds.length > 0
          ? allOptions.filter((o: any) => availableOptionIds.includes(o.id))
          : allOptions;

        return convertBooleans({
          ...v,
          availableOptionIds,
          options: convertBooleansArray(options),
        });
      })
    );

    res.json(convertBooleans({ ...item, variants: variantsWithOptions }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all active deals
websiteRoutes.get('/deals', async (_req, res) => {
  try {
    const deals = await allAsync(
      "SELECT * FROM deals WHERE isActive = TRUE ORDER BY name"
    );

    // Get items for each deal + variant price info for deals with price 0
    const dealsWithItems = await Promise.all(
      deals.map(async (deal: any) => {
        const items = await allAsync(
          `SELECT di.*, mi.name as menuItemName
           FROM dealItems di
           JOIN menuItems mi ON di.menuItemId = mi.id
           WHERE di.dealId = ?
           ORDER BY di.sortOrder`,
          [deal.id]
        );

        let minVariantPrice = 0;
        let maxVariantPrice = 0;

        if (deal.price === 0 && deal.hasVariants) {
          const variants = await allAsync(
            `SELECT dv.variantId, dv.availableOptionIds
             FROM dealVariants dv
             JOIN variants v ON dv.variantId = v.id
             WHERE dv.dealId = ? AND v.isActive = TRUE`,
            [deal.id]
          );

          let min = Infinity;
          let max = 0;

          for (const v of variants) {
            const availableOptionIds = v.availableOptionIds
              ? (typeof v.availableOptionIds === 'string' ? JSON.parse(v.availableOptionIds) : v.availableOptionIds)
              : [];

            const allOptions = await allAsync(
              'SELECT priceModifier FROM variantOptions WHERE variantId = ? AND isActive = TRUE',
              [v.variantId]
            );

            const options = availableOptionIds.length > 0
              ? allOptions.filter((o: any) => availableOptionIds.includes(o.id))
              : allOptions;

            for (const opt of options) {
              if (opt.priceModifier > 0) {
                min = Math.min(min, opt.priceModifier);
                max = Math.max(max, opt.priceModifier);
              }
            }
          }

          minVariantPrice = min === Infinity ? 0 : min;
          maxVariantPrice = max;
        }

        return convertBooleans({
          ...deal,
          items: convertBooleansArray(items),
          minVariantPrice,
          maxVariantPrice,
        });
      })
    );

    res.json(dealsWithItems);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get deal with variants and items
websiteRoutes.get('/deals/:id', async (req, res) => {
  try {
    const deal = await getAsync(
      'SELECT * FROM deals WHERE id = ? AND isActive = TRUE',
      [req.params.id]
    );
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const items = await allAsync(
      `SELECT di.*, mi.name as menuItemName
       FROM dealItems di
       JOIN menuItems mi ON di.menuItemId = mi.id
       WHERE di.dealId = ?
       ORDER BY di.sortOrder`,
      [deal.id]
    );

    const variants = await allAsync(
      `SELECT dv.*, v.name as variantName, v.type as variantType
       FROM dealVariants dv
       JOIN variants v ON dv.variantId = v.id
       WHERE dv.dealId = ? AND v.isActive = TRUE`,
      [deal.id]
    );

    const variantsWithOptions = await Promise.all(
      variants.map(async (v: any) => {
        const availableOptionIds = v.availableOptionIds
          ? (typeof v.availableOptionIds === 'string' ? JSON.parse(v.availableOptionIds) : v.availableOptionIds)
          : [];

        const allOptions = await allAsync(
          'SELECT * FROM variantOptions WHERE variantId = ? AND isActive = TRUE ORDER BY sortOrder',
          [v.variantId]
        );

        const options = availableOptionIds.length > 0
          ? allOptions.filter((o: any) => availableOptionIds.includes(o.id))
          : allOptions;

        return convertBooleans({
          ...v,
          availableOptionIds,
          options: convertBooleansArray(options),
        });
      })
    );

    res.json(convertBooleans({
      ...deal,
      items: convertBooleansArray(items),
      variants: variantsWithOptions,
    }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ─── Public Order API ──────────────────────────────────────────────

// Place order from website
websiteRoutes.post('/orders', async (req, res) => {
  try {
    const {
      orderType,
      customerName,
      customerPhone,
      deliveryAddress,
      notes,
      items, // Array of { itemType, menuItemId?, dealId?, quantity, unitPrice, totalPrice, selectedVariants?, dealBreakdown?, notes? }
    } = req.body;

    // Validate required fields
    if (!orderType || !customerName || !customerPhone) {
      return res.status(400).json({ error: 'Customer name, phone, and order type are required' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    if (!['take_away', 'delivery'].includes(orderType)) {
      return res.status(400).json({ error: 'Website orders must be take_away or delivery' });
    }

    if (orderType === 'delivery' && !deliveryAddress) {
      return res.status(400).json({ error: 'Delivery address is required for delivery orders' });
    }

    // Get settings for delivery charge
    const settings = await getAsync('SELECT * FROM settings WHERE id = ?', ['default']);
    const deliveryCharge = orderType === 'delivery' ? (settings?.deliveryCharge || 0) : 0;

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.totalPrice || 0;
    }
    const total = subtotal + deliveryCharge;

    // Find or create a website register session
    let registerSession = await getAsync(
      "SELECT * FROM registerSessions WHERE status = 'open' ORDER BY openedAt DESC LIMIT 1"
    );

    if (!registerSession) {
      // Create a website register session
      const sessionId = uuidv4();
      // Get the first admin user to use as session creator
      const adminUser = await getAsync(
        "SELECT u.id FROM users u JOIN roles r ON u.roleId = r.id WHERE r.name = 'Admin' LIMIT 1"
      );
      const defaultUserId = adminUser?.id || 'system';

      await runAsync(
        `INSERT INTO registerSessions (id, openedBy, openedAt, openingCash, status)
         VALUES (?, ?, ?, ?, ?)`,
        [sessionId, defaultUserId, new Date().toISOString(), 0, 'open']
      );
      registerSession = await getAsync('SELECT * FROM registerSessions WHERE id = ?', [sessionId]);
    }

    // Get the first admin user for createdBy
    const adminUser = await getAsync(
      "SELECT u.id FROM users u JOIN roles r ON u.roleId = r.id WHERE r.name = 'Admin' LIMIT 1"
    );
    const createdBy = adminUser?.id || 'system';

    // Generate order number
    const lastOrder = await getAsync(`
      SELECT orderNumber FROM orders
      ORDER BY CAST(SUBSTR(orderNumber, 5) AS INTEGER) DESC
      LIMIT 1
    `);
    let orderNumber = 'ORD-00001';
    if (lastOrder?.orderNumber) {
      const match = lastOrder.orderNumber.match(/ORD-(\d+)/);
      if (match) {
        orderNumber = `ORD-${String(parseInt(match[1], 10) + 1).padStart(5, '0')}`;
      }
    }

    // Find or create customer
    let customer = await getAsync('SELECT * FROM customers WHERE phone = ?', [customerPhone]);
    if (!customer) {
      const customerId = uuidv4();
      await runAsync(
        `INSERT INTO customers (id, phone, name, address, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [customerId, customerPhone, customerName, deliveryAddress || null, new Date().toISOString(), new Date().toISOString()]
      );
      customer = await getAsync('SELECT * FROM customers WHERE id = ?', [customerId]);
    }

    const orderId = uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO orders (
        id, orderNumber, registerSessionId, orderType, orderSource,
        tableId, waiterId, customerName, customerPhone, customerId,
        riderId, deliveryAddress, deliveryCharge,
        subtotal, discountType, discountValue, discountAmount, total,
        status, deliveryStatus, isPaid, createdBy, createdAt, updatedAt, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId, orderNumber, registerSession.id, orderType, 'website',
        null, null, customerName, customerPhone, customer.id,
        null, deliveryAddress || null, deliveryCharge,
        subtotal, null, 0, 0, total,
        'open', orderType === 'delivery' ? 'pending' : null, false, createdBy, now, now, notes || null,
      ]
    );

    // Insert order items
    for (const item of items) {
      const itemId = uuidv4();
      await runAsync(
        `INSERT INTO orderItems (
          id, orderId, itemType, menuItemId, dealId, quantity, unitPrice, totalPrice,
          notes, selectedVariants, dealBreakdown, addedAt, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId, orderId, item.itemType,
          item.menuItemId || null, item.dealId || null,
          item.quantity, item.unitPrice, item.totalPrice,
          item.notes || null,
          JSON.stringify(item.selectedVariants || []),
          JSON.stringify(item.dealBreakdown || null),
          now, now,
        ]
      );
    }

    // Update customer stats
    await runAsync(
      'UPDATE customers SET totalOrders = totalOrders + 1, lastOrderAt = ? WHERE id = ?',
      [now, customer.id]
    );

    // Broadcast new order to POS
    broadcastSync('orders', 'create', orderId);

    // Send website order notification with details
    broadcastWebsiteOrder({
      orderId,
      orderNumber,
      customerName,
      customerPhone,
      orderType,
      total,
      itemCount: items.length,
    });

    const order = await getAsync('SELECT * FROM orders WHERE id = ?', [orderId]);
    const orderItems = await allAsync('SELECT * FROM orderItems WHERE orderId = ?', [orderId]);

    res.status(201).json(convertBooleans({
      ...order,
      items: orderItems.map((item: any) => convertBooleans({
        ...item,
        selectedVariants: item.selectedVariants ? JSON.parse(item.selectedVariants) : [],
        dealBreakdown: item.dealBreakdown ? JSON.parse(item.dealBreakdown) : null,
      })),
    }));
  } catch (error) {
    console.error('Website order creation error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});
