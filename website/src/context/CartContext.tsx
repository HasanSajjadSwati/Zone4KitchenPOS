'use client';

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

export interface CartItem {
  id: string;
  itemType: 'menu_item' | 'deal';
  menuItemId?: string;
  dealId?: string;
  name: string;
  price: number;
  quantity: number;
  selectedVariants?: {
    variantId: string;
    variantName: string;
    optionId: string;
    optionName: string;
    priceModifier: number;
  }[];
  notes?: string;
}

interface CartState {
  items: CartItem[];
  orderType: 'delivery' | 'pickup';
  deliveryAddress: string;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'UPDATE_NOTES'; payload: { id: string; notes: string } }
  | { type: 'SET_ORDER_TYPE'; payload: 'delivery' | 'pickup' }
  | { type: 'SET_DELIVERY_ADDRESS'; payload: string }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: CartState };

interface CartContextValue extends CartState {
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateNotes: (id: string, notes: string) => void;
  setOrderType: (type: 'delivery' | 'pickup') => void;
  setDeliveryAddress: (address: string) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  deliveryCharge: number;
  total: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const DELIVERY_CHARGE = 150; // PKR

function generateCartItemId(): string {
  return `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateItemTotal(item: CartItem): number {
  let total = item.price;
  if (item.selectedVariants) {
    total += item.selectedVariants.reduce((sum, v) => sum + v.priceModifier, 0);
  }
  return total * item.quantity;
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      // Check if item already exists with same variants
      const existingIndex = state.items.findIndex((item) => {
        if (item.menuItemId !== action.payload.menuItemId || item.dealId !== action.payload.dealId) {
          return false;
        }
        // Compare variants
        const existingVariants = JSON.stringify(item.selectedVariants || []);
        const newVariants = JSON.stringify(action.payload.selectedVariants || []);
        return existingVariants === newVariants;
      });

      if (existingIndex > -1) {
        const newItems = [...state.items];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + action.payload.quantity,
        };
        return { ...state, items: newItems };
      }

      return {
        ...state,
        items: [...state.items, { ...action.payload, id: generateCartItemId() }],
      };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.payload),
      };

    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter((item) => item.id !== action.payload.id),
        };
      }
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
      };
    }

    case 'UPDATE_NOTES':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id
            ? { ...item, notes: action.payload.notes }
            : item
        ),
      };

    case 'SET_ORDER_TYPE':
      return { ...state, orderType: action.payload };

    case 'SET_DELIVERY_ADDRESS':
      return { ...state, deliveryAddress: action.payload };

    case 'CLEAR_CART':
      return { items: [], orderType: 'delivery', deliveryAddress: '' };

    case 'LOAD_CART':
      return action.payload;

    default:
      return state;
  }
}

const initialState: CartState = {
  items: [],
  orderType: 'delivery',
  deliveryAddress: '',
};

export default function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('zone4kitchen_cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        dispatch({ type: 'LOAD_CART', payload: parsed });
      } catch (e) {
        console.error('Failed to load cart from localStorage');
      }
    }
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    localStorage.setItem('zone4kitchen_cart', JSON.stringify(state));
  }, [state]);

  const addItem = (item: Omit<CartItem, 'id'>) => {
    dispatch({ type: 'ADD_ITEM', payload: { ...item, id: '' } as CartItem });
  };

  const removeItem = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: id });
  };

  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  };

  const updateNotes = (id: string, notes: string) => {
    dispatch({ type: 'UPDATE_NOTES', payload: { id, notes } });
  };

  const setOrderType = (type: 'delivery' | 'pickup') => {
    dispatch({ type: 'SET_ORDER_TYPE', payload: type });
  };

  const setDeliveryAddress = (address: string) => {
    dispatch({ type: 'SET_DELIVERY_ADDRESS', payload: address });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const deliveryCharge = state.orderType === 'delivery' ? DELIVERY_CHARGE : 0;
  const total = subtotal + deliveryCharge;

  return (
    <CartContext.Provider
      value={{
        ...state,
        addItem,
        removeItem,
        updateQuantity,
        updateNotes,
        setOrderType,
        setDeliveryAddress,
        clearCart,
        itemCount,
        subtotal,
        deliveryCharge,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
