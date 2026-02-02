import { db } from '@/db';
import type { Order, OrderItem, Settings, KOTTicket, KOTItemDisplay } from '@/db/types';
import { formatDateTime, formatCurrency } from '@/utils/validation';
import { logAudit } from '@/utils/audit';
import { createId } from '@/utils/uuid';

// KOT Printing
export async function printKOT(
  orderId: string,
  userId: string,
  splitByCategory: boolean = false,
  reprintAll: boolean = false
): Promise<void> {
  const order = await db.orders.get(orderId);
  if (!order) throw new Error('Order not found');

  const allItems = await db.orderItems.where('orderId').equals(orderId).toArray();

  // Get only NEW items (not yet printed or added after last KOT)
  const newItems = allItems.filter(
    (item: OrderItem) =>
      !item.lastPrintedAt ||
      (order.lastKotPrintedAt && item.addedAt > order.lastKotPrintedAt)
  );

  // If no new items and not reprinting all, throw error with special code
  if (newItems.length === 0 && !reprintAll) {
    const error = new Error('No new items to print') as Error & { code?: string };
    error.code = 'NO_NEW_ITEMS';
    throw error;
  }

  // Use either new items or all items depending on reprintAll flag
  const itemsToPrint = reprintAll ? allItems : newItems;

  if (itemsToPrint.length === 0) {
    throw new Error('No items in order');
  }

  const settings = await db.settings.get('default');
  const shouldSplit = splitByCategory || settings?.kotSplitByMajorCategory || false;

  let kotTickets: KOTTicket[] = [];

  if (shouldSplit) {
    // Group by major category
    const grouped = await groupItemsByMajorCategory(itemsToPrint);

    for (const [categoryName, items] of Object.entries(grouped)) {
      const ticket = await createKOTTicket(order, items, categoryName);
      kotTickets.push(ticket);
    }
  } else {
    // Single KOT
    const ticket = await createKOTTicket(order, itemsToPrint, null);
    kotTickets.push(ticket);
  }

  // Print all tickets in a single window with page breaks
  await printAllKOTTickets(kotTickets);

  // Save to kotPrints table
  for (const ticket of kotTickets) {
    await db.kotPrints.add({
      id: createId(),
      orderId,
      printNumber: order.kotPrintCount + 1,
      majorCategory: ticket.category,
      itemIds: ticket.items.map((i) => i.id),
      printedBy: userId,
      printedAt: new Date(),
      createdAt: new Date(),
    });
  }

  // Update items lastPrintedAt
  const now = new Date();
  for (const item of itemsToPrint) {
    await db.orderItems.update(item.id, { lastPrintedAt: now });
  }

  // Update order
  await db.orders.update(orderId, {
    lastKotPrintedAt: now,
    kotPrintCount: order.kotPrintCount + 1,
    updatedAt: new Date(),
  });

  await logAudit({
    userId,
    action: 'print',
    tableName: 'orders',
    recordId: orderId,
    description: `Printed KOT #${order.kotPrintCount + 1} with ${itemsToPrint.length} items${reprintAll ? ' (REPRINT ALL)' : ''}`,
  });
}

async function createKOTTicket(
  order: Order,
  items: OrderItem[],
  category: string | null
): Promise<KOTTicket> {
  const displayItems: KOTItemDisplay[] = await Promise.all(
    items.map(async (item) => await formatKOTItem(item))
  );

  const table = order.tableId ? await getTableNumber(order.tableId) : null;

  return {
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    table,
    category,
    items: displayItems,
    printTime: new Date(),
    printNumber: order.kotPrintCount + 1,
  };
}

