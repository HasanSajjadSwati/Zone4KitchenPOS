const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3033/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('zone4kitchen_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  async get<T = any>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async uploadFile(endpoint: string, formData: FormData): Promise<any> {
    const headers: HeadersInit = {};
    
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('zone4kitchen_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  }
}

export const api = new ApiClient(API_BASE_URL);

// Type definitions for API responses
export interface Category {
  id: string;
  name: string;
  type: 'major' | 'sub';
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  description: string | null;
  isActive: boolean;
  isDealOnly: boolean;
  hasVariants: boolean;
  variants?: MenuItemVariant[];
}

export interface MenuItemVariant {
  id: string;
  menuItemId: string;
  variantId: string;
  variantName: string;
  variantType: string;
  isRequired: boolean;
  selectionMode: 'single' | 'multiple' | 'all';
  availableOptionIds: string[];
  options?: VariantOption[];
}

export interface Variant {
  id: string;
  name: string;
  type: 'size' | 'flavour' | 'custom';
  options: VariantOption[];
}

export interface VariantOption {
  id: string;
  variantId: string;
  name: string;
  priceModifier: number;
  sortOrder: number;
  isActive: boolean;
}

export interface Deal {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryId: string | null;
  isActive: boolean;
  hasVariants: boolean;
  items?: DealItem[];
  variants?: DealVariant[];
}

export interface DealItem {
  id: string;
  dealId: string;
  menuItemId: string;
  quantity: number;
  requiresVariantSelection: boolean;
  sortOrder: number;
  menuItem?: MenuItem;
}

export interface DealVariant {
  id: string;
  dealId: string;
  variantId: string;
  variantName: string;
  isRequired: boolean;
  selectionMode: 'single' | 'multiple' | 'all';
  availableOptionIds: string[];
}

export interface Order {
  id: string;
  orderNumber: string;
  orderType: 'delivery' | 'take_away' | 'dine_in';
  status: 'open' | 'completed' | 'cancelled';
  deliveryStatus: 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | null;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  subtotal: number;
  deliveryCharge: number;
  total: number;
  isPaid: boolean;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  itemType: 'menu_item' | 'deal';
  menuItemId: string | null;
  dealId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
  selectedVariants: any;
}

// CMS Types
export interface CMSHero {
  title: string;
  subtitle: string;
  backgroundImage: string;
  ctaText: string;
  ctaLink: string;
}

export interface CMSAbout {
  title: string;
  description: string;
  image: string;
  features: { icon: string; title: string; description: string }[];
}

export interface CMSBankDetails {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
  instructions: string;
}
