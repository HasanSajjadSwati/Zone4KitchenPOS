import { z } from 'zod';

// Pakistani phone validation (11 digits, starts with 03)
export const phoneSchema = z
  .string()
  .regex(/^[0-9]{11}$/, 'Phone must be exactly 11 digits')
  .refine((phone) => phone.startsWith('03'), 'Pakistani mobile must start with 03');

export function validatePhone(phone: string): boolean {
  return phoneSchema.safeParse(phone).success;
}

export function formatPhone(phone: string): string {
  // Format as 0300-1234567
  if (phone.length === 11) {
    return `${phone.slice(0, 4)}-${phone.slice(4)}`;
  }
  return phone;
}

// Order number generator
let orderCounter = 0;

export function generateOrderNumber(): string {
  orderCounter++;
  return `ORD-${String(orderCounter).padStart(5, '0')}`;
}

export async function initializeOrderCounter(db: any) {
  const lastOrder = await db.orders.orderBy('createdAt').reverse().first();
  if (lastOrder && lastOrder.orderNumber) {
    const match = lastOrder.orderNumber.match(/ORD-(\d+)/);
    if (match) {
      orderCounter = parseInt(match[1], 10);
    }
  }
}

// Currency formatting
export function formatCurrency(amount: number): string {
  return `Rs ${amount.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Date formatting
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-PK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatDateTime(date: any): string {
  try {
    if (!date) return 'N/A';

    // Convert string to Date if needed
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Check if valid date
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }

    return new Intl.DateTimeFormat('en-PK', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj);
  } catch (error) {
    console.error('formatDateTime error:', error, 'date:', date);
    return 'N/A';
  }
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