async function formatKOTItem(item: OrderItem): Promise<KOTItemDisplay> {
  if (item.itemType === 'menu_item') {
    const menuItem = await db.menuItems.get(item.menuItemId!);

    // Format variants - handle both single-select and multi-select
    const variants = item.selectedVariants.map((v) => {
      if (v.selectedOptions && v.selectedOptions.length > 0) {
        // Multi-select format
        const optionNames = v.selectedOptions.map(o => o.optionName).join(', ');
        return `${v.variantName}: ${optionNames}`;
      } else {
        // Single-select format
        return `${v.variantName}: ${v.optionName}`;
      }
    });

    return {
      id: item.id,
      name: menuItem?.name || 'Unknown Item',
      quantity: item.quantity,
      variants,
      notes: item.notes,
    };
  } else {
    // Deal
    const deal = await db.deals.get(item.dealId!);

    const breakdown = item.dealBreakdown?.map((di) => ({
      name: di.menuItemName,
      quantity: di.quantity,
      variants: di.selectedVariants.map((v) => {
        if (v.selectedOptions && v.selectedOptions.length > 0) {
          // Multi-select format
          const optionNames = v.selectedOptions.map(o => o.optionName).join(', ');
          return `${v.variantName}: ${optionNames}`;
        } else {
          // Single-select format
          return `${v.variantName}: ${v.optionName}`;
        }
      }),
    }));

    return {
      id: item.id,
      name: deal?.name || 'Unknown Deal',
      quantity: item.quantity,
      variants: [],
      breakdown,
      notes: item.notes,
    };
  }
}

async function groupItemsByMajorCategory(
  items: OrderItem[]
): Promise<Record<string, OrderItem[]>> {
  const grouped: Record<string, OrderItem[]> = {};

  for (const item of items) {
    let categoryName = 'Uncategorized';

    if (item.itemType === 'menu_item' && item.menuItemId) {
      const menuItem = await db.menuItems.get(item.menuItemId);
      if (menuItem) {
        categoryName = await getMajorCategoryName(menuItem.categoryId);
      }
    } else if (item.itemType === 'deal' && item.dealId) {
      const deal = await db.deals.get(item.dealId);
      if (deal && deal.categoryId) {
        categoryName = await getMajorCategoryName(deal.categoryId);
      }
    }

    if (!grouped[categoryName]) {
      grouped[categoryName] = [];
    }
    grouped[categoryName].push(item);
  }

  return grouped;
}

async function getMajorCategoryName(categoryId: string): Promise<string> {
  const category = await db.categories.get(categoryId);
  if (!category) return 'Unknown';

  if (category.type === 'major') {
    return category.name;
  } else {
    // Get parent
    const parent = category.parentId
      ? await db.categories.get(category.parentId)
      : null;
    return parent?.name || category.name;
  }
}

async function getTableNumber(tableId: string): Promise<string> {
  const table = await db.diningTables.get(tableId);
  return table?.tableNumber || 'Unknown';
}

