import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  MapPinIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { ShoppingBagIcon } from '@heroicons/react/24/solid';
import { api } from '@/services/api';
import logoSvg from '@/assets/logo.svg';

// ─── Brand Colors from Logo ───────────────────────────────────────
const BRAND = {
  red: '#ce171e',
  redDark: '#a8131a',
  redLight: '#e84249',
  gold: '#ffc20d',
  goldDark: '#e0aa00',
  goldLight: '#ffd24d',
  cream: '#FFF8E7',
  dark: '#1a1a1a',
  warmGray: '#2d2926',
};

// ─── Types ─────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  type: 'major' | 'sub';
  parentId: string | null;
  sortOrder: number;
}

interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  hasVariants: boolean;
  minVariantPrice?: number;
  maxVariantPrice?: number;
}

interface VariantOption {
  id: string;
  variantId: string;
  name: string;
  priceModifier: number;
}

interface MenuItemVariant {
  variantId: string;
  variantName: string;
  variantType: string;
  isRequired: boolean;
  selectionMode: 'single' | 'multiple' | 'all';
  options: VariantOption[];
}

interface DealItem {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
}

interface Deal {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  categoryId: string | null;
  hasVariants: boolean;
  items: DealItem[];
  variants?: MenuItemVariant[];
  minVariantPrice?: number;
  maxVariantPrice?: number;
}

interface CartVariantSelection {
  variantId: string;
  variantName: string;
  optionId: string;
  optionName: string;
  priceModifier: number;
  selectedOptions?: Array<{
    optionId: string;
    optionName: string;
    priceModifier: number;
  }>;
}

interface CartItem {
  id: string;
  itemType: 'menu_item' | 'deal';
  menuItemId?: string;
  dealId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedVariants: CartVariantSelection[];
  dealBreakdown: any[] | null;
  notes?: string;
}

interface RestaurantInfo {
  restaurantName: string;
  restaurantPhone: string;
  restaurantAddress: string;
  whatsappNumber: string;
  deliveryCharge: number;
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getDisplayPrice(item: MenuItem | Deal): string {
  if (item.price > 0) return formatCurrency(item.price);
  if (item.hasVariants && item.minVariantPrice && item.minVariantPrice > 0) {
    if (item.maxVariantPrice && item.maxVariantPrice !== item.minVariantPrice) {
      return `${formatCurrency(item.minVariantPrice)} – ${formatCurrency(item.maxVariantPrice)}`;
    }
    return `From ${formatCurrency(item.minVariantPrice)}`;
  }
  return formatCurrency(0);
}

// ─── Carousel Component ───────────────────────────────────────────

interface CarouselItem {
  id: string;
  name: string;
  imageUrl: string | null;
  price: number;
  type: 'item' | 'deal';
  hasVariants: boolean;
  minVariantPrice?: number;
  maxVariantPrice?: number;
}

const HeroCarousel: React.FC<{ items: CarouselItem[]; onAddToCart: (item: CarouselItem) => void }> = ({ items, onAddToCart }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % items.length);
        setIsTransitioning(false);
      }, 400);
    }, 5000);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [items.length, resetTimer]);

  const goTo = (idx: number) => {
    if (idx === currentIndex) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(idx);
      setIsTransitioning(false);
    }, 400);
    resetTimer();
  };

  const prev = () => goTo((currentIndex - 1 + items.length) % items.length);
  const next = () => goTo((currentIndex + 1) % items.length);

  if (items.length === 0) return null;

  const current = items[currentIndex];
  const priceDisplay = current.price > 0 ? formatCurrency(current.price) :
    (current.hasVariants && current.minVariantPrice && current.minVariantPrice > 0)
      ? (current.maxVariantPrice && current.maxVariantPrice !== current.minVariantPrice
        ? `${formatCurrency(current.minVariantPrice)} – ${formatCurrency(current.maxVariantPrice)}`
        : `From ${formatCurrency(current.minVariantPrice)}`)
      : null;

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl mx-2 sm:mx-0 group" style={{ aspectRatio: '16/7' }}>
      {/* Full-bleed background image */}
      <div
        className="absolute inset-0 transition-opacity duration-500 ease-in-out"
        style={{ opacity: isTransitioning ? 0 : 1 }}
      >
        {current.imageUrl ? (
          <img
            key={current.id}
            src={current.imageUrl}
            alt={current.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${BRAND.dark} 0%, ${BRAND.warmGray} 60%, ${BRAND.red}40 100%)` }}
          >
            <span className="text-[100px] sm:text-[140px] opacity-20 select-none">🍽️</span>
          </div>
        )}
      </div>

      {/* Bottom gradient overlay for text readability */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 35%, rgba(0,0,0,0.05) 60%, transparent 100%)',
        }}
      />

      {/* Content overlay — pinned to bottom-left */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 p-4 sm:p-6 md:p-8 flex items-end justify-between gap-4 transition-opacity duration-500 ease-in-out"
        style={{ opacity: isTransitioning ? 0 : 1 }}
      >
        <div className="flex-1 min-w-0">
          {current.type === 'deal' && (
            <span
              className="inline-block px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold mb-2 uppercase tracking-wider"
              style={{ background: BRAND.gold, color: BRAND.dark }}
            >
              🔥 Deal
            </span>
          )}
          <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-white leading-tight truncate drop-shadow-md">
            {current.name}
          </h2>
          {priceDisplay && (
            <p className="text-base sm:text-lg md:text-xl font-bold mt-0.5" style={{ color: BRAND.gold }}>
              {priceDisplay}
            </p>
          )}
        </div>
        <button
          onClick={() => onAddToCart(current)}
          className="shrink-0 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg flex items-center gap-1.5"
          style={{ background: BRAND.red, color: '#fff' }}
        >
          <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Order Now</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Navigation arrows — visible on hover */}
      {items.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/20 backdrop-blur-md text-white/80 flex items-center justify-center hover:bg-black/40 hover:text-white transition-all z-30 opacity-0 group-hover:opacity-100"
          >
            <ChevronLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/20 backdrop-blur-md text-white/80 flex items-center justify-center hover:bg-black/40 hover:text-white transition-all z-30 opacity-0 group-hover:opacity-100"
          >
            <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </>
      )}

      {/* Progress bar dots — minimal pill style */}
      {items.length > 1 && (
        <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="h-1 rounded-full transition-all duration-500"
              style={{
                width: i === currentIndex ? '24px' : '8px',
                background: i === currentIndex ? BRAND.gold : 'rgba(255,255,255,0.35)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────

export const WebsiteMenu: React.FC = () => {
  const [info, setInfo] = useState<RestaurantInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showDeals, setShowDeals] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [addedItemId, setAddedItemId] = useState<string | null>(null);

  const [variantModal, setVariantModal] = useState<{
    item?: MenuItem;
    deal?: Deal;
    variants: MenuItemVariant[];
    selections: Record<string, string | string[]>;
  } | null>(null);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    customerPhone: '',
    orderType: 'take_away' as 'take_away' | 'delivery',
    deliveryAddress: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ orderNumber: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ─── Load Data ─────────────────────────────────────────────────

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [infoRes, catsRes, itemsRes, dealsRes] = await Promise.all([
        api.get('/website/info'),
        api.get('/website/categories'),
        api.get('/website/menu-items'),
        api.get('/website/deals'),
      ]);
      setInfo(infoRes);
      setCategories(Array.isArray(catsRes) ? catsRes : []);
      setMenuItems(Array.isArray(itemsRes) ? itemsRes : []);
      setDeals(Array.isArray(dealsRes) ? dealsRes : []);
    } catch (error) {
      console.error('Failed to load menu data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Carousel items: random mix of items and deals ─────────────

  const carouselItems: CarouselItem[] = useMemo(() => {
    const all: CarouselItem[] = [];
    menuItems.forEach(item => {
      all.push({
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        price: item.price,
        type: 'item',
        hasVariants: item.hasVariants,
        minVariantPrice: item.minVariantPrice,
        maxVariantPrice: item.maxVariantPrice,
      });
    });
    deals.forEach(deal => {
      all.push({
        id: deal.id,
        name: deal.name,
        imageUrl: deal.imageUrl,
        price: deal.price,
        type: 'deal',
        hasVariants: deal.hasVariants,
        minVariantPrice: deal.minVariantPrice,
        maxVariantPrice: deal.maxVariantPrice,
      });
    });
    // Shuffle
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, 8); // max 8 slides
  }, [menuItems, deals]);

  // ─── Item add animation ───────────────────────────────────────

  const flashAdded = (id: string) => {
    setAddedItemId(id);
    setTimeout(() => setAddedItemId(null), 700);
  };

  // ─── Cart Logic ────────────────────────────────────────────────

  const addToCart = useCallback(async (item: MenuItem) => {
    if (item.hasVariants) {
      try {
        const itemWithVariants = await api.get(`/website/menu-items/${item.id}`);
        if (itemWithVariants.variants && itemWithVariants.variants.length > 0) {
          const initialSelections: Record<string, string | string[]> = {};
          itemWithVariants.variants.forEach((v: MenuItemVariant) => {
            if (v.selectionMode === 'all') {
              initialSelections[v.variantId] = v.options.map((o: VariantOption) => o.id);
            } else if (v.selectionMode === 'multiple') {
              initialSelections[v.variantId] = [];
            } else {
              initialSelections[v.variantId] = '';
            }
          });
          setVariantModal({ item, variants: itemWithVariants.variants, selections: initialSelections });
          return;
        }
      } catch (e) {
        console.error('Failed to load variants:', e);
      }
    }

    const cartItem: CartItem = {
      id: generateId(),
      itemType: 'menu_item',
      menuItemId: item.id,
      name: item.name,
      quantity: 1,
      unitPrice: item.price,
      totalPrice: item.price,
      selectedVariants: [],
      dealBreakdown: null,
    };
    setCart(prev => [...prev, cartItem]);
    flashAdded(item.id);
  }, []);

  const addDealToCart = useCallback(async (deal: Deal) => {
    if (deal.hasVariants) {
      try {
        const dealWithVariants = await api.get(`/website/deals/${deal.id}`);
        if (dealWithVariants.variants && dealWithVariants.variants.length > 0) {
          const initialSelections: Record<string, string | string[]> = {};
          dealWithVariants.variants.forEach((v: MenuItemVariant) => {
            if (v.selectionMode === 'all') {
              initialSelections[v.variantId] = v.options.map((o: VariantOption) => o.id);
            } else if (v.selectionMode === 'multiple') {
              initialSelections[v.variantId] = [];
            } else {
              initialSelections[v.variantId] = '';
            }
          });
          setVariantModal({ deal, variants: dealWithVariants.variants, selections: initialSelections });
          return;
        }
      } catch (e) {
        console.error('Failed to load deal variants:', e);
      }
    }

    const cartItem: CartItem = {
      id: generateId(),
      itemType: 'deal',
      dealId: deal.id,
      name: deal.name,
      quantity: 1,
      unitPrice: deal.price,
      totalPrice: deal.price,
      selectedVariants: [],
      dealBreakdown: deal.items.map(i => ({
        menuItemId: i.menuItemId,
        menuItemName: i.menuItemName,
        quantity: i.quantity,
        selectedVariants: [],
      })),
    };
    setCart(prev => [...prev, cartItem]);
    flashAdded(deal.id);
  }, []);

  // Carousel click handler
  const handleCarouselAdd = useCallback((carouselItem: CarouselItem) => {
    if (carouselItem.type === 'item') {
      const menuItem = menuItems.find(i => i.id === carouselItem.id);
      if (menuItem) addToCart(menuItem);
    } else {
      const deal = deals.find(d => d.id === carouselItem.id);
      if (deal) addDealToCart(deal);
    }
  }, [menuItems, deals, addToCart, addDealToCart]);

  const confirmVariantSelection = () => {
    if (!variantModal) return;
    const { item, deal, variants, selections } = variantModal;

    for (const v of variants) {
      if (v.isRequired) {
        const sel = selections[v.variantId];
        if (!sel || (Array.isArray(sel) && sel.length === 0)) {
          alert(`Please select ${v.variantName}`);
          return;
        }
      }
    }

    const selectedVariants: CartVariantSelection[] = [];
    let extraPrice = 0;

    for (const v of variants) {
      const sel = selections[v.variantId];
      if (!sel || (Array.isArray(sel) && sel.length === 0)) continue;

      if (Array.isArray(sel)) {
        const selectedOptions = sel.map(optId => {
          const opt = v.options.find(o => o.id === optId)!;
          return { optionId: opt.id, optionName: opt.name, priceModifier: opt.priceModifier };
        });
        const totalModifier = selectedOptions.reduce((sum, o) => sum + o.priceModifier, 0);
        extraPrice += totalModifier;
        selectedVariants.push({
          variantId: v.variantId, variantName: v.variantName,
          optionId: selectedOptions[0]?.optionId || '', optionName: selectedOptions[0]?.optionName || '',
          priceModifier: totalModifier, selectedOptions,
        });
      } else {
        const opt = v.options.find(o => o.id === sel);
        if (opt) {
          extraPrice += opt.priceModifier;
          selectedVariants.push({
            variantId: v.variantId, variantName: v.variantName,
            optionId: opt.id, optionName: opt.name, priceModifier: opt.priceModifier,
          });
        }
      }
    }

    if (item) {
      const unitPrice = item.price + extraPrice;
      setCart(prev => [...prev, {
        id: generateId(), itemType: 'menu_item', menuItemId: item.id, name: item.name,
        quantity: 1, unitPrice, totalPrice: unitPrice, selectedVariants, dealBreakdown: null,
      }]);
      flashAdded(item.id);
    } else if (deal) {
      const unitPrice = deal.price + extraPrice;
      setCart(prev => [...prev, {
        id: generateId(), itemType: 'deal', dealId: deal.id, name: deal.name,
        quantity: 1, unitPrice, totalPrice: unitPrice, selectedVariants,
        dealBreakdown: deal.items.map(i => ({
          menuItemId: i.menuItemId, menuItemName: i.menuItemName,
          quantity: i.quantity, selectedVariants: [],
        })),
      }]);
      flashAdded(deal.id);
    }

    setVariantModal(null);
  };

  const updateCartItemQuantity = (cartItemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        return { ...item, quantity: newQty, totalPrice: item.unitPrice * newQty };
      }
      return item;
    }));
  };

  const removeCartItem = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryCharge = orderForm.orderType === 'delivery' ? (info?.deliveryCharge || 0) : 0;
  const grandTotal = cartTotal + deliveryCharge;

  // ─── Checkout ──────────────────────────────────────────────────

  const handlePlaceOrder = async () => {
    if (!orderForm.customerName.trim()) { alert('Please enter your name'); return; }
    if (!orderForm.customerPhone.trim()) { alert('Please enter your phone number'); return; }
    if (orderForm.orderType === 'delivery' && !orderForm.deliveryAddress.trim()) {
      alert('Please enter delivery address'); return;
    }
    if (cart.length === 0) { alert('Your cart is empty'); return; }

    setIsSubmitting(true);
    try {
      const res = await api.post('/website/orders', {
        orderType: orderForm.orderType,
        customerName: orderForm.customerName.trim(),
        customerPhone: orderForm.customerPhone.trim(),
        deliveryAddress: orderForm.deliveryAddress.trim(),
        notes: orderForm.notes.trim(),
        items: cart.map(item => ({
          itemType: item.itemType,
          menuItemId: item.menuItemId || null,
          dealId: item.dealId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          selectedVariants: item.selectedVariants,
          dealBreakdown: item.dealBreakdown,
          notes: item.notes || null,
        })),
      });

      setOrderSuccess({ orderNumber: res.orderNumber });
      setCart([]);
      setIsCheckoutOpen(false);
    } catch (error: any) {
      alert(error?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── WhatsApp ──────────────────────────────────────────────────

  const sendToWhatsApp = () => {
    if (!info?.whatsappNumber) { alert('WhatsApp ordering is not configured.'); return; }
    if (cart.length === 0) { alert('Your cart is empty'); return; }
    if (!orderForm.customerName.trim()) { alert('Please enter your name first'); return; }
    if (!orderForm.customerPhone.trim()) { alert('Please enter your phone number first'); return; }

    let message = `*New Order*\n\n*Name:* ${orderForm.customerName}\n*Phone:* ${orderForm.customerPhone}\n`;
    message += `*Type:* ${orderForm.orderType === 'delivery' ? 'Delivery' : 'Take Away'}\n`;
    if (orderForm.orderType === 'delivery' && orderForm.deliveryAddress) {
      message += `*Address:* ${orderForm.deliveryAddress}\n`;
    }
    message += `\n*Order Items:*\n`;
    cart.forEach((item, idx) => {
      message += `${idx + 1}. ${item.name} x${item.quantity} — ${formatCurrency(item.totalPrice)}`;
      if (item.selectedVariants.length > 0) {
        const varInfo = item.selectedVariants.map(v => {
          if (v.selectedOptions && v.selectedOptions.length > 1)
            return `${v.variantName}: ${v.selectedOptions.map(o => o.optionName).join(', ')}`;
          return `${v.variantName}: ${v.optionName}`;
        }).join(', ');
        message += ` (${varInfo})`;
      }
      message += `\n`;
    });
    message += `\n*Subtotal:* ${formatCurrency(cartTotal)}`;
    if (deliveryCharge > 0) message += `\n*Delivery:* ${formatCurrency(deliveryCharge)}`;
    message += `\n*Total: ${formatCurrency(grandTotal)}*`;
    if (orderForm.notes) message += `\n\n*Notes:* ${orderForm.notes}`;

    const whatsappUrl = `https://wa.me/${info.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // ─── Filtering ─────────────────────────────────────────────────

  const majorCategories = categories.filter(c => c.type === 'major');

  const getFilteredItems = () => {
    let filtered = menuItems;
    if (selectedCategory !== 'all') {
      const cat = categories.find(c => c.id === selectedCategory);
      if (cat?.type === 'major') {
        const subIds = categories.filter(c => c.parentId === cat.id).map(c => c.id);
        const validIds = new Set([cat.id, ...subIds]);
        filtered = filtered.filter(item => validIds.has(item.categoryId));
      } else {
        filtered = filtered.filter(item => item.categoryId === selectedCategory);
      }
    }
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(s) ||
        (item.description && item.description.toLowerCase().includes(s))
      );
    }
    return filtered;
  };

  const getFilteredDeals = () => {
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      return deals.filter(d =>
        d.name.toLowerCase().includes(s) ||
        (d.description && d.description.toLowerCase().includes(s))
      );
    }
    return deals;
  };

  const filteredItems = getFilteredItems();
  const filteredDeals = getFilteredDeals();

  // ─── Render: Order Success ─────────────────────────────────────

  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${BRAND.cream} 0%, #fff 100%)` }}>
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-10 text-center border border-gray-100">
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8" style={{ background: `${BRAND.gold}22` }}>
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke={BRAND.gold} strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold mb-3" style={{ color: BRAND.dark }}>Order Confirmed!</h2>
          <p className="text-gray-400 mb-2">Your order number is</p>
          <div className="inline-block px-8 py-3 rounded-2xl mb-6" style={{ background: BRAND.red, color: '#fff' }}>
            <p className="text-2xl font-bold tracking-wider">{orderSuccess.orderNumber}</p>
          </div>
          <p className="text-sm text-gray-400 mb-10 leading-relaxed">
            We've received your order and will start preparing it shortly.
          </p>
          <button
            onClick={() => {
              setOrderSuccess(null);
              setOrderForm({ customerName: '', customerPhone: '', orderType: 'take_away', deliveryAddress: '', notes: '' });
            }}
            className="w-full py-4 rounded-2xl font-semibold text-lg text-white transition-all duration-200 active:scale-[0.98] hover:opacity-90"
            style={{ background: BRAND.red }}
          >
            Continue Ordering
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Loading ───────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND.cream }}>
        <div className="text-center">
          <img src={logoSvg} alt="Logo" className="w-24 h-24 mx-auto mb-6 animate-pulse object-contain" />
          <div className="w-10 h-10 border-4 border-gray-200 rounded-full animate-spin mx-auto mb-4" style={{ borderTopColor: BRAND.red }} />
          <p className="text-gray-400 font-medium">Loading menu...</p>
        </div>
      </div>
    );
  }

  // ─── Render: Main ──────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: BRAND.cream, fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" }}>

      {/* ══════ HEADER ══════ */}
      <header className="sticky top-0 z-50 backdrop-blur-lg border-b" style={{ background: 'rgba(255,255,255,0.95)', borderColor: '#f0e8d8' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo + Name */}
            <div className="flex items-center space-x-3 min-w-0">
              <img src={logoSvg} alt="Logo" className="w-10 h-10 sm:w-12 sm:h-12 object-contain flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-extrabold truncate" style={{ color: BRAND.dark }}>
                  {info?.restaurantName || 'Restaurant'}
                </h1>
                {info?.restaurantAddress && (
                  <p className="text-[11px] text-gray-400 truncate hidden sm:block">{info.restaurantAddress}</p>
                )}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {info?.restaurantPhone && (
                <a
                  href={`tel:${info.restaurantPhone}`}
                  className="hidden sm:flex items-center space-x-1.5 text-sm px-3 py-2 rounded-xl transition-colors hover:bg-gray-50"
                  style={{ color: BRAND.red }}
                >
                  <PhoneIcon className="w-4 h-4" />
                  <span className="font-medium">{info.restaurantPhone}</span>
                </a>
              )}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative flex items-center space-x-2 text-white pl-4 pr-5 py-2.5 rounded-2xl transition-all duration-200 active:scale-95 hover:opacity-90 shadow-lg"
                style={{ background: BRAND.red, boxShadow: `0 4px 20px ${BRAND.red}40` }}
              >
                <ShoppingBagIcon className="w-5 h-5" />
                <span className="font-bold text-sm">{cartCount > 0 ? formatCurrency(cartTotal) : 'Cart'}</span>
                {cartCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ring-2 ring-white"
                    style={{ background: BRAND.gold, color: BRAND.dark }}
                  >
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ══════ HERO CAROUSEL ══════ */}
      {carouselItems.length > 0 && !searchTerm && (
        <section className="max-w-6xl mx-auto px-2 sm:px-6 pt-4 sm:pt-6 pb-1">
          <HeroCarousel items={carouselItems} onAddToCart={handleCarouselAdd} />
        </section>
      )}

      {/* ══════ SEARCH + CATEGORIES ══════ */}
      <div className="sticky top-16 sm:top-20 z-40 border-b" style={{ background: 'rgba(255,248,231,0.97)', backdropFilter: 'blur(12px)', borderColor: '#f0e8d8' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Search */}
          <div className="py-3">
            <div className="relative max-w-md">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
              <input
                type="text"
                placeholder="Search our menu..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-2.5 rounded-xl bg-white border border-gray-200 focus:outline-none focus:ring-2 text-sm placeholder:text-gray-400 transition-all"
                style={{ '--tw-ring-color': `${BRAND.red}40` } as React.CSSProperties}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg"
                >
                  <XMarkIcon className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex space-x-1.5 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:-mx-6 sm:px-6">
            <button
              onClick={() => { setShowDeals(false); setSelectedCategory('all'); }}
              className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200"
              style={
                !showDeals && selectedCategory === 'all'
                  ? { background: BRAND.red, color: '#fff', boxShadow: `0 2px 10px ${BRAND.red}30` }
                  : { background: 'white', color: '#666', border: '1px solid #e5e5e5' }
              }
            >
              All Items
            </button>
            {majorCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setShowDeals(false); setSelectedCategory(cat.id); }}
                className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200"
                style={
                  !showDeals && selectedCategory === cat.id
                    ? { background: BRAND.red, color: '#fff', boxShadow: `0 2px 10px ${BRAND.red}30` }
                    : { background: 'white', color: '#666', border: '1px solid #e5e5e5' }
                }
              >
                {cat.name}
              </button>
            ))}
            {deals.length > 0 && (
              <button
                onClick={() => { setShowDeals(true); setSelectedCategory('all'); }}
                className="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 flex items-center space-x-1.5"
                style={
                  showDeals
                    ? { background: BRAND.gold, color: BRAND.dark, boxShadow: `0 2px 10px ${BRAND.gold}40` }
                    : { background: 'white', color: '#666', border: '1px solid #e5e5e5' }
                }
              >
                <span>🔥</span>
                <span>Deals</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══════ CONTENT ══════ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {!showDeals ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold" style={{ color: BRAND.dark }}>
                {selectedCategory === 'all' ? 'Our Menu' : categories.find(c => c.id === selectedCategory)?.name || 'Menu'}
              </h2>
              <p className="text-sm text-gray-400">{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}</p>
            </div>

            {filteredItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <span className="text-3xl">🍽️</span>
                </div>
                <p className="font-semibold mb-1" style={{ color: BRAND.dark }}>No items found</p>
                <p className="text-sm text-gray-400">Try a different search or category</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    className={`group bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                      addedItemId === item.id ? 'ring-2 ring-offset-2' : ''
                    }`}
                    style={{
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
                      ...(addedItemId === item.id ? { '--tw-ring-color': BRAND.gold } as React.CSSProperties : {}),
                    }}
                  >
                    {/* Image */}
                    <div className="aspect-[16/10] overflow-hidden relative">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${BRAND.red}08, ${BRAND.gold}15)` }}
                        >
                          <span className="text-5xl opacity-20">🍽️</span>
                        </div>
                      )}
                      {item.hasVariants && (
                        <span className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.9)', color: BRAND.red }}>
                          Customizable
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 sm:p-5">
                      <h3 className="font-bold text-[15px] leading-tight mb-1" style={{ color: BRAND.dark }}>
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-gray-400 text-sm mb-3 line-clamp-2 leading-relaxed">{item.description}</p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-lg font-extrabold" style={{ color: BRAND.red }}>
                          {getDisplayPrice(item)}
                        </span>
                        <button
                          onClick={() => addToCart(item)}
                          className="flex items-center space-x-1.5 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 hover:opacity-90"
                          style={{ background: BRAND.red }}
                        >
                          <PlusIcon className="w-4 h-4" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── Deals Tab ── */
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center space-x-2" style={{ color: BRAND.dark }}>
                <span>🔥</span>
                <span>Special Deals</span>
              </h2>
              <p className="text-sm text-gray-400">{filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}</p>
            </div>

            {filteredDeals.length === 0 ? (
              <div className="text-center py-20">
                <p className="font-semibold mb-1" style={{ color: BRAND.dark }}>No deals available</p>
                <p className="text-sm text-gray-400">Check back later for special offers</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredDeals.map(deal => (
                  <div
                    key={deal.id}
                    className={`group bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative ${
                      addedItemId === deal.id ? 'ring-2 ring-offset-2' : ''
                    }`}
                    style={{
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
                      ...(addedItemId === deal.id ? { '--tw-ring-color': BRAND.gold } as React.CSSProperties : {}),
                    }}
                  >
                    {/* DEAL badge */}
                    <div className="absolute top-3 left-3 z-10">
                      <span
                        className="text-[11px] font-extrabold px-3 py-1.5 rounded-full shadow-lg"
                        style={{ background: BRAND.gold, color: BRAND.dark, boxShadow: `0 2px 12px ${BRAND.gold}50` }}
                      >
                        🔥 DEAL
                      </span>
                    </div>

                    {/* Image */}
                    <div className="aspect-[16/10] overflow-hidden">
                      {deal.imageUrl ? (
                        <img
                          src={deal.imageUrl}
                          alt={deal.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${BRAND.gold}15, ${BRAND.red}10)` }}
                        >
                          <span className="text-5xl opacity-20">🔥</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 sm:p-5">
                      <h3 className="font-bold text-[15px] leading-tight mb-1" style={{ color: BRAND.dark }}>{deal.name}</h3>
                      {deal.description && (
                        <p className="text-gray-400 text-sm mb-2 line-clamp-2">{deal.description}</p>
                      )}
                      {deal.items && deal.items.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {deal.items.map((di, i) => (
                            <span
                              key={i}
                              className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                              style={{ background: `${BRAND.gold}18`, color: BRAND.warmGray }}
                            >
                              {di.menuItemName}{di.quantity > 1 ? ` ×${di.quantity}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-lg font-extrabold" style={{ color: BRAND.red }}>
                          {getDisplayPrice(deal)}
                        </span>
                        <button
                          onClick={() => addDealToCart(deal)}
                          className="flex items-center space-x-1.5 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 hover:opacity-90"
                          style={{ background: BRAND.red }}
                        >
                          <PlusIcon className="w-4 h-4" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════ Floating Cart Bar (Mobile) ══════ */}
      {cartCount > 0 && !isCartOpen && !isCheckoutOpen && (
        <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 md:hidden z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full text-white py-4 rounded-2xl font-bold text-[15px] flex items-center justify-between px-6 active:scale-[0.98] transition-transform"
            style={{ background: BRAND.red, boxShadow: `0 4px 24px ${BRAND.red}40` }}
          >
            <span className="flex items-center space-x-2.5">
              <span className="rounded-lg w-7 h-7 flex items-center justify-center text-xs font-extrabold" style={{ background: BRAND.gold, color: BRAND.dark }}>
                {cartCount}
              </span>
              <span>View Cart</span>
            </span>
            <span className="font-extrabold">{formatCurrency(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* ══════ Overlay ══════ */}
      {(isCartOpen || isCheckoutOpen) && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
          onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(false); }}
        />
      )}

      {/* ══════ CART DRAWER ══════ */}
      <div className={`fixed inset-y-0 right-0 z-50 bg-white w-full max-w-md shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
        isCartOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-extrabold" style={{ color: BRAND.dark }}>Your Cart</h2>
            <p className="text-xs text-gray-400 mt-0.5">{cartCount} item{cartCount !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${BRAND.cream}` }}>
                <ShoppingBagIcon className="w-8 h-8 text-gray-200" />
              </div>
              <p className="font-semibold mb-1" style={{ color: BRAND.dark }}>Cart is empty</p>
              <p className="text-sm text-gray-400">Start adding items from the menu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.id} className="rounded-2xl p-4" style={{ background: BRAND.cream }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 mr-2">
                      <h4 className="font-bold text-sm" style={{ color: BRAND.dark }}>{item.name}</h4>
                      {item.selectedVariants.length > 0 && (
                        <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                          {item.selectedVariants.map(v => {
                            if (v.selectedOptions && v.selectedOptions.length > 1)
                              return `${v.variantName}: ${v.selectedOptions.map(o => o.optionName).join(', ')}`;
                            return `${v.variantName}: ${v.optionName}`;
                          }).join(' · ')}
                        </p>
                      )}
                    </div>
                    <button onClick={() => removeCartItem(item.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center bg-white rounded-xl border border-gray-200">
                      <button
                        onClick={() => updateCartItemQuantity(item.id, -1)}
                        disabled={item.quantity <= 1}
                        className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 rounded-l-xl transition-colors disabled:opacity-30"
                      >
                        <MinusIcon className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-9 text-center text-sm font-bold" style={{ color: BRAND.dark }}>{item.quantity}</span>
                      <button
                        onClick={() => updateCartItemQuantity(item.id, 1)}
                        className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 rounded-r-xl transition-colors"
                      >
                        <PlusIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="font-extrabold text-sm" style={{ color: BRAND.red }}>{formatCurrency(item.totalPrice)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-xl font-extrabold" style={{ color: BRAND.red }}>{formatCurrency(cartTotal)}</span>
            </div>
            <button
              onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
              className="w-full text-white py-4 rounded-2xl font-bold text-[15px] transition-all duration-200 active:scale-[0.98] hover:opacity-90"
              style={{ background: BRAND.red }}
            >
              Checkout
            </button>
          </div>
        )}
      </div>

      {/* ══════ CHECKOUT DRAWER ══════ */}
      <div className={`fixed inset-y-0 right-0 z-50 bg-white w-full max-w-md shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
        isCheckoutOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-extrabold" style={{ color: BRAND.dark }}>Checkout</h2>
            <p className="text-xs text-gray-400 mt-0.5">Complete your order</p>
          </div>
          <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Customer Details */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND.red }}>Your Details</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: BRAND.dark }}>Name *</label>
                <input
                  type="text"
                  value={orderForm.customerName}
                  onChange={e => setOrderForm(prev => ({ ...prev, customerName: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 text-sm transition-all"
                  style={{ '--tw-ring-color': `${BRAND.red}40`, background: BRAND.cream } as React.CSSProperties}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: BRAND.dark }}>Phone *</label>
                <input
                  type="tel"
                  maxLength={13}
                  value={orderForm.customerPhone}
                  onChange={e => setOrderForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 text-sm transition-all"
                  style={{ '--tw-ring-color': `${BRAND.red}40`, background: BRAND.cream } as React.CSSProperties}
                  placeholder="03XX-XXXXXXX"
                />
              </div>
            </div>
          </div>

          {/* Order Type */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND.red }}>Order Type</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOrderForm(prev => ({ ...prev, orderType: 'take_away' }))}
                className="py-3.5 rounded-xl font-semibold text-sm border-2 transition-all duration-200"
                style={
                  orderForm.orderType === 'take_away'
                    ? { borderColor: BRAND.red, background: BRAND.red, color: '#fff' }
                    : { borderColor: '#e5e5e5', background: 'white', color: '#666' }
                }
              >
                Take Away
              </button>
              <button
                type="button"
                onClick={() => setOrderForm(prev => ({ ...prev, orderType: 'delivery' }))}
                className="py-3.5 rounded-xl font-semibold text-sm border-2 transition-all duration-200"
                style={
                  orderForm.orderType === 'delivery'
                    ? { borderColor: BRAND.red, background: BRAND.red, color: '#fff' }
                    : { borderColor: '#e5e5e5', background: 'white', color: '#666' }
                }
              >
                Delivery
              </button>
            </div>
          </div>

          {orderForm.orderType === 'delivery' && (
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: BRAND.dark }}>Delivery Address *</label>
              <textarea
                value={orderForm.deliveryAddress}
                onChange={e => setOrderForm(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 text-sm transition-all resize-none"
                style={{ '--tw-ring-color': `${BRAND.red}40`, background: BRAND.cream } as React.CSSProperties}
                placeholder="Complete address"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: BRAND.dark }}>Notes</label>
            <textarea
              value={orderForm.notes}
              onChange={e => setOrderForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 text-sm transition-all resize-none"
              style={{ '--tw-ring-color': `${BRAND.red}40`, background: BRAND.cream } as React.CSSProperties}
              placeholder="Special instructions (optional)"
            />
          </div>

          {/* Order Summary */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND.red }}>Order Summary</h3>
            <div className="rounded-2xl p-4 space-y-2.5" style={{ background: BRAND.cream }}>
              {cart.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.name} <span className="text-gray-400">×{item.quantity}</span>
                  </span>
                  <span className="font-semibold ml-4 whitespace-nowrap" style={{ color: BRAND.dark }}>{formatCurrency(item.totalPrice)}</span>
                </div>
              ))}
              <div className="border-t pt-2.5 mt-2.5 space-y-1.5" style={{ borderColor: '#e8dfc8' }}>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-semibold" style={{ color: BRAND.dark }}>{formatCurrency(cartTotal)}</span>
                </div>
                {deliveryCharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Delivery</span>
                    <span className="font-semibold" style={{ color: BRAND.dark }}>{formatCurrency(deliveryCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5">
                  <span className="font-extrabold" style={{ color: BRAND.dark }}>Total</span>
                  <span className="text-lg font-extrabold" style={{ color: BRAND.red }}>{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Checkout Actions */}
        <div className="border-t border-gray-100 px-6 py-5 space-y-3">
          <button
            onClick={handlePlaceOrder}
            disabled={isSubmitting}
            className="w-full text-white py-4 rounded-2xl font-bold text-[15px] transition-all duration-200 disabled:opacity-50 active:scale-[0.98] hover:opacity-90"
            style={{ background: BRAND.red }}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </span>
            ) : (
              `Place Order — ${formatCurrency(grandTotal)}`
            )}
          </button>

          {info?.whatsappNumber && (
            <button
              onClick={sendToWhatsApp}
              className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold text-[15px] hover:bg-[#22c55e] transition-all duration-200 flex items-center justify-center space-x-2 active:scale-[0.98]"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span>Order via WhatsApp</span>
            </button>
          )}
        </div>
      </div>

      {/* ══════ VARIANT MODAL ══════ */}
      {variantModal && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setVariantModal(null)} />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-gray-100 z-10 sm:rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-extrabold" style={{ color: BRAND.dark }}>
                      {variantModal.item?.name || variantModal.deal?.name}
                    </h3>
                    <p className="text-sm text-gray-400 mt-0.5">Customize your order</p>
                  </div>
                  <button onClick={() => setVariantModal(null)} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                    <XMarkIcon className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-5 space-y-6">
                {variantModal.variants.map(variant => (
                  <div key={variant.variantId}>
                    <label className="block text-sm font-bold mb-2" style={{ color: BRAND.dark }}>
                      {variant.variantName}
                      {variant.isRequired && <span style={{ color: BRAND.red }} className="ml-1">*</span>}
                      <span className="font-normal text-gray-400 ml-2 text-xs">
                        {variant.selectionMode === 'single' ? 'Choose one' : variant.selectionMode === 'multiple' ? 'Choose any' : 'All included'}
                      </span>
                    </label>
                    <div className="space-y-2">
                      {variant.options.map(option => {
                        const sel = variantModal.selections[variant.variantId];
                        const isSelected = variant.selectionMode === 'single'
                          ? sel === option.id
                          : Array.isArray(sel) && sel.includes(option.id);

                        return (
                          <label
                            key={option.id}
                            className="flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200"
                            style={
                              isSelected
                                ? { borderColor: BRAND.red, background: `${BRAND.red}08` }
                                : { borderColor: '#e5e5e5' }
                            }
                          >
                            <div className="flex items-center space-x-3">
                              <div
                                className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                                style={
                                  isSelected
                                    ? { borderColor: BRAND.red, background: BRAND.red }
                                    : { borderColor: '#d1d5db' }
                                }
                              >
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className={`text-sm font-medium ${isSelected ? '' : 'text-gray-600'}`} style={isSelected ? { color: BRAND.dark } : {}}>
                                {option.name}
                              </span>
                            </div>
                            {option.priceModifier !== 0 && (
                              <span className="text-xs font-bold" style={{ color: option.priceModifier > 0 ? BRAND.red : '#16a34a' }}>
                                {option.priceModifier > 0 ? '+' : ''}{formatCurrency(option.priceModifier)}
                              </span>
                            )}
                            <input
                              type={variant.selectionMode === 'single' ? 'radio' : 'checkbox'}
                              name={`variant-${variant.variantId}`}
                              checked={isSelected}
                              onChange={() => {
                                setVariantModal(prev => {
                                  if (!prev) return prev;
                                  const newSelections = { ...prev.selections };
                                  if (variant.selectionMode === 'single') {
                                    newSelections[variant.variantId] = option.id;
                                  } else {
                                    const current = (newSelections[variant.variantId] as string[]) || [];
                                    if (current.includes(option.id)) {
                                      newSelections[variant.variantId] = current.filter(id => id !== option.id);
                                    } else {
                                      newSelections[variant.variantId] = [...current, option.id];
                                    }
                                  }
                                  return { ...prev, selections: newSelections };
                                });
                              }}
                              className="sr-only"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="sticky bottom-0 bg-white px-6 py-5 border-t border-gray-100">
                <button
                  onClick={confirmVariantSelection}
                  className="w-full text-white py-4 rounded-2xl font-bold text-[15px] transition-all duration-200 active:scale-[0.98] hover:opacity-90"
                  style={{ background: BRAND.red }}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════ FOOTER ══════ */}
      <footer className="mt-12 pb-24 md:pb-0 border-t" style={{ background: BRAND.dark, borderColor: '#333' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <img src={logoSvg} alt="Logo" className="w-12 h-12 object-contain" />
              <div>
                <h3 className="font-extrabold text-white text-lg">{info?.restaurantName || 'Restaurant'}</h3>
                <p className="text-gray-400 text-xs mt-0.5">Freshly made, just for you</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-5 text-sm text-gray-400">
              {info?.restaurantAddress && (
                <span className="flex items-center space-x-1.5">
                  <MapPinIcon className="w-4 h-4" />
                  <span>{info.restaurantAddress}</span>
                </span>
              )}
              {info?.restaurantPhone && (
                <a href={`tel:${info.restaurantPhone}`} className="flex items-center space-x-1.5 hover:text-white transition-colors">
                  <PhoneIcon className="w-4 h-4" />
                  <span>{info.restaurantPhone}</span>
                </a>
              )}
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-700 text-center">
            <p className="text-gray-500 text-xs">
              © {new Date().getFullYear()} {info?.restaurantName || 'Restaurant'}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