async function printAllKOTTickets(tickets: KOTTicket[]): Promise<void> {
  const html = renderAllKOTTickets(tickets);
  const printWindow = window.open('', '_blank', 'width=300,height=800');

  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

function renderAllKOTTickets(tickets: KOTTicket[]): string {
  const ticketsHtml = tickets.map((ticket, index) => `
    <div class="kot-ticket" ${index < tickets.length - 1 ? 'style="page-break-after: always;"' : ''}>
      <div class="header">
        <div class="header-title">*** KITCHEN ORDER ***</div>
        <div>Order: ${ticket.orderNumber}</div>
        ${ticket.category ? `<div class="station">Station: ${ticket.category}</div>` : ''}
        <div>Type: ${ticket.orderType.toUpperCase().replace('_', ' ')}</div>
        ${ticket.table ? `<div>Table: ${ticket.table}</div>` : ''}
        <div>KOT #${ticket.printNumber}</div>
        <div>${formatDateTime(ticket.printTime)}</div>
      </div>

      ${ticket.items
        .map(
          (item) => `
        <div class="item">
          <div class="item-name">${item.quantity}x ${item.name}</div>
          ${
            item.variants && item.variants.length > 0
              ? `<div class="item-detail">→ ${item.variants.join(', ')}</div>`
              : ''
          }
          ${
            item.breakdown
              ? item.breakdown
                  .map(
                    (di) => `
            <div class="item-detail">
              • ${di.quantity}x ${di.name}
              ${di.variants.length > 0 ? `(${di.variants.join(', ')})` : ''}
            </div>
          `
                  )
                  .join('')
              : ''
          }
          ${item.notes ? `<div class="notes">NOTE: ${item.notes}</div>` : ''}
        </div>
      `
        )
        .join('')}

      <div class="footer">
        <div>--- END OF KOT ---</div>
      </div>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>KOT - Multiple Stations</title>
  <style>
    @media print {
      @page { margin: 0; size: 80mm auto; }
      body { margin: 10mm; }
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12pt;
      line-height: 1.4;
      font-weight: 600;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .kot-ticket {
      margin-bottom: 20px;
    }
    .header {
      text-align: center;
      font-weight: bold;
      border-bottom: 2px dashed #000;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .header-title {
      font-size: 16pt;
      margin-bottom: 5px;
    }
    .station {
      font-size: 14pt;
      padding: 4px 0;
      margin: 5px 0;
      font-weight: bold;
      text-transform: uppercase;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }
    .item {
      margin: 10px 0;
      page-break-inside: avoid;
    }
    .item-name {
      font-weight: bold;
      font-size: 13pt;
    }
    .item-detail {
      margin-left: 15px;
      font-size: 11pt;
    }
    .notes {
      margin-left: 15px;
      font-style: normal;
      border-left: 2px solid #000;
      padding-left: 6px;
      margin-top: 5px;
    }
    .footer {
      border-top: 2px dashed #000;
      margin-top: 15px;
      padding-top: 10px;
      text-align: center;
      font-size: 11pt;
    }
  </style>
</head>
<body>
  ${ticketsHtml}
</body>
</html>
  `;
}

function renderCombinedReceipts(sections: string[]): string {
  const extractBody = (html: string): string => {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : html;
  };

  const bodies = sections.map(extractBody).filter((body) => body && body.trim().length > 0);
  const pageBlocks = bodies
    .map(
      (body, index) =>
        `<div ${index < bodies.length - 1 ? 'class="page-break"' : ''}>${body}</div>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>All Receipts</title>
  <style>
    @media print {
      @page { margin: 0; size: 80mm auto; }
      body { margin: 10mm; }
      .page-break { page-break-after: always; }
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12pt;
      line-height: 1.4;
      font-weight: 600;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .kot-ticket {
      margin-bottom: 20px;
    }
    .header {
      text-align: center;
      font-weight: bold;
      border-bottom: 2px dashed #000;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .header-title {
      font-size: 16pt;
      margin-bottom: 5px;
    }
    .station {
      font-size: 14pt;
      padding: 4px 0;
      margin: 5px 0;
      font-weight: bold;
      text-transform: uppercase;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }
    .item {
      margin: 10px 0;
      page-break-inside: avoid;
    }
    .item-name {
      font-weight: bold;
      font-size: 13pt;
    }
    .item-detail {
      margin-left: 15px;
      font-size: 11pt;
    }
    .notes {
      margin-left: 15px;
      font-style: normal;
      border-left: 2px solid #000;
      padding-left: 6px;
      margin-top: 5px;
    }
    .footer {
      border-top: 2px dashed #000;
      margin-top: 15px;
      padding-top: 10px;
      text-align: center;
      font-size: 11pt;
    }
    .restaurant-name {
      font-size: 16pt;
      margin-bottom: 5px;
    }
    .copy-type {
      font-size: 12pt;
      padding: 4px 0;
      margin: 10px 0;
      font-weight: bold;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }
    .divider {
      border-bottom: 1px dashed #000;
      margin: 10px 0;
    }
    .info-table {
      width: 100%;
      margin: 10px 0;
    }
    .info-table td {
      padding: 2px 0;
    }
    .items-table {
      width: 100%;
      margin: 10px 0;
    }
    .items-table td {
      padding: 5px 0;
    }
    .totals {
      margin-top: 10px;
      border-top: 2px solid #000;
      padding-top: 10px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
    .grand-total {
      font-size: 14pt;
      font-weight: bold;
      border-top: 2px solid #000;
      padding-top: 5px;
      margin-top: 5px;
    }
    .section {
      margin: 10px 0;
      padding: 8px 0;
      border-bottom: 1px dashed #000;
    }
    .section-title {
      font-weight: bold;
      margin-bottom: 5px;
      text-decoration: underline;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    .page-break {
      page-break-after: always;
    }
  </style>
</head>
<body>
  ${pageBlocks}
</body>
</html>
  `;
}

// Receipt Printing
export async function printCustomerReceipt(orderId: string, userId: string): Promise<void> {
  const order = await db.orders.get(orderId);
  if (!order) throw new Error('Order not found');

  const items = await db.orderItems.where('orderId').equals(orderId).toArray();
  const settings = await db.settings.get('default');

  const html = await renderReceiptTemplate(order, items, settings!, 'CUSTOMER COPY');
  await printDocument(html);

  await logAudit({
    userId,
    action: 'print',
    tableName: 'orders',
    recordId: orderId,
    description: `Printed customer receipt for ${order.orderNumber}`,
  });
}

export async function printCounterCopy(orderId: string, userId: string): Promise<void> {
  const order = await db.orders.get(orderId);
  if (!order) throw new Error('Order not found');

  const items = await db.orderItems.where('orderId').equals(orderId).toArray();
  const settings = await db.settings.get('default');

  const html = await renderReceiptTemplate(order, items, settings!, 'COUNTER COPY');
  await printDocument(html);

  await logAudit({
    userId,
    action: 'print',
    tableName: 'orders',
    recordId: orderId,
    description: `Printed counter copy for ${order.orderNumber}`,
  });
}

async function resolveDeliveryCustomerInfo(order: Order): Promise<{
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
}> {
  let customerName = order.customerName?.trim() || '';
  let customerPhone = (order.customerPhone || '').trim();
  let deliveryAddress = order.deliveryAddress?.trim() || '';

  if (order.customerId) {
    const customer = await db.customers.get(order.customerId);
    if (customer) {
      if (!customerName && customer.name) customerName = customer.name;
      if (!customerPhone && customer.phone) customerPhone = customer.phone;
      if (!deliveryAddress && customer.address) deliveryAddress = customer.address;
    }
  }

  if (!customerName) customerName = 'N/A';
  if (!deliveryAddress) deliveryAddress = 'N/A';

  return { customerName, customerPhone, deliveryAddress };
}

export async function printAllReceipts(orderId: string, userId: string): Promise<void> {
  const order = await db.orders.get(orderId);
  if (!order) throw new Error('Order not found');

  const items = await db.orderItems.where('orderId').equals(orderId).toArray();
  const settings = await db.settings.get('default');

  const includeKOT = settings?.printAllIncludeKOT ?? true;
  const includeCustomer = settings?.printAllIncludeCustomer ?? true;
  const includeCounter = settings?.printAllIncludeCounter ?? false;
  const includeRider = settings?.printAllIncludeRider ?? false;

  const sections: Array<{ type: string; html: string }> = [];

  if (includeKOT) {
    const shouldSplit = settings?.kotSplitByMajorCategory || false;
    let kotTickets: KOTTicket[] = [];

    if (shouldSplit) {
      const grouped = await groupItemsByMajorCategory(items);
      for (const [categoryName, categoryItems] of Object.entries(grouped)) {
        const ticket = await createKOTTicket(order, categoryItems, categoryName);
        kotTickets.push(ticket);
      }
    } else {
      const ticket = await createKOTTicket(order, items, null);
      kotTickets.push(ticket);
    }

    sections.push({ type: 'KOT', html: renderAllKOTTickets(kotTickets) });
  }

  if (includeCustomer) {
    sections.push({
      type: 'Customer Copy',
      html: await renderReceiptTemplate(order, items, settings!, 'CUSTOMER COPY'),
    });
  }

  if (includeCounter) {
    sections.push({
      type: 'Counter Copy',
      html: await renderReceiptTemplate(order, items, settings!, 'COUNTER COPY'),
    });
  }

  if (includeRider && order.orderType === 'delivery') {
    const { customerName, customerPhone, deliveryAddress } = await resolveDeliveryCustomerInfo(order);

    let riderName = 'Not Assigned';
    if (order.riderId) {
      const rider = await db.riders.get(order.riderId);
      if (rider) riderName = rider.name;
    }

    sections.push({
      type: 'Rider Copy',
      html: await renderRiderReceiptTemplate(
        order,
        items,
        settings!,
        customerName,
        customerPhone,
        deliveryAddress,
        riderName
      ),
    });
  }

  if (sections.length === 0) {
    throw new Error('Print All is disabled. Enable at least one receipt in Settings.');
  }

  if (sections.length === 1) {
    await printDocument(sections[0].html);
  } else {
    const combinedHtml = renderCombinedReceipts(sections.map((section) => section.html));
    await printDocument(combinedHtml);
  }

  const printedTypes = sections.map((section) => section.type).join(', ');
  await logAudit({
    userId,
    action: 'print',
    tableName: 'orders',
    recordId: orderId,
    description: `Printed receipts (${printedTypes}) for ${order.orderNumber}`,
  });
}

// Rider Receipt Printing (Delivery orders only)
export async function printRiderReceipt(orderId: string, userId: string): Promise<void> {
  const order = await db.orders.get(orderId);
  if (!order) throw new Error('Order not found');

  // Only allow for delivery orders
  if (order.orderType !== 'delivery') {
    throw new Error('Rider receipt is only available for delivery orders');
  }

  const items = await db.orderItems.where('orderId').equals(orderId).toArray();
  const settings = await db.settings.get('default');

  // Get customer info
  const { customerName, customerPhone, deliveryAddress } = await resolveDeliveryCustomerInfo(order);

  // Get rider name
  let riderName = 'Not Assigned';
  if (order.riderId) {
    const rider = await db.riders.get(order.riderId);
    if (rider) riderName = rider.name;
  }

  const html = await renderRiderReceiptTemplate(
    order,
    items,
    settings!,
    customerName,
    customerPhone,
    deliveryAddress,
    riderName
  );

  await printDocument(html);

  // Log in riderReceipts table
  await db.riderReceipts.add({
    id: createId(),
    orderId,
    printedAt: new Date(),
    printedBy: userId,
    createdAt: new Date(),
  });

  await logAudit({
    userId,
    action: 'print',
    tableName: 'orders',
    recordId: orderId,
    description: `Printed rider receipt for ${order.orderNumber}`,
  });
}

async function renderRiderReceiptTemplate(
  order: Order,
  items: OrderItem[],
  settings: Settings,
  customerName: string,
  customerPhone: string,
  deliveryAddress: string,
  riderName: string
): Promise<string> {
  const itemsHtml = await Promise.all(
    items.map(async (item) => {
      const name =
        item.itemType === 'menu_item'
          ? (await db.menuItems.get(item.menuItemId!))?.name
          : (await db.deals.get(item.dealId!))?.name;

      return `
        <tr>
          <td style="padding: 3px 0;">${item.quantity}x ${name}</td>
          <td style="text-align: right; padding: 3px 0;">${formatCurrency(item.totalPrice)}</td>
        </tr>
      `;
    })
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Rider Receipt - ${order.orderNumber}</title>
  <style>
    @media print {
      @page { margin: 0; size: 80mm auto; }
      body { margin: 10mm; }
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 11pt;
      line-height: 1.3;
      font-weight: 600;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      text-align: center;
      font-weight: bold;
      margin-bottom: 15px;
      border-bottom: 2px dashed #000;
      padding-bottom: 10px;
    }
    .section {
      margin: 10px 0;
      padding: 8px 0;
      border-bottom: 1px dashed #000;
    }
    .section-title {
      font-weight: bold;
      margin-bottom: 5px;
      text-decoration: underline;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
      .total-row {
        font-weight: bold;
        border-top: 2px solid #000;
        padding-top: 5px;
      }
      .footer {
        text-align: center;
        margin-top: 15px;
        padding-top: 10px;
        border-top: 2px dashed #000;
        font-size: 10pt;
      }
    </style>
</head>
<body>
  <div class="header">
    <div style="font-size: 14pt;">${settings.restaurantName}</div>
    <div style="font-size: 10pt; margin-top: 3px;">${settings.restaurantAddress}</div>
    <div style="font-size: 10pt;">${settings.restaurantPhone}</div>
    <div style="margin-top: 10px; font-size: 13pt; font-weight: bold;">═══ RIDER COPY ═══</div>
  </div>

  <div class="section">
    <div><strong>Order #:</strong> ${order.orderNumber}</div>
    <div><strong>Date:</strong> ${formatDateTime(order.createdAt)}</div>
    <div><strong>Rider:</strong> ${riderName}</div>
  </div>

  <div class="section">
    <div class="section-title">DELIVERY INFORMATION</div>
    <div><strong>Customer:</strong> ${customerName}</div>
    ${customerPhone ? `<div><strong>Phone:</strong> ${customerPhone}</div>` : ''}
    <div><strong>Address:</strong> ${deliveryAddress}</div>
  </div>

  <div class="section">
    <div class="section-title">ORDER ITEMS</div>
    <table>
      ${itemsHtml.join('')}
        ${order.discountAmount > 0 ? `
          <tr>
            <td style="padding: 3px 0;">Subtotal:</td>
            <td style="text-align: right; padding: 3px 0;">${formatCurrency(order.subtotal)}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0;">Discount:</td>
            <td style="text-align: right; padding: 3px 0;">-${formatCurrency(order.discountAmount)}</td>
          </tr>
        ` : ''}
      <tr class="total-row">
        <td style="padding: 8px 0 3px 0; font-size: 13pt;">TOTAL:</td>
        <td style="text-align: right; padding: 8px 0 3px 0; font-size: 13pt;">${formatCurrency(order.total)}</td>
      </tr>
    </table>
  </div>

  <div class="section" style="border-bottom: none;">
    <div class="section-title">PAYMENT STATUS</div>
    <div style="font-size: 12pt; font-weight: bold;">
      ${order.isPaid ? '✓ PAID' : '✗ PAYMENT TO BE COLLECTED'}
    </div>
    </div>

    <div class="footer">
      <div style="font-weight: bold; margin-bottom: 5px;">Handle with care!</div>
      <div style="font-size: 9pt;">This is a rider copy for delivery reference</div>
      <div style="margin-top: 8px;">Powered by Zone4Kitchen POS</div>
    </div>
  
  </body>
</html>
  `;
}

async function renderReceiptTemplate(
  order: Order,
  items: OrderItem[],
  settings: Settings,
  copyType: string
): Promise<string> {
  const itemsHtml = await Promise.all(
    items.map(async (item) => {
      const name =
        item.itemType === 'menu_item'
          ? (await db.menuItems.get(item.menuItemId!))?.name
          : (await db.deals.get(item.dealId!))?.name;

        const variants =
          item.selectedVariants.length > 0
            ? `<div style="margin-left: 20px; font-size: 11pt;">
                ${item.selectedVariants.map((v) => {
                  if (v.selectedOptions && v.selectedOptions.length > 0) {
                    // Multi-select format
                    const optionNames = v.selectedOptions.map(o => o.optionName).join(', ');
                    return `${v.variantName}: ${optionNames}`;
                } else {
                  // Single-select format
                  return `${v.variantName}: ${v.optionName}`;
                }
              }).join(', ')}
            </div>`
          : '';

      return `
        <tr>
          <td>${item.quantity}x ${name}</td>
          <td style="text-align: right;">${formatCurrency(item.totalPrice)}</td>
        </tr>
        ${variants}
      `;
    })
  );

  let customerPhone = '';
  if (copyType === 'CUSTOMER COPY') {
    customerPhone = (order.customerPhone || '').trim();
    if (!customerPhone && order.customerId) {
      const customer = await db.customers.get(order.customerId);
      if (customer?.phone) customerPhone = customer.phone;
    }
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${order.orderNumber}</title>
  <style>
    @media print {
      @page { margin: 0; size: 80mm auto; }
      body { margin: 10mm; }
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 11pt;
      line-height: 1.3;
      font-weight: 600;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      text-align: center;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .restaurant-name {
      font-size: 16pt;
      margin-bottom: 5px;
    }
    .copy-type {
      font-size: 12pt;
      padding: 4px 0;
      margin: 10px 0;
      font-weight: bold;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }
    .divider {
      border-bottom: 1px dashed #000;
      margin: 10px 0;
    }
    .info-table {
      width: 100%;
      margin: 10px 0;
    }
    .info-table td {
      padding: 2px 0;
    }
    .items-table {
      width: 100%;
      margin: 10px 0;
    }
    .items-table td {
      padding: 5px 0;
    }
    .totals {
      margin-top: 10px;
      border-top: 2px solid #000;
      padding-top: 10px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
      .grand-total {
        font-size: 14pt;
        font-weight: bold;
        border-top: 2px solid #000;
        padding-top: 5px;
        margin-top: 5px;
      }
      .footer {
        text-align: center;
        margin-top: 20px;
        font-size: 10pt;
      }
    </style>
</head>
<body>
  <div class="header">
    <div class="restaurant-name">${settings.restaurantName}</div>
    <div>${settings.restaurantAddress}</div>
    <div>${settings.restaurantPhone}</div>
    <div class="copy-type">${copyType}</div>
  </div>

  <div class="divider"></div>

  <table class="info-table">
    <tr><td>Order #:</td><td style="text-align: right; font-weight: bold;">${order.orderNumber}</td></tr>
    <tr><td>Date:</td><td style="text-align: right;">${formatDateTime(order.createdAt)}</td></tr>
    <tr><td>Type:</td><td style="text-align: right;">${order.orderType.replace('_', ' ').toUpperCase()}</td></tr>
    <tr><td>Payment:</td><td style="text-align: right;">${
      order.isPaid
        ? '<span style="display:inline-block;padding:4px 12px;border:3px solid #000;font-weight:800;font-size:16pt;letter-spacing:1px;text-decoration:underline;transform:rotate(-12deg);line-height:1;">PAID</span>'
        : '<span style="display:inline-block;padding:2px 6px;border:1px dashed #000;font-weight:700;font-size:12pt;letter-spacing:0.5px;">UNPAID</span>'
    }</td></tr>
    ${order.tableId ? `<tr><td>Table:</td><td style="text-align: right;">${await getTableNumber(order.tableId)}</td></tr>` : ''}
    ${order.customerName ? `<tr><td>Customer:</td><td style="text-align: right;">${order.customerName}</td></tr>` : ''}
    ${copyType === 'CUSTOMER COPY' && customerPhone ? `<tr><td>Phone:</td><td style="text-align: right;">${customerPhone}</td></tr>` : ''}
  </table>

  <div class="divider"></div>

  <table class="items-table">
    ${itemsHtml.join('')}
  </table>

    <div class="totals">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>${formatCurrency(order.subtotal)}</span>
      </div>
    ${
      order.discountAmount > 0
        ? `
    <div class="total-row">
      <span>Discount ${order.discountReference ? `(${order.discountReference})` : ''}:</span>
      <span>- ${formatCurrency(order.discountAmount)}</span>
    </div>
    `
        : ''
    }
      <div class="total-row grand-total">
        <span>TOTAL:</span>
        <span>${formatCurrency(order.total)}</span>
      </div>
    </div>

    <div class="footer">
      <div style="margin: 10px 0;">${settings.receiptFooter || 'Thank you for your visit!'}</div>
      <div>Powered by Zone4Kitchen POS</div>
    </div>
  
  </body>
  </html>
  `;
}

async function printDocument(html: string): Promise<void> {
  const printWindow = window.open('', '_blank', 'width=300,height=800');

  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}
