import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShoppingCartIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  PrinterIcon,
  CheckCircleIcon,
  TagIcon,
  XMarkIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { Button, Card, Modal, Input, Select, CategoryFilter } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createOrder,
  addMenuItemFast,
  addDealFast,
  validateVariantSelections,
  updateOrderItemQuantityFast,
  updateOrderItemVariants,
  removeOrderItemFast,
  applyDiscount,
  removeDiscount,
  completeOrder,
  getOrderWithItems,
  calculateOrderTotals,
} from '@/services/orderService';
import {
  getAllCategories,
  getMenuItemsByCategory,
  getAllMenuItems,
  getVariantOptions,
  getAllDeals,
  getDealItems,
} from '@/services/menuService';
import { getAllWaiters, getAllRiders, getAllTables } from '@/services/staffService';
import { getCustomerByPhone, createCustomer } from '@/services/customerService';
import { getCurrentSession } from '@/services/registerService';
import { printKOT, printCustomerReceipt, printCounterCopy, printRiderReceipt, printAllReceipts } from '@/services/printService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { useSyncRefresh } from '@/contexts/SyncContext';
import { formatCurrency } from '@/utils/validation';
import type {
  Order,
  OrderItem,
  MenuItem,
  Category,
  Waiter,
  Rider,
  TableRecord,
  RegisterSession,
  VariantSelection,
  Variant,
  VariantOption,
  Deal,
  DealItem,
  MenuItemVariant,
  DealVariant,
} from '@/db/types';
import { db } from '@/db';

type VariantConfig = {
  variant: Variant;
  options: VariantOption[];
  isRequired: boolean;
  selectionMode: 'single' | 'multiple' | 'all';
};

const orderTypeSchema = z
  .object({
    orderType: z.enum(['dine_in', 'take_away', 'delivery']),
    tableId: z.string().optional(),
    waiterId: z.string().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerId: z.string().optional(),
    riderId: z.string().optional(),
    deliveryAddress: z.string().optional(),
    includeDeliveryCharge: z.boolean().optional(),
    deliveryCharge: z.preprocess(
      (value) => (value === '' || value === null || value === undefined || Number.isNaN(value) ? 0 : value),
      z.number().min(0, 'Delivery charges must be positive')
    ),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.orderType === 'delivery' && !data.customerPhone?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customerPhone'],
        message: 'Customer phone is required for delivery orders',
      });
    }
  });

const customerEditSchema = z
  .object({
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerId: z.string().optional(),
    waiterId: z.string().optional(),
    riderId: z.string().optional(),
    deliveryAddress: z.string().optional(),
    includeDeliveryCharge: z.boolean().optional(),
    deliveryCharge: z.preprocess(
      (value) => (value === '' || value === null || value === undefined || Number.isNaN(value) ? 0 : value),
      z.number().min(0, 'Delivery charges must be positive')
    ),
    orderType: z.enum(['dine_in', 'take_away', 'delivery']),
  })
  .superRefine((data, ctx) => {
    if (data.orderType === 'delivery' && !data.customerPhone?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customerPhone'],
        message: 'Customer phone is required for delivery orders',
      });
    }
  });

const discountSchema = z.object({
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(0, 'Discount must be positive'),
  discountReference: z.string().optional(),
});

const completeOrderSchema = z.object({
  isPaid: z.boolean(),
  paymentMethod: z.enum(['cash', 'card', 'online', 'other']).optional(),
  paymentAmount: z.number().optional(),
  paymentReference: z.string().optional(),
});

type OrderTypeFormData = z.infer<typeof orderTypeSchema>;
type CustomerEditFormData = z.infer<typeof customerEditSchema>;
type DiscountFormData = z.infer<typeof discountSchema>;
type CompleteOrderFormData = z.infer<typeof completeOrderSchema>;

export const CreateOrder: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editOrderId = searchParams.get('orderId');
  const currentUser = useAuthStore((state) => state.currentUser);
  const canApplyDiscount = useAuthStore((state) => state.hasPermission('discounts', 'create'));
  const dialog = useDialog();
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDealCategory, setSelectedDealCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [menuTab, setMenuTab] = useState<'items' | 'deals'>('items');
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [tables, setTables] = useState<TableRecord[]>([]);
  const [registerSession, setRegisterSession] = useState<RegisterSession | null>(null);

  // Variant Selection State
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [editingOrderItem, setEditingOrderItem] = useState<OrderItem | null>(null);
  const [itemVariants, setItemVariants] = useState<VariantConfig[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<VariantSelection[]>([]);
  const [variantNotes, setVariantNotes] = useState<string>('');

  // Deal Variant Selection State
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [dealVariants, setDealVariants] = useState<VariantConfig[]>([]);
  const [selectedDealVariants, setSelectedDealVariants] = useState<VariantSelection[]>([]);
  const [dealVariantNotes, setDealVariantNotes] = useState<string>('');
  const [dealItemsForSelection, setDealItemsForSelection] = useState<Array<DealItem & { menuItemName: string; hasVariants: boolean }>>([]);
  const [dealItemVariants, setDealItemVariants] = useState<Record<string, VariantConfig[]>>({});
  const [dealItemSelections, setDealItemSelections] = useState<Record<string, VariantSelection[][]>>({});

  // Modals
  const [isOrderTypeModalOpen, setIsOrderTypeModalOpen] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [isDealVariantModalOpen, setIsDealVariantModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isReprintKOTModalOpen, setIsReprintKOTModalOpen] = useState(false);
  const [isCustomerEditModalOpen, setIsCustomerEditModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customerStatus, setCustomerStatus] = useState<'new' | 'existing' | null>(null);
  const [editCustomerStatus, setEditCustomerStatus] = useState<'new' | 'existing' | null>(null);

  const orderTypeForm = useForm<OrderTypeFormData>({
    resolver: zodResolver(orderTypeSchema),
    defaultValues: {
      includeDeliveryCharge: false,
      deliveryCharge: 0,
    },
  });
  const selectedOrderType = orderTypeForm.watch('orderType');

  const customerEditForm = useForm<CustomerEditFormData>({
    resolver: zodResolver(customerEditSchema),
    defaultValues: { orderType: 'delivery', includeDeliveryCharge: false, deliveryCharge: 0 },
  });

  const discountForm = useForm<DiscountFormData>({
    resolver: zodResolver(discountSchema),
  });

  const completeForm = useForm<CompleteOrderFormData>({
    resolver: zodResolver(completeOrderSchema),
    defaultValues: { isPaid: false },
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadMenuItemsByCategory(selectedCategory);
    } else {
      loadAllMenuItems();
    }
  }, [selectedCategory, categories]);

  useEffect(() => {
    if (selectedOrderType !== 'delivery') {
      orderTypeForm.setValue('includeDeliveryCharge', false);
      orderTypeForm.setValue('deliveryCharge', 0);
    }
  }, [selectedOrderType, orderTypeForm]);

  // Real-time sync: auto-refresh order items when changes occur on other terminals
  const refreshCurrentOrder = useCallback(async () => {
    if (currentOrder) {
      try {
        // Single API call - getOrderWithItems returns both order and items
        const result = await getOrderWithItems(currentOrder.id);
        if (result) {
          // Recalculate totals from items to ensure accuracy
          const totals = calculateOrderTotals(result.order, result.items);
          setCurrentOrder({ ...result.order, ...totals });
          setOrderItems(result.items);
        }
      } catch (error) {
        console.error('Failed to refresh order:', error);
      }
    }
  }, [currentOrder?.id]);

  useSyncRefresh(['orders', 'order_items', 'payments'], refreshCurrentOrder);

  const loadInitialData = async () => {
    const session = await getCurrentSession();
    if (!session) {
      await dialog.alert('No active register session. Please open the register first.', 'No Register Session');
      return;
    }
    setRegisterSession(session);

    const cats = await getAllCategories();
    setCategories(cats.filter((c) => c.isActive));

    const allItems = await getAllMenuItems();
    // Filter out deal-only items from regular menu
    setMenuItems(allItems.filter((i) => i.isActive && !i.isDealOnly));

    const allDeals = await getAllDeals();
    setDeals(allDeals.filter((d) => d.isActive));

    const allWaiters = await getAllWaiters();
    setWaiters(allWaiters.filter((w) => w.isActive));

    const allRiders = await getAllRiders();
    setRiders(allRiders.filter((r) => r.isActive));

    const allTables = await getAllTables();
    setTables(allTables.filter((t) => t.isActive));

    // If editing an existing order, load it (single API call)
    if (editOrderId) {
      const result = await getOrderWithItems(editOrderId);
      if (result) {
        // Recalculate totals from items to ensure accuracy (backend may have stale data)
        const totals = calculateOrderTotals(result.order, result.items);
        setCurrentOrder({ ...result.order, ...totals });
        setOrderItems(result.items);
      } else {
        await dialog.alert('Order not found', 'Error');
      }
    }
  };

  const loadMenuItemsByCategory = async (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);

    if (category?.type === 'major') {
      const subCategoryIds = categories
        .filter((c) => c.parentId === categoryId && c.isActive)
        .map((c) => c.id);

      const validCategoryIds = new Set([categoryId, ...subCategoryIds]);
      const allItems = await getAllMenuItems();
      const filtered = allItems.filter(
        (i) => i.isActive && !i.isDealOnly && i.categoryId && validCategoryIds.has(i.categoryId)
      );
      setMenuItems(filtered);
      return;
    }

    const items = await getMenuItemsByCategory(categoryId);
    // Filter out deal-only items from regular menu
    setMenuItems(items.filter((i) => i.isActive && !i.isDealOnly));
  };

  const loadAllMenuItems = async () => {
    const allItems = await getAllMenuItems();
    // Filter out deal-only items from regular menu
    setMenuItems(allItems.filter((i) => i.isActive && !i.isDealOnly));
  };

  const loadMenuItemVariantConfig = async (menuItemId: string): Promise<VariantConfig[]> => {
    const menuItemVariants = (await db.menuItemVariants
      .where('menuItemId')
      .equals(menuItemId)
      .toArray()) as MenuItemVariant[];

    const variantDetails = await Promise.all(
      menuItemVariants.map(async (miv) => {
        const variant = await db.variants.get(miv.variantId);
        let options = await getVariantOptions(miv.variantId);

        if (!variant) return null;

        options = options.filter((o) => o.isActive);

        const availableOptionIds = miv.availableOptionIds || [];
        if (availableOptionIds.length > 0) {
          options = options.filter((o) => availableOptionIds.includes(o.id));
        }

        return {
          variant,
          options,
          isRequired: miv.isRequired,
          selectionMode: miv.selectionMode || 'single',
        };
      })
    );

    return variantDetails.filter((v) => v !== null) as VariantConfig[];
  };

  const handleCreateOrder = async (data: OrderTypeFormData) => {
    if (!currentUser || !registerSession) return;

    setIsLoading(true);
    try {
      const normalizedDeliveryCharge = data.orderType === 'delivery' && data.includeDeliveryCharge
        ? Math.max(0, Number.isFinite(data.deliveryCharge) ? data.deliveryCharge : 0)
        : 0;

      const newOrder = await createOrder({
        orderType: data.orderType,
        registerSessionId: registerSession.id,
        tableId: data.tableId,
        waiterId: data.waiterId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerId: data.customerId,
        riderId: data.riderId,
        deliveryAddress: data.deliveryAddress,
        deliveryCharge: normalizedDeliveryCharge,
        notes: data.notes,
        userId: currentUser.id,
      });

      setCurrentOrder(newOrder);
      setIsOrderTypeModalOpen(false);
      orderTypeForm.reset();
      setCustomerStatus(null);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to create order', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async (menuItem: MenuItem) => {
    if (!currentOrder || !currentUser) return;

    // Check if item has variants
    if (menuItem.hasVariants) {
      // Load variant configuration
      const menuItemVariants = (await db.menuItemVariants
        .where('menuItemId')
        .equals(menuItem.id)
        .toArray()) as MenuItemVariant[];

      const hasRequiredVariants = menuItemVariants.some(miv => miv.isRequired);

      if (hasRequiredVariants) {
        // Show variant modal for required variants
        await loadItemVariants(menuItem);
        setSelectedMenuItem(menuItem);
        setSelectedVariants([]);
        setVariantNotes('');
        setIsVariantModalOpen(true);
      } else {
        // Auto-attach pre-selected variant options (not required, but configured)
        const autoVariants: VariantSelection[] = [];

        for (const miv of menuItemVariants) {
          const variant = await db.variants.get(miv.variantId);
          let options = await getVariantOptions(miv.variantId);

          if (!variant) continue;

          // Filter to only active options
          options = options.filter(o => o.isActive);

          // Filter to available options if specific ones were selected
          const availableOptionIds = miv.availableOptionIds || [];
          if (availableOptionIds.length > 0) {
            options = options.filter(o => availableOptionIds.includes(o.id));
          }

          // Auto-select based on selection mode
          if (miv.selectionMode === 'single' && options.length === 1) {
            // Single mode with only 1 option available → auto-select it
            autoVariants.push({
              variantId: variant.id,
              variantName: variant.name,
              optionId: options[0].id,
              optionName: options[0].name,
              priceModifier: options[0].priceModifier
            });
          } else if (miv.selectionMode === 'all' && options.length > 0) {
            // All mode → auto-select all available options
            autoVariants.push({
              variantId: variant.id,
              variantName: variant.name,
              optionId: '',
              optionName: '',
              priceModifier: 0,
              selectedOptions: options.map(opt => ({
                optionId: opt.id,
                optionName: opt.name,
                priceModifier: opt.priceModifier
              }))
            });
          } else if (miv.selectionMode === 'multiple' && availableOptionIds.length > 0) {
            // Multiple mode with pre-selected options → auto-select all available
            autoVariants.push({
              variantId: variant.id,
              variantName: variant.name,
              optionId: '',
              optionName: '',
              priceModifier: 0,
              selectedOptions: options.map(opt => ({
                optionId: opt.id,
                optionName: opt.name,
                priceModifier: opt.priceModifier
              }))
            });
          }
        }

        // Add item with auto-selected variants
        try {
          const newItem = await addMenuItemFast({
            orderId: currentOrder.id,
            menuItem: { id: menuItem.id, name: menuItem.name, price: menuItem.price },
            quantity: 1,
            selectedVariants: autoVariants,
            userId: currentUser.id,
          });
          // Optimistic update using functional update to avoid stale closure
          setOrderItems(prevItems => {
            const newItems = [...prevItems, newItem];
            const totals = calculateOrderTotals(currentOrder, newItems);
            setCurrentOrder(prev => prev ? { ...prev, ...totals, updatedAt: new Date() } : prev);
            return newItems;
          });
        } catch (error) {
          await refreshOrder();
          await dialog.alert(error instanceof Error ? error.message : 'Failed to add item', 'Error');
        }
      }
    } else {
      // Add item without variants
      try {
        const newItem = await addMenuItemFast({
          orderId: currentOrder.id,
          menuItem: { id: menuItem.id, name: menuItem.name, price: menuItem.price },
          quantity: 1,
          selectedVariants: [],
          userId: currentUser.id,
        });
        // Optimistic update using functional update to avoid stale closure
        setOrderItems(prevItems => {
          const newItems = [...prevItems, newItem];
          const totals = calculateOrderTotals(currentOrder, newItems);
          setCurrentOrder(prev => prev ? { ...prev, ...totals, updatedAt: new Date() } : prev);
          return newItems;
        });
      } catch (error) {
        await refreshOrder();
        await dialog.alert(error instanceof Error ? error.message : 'Failed to add item', 'Error');
      }
    }
  };

  const loadItemVariants = async (menuItem: MenuItem) => {
    try {
      const variantDetails = await loadMenuItemVariantConfig(menuItem.id);
      setItemVariants(variantDetails);
    } catch (error) {
      console.error('Failed to load variants:', error);
      setItemVariants([]);
    }
  };

  const loadDealVariants = async (deal: Deal) => {
    try {
      const dealVariantLinks = (await db.dealVariants
        .where('dealId')
        .equals(deal.id)
        .toArray()) as DealVariant[];

      const variantDetails = await Promise.all(
        dealVariantLinks.map(async (dv) => {
          const variant = await db.variants.get(dv.variantId);
          let options = await getVariantOptions(dv.variantId);

          if (!variant) return null;

          options = options.filter((o) => o.isActive);

          const availableOptionIds = dv.availableOptionIds || [];
          if (availableOptionIds.length > 0) {
            options = options.filter((o) => availableOptionIds.includes(o.id));
          }

          return {
            variant,
            options,
            isRequired: dv.isRequired,
            selectionMode: dv.selectionMode || 'single',
          };
        })
      );

      setDealVariants(variantDetails.filter((v) => v !== null) as typeof dealVariants);
    } catch (error) {
      console.error('Failed to load deal variants:', error);
      setDealVariants([]);
    }
  };

  const updateVariantSelectionList = (
    prev: VariantSelection[],
    variantId: string,
    variantName: string,
    optionId: string,
    optionName: string,
    priceModifier: number,
    selectionMode: 'single' | 'multiple' | 'all'
  ) => {
    if (selectionMode === 'single') {
      const filtered = prev.filter(v => v.variantId !== variantId);
      return [
        ...filtered,
        { variantId, variantName, optionId, optionName, priceModifier }
      ];
    }

    const existing = prev.find(v => v.variantId === variantId);

    if (existing) {
      const selectedOpts = existing.selectedOptions || [];
      const optionExists = selectedOpts.find(o => o.optionId === optionId);

      if (optionExists) {
        const newOptions = selectedOpts.filter(o => o.optionId !== optionId);
        if (newOptions.length === 0) {
          return prev.filter(v => v.variantId !== variantId);
        }
        return prev.map(v =>
          v.variantId === variantId
            ? { ...v, selectedOptions: newOptions }
            : v
        );
      }

      return prev.map(v =>
        v.variantId === variantId
          ? {
              ...v,
              selectedOptions: [...selectedOpts, { optionId, optionName, priceModifier }]
            }
          : v
      );
    }

    return [
      ...prev,
      {
        variantId,
        variantName,
        optionId: '',
        optionName: '',
        priceModifier: 0,
        selectedOptions: [{ optionId, optionName, priceModifier }]
      }
    ];
  };

  const applyVariantSelection = (
    variantId: string,
    variantName: string,
    optionId: string,
    optionName: string,
    priceModifier: number,
    selectionMode: 'single' | 'multiple' | 'all',
    setSelections: React.Dispatch<React.SetStateAction<VariantSelection[]>>
  ) => {
    setSelections(prev =>
      updateVariantSelectionList(prev, variantId, variantName, optionId, optionName, priceModifier, selectionMode)
    );
  };

  const handleVariantSelection = (
    variantId: string,
    variantName: string,
    optionId: string,
    optionName: string,
    priceModifier: number,
    selectionMode: 'single' | 'multiple' | 'all'
  ) => {
    applyVariantSelection(
      variantId,
      variantName,
      optionId,
      optionName,
      priceModifier,
      selectionMode,
      setSelectedVariants
    );
  };

  const handleDealVariantSelection = (
    variantId: string,
    variantName: string,
    optionId: string,
    optionName: string,
    priceModifier: number,
    selectionMode: 'single' | 'multiple' | 'all'
  ) => {
    applyVariantSelection(
      variantId,
      variantName,
      optionId,
      optionName,
      priceModifier,
      selectionMode,
      setSelectedDealVariants
    );
  };

  const handleDealItemVariantSelection = (
    menuItemId: string,
    unitIndex: number,
    variantId: string,
    variantName: string,
    optionId: string,
    optionName: string,
    priceModifier: number,
    selectionMode: 'single' | 'multiple' | 'all'
  ) => {
    setDealItemSelections((prev) => {
      const perUnit = prev[menuItemId] ? [...prev[menuItemId]] : [];
      const currentSelections = perUnit[unitIndex] ? [...perUnit[unitIndex]] : [];

      perUnit[unitIndex] = updateVariantSelectionList(
        currentSelections,
        variantId,
        variantName,
        optionId,
        optionName,
        priceModifier,
        selectionMode
      );

      return { ...prev, [menuItemId]: perUnit };
    });
  };

  // Auto-select all options for variants with 'all' selection mode
  useEffect(() => {
    if (isVariantModalOpen && itemVariants.length > 0) {
      const autoSelections: VariantSelection[] = [];

      for (const iv of itemVariants) {
        if (iv.selectionMode === 'all') {
          autoSelections.push({
            variantId: iv.variant.id,
            variantName: iv.variant.name,
            optionId: '',
            optionName: '',
            priceModifier: 0,
            selectedOptions: iv.options.map(opt => ({
              optionId: opt.id,
              optionName: opt.name,
              priceModifier: opt.priceModifier
            }))
          });
        }
      }

      if (autoSelections.length > 0) {
        setSelectedVariants(prev => {
          // Filter out any existing selections for 'all' mode variants
          const filtered = prev.filter(
            sv => !autoSelections.find(as => as.variantId === sv.variantId)
          );
          return [...filtered, ...autoSelections];
        });
      }
    }
  }, [isVariantModalOpen, itemVariants]);

  useEffect(() => {
    if (isDealVariantModalOpen && dealVariants.length > 0) {
      const autoSelections: VariantSelection[] = [];

      for (const dv of dealVariants) {
        if (dv.selectionMode === 'all') {
          autoSelections.push({
            variantId: dv.variant.id,
            variantName: dv.variant.name,
            optionId: '',
            optionName: '',
            priceModifier: 0,
            selectedOptions: dv.options.map((opt) => ({
              optionId: opt.id,
              optionName: opt.name,
              priceModifier: opt.priceModifier,
            })),
          });
        }
      }

      if (autoSelections.length > 0) {
        setSelectedDealVariants((prev) => {
          const filtered = prev.filter(
            (sv) => !autoSelections.find((as) => as.variantId === sv.variantId)
          );
          return [...filtered, ...autoSelections];
        });
      }
    }
  }, [isDealVariantModalOpen, dealVariants]);

  useEffect(() => {
    if (isDealVariantModalOpen && Object.keys(dealItemVariants).length > 0) {
      setDealItemSelections((prev) => {
        const updated: Record<string, VariantSelection[][]> = { ...prev };

        for (const [menuItemId, configs] of Object.entries(dealItemVariants)) {
          const autoSelections: VariantSelection[] = [];

          for (const cfg of configs) {
            if (cfg.selectionMode === 'all') {
              autoSelections.push({
                variantId: cfg.variant.id,
                variantName: cfg.variant.name,
                optionId: '',
                optionName: '',
                priceModifier: 0,
                selectedOptions: cfg.options.map((opt) => ({
                  optionId: opt.id,
                  optionName: opt.name,
                  priceModifier: opt.priceModifier,
                })),
              });
            }
          }

          if (autoSelections.length === 0) continue;

          const perUnit = updated[menuItemId] || [];
          updated[menuItemId] = perUnit.map((unitSelections) => {
            const filtered = unitSelections.filter(
              (sv) => !autoSelections.find((as) => as.variantId === sv.variantId)
            );
            return [...filtered, ...autoSelections];
          });
        }

        return updated;
      });
    }
  }, [isDealVariantModalOpen, dealItemVariants]);

  const handleAddItemWithVariants = async () => {
    if (!selectedMenuItem || !currentOrder || !currentUser) return;

    // Validate required variants
    const missingRequired = itemVariants.filter(
      (iv) => iv.isRequired && !selectedVariants.find((sv) => sv.variantId === iv.variant.id)
    );

    if (missingRequired.length > 0) {
      await dialog.alert(`Please select: ${missingRequired.map((v) => v.variant.name).join(', ')}`, 'Missing Required Options');
      return;
    }

    setIsLoading(true);
    try {
      const newItem = await addMenuItemFast({
        orderId: currentOrder.id,
        menuItem: { id: selectedMenuItem.id, name: selectedMenuItem.name, price: selectedMenuItem.price },
        quantity: 1,
        selectedVariants,
        notes: variantNotes || undefined,
        userId: currentUser.id,
      });

      // Optimistic update using functional update to avoid stale closure
      setOrderItems(prevItems => {
        const newItems = [...prevItems, newItem];
        const totals = calculateOrderTotals(currentOrder, newItems);
        setCurrentOrder(prev => prev ? { ...prev, ...totals, updatedAt: new Date() } : prev);
        return newItems;
      });
      
      setIsVariantModalOpen(false);
      setSelectedMenuItem(null);
      setEditingOrderItem(null);
      setSelectedVariants([]);
      setVariantNotes('');
    } catch (error) {
      await refreshOrder();
      await dialog.alert(error instanceof Error ? error.message : 'Failed to add item', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateItemPrice = () => {
    if (!selectedMenuItem) return 0;
    const variantsTotal = selectedVariants.reduce((sum, v) => sum + v.priceModifier, 0);
    return selectedMenuItem.price + variantsTotal;
  };

  const calculateDealPrice = () => {
    return selectedDeal ? selectedDeal.price : 0;
  };

  const handleEditOrderItem = async (orderItem: OrderItem) => {
    if (!orderItem.menuItemId || orderItem.itemType !== 'menu_item') return;

    // Load the menu item
    const menuItem = await db.menuItems.get(orderItem.menuItemId);
    if (!menuItem) return;

    // Load variants for this menu item
    await loadItemVariants(menuItem);

    // Set the selected menu item and editing state
    setSelectedMenuItem(menuItem);
    setEditingOrderItem(orderItem);

    // Pre-populate existing variant selections
    setSelectedVariants(orderItem.selectedVariants || []);
    setVariantNotes(orderItem.notes || '');

    // Open the variant modal
    setIsVariantModalOpen(true);
  };

  const handleUpdateItemWithVariants = async () => {
    if (!editingOrderItem || !currentUser) return;

    // Validate required variants
    const missingRequired = itemVariants.filter(
      (iv) => iv.isRequired && !selectedVariants.find((sv) => sv.variantId === iv.variant.id)
    );

    if (missingRequired.length > 0) {
      await dialog.alert(`Please select: ${missingRequired.map((v) => v.variant.name).join(', ')}`, 'Missing Required Options');
      return;
    }

    setIsLoading(true);
    try {
      await updateOrderItemVariants({
        itemId: editingOrderItem.id,
        selectedVariants,
        notes: variantNotes || undefined,
        userId: currentUser.id,
      });

      await refreshOrder();
      setIsVariantModalOpen(false);
      setSelectedMenuItem(null);
      setEditingOrderItem(null);
      setSelectedVariants([]);
      setVariantNotes('');
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to update item', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDeal = async (deal: Deal) => {
    if (!currentOrder || !currentUser) return;

    setIsLoading(true);
    try {
      // Load deal variants
      const dealVariantLinks = (await db.dealVariants
        .where('dealId')
        .equals(deal.id)
        .toArray()) as DealVariant[];
      const dealItems = await getDealItems(deal.id);
      const enrichedDealItems = await Promise.all(
        dealItems.map(async (item) => {
          const menuItem = await db.menuItems.get(item.menuItemId);
          return {
            ...item,
            menuItemName: menuItem?.name || 'Unknown',
            hasVariants: Boolean(menuItem?.hasVariants),
          };
        })
      );

      const itemsWithVariants = enrichedDealItems.filter((item) => item.hasVariants);

      if (dealVariantLinks.length > 0 || itemsWithVariants.length > 0) {
        if (dealVariantLinks.length > 0) {
          await loadDealVariants(deal);
        } else {
          setDealVariants([]);
        }

        setSelectedDeal(deal);
        setSelectedDealVariants([]);
        setDealVariantNotes('');
        setDealItemsForSelection(enrichedDealItems);

        const variantConfigs: Record<string, VariantConfig[]> = {};
        const selections: Record<string, VariantSelection[][]> = {};

        for (const item of itemsWithVariants) {
          const configs = await loadMenuItemVariantConfig(item.menuItemId);
          variantConfigs[item.menuItemId] = configs;
          selections[item.menuItemId] = Array.from({ length: item.quantity }, () => []);
        }

        setDealItemVariants(variantConfigs);
        setDealItemSelections(selections);
        setIsDealVariantModalOpen(true);
        setIsLoading(false);
        return;
      }

      // Auto-attach pre-selected deal variant options (not required, but configured)
      const autoVariants: VariantSelection[] = [];

      for (const dv of dealVariantLinks) {
        const variant = await db.variants.get(dv.variantId);
        let options = await getVariantOptions(dv.variantId);

        if (!variant) continue;

        options = options.filter(o => o.isActive);

        const availableOptionIds = dv.availableOptionIds || [];
        if (availableOptionIds.length > 0) {
          options = options.filter(o => availableOptionIds.includes(o.id));
        }

        // Auto-select based on selection mode
        if (dv.selectionMode === 'single' && options.length === 1) {
          autoVariants.push({
            variantId: variant.id,
            variantName: variant.name,
            optionId: options[0].id,
            optionName: options[0].name,
            priceModifier: options[0].priceModifier
          });
        } else if (dv.selectionMode === 'all' && options.length > 0) {
          autoVariants.push({
            variantId: variant.id,
            variantName: variant.name,
            optionId: '',
            optionName: '',
            priceModifier: 0,
            selectedOptions: options.map(opt => ({
              optionId: opt.id,
              optionName: opt.name,
              priceModifier: opt.priceModifier
            }))
          });
        } else if (dv.selectionMode === 'multiple' && availableOptionIds.length > 0) {
          autoVariants.push({
            variantId: variant.id,
            variantName: variant.name,
            optionId: '',
            optionName: '',
            priceModifier: 0,
            selectedOptions: options.map(opt => ({
              optionId: opt.id,
              optionName: opt.name,
              priceModifier: opt.priceModifier
            }))
          });
        }
      }

      // Load deal items to create breakdown
      const dealBreakdown = await Promise.all(
        dealItems.map(async (item) => {
          const menuItem = await db.menuItems.get(item.menuItemId);
          return {
            menuItemId: item.menuItemId,
            menuItemName: menuItem?.name || 'Unknown',
            quantity: item.quantity,
            selectedVariants: autoVariants, // Apply auto-attached deal variants to each item
          };
        })
      );

      const newItem = await addDealFast({
        orderId: currentOrder.id,
        deal: { id: deal.id, name: deal.name, price: deal.price },
        quantity: 1,
        dealBreakdown,
        selectedVariants: autoVariants,
        userId: currentUser.id,
      });

      // Optimistic update using functional update to avoid stale closure
      setOrderItems(prevItems => {
        const updatedItems = [...prevItems, newItem];
        const totals = calculateOrderTotals(currentOrder, updatedItems);
        setCurrentOrder(prev => prev ? { ...prev, ...totals, updatedAt: new Date() } : prev);
        return updatedItems;
      });
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to add deal', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDealWithVariants = async () => {
    if (!selectedDeal || !currentOrder || !currentUser) return;

    if (dealVariants.length > 0) {
      const validation = validateVariantSelections(dealVariants, selectedDealVariants);
      if (!validation.valid) {
        await dialog.alert(validation.error || 'Please select required variants', 'Missing Required Options');
        return;
      }
    }

    for (const item of dealItemsForSelection) {
      if (!item.hasVariants) continue;
      const configs = dealItemVariants[item.menuItemId] || [];
      const perUnitSelections = dealItemSelections[item.menuItemId] || [];

      for (let idx = 0; idx < item.quantity; idx += 1) {
        const selections = perUnitSelections[idx] || [];
        const result = validateVariantSelections(configs, selections);
        if (!result.valid) {
          await dialog.alert(
            `${item.menuItemName} (item ${idx + 1}): ${result.error || 'Missing required variants'}`,
            'Missing Required Options'
          );
          return;
        }
      }
    }

    setIsLoading(true);
    try {
      const dealBreakdown = dealItemsForSelection.flatMap((item) => {
        const perUnitSelections = dealItemSelections[item.menuItemId] || [];
        const mergeSelections = (unitSelections: VariantSelection[]) => ([
          ...selectedDealVariants,
          ...unitSelections,
        ]);

        if (item.hasVariants && item.quantity > 0) {
          return Array.from({ length: item.quantity }).map((_, idx) => ({
            menuItemId: item.menuItemId,
            menuItemName: item.menuItemName,
            quantity: 1,
            selectedVariants: mergeSelections(perUnitSelections[idx] || []),
          }));
        }

        return [{
          menuItemId: item.menuItemId,
          menuItemName: item.menuItemName,
          quantity: item.quantity,
          selectedVariants: selectedDealVariants,
        }];
      });

      const newItem = await addDealFast({
        orderId: currentOrder.id,
        deal: { id: selectedDeal.id, name: selectedDeal.name, price: selectedDeal.price },
        quantity: 1,
        dealBreakdown,
        selectedVariants: selectedDealVariants,
        notes: dealVariantNotes || undefined,
        userId: currentUser.id,
      });

      // Optimistic update using functional update to avoid stale closure
      setOrderItems(prevItems => {
        const updatedItems = [...prevItems, newItem];
        const totals = calculateOrderTotals(currentOrder, updatedItems);
        setCurrentOrder(prev => prev ? { ...prev, ...totals, updatedAt: new Date() } : prev);
        return updatedItems;
      });
      
      setIsDealVariantModalOpen(false);
      setSelectedDeal(null);
      setDealVariants([]);
      setSelectedDealVariants([]);
      setDealVariantNotes('');
      setDealItemsForSelection([]);
      setDealItemVariants({});
      setDealItemSelections({});
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to add deal', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (!currentUser || !currentOrder) return;

    // Find the item from state (no API fetch needed)
    const item = orderItems.find(i => i.id === itemId);
    if (!item) return;

    // Calculate unit price safely to avoid NaN from division by zero
    const unitPrice = item.quantity > 0 ? item.totalPrice / item.quantity : item.unitPrice || 0;

    try {
      if (newQuantity <= 0) {
        // Optimistic update: remove from UI immediately using functional update to avoid stale closure
        setOrderItems(prevItems => {
          const newItems = prevItems.filter(i => i.id !== itemId);
          // Update order totals in the same render cycle
          const totals = calculateOrderTotals(currentOrder, newItems);
          setCurrentOrder(prev => prev ? { ...prev, ...totals, updatedAt: new Date() } : prev);
          return newItems;
        });
        await removeOrderItemFast(item, currentUser.id);
      } else {
        // Calculate new total price safely
        const newTotalPrice = Math.max(0, unitPrice * newQuantity);
        // Ensure the price is a valid number
        if (!Number.isFinite(newTotalPrice)) {
          console.error('Invalid price calculation detected', { unitPrice, newQuantity, item });
          await refreshOrder();
          return;
        }
        // Optimistic update using functional update to avoid stale closure
        setOrderItems(prevItems => {
          const newItems = prevItems.map(i => 
            i.id === itemId ? { ...i, quantity: newQuantity, totalPrice: newTotalPrice } : i
          );
          // Update order totals in the same render cycle
          const totals = calculateOrderTotals(currentOrder, newItems);
          setCurrentOrder(prev => prev ? { ...prev, ...totals, updatedAt: new Date() } : prev);
          return newItems;
        });
        await updateOrderItemQuantityFast(item, newQuantity, currentUser.id);
      }
    } catch (error) {
      // Revert optimistic update on error
      await refreshOrder();
      await dialog.alert(error instanceof Error ? error.message : 'Failed to update quantity', 'Error');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!currentUser || !currentOrder) return;

    // Find the item from state (no API fetch needed)
    const item = orderItems.find(i => i.id === itemId);
    if (!item) return;

    try {
      // Optimistic update using functional update to avoid stale closure
      setOrderItems(prevItems => {
        const newItems = prevItems.filter(i => i.id !== itemId);
        const totals = calculateOrderTotals(currentOrder, newItems);
        setCurrentOrder(prev => prev ? { ...prev, ...totals, updatedAt: new Date() } : prev);
        return newItems;
      });
      await removeOrderItemFast(item, currentUser.id);
    } catch (error) {
      // Revert optimistic update on error
      await refreshOrder();
      await dialog.alert(error instanceof Error ? error.message : 'Failed to remove item', 'Error');
    }
  };

  const handleApplyDiscount = async (data: DiscountFormData) => {
    if (!currentOrder || !currentUser) return;

    setIsLoading(true);
    try {
      await applyDiscount({
        orderId: currentOrder.id,
        discountType: data.discountType,
        discountValue: data.discountValue,
        discountReference: data.discountReference,
        userId: currentUser.id,
      });

      await refreshOrder();
      setIsDiscountModalOpen(false);
      discountForm.reset();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to apply discount', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveDiscount = async () => {
    if (!currentOrder || !currentUser) return;

    try {
      await removeDiscount(currentOrder.id, currentUser.id);
      await refreshOrder();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to remove discount', 'Error');
    }
  };

  const handleCompleteOrder = async (data: CompleteOrderFormData) => {
    if (!currentOrder || !currentUser) return;

    setIsLoading(true);
    try {
      // Auto-create customer for delivery orders if new customer
      if (currentOrder.orderType === 'delivery' &&
          currentOrder.customerPhone &&
          currentOrder.customerName &&
          !currentOrder.customerId &&
          currentOrder.customerPhone.length === 11) {

        try {
          // Create new customer
          const newCustomer = await createCustomer({
            name: currentOrder.customerName,
            phone: currentOrder.customerPhone,
            address: currentOrder.deliveryAddress || null,
            notes: null,
          }, currentUser.id);

          // Update order with customer ID
          await db.orders.update(currentOrder.id, {
            customerId: newCustomer.id,
            updatedAt: new Date(),
          });

          console.log(`Auto-created customer: ${newCustomer.name} (${newCustomer.phone})`);
        } catch (customerError) {
          // Log error but don't fail the order
          console.error('Failed to auto-create customer:', customerError);
        }
      }

        await completeOrder({
          orderId: currentOrder.id,
          isPaid: data.isPaid,
          paymentMethod: data.paymentMethod,
          paymentAmount: data.paymentAmount,
          paymentReference: data.paymentReference,
          userId: currentUser.id,
        });

        let printError: string | null = null;
        if (data.isPaid) {
          try {
            await printCustomerReceipt(currentOrder.id, currentUser.id);
          } catch (error) {
            printError = error instanceof Error ? error.message : 'Failed to print paid receipt';
          }
        }

        if (printError) {
          await dialog.alert(
            `Order ${currentOrder.orderNumber} completed, but failed to print paid receipt: ${printError}`,
            'Warning'
          );
        } else {
          await dialog.alert(`Order ${currentOrder.orderNumber} completed successfully!`, 'Success');
        }

      // If editing, go back to orders list
      if (editOrderId) {
        navigate('/orders');
      } else {
        // Reset for new order
        setCurrentOrder(null);
        setOrderItems([]);
        setIsCompleteModalOpen(false);
        completeForm.reset({ isPaid: false });
        setIsOrderTypeModalOpen(true);
        setCustomerStatus(null);
      }
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to complete order', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintKOT = async (reprintAll: boolean = false) => {
    if (!currentOrder || !currentUser) return;

    try {
      await printKOT(currentOrder.id, currentUser.id, false, reprintAll);
      await refreshOrder();
      await dialog.alert('KOT printed successfully!', 'Success');
      setIsReprintKOTModalOpen(false);
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === 'NO_NEW_ITEMS') {
        // Show confirmation modal to reprint all items
        setIsReprintKOTModalOpen(true);
      } else {
        await dialog.alert(err.message || 'Failed to print KOT', 'Error');
      }
    }
  };

  const handlePrintReceipt = async () => {
    if (!currentOrder || !currentUser) return;

    try {
      await printCustomerReceipt(currentOrder.id, currentUser.id);
      await dialog.alert('Customer receipt printed successfully!', 'Success');
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to print receipt', 'Error');
    }
  };

  const handlePrintRiderReceipt = async () => {
    if (!currentOrder || !currentUser) return;

    try {
      await printRiderReceipt(currentOrder.id, currentUser.id);
      await dialog.alert('Rider receipt printed successfully!', 'Success');
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to print rider receipt', 'Error');
    }
  };

  const handlePrintCounterReceipt = async () => {
    if (!currentOrder || !currentUser) return;

    try {
      await printCounterCopy(currentOrder.id, currentUser.id);
      await dialog.alert('Counter receipt printed successfully!', 'Success');
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to print counter receipt', 'Error');
    }
  };

  const handlePrintAllReceipts = async () => {
    if (!currentOrder || !currentUser) return;

    try {
      await printAllReceipts(currentOrder.id, currentUser.id);
      await dialog.alert('Print all executed successfully!', 'Success');
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to print receipts', 'Error');
    }
  };

  const refreshOrder = async () => {
    if (!currentOrder) return;
    // Single API call - getOrderWithItems returns both order and items
    const result = await getOrderWithItems(currentOrder.id);
    if (result) {
      // Recalculate totals from items to ensure accuracy
      const totals = calculateOrderTotals(result.order, result.items);
      setCurrentOrder({ ...result.order, ...totals });
      setOrderItems(result.items);
    }
  };

  const handleCustomerPhoneChange = async (phone: string) => {
    if (phone.length === 11) {
      const customer = await getCustomerByPhone(phone);
      if (customer) {
        // Existing customer found - populate form
        orderTypeForm.setValue('customerName', customer.name);
        orderTypeForm.setValue('customerId', customer.id);
        if (orderTypeForm.getValues('orderType') === 'delivery') {
          orderTypeForm.setValue('deliveryAddress', customer.address || '');
        }
        setCustomerStatus('existing');
      } else {
        // New customer - clear customer ID and mark as new
        orderTypeForm.setValue('customerId', '');
        setCustomerStatus('new');
      }
    } else {
      // Reset status if phone is incomplete
      setCustomerStatus(null);
    }
  };

  const openCustomerEditModal = () => {
    if (!currentOrder) return;
    customerEditForm.reset({
      customerName: currentOrder.customerName || '',
      customerPhone: currentOrder.customerPhone || '',
      customerId: currentOrder.customerId || '',
      waiterId: currentOrder.waiterId || '',
      riderId: currentOrder.riderId || '',
      deliveryAddress: currentOrder.deliveryAddress || '',
      includeDeliveryCharge: (currentOrder.deliveryCharge || 0) > 0,
      deliveryCharge: currentOrder.deliveryCharge || 0,
      orderType: currentOrder.orderType,
    });
    setEditCustomerStatus(null);
    setIsCustomerEditModalOpen(true);
  };

  const handleEditCustomerPhoneChange = async (phone: string) => {
    if (phone.length === 11) {
      const customer = await getCustomerByPhone(phone);
      if (customer) {
        customerEditForm.setValue('customerName', customer.name);
        customerEditForm.setValue('customerId', customer.id);
        if (currentOrder?.orderType === 'delivery') {
          customerEditForm.setValue('deliveryAddress', customer.address || '');
        }
        setEditCustomerStatus('existing');
      } else {
        customerEditForm.setValue('customerId', '');
        setEditCustomerStatus('new');
      }
    } else {
      setEditCustomerStatus(null);
    }
  };

  const handleUpdateCustomerDetails = async (data: CustomerEditFormData) => {
    if (!currentOrder || !currentUser) return;

    setIsLoading(true);
    try {
      const updates: Record<string, any> = {
        customerName: data.customerName?.trim() || null,
        customerPhone: data.customerPhone?.trim() || null,
        customerId: data.customerId?.trim() || null,
        deliveryAddress:
          currentOrder.orderType === 'delivery'
            ? data.deliveryAddress?.trim() || null
            : null,
      };

      if (currentOrder.orderType === 'delivery') {
        const normalizedDeliveryCharge = data.includeDeliveryCharge
          ? Math.max(0, Number.isFinite(data.deliveryCharge) ? data.deliveryCharge : 0)
          : 0;
        updates.riderId = data.riderId?.trim() || null;
        updates.deliveryCharge = normalizedDeliveryCharge;
        const baseTotal = Math.max(0, currentOrder.subtotal - currentOrder.discountAmount);
        updates.total = Math.max(0, baseTotal + normalizedDeliveryCharge);
      } else {
        updates.waiterId = data.waiterId?.trim() || null;
        updates.deliveryCharge = 0;
        const baseTotal = Math.max(0, currentOrder.subtotal - currentOrder.discountAmount);
        updates.total = baseTotal;
      }

      await db.orders.update(currentOrder.id, updates);
      await refreshOrder();
      setIsCustomerEditModalOpen(false);
      setEditCustomerStatus(null);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to update customer details', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!registerSession) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card padding="lg">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No Active Register Session</h2>
            <p className="text-gray-600 mb-6">
              Please open a register session before creating orders.
            </p>
            <Button onClick={() => navigate('/register')} variant="primary">
              Go to Register Management
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const filteredDeals = deals.filter((deal) => {
    const matchesSearch = deal.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (!selectedDealCategory) return true;
    if (!deal.categoryId) return false;

    const selectedCategoryData = categories.find((cat) => cat.id === selectedDealCategory);
    if (selectedCategoryData?.type === 'major') {
      const subIds = categories
        .filter((cat) => cat.parentId === selectedCategoryData.id)
        .map((cat) => cat.id);
      const validIds = new Set([selectedCategoryData.id, ...subIds]);
      return validIds.has(deal.categoryId);
    }

    return deal.categoryId === selectedDealCategory;
  });

  const editOrderType = customerEditForm.watch('orderType');
  const assignedWaiterName = currentOrder?.waiterId
    ? waiters.find((w) => w.id === currentOrder.waiterId)?.name || 'Unknown'
    : 'Unassigned';
  const assignedRiderName = currentOrder?.riderId
    ? riders.find((r) => r.id === currentOrder.riderId)?.name || 'Unknown'
    : 'Unassigned';
  const appliedDeliveryCharge = currentOrder?.orderType === 'delivery'
    ? Math.max(0, currentOrder.deliveryCharge || 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          {editOrderId && currentOrder ? `Edit Order ${currentOrder.orderNumber}` : 'Create Order'}
        </h1>
        {!currentOrder && !editOrderId && (
          <Button
            onClick={() => setIsOrderTypeModalOpen(true)}
            leftIcon={<ShoppingCartIcon className="w-5 h-5" />}
            variant="primary"
            size="lg"
          >
            New Order
          </Button>
        )}
        {editOrderId && currentOrder && (
          <Button
            onClick={() => navigate('/orders')}
            variant="secondary"
          >
            Back to Orders
          </Button>
        )}
      </div>

      {currentOrder ? (
        <div className="grid grid-cols-12 gap-6">
          {/* Left Pane: Menu Browser */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <Card padding="md">
              <h2 className="font-bold text-gray-900 mb-4">Menu</h2>

              {/* Search Input */}
              <Input
                placeholder="Search menu items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {/* Tabs for Items and Deals */}
              <div className="flex space-x-2 mb-4 mt-4">
                <button
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    menuTab === 'items'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setMenuTab('items')}
                >
                  Menu Items
                </button>
                <button
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    menuTab === 'deals'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setMenuTab('deals')}
                >
                  Deals ({deals.length})
                </button>
              </div>

              {menuTab === 'items' ? (
                <>
                    <CategoryFilter
                      categories={categories}
                      value={selectedCategory}
                      onChange={setSelectedCategory}
                      label="Filter by Category"
                    />

                  <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto">
                    {menuItems
                      .filter((item) =>
                        item.name.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleAddItem(item)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold text-gray-900">{item.name}</p>
                            {item.hasVariants && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                Has Options
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{formatCurrency(item.price)}</p>
                        </div>
                        <PlusIcon className="w-5 h-5 text-primary-600" />
                      </div>
                    ))}
                    {menuItems.filter((item) =>
                      item.name.toLowerCase().includes(searchTerm.toLowerCase())
                    ).length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <p className="text-sm">
                          {searchTerm ? 'No menu items match your search.' : 'No menu items available.'}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <CategoryFilter
                    categories={categories}
                    value={selectedDealCategory}
                    onChange={setSelectedDealCategory}
                    label="Filter by Category"
                  />

                  <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto">
                    {filteredDeals.map((deal) => (
                    <div
                      key={deal.id}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg hover:from-green-100 hover:to-blue-100 cursor-pointer border border-green-200 dark:from-emerald-900/40 dark:to-sky-900/40 dark:hover:from-emerald-900/60 dark:hover:to-sky-900/60 dark:border-emerald-700/60"
                      onClick={() => handleAddDeal(deal)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="font-bold text-gray-900 dark:text-gray-100">{deal.name}</p>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium dark:bg-emerald-900/70 dark:text-emerald-200">
                            DEAL
                          </span>
                        </div>
                        {deal.description && (
                          <p className="text-xs text-gray-600 mb-2 line-clamp-1 dark:text-gray-300">{deal.description}</p>
                        )}
                        <p className="text-lg font-bold text-primary-600 dark:text-primary-300">
                          {formatCurrency(deal.price)}
                        </p>
                      </div>
                      <PlusIcon className="w-6 h-6 text-primary-600 dark:text-primary-300" />
                    </div>
                    ))}
                    {filteredDeals.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <p className="text-sm">
                          {searchTerm || selectedDealCategory ? 'No deals match your filters.' : 'No active deals available.'}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* Center Pane: Order Items */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <Card padding="md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Order Items</h2>
                <span className="text-sm text-gray-600">
                  Order #{currentOrder.orderNumber}
                </span>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {orderItems.map((item) => (
                  <div key={item.id} className={`border rounded-lg p-3 ${
                    item.itemType === 'deal'
                      ? 'border-green-300 bg-green-50 dark:border-emerald-700/60 dark:bg-emerald-900/30'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="font-semibold text-gray-900">
                            {item.itemType === 'menu_item'
                              ? menuItems.find((m) => m.id === item.menuItemId)?.name
                              : deals.find((d) => d.id === item.dealId)?.name || 'Deal'}
                          </p>
                          {item.itemType === 'deal' && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium dark:bg-emerald-900/70 dark:text-emerald-200">
                              DEAL
                            </span>
                          )}
                        </div>

                        {/* Deal Breakdown */}
                        {item.itemType === 'deal' && item.dealBreakdown && (
                          <div className="mt-2 pl-3 border-l-2 border-green-300 space-y-1 dark:border-emerald-700/60">
                            {item.dealBreakdown.map((breakdown, idx) => (
                              <div key={idx} className="text-xs text-gray-700">
                                <span className="font-medium">{breakdown.quantity}x</span> {breakdown.menuItemName}
                                {breakdown.selectedVariants && breakdown.selectedVariants.length > 0 && (
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {breakdown.selectedVariants.map((v, vIdx) => {
                                      if (v.selectedOptions && v.selectedOptions.length > 0) {
                                        const optionNames = v.selectedOptions.map(o => o.optionName).join(', ');
                                        return (
                                          <div key={vIdx}>
                                            {v.variantName}: {optionNames}
                                          </div>
                                        );
                                      }
                                      return (
                                        <div key={vIdx}>
                                          {v.variantName}: {v.optionName}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Menu Item Variants */}
                        {item.selectedVariants.length > 0 && (
                          <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                            {item.selectedVariants.map((v, idx) => {
                              // Handle both single-select and multi-select display
                              if (v.selectedOptions && v.selectedOptions.length > 0) {
                                // Multi-select display
                                const optionNames = v.selectedOptions.map(o => o.optionName).join(', ');
                                const totalModifier = v.selectedOptions.reduce((sum, o) => sum + o.priceModifier, 0);
                                return (
                                  <div key={idx}>
                                    {v.variantName}: {optionNames}
                                    {totalModifier !== 0 && ` (${totalModifier > 0 ? '+' : ''}${formatCurrency(totalModifier)})`}
                                  </div>
                                );
                              } else {
                                // Single select display (existing behavior)
                                return (
                                  <div key={idx}>
                                    {v.variantName}: {v.optionName}
                                    {v.priceModifier !== 0 && ` (${v.priceModifier > 0 ? '+' : ''}${formatCurrency(v.priceModifier)})`}
                                  </div>
                                );
                              }
                            })}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-xs text-gray-500 italic mt-1">{item.notes}</p>
                        )}
                        <p className="text-sm text-gray-600 mt-1">
                          {formatCurrency(item.unitPrice)} each
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        {item.itemType === 'menu_item' && item.selectedVariants.length > 0 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleEditOrderItem(item)}
                          >
                            <PencilIcon className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        >
                          <MinusIcon className="w-4 h-4" />
                        </Button>
                        <span className="font-semibold text-gray-900 w-8 text-center">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        >
                          <PlusIcon className="w-4 h-4" />
                        </Button>
                      </div>
                      <span className="font-bold text-gray-900">
                        {formatCurrency(item.totalPrice)}
                      </span>
                    </div>
                  </div>
                ))}

                {orderItems.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <ShoppingCartIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>No items yet. Add items from the menu.</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Pane: Order Summary & Actions */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <Card padding="md">
              <h2 className="font-bold text-gray-900 mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-semibold text-gray-900">
                    {currentOrder.orderType.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {currentOrder.tableId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Table:</span>
                    <span className="font-semibold text-gray-900">
                      {tables.find((t) => t.id === currentOrder.tableId)?.tableNumber}
                    </span>
                  </div>
                )}

                <div className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">Order Details</span>
                    <Button size="sm" variant="secondary" onClick={openCustomerEditModal}>
                      Edit
                    </Button>
                  </div>
                  <div className="space-y-1 text-gray-600">
                    {(currentOrder.orderType === 'delivery' || currentOrder.orderType === 'take_away') && (
                      <>
                        <div>
                          <span className="text-gray-500">Name:</span>{' '}
                          {currentOrder.customerName || 'N/A'}
                        </div>
                        <div>
                          <span className="text-gray-500">Phone:</span>{' '}
                          {currentOrder.customerPhone || 'N/A'}
                        </div>
                      </>
                    )}
                    {currentOrder.orderType === 'delivery' && (
                      <div>
                        <span className="text-gray-500">Address:</span>{' '}
                        {currentOrder.deliveryAddress || 'N/A'}
                      </div>
                    )}
                    {(currentOrder.orderType === 'dine_in' || currentOrder.orderType === 'take_away') && (
                      <div>
                        <span className="text-gray-500">Waiter:</span>{' '}
                        {assignedWaiterName}
                      </div>
                    )}
                    {currentOrder.orderType === 'delivery' && (
                      <div>
                        <span className="text-gray-500">Rider:</span>{' '}
                        {assignedRiderName}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mb-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(currentOrder.subtotal)}
                  </span>
                </div>

                {currentOrder.discountAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-red-600">Discount:</span>
                      {currentOrder.discountReference && (
                        <span className="text-xs text-gray-500">
                          ({currentOrder.discountReference})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-red-600">
                        -{formatCurrency(currentOrder.discountAmount)}
                      </span>
                      <button
                        onClick={handleRemoveDiscount}
                        className="text-red-600 hover:text-red-800"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {currentOrder.orderType === 'delivery' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Delivery Charges:</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(appliedDeliveryCharge)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                  <span>Total:</span>
                  <span className="text-primary-600">{formatCurrency(currentOrder.total)}</span>
                </div>
              </div>

              <div className="space-y-2">
                {canApplyDiscount ? (
                  <Button
                    fullWidth
                    variant="secondary"
                    onClick={() => setIsDiscountModalOpen(true)}
                    leftIcon={<TagIcon className="w-5 h-5" />}
                    disabled={orderItems.length === 0}
                  >
                    Apply Discount
                  </Button>
                ) : (
                  <div className="text-sm text-gray-500 text-center py-2">
                    Only Managers and Admins can apply discounts
                  </div>
                )}

                <Button
                  fullWidth
                  variant="secondary"
                  onClick={() => handlePrintKOT()}
                  leftIcon={<PrinterIcon className="w-5 h-5" />}
                  disabled={orderItems.length === 0}
                >
                  Print KOT
                </Button>

                {currentOrder?.orderType === 'delivery' && (
                  <Button
                    fullWidth
                    variant="secondary"
                    onClick={handlePrintRiderReceipt}
                    leftIcon={<PrinterIcon className="w-5 h-5" />}
                    disabled={orderItems.length === 0}
                  >
                    Print Rider Receipt
                  </Button>
                )}

                <Button
                  fullWidth
                  variant="secondary"
                  onClick={handlePrintReceipt}
                  leftIcon={<PrinterIcon className="w-5 h-5" />}
                  disabled={orderItems.length === 0}
                >
                  Print Customer Receipt
                </Button>

                <Button
                  fullWidth
                  variant="secondary"
                  onClick={handlePrintCounterReceipt}
                  leftIcon={<PrinterIcon className="w-5 h-5" />}
                  disabled={orderItems.length === 0}
                >
                  Print Counter Receipt
                </Button>

                <Button
                  fullWidth
                  variant="secondary"
                  onClick={handlePrintAllReceipts}
                  leftIcon={<PrinterIcon className="w-5 h-5" />}
                  disabled={orderItems.length === 0}
                >
                  Print All
                </Button>

                <Button
                  fullWidth
                  variant="success"
                  onClick={() => {
                    completeForm.reset({
                      isPaid: currentOrder?.isPaid || false,
                      paymentMethod: 'cash',
                      paymentAmount: currentOrder?.total || 0,
                      paymentReference: '',
                    });
                    setIsCompleteModalOpen(true);
                  }}
                  leftIcon={<CheckCircleIcon className="w-5 h-5" />}
                  disabled={orderItems.length === 0}
                  size="lg"
                >
                  Complete Order
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <Card padding="lg">
          <div className="text-center py-12">
            <ShoppingCartIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Order</h3>
            <p className="text-gray-600 mb-6">Click "New Order" to get started</p>
          </div>
        </Card>
      )}

      {/* Order Type Selection Modal */}
      <Modal
        isOpen={isOrderTypeModalOpen}
        onClose={() => setIsOrderTypeModalOpen(false)}
        title="Create New Order"
        size="lg"
      >
        <form onSubmit={orderTypeForm.handleSubmit(handleCreateOrder)} className="space-y-4">
          <Select
            label="Order Type"
            error={orderTypeForm.formState.errors.orderType?.message}
            {...orderTypeForm.register('orderType')}
          >
            <option value="">Select order type</option>
            <option value="dine_in">Dine In</option>
            <option value="take_away">Take Away</option>
            <option value="delivery">Delivery</option>
          </Select>

          {selectedOrderType === 'dine_in' && (
            <Select label="Table" {...orderTypeForm.register('tableId')}>
              <option value="">Select table</option>
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.tableNumber}
                </option>
              ))}
            </Select>
          )}

          {(selectedOrderType === 'dine_in' || selectedOrderType === 'take_away') && (
            <Select label="Waiter" {...orderTypeForm.register('waiterId')}>
              <option value="">Select waiter</option>
              {waiters.map((waiter) => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.name}
                </option>
              ))}
            </Select>
          )}

          {selectedOrderType === 'delivery' && (
            <>
                <div>
                  <Input
                    label="Customer Phone"
                    placeholder="03001234567"
                    error={orderTypeForm.formState.errors.customerPhone?.message}
                    {...orderTypeForm.register('customerPhone')}
                    onChange={(e) => {
                      orderTypeForm.register('customerPhone').onChange(e);
                      handleCustomerPhoneChange(e.target.value);
                    }}
                />
                {customerStatus === 'existing' && (
                  <div className="mt-1 flex items-center text-sm text-green-600">
                    <CheckCircleIcon className="w-4 h-4 mr-1" />
                    Existing customer - details loaded
                  </div>
                )}
                {customerStatus === 'new' && (
                  <div className="mt-1 flex items-center text-sm text-blue-600">
                    <PlusIcon className="w-4 h-4 mr-1" />
                    New customer - will be saved automatically
                  </div>
                )}
              </div>

              <Input
                label="Customer Name"
                {...orderTypeForm.register('customerName')}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Address
                </label>
                <textarea
                  className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  {...orderTypeForm.register('deliveryAddress')}
                />
              </div>

              <Select label="Rider" {...orderTypeForm.register('riderId')}>
                <option value="">Select rider</option>
                {riders.map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.name}
                  </option>
                ))}
              </Select>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeDeliveryCharge"
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  {...orderTypeForm.register('includeDeliveryCharge')}
                />
                <label htmlFor="includeDeliveryCharge" className="text-sm font-medium text-gray-700">
                  Add Delivery Charges
                </label>
              </div>

              {orderTypeForm.watch('includeDeliveryCharge') && (
                <Input
                  label="Delivery Charges"
                  type="number"
                  step="0.01"
                  error={orderTypeForm.formState.errors.deliveryCharge?.message}
                  {...orderTypeForm.register('deliveryCharge', { valueAsNumber: true })}
                />
              )}
            </>
          )}

          {selectedOrderType === 'take_away' && (
            <>
              <Input
                label="Customer Phone (Optional)"
                placeholder="03001234567"
                error={orderTypeForm.formState.errors.customerPhone?.message}
                {...orderTypeForm.register('customerPhone')}
                onChange={(e) => {
                  orderTypeForm.register('customerPhone').onChange(e);
                  handleCustomerPhoneChange(e.target.value);
                }}
              />
              <Input
                label="Customer Name (Optional)"
                {...orderTypeForm.register('customerName')}
              />
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={2}
              {...orderTypeForm.register('notes')}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsOrderTypeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              Create Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* Order Details Edit Modal */}
      <Modal
        isOpen={isCustomerEditModalOpen}
        onClose={() => {
          setIsCustomerEditModalOpen(false);
          customerEditForm.reset();
          setEditCustomerStatus(null);
        }}
        title="Edit Order Details"
        size="lg"
      >
        <form
          onSubmit={customerEditForm.handleSubmit(handleUpdateCustomerDetails)}
          className="space-y-4"
        >
          <input type="hidden" {...customerEditForm.register('orderType')} />
          <input type="hidden" {...customerEditForm.register('customerId')} />

          {(editOrderType === 'delivery' || editOrderType === 'take_away') && (
            <>
              <div>
                <Input
                  label={editOrderType === 'delivery' ? 'Customer Phone' : 'Customer Phone (Optional)'}
                  placeholder="03001234567"
                  error={customerEditForm.formState.errors.customerPhone?.message}
                  {...customerEditForm.register('customerPhone')}
                  onChange={(e) => {
                    customerEditForm.register('customerPhone').onChange(e);
                    handleEditCustomerPhoneChange(e.target.value);
                  }}
                />
                {editCustomerStatus === 'existing' && (
                  <div className="mt-1 flex items-center text-sm text-green-600">
                    <CheckCircleIcon className="w-4 h-4 mr-1" />
                    Existing customer - details loaded
                  </div>
                )}
                {editCustomerStatus === 'new' && (
                  <div className="mt-1 flex items-center text-sm text-blue-600">
                    <PlusIcon className="w-4 h-4 mr-1" />
                    New customer - will be saved automatically
                  </div>
                )}
              </div>

              <Input
                label={editOrderType === 'delivery' ? 'Customer Name' : 'Customer Name (Optional)'}
                {...customerEditForm.register('customerName')}
              />
            </>
          )}

          {editOrderType === 'delivery' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Address
              </label>
              <textarea
                className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={3}
                {...customerEditForm.register('deliveryAddress')}
              />
            </div>
          )}

          {(editOrderType === 'dine_in' || editOrderType === 'take_away') && (
            <Select label="Waiter" {...customerEditForm.register('waiterId')}>
              <option value="">Select waiter</option>
              {waiters.map((waiter) => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.name}
                </option>
              ))}
            </Select>
          )}

          {editOrderType === 'delivery' && (
            <>
              <Select label="Rider" {...customerEditForm.register('riderId')}>
                <option value="">Select rider</option>
                {riders.map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.name}
                  </option>
                ))}
              </Select>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editIncludeDeliveryCharge"
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  {...customerEditForm.register('includeDeliveryCharge')}
                />
                <label htmlFor="editIncludeDeliveryCharge" className="text-sm font-medium text-gray-700">
                  Add Delivery Charges
                </label>
              </div>

              {customerEditForm.watch('includeDeliveryCharge') && (
                <Input
                  label="Delivery Charges"
                  type="number"
                  step="0.01"
                  error={customerEditForm.formState.errors.deliveryCharge?.message}
                  {...customerEditForm.register('deliveryCharge', { valueAsNumber: true })}
                />
              )}
            </>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsCustomerEditModalOpen(false);
                customerEditForm.reset();
                setEditCustomerStatus(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Variant Selection Modal */}
      <Modal
        isOpen={isVariantModalOpen}
        onClose={() => {
          setIsVariantModalOpen(false);
          setSelectedMenuItem(null);
          setEditingOrderItem(null);
          setSelectedVariants([]);
          setVariantNotes('');
        }}
        title={`${editingOrderItem ? 'Edit' : 'Customize'}: ${selectedMenuItem?.name}`}
        size="lg"
      >
        <div className="space-y-6">
          {selectedMenuItem && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-900">{selectedMenuItem.name}</p>
                  <p className="text-sm text-gray-600">Base Price: {formatCurrency(selectedMenuItem.price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total:</p>
                  <p className="text-xl font-bold text-primary-600">
                    {formatCurrency(calculateItemPrice())}
                  </p>
                </div>
              </div>
            </div>
          )}

          {itemVariants.map((iv) => (
            <div key={iv.variant.id} className="border-b border-gray-200 pb-4">
              <label className="block text-sm font-medium text-gray-900 mb-3">
                {iv.variant.name}
                {iv.isRequired && <span className="text-red-600 ml-1">*</span>}
                <span className="text-xs text-gray-500 ml-2">
                  {iv.selectionMode === 'single' && '(Select one)'}
                  {iv.selectionMode === 'multiple' && '(Select multiple)'}
                  {iv.selectionMode === 'all' && '(Pre-selected)'}
                </span>
              </label>

              <div className="space-y-2">
                {iv.options.map((option) => {
                  // Check if option is selected (handle both single and multi-select)
                  const selection = selectedVariants.find(sv => sv.variantId === iv.variant.id);
                  const isSelected = (() => {
                    if (!selection) return false;
                    if (iv.selectionMode === 'single') {
                      return selection.optionId === option.id;
                    } else {
                      return selection.selectedOptions?.some(o => o.optionId === option.id) || false;
                    }
                  })();

                  return (
                    <div
                      key={option.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                      }`}
                      onClick={() =>
                        handleVariantSelection(
                          iv.variant.id,
                          iv.variant.name,
                          option.id,
                          option.name,
                          option.priceModifier,
                          iv.selectionMode
                        )
                      }
                    >
                      <div className="flex items-center space-x-3">
                        {/* Radio button for single, checkbox for multiple/all */}
                        {iv.selectionMode === 'single' ? (
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-primary-500' : 'border-gray-300'
                            }`}
                          >
                            {isSelected && (
                              <div className="w-3 h-3 rounded-full bg-primary-500" />
                            )}
                          </div>
                        ) : (
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none"/>
                              </svg>
                            )}
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{option.name}</span>
                      </div>
                      {option.priceModifier !== 0 && (
                        <span className="text-sm text-gray-600">
                          {option.priceModifier > 0 ? '+' : ''}
                          {formatCurrency(option.priceModifier)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Instructions (Optional)
            </label>
            <textarea
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={2}
              placeholder="e.g., No onions, extra cheese..."
              value={variantNotes}
              onChange={(e) => setVariantNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsVariantModalOpen(false);
                setSelectedMenuItem(null);
                setEditingOrderItem(null);
                setSelectedVariants([]);
                setVariantNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingOrderItem ? handleUpdateItemWithVariants : handleAddItemWithVariants}
              variant="primary"
              isLoading={isLoading}
            >
              {editingOrderItem ? 'Update Item' : 'Add to Order'} - {formatCurrency(calculateItemPrice())}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deal Variant Selection Modal */}
      <Modal
        isOpen={isDealVariantModalOpen}
        onClose={() => {
          setIsDealVariantModalOpen(false);
          setSelectedDeal(null);
          setDealVariants([]);
          setSelectedDealVariants([]);
          setDealVariantNotes('');
          setDealItemsForSelection([]);
          setDealItemVariants({});
          setDealItemSelections({});
        }}
        title={`Customize Deal: ${selectedDeal?.name || ''}`}
        size="lg"
      >
        <div className="space-y-6">
          {selectedDeal && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-900">{selectedDeal.name}</p>
                  <p className="text-sm text-gray-600">Deal Price: {formatCurrency(selectedDeal.price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total:</p>
                  <p className="text-xl font-bold text-primary-600">
                    {formatCurrency(calculateDealPrice())}
                  </p>
                </div>
              </div>
            </div>
          )}

          {dealVariants.map((dv) => (
            <div key={dv.variant.id} className="border-b border-gray-200 pb-4">
              <label className="block text-sm font-medium text-gray-900 mb-3">
                {dv.variant.name}
                {dv.isRequired && <span className="text-red-600 ml-1">*</span>}
                <span className="text-xs text-gray-500 ml-2">
                  {dv.selectionMode === 'single' && '(Select one)'}
                  {dv.selectionMode === 'multiple' && '(Select multiple)'}
                  {dv.selectionMode === 'all' && '(Pre-selected)'}
                </span>
              </label>

              <div className="space-y-2">
                {dv.options.map((option) => {
                  const selection = selectedDealVariants.find(sv => sv.variantId === dv.variant.id);
                  const isSelected = (() => {
                    if (!selection) return false;
                    if (dv.selectionMode === 'single') {
                      return selection.optionId === option.id;
                    }
                    return selection.selectedOptions?.some(o => o.optionId === option.id) || false;
                  })();

                  return (
                    <div
                      key={option.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                      }`}
                      onClick={() =>
                        handleDealVariantSelection(
                          dv.variant.id,
                          dv.variant.name,
                          option.id,
                          option.name,
                          option.priceModifier,
                          dv.selectionMode
                        )
                      }
                    >
                      <div className="flex items-center space-x-3">
                        {dv.selectionMode === 'single' ? (
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-primary-500' : 'border-gray-300'
                            }`}
                          >
                            {isSelected && (
                              <div className="w-3 h-3 rounded-full bg-primary-500" />
                            )}
                          </div>
                        ) : (
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none"/>
                              </svg>
                            )}
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{option.name}</span>
                      </div>
                      {option.priceModifier !== 0 && (
                        <span className="text-sm text-gray-600">
                          {option.priceModifier > 0 ? '+' : ''}
                          {formatCurrency(option.priceModifier)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {dealItemsForSelection.filter((item) => item.hasVariants).length > 0 && (
            <div className="space-y-6">
              {dealItemsForSelection
                .filter((item) => item.hasVariants)
                .map((item) => {
                  const configs = dealItemVariants[item.menuItemId] || [];
                  const perUnitSelections = dealItemSelections[item.menuItemId] || [];

                  return (
                    <div key={item.menuItemId} className="border-t border-gray-200 pt-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">
                        {item.menuItemName} ({item.quantity}x)
                      </h3>

                      {Array.from({ length: item.quantity }).map((_, unitIndex) => {
                        const unitSelections = perUnitSelections[unitIndex] || [];
                        return (
                          <div key={`${item.menuItemId}-${unitIndex}`} className="mb-4 rounded-lg border border-gray-200 p-3">
                            <p className="text-xs font-medium text-gray-700 mb-3">
                              Item {unitIndex + 1} of {item.quantity}
                            </p>

                            {configs.map((cfg) => (
                              <div key={cfg.variant.id} className="border-b border-gray-200 pb-3 mb-3 last:border-b-0 last:pb-0 last:mb-0">
                                <label className="block text-sm font-medium text-gray-900 mb-2">
                                  {cfg.variant.name}
                                  {cfg.isRequired && <span className="text-red-600 ml-1">*</span>}
                                  <span className="text-xs text-gray-500 ml-2">
                                    {cfg.selectionMode === 'single' && '(Select one)'}
                                    {cfg.selectionMode === 'multiple' && '(Select multiple)'}
                                    {cfg.selectionMode === 'all' && '(Pre-selected)'}
                                  </span>
                                </label>

                                <div className="space-y-2">
                                  {cfg.options.map((option) => {
                                    const selection = unitSelections.find((sv) => sv.variantId === cfg.variant.id);
                                    const isSelected = (() => {
                                      if (!selection) return false;
                                      if (cfg.selectionMode === 'single') {
                                        return selection.optionId === option.id;
                                      }
                                      return selection.selectedOptions?.some((o) => o.optionId === option.id) || false;
                                    })();

                                    return (
                                      <div
                                        key={`${cfg.variant.id}-${option.id}-${unitIndex}`}
                                        className={`flex items-center justify-between p-2 border rounded-lg cursor-pointer transition-colors ${
                                          isSelected
                                            ? 'border-primary-500 bg-primary-50'
                                            : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                                        }`}
                                        onClick={() =>
                                          handleDealItemVariantSelection(
                                            item.menuItemId,
                                            unitIndex,
                                            cfg.variant.id,
                                            cfg.variant.name,
                                            option.id,
                                            option.name,
                                            option.priceModifier,
                                            cfg.selectionMode
                                          )
                                        }
                                      >
                                        <div className="flex items-center space-x-3">
                                          {cfg.selectionMode === 'single' ? (
                                            <div
                                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                isSelected ? 'border-primary-500' : 'border-gray-300'
                                              }`}
                                            >
                                              {isSelected && (
                                                <div className="w-2 h-2 rounded-full bg-primary-500" />
                                              )}
                                            </div>
                                          ) : (
                                            <div
                                              className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                                isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                                              }`}
                                            >
                                              {isSelected && (
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                                                  <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none"/>
                                                </svg>
                                              )}
                                            </div>
                                          )}
                                          <span className="text-sm font-medium text-gray-900">{option.name}</span>
                                        </div>
                                        {option.priceModifier !== 0 && (
                                          <span className="text-xs text-gray-600">
                                            {option.priceModifier > 0 ? '+' : ''}
                                            {formatCurrency(option.priceModifier)}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Instructions (Optional)
            </label>
            <textarea
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={2}
              placeholder="e.g., Replace fries with salad..."
              value={dealVariantNotes}
              onChange={(e) => setDealVariantNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsDealVariantModalOpen(false);
                setSelectedDeal(null);
                setDealVariants([]);
                setSelectedDealVariants([]);
                setDealVariantNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddDealWithVariants}
              variant="primary"
              isLoading={isLoading}
            >
              Add Deal - {formatCurrency(calculateDealPrice())}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Discount Modal */}
      <Modal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        title="Apply Discount"
        size="md"
      >
        <form onSubmit={discountForm.handleSubmit(handleApplyDiscount)} className="space-y-4">
          <Select
            label="Discount Type"
            error={discountForm.formState.errors.discountType?.message}
            {...discountForm.register('discountType')}
          >
            <option value="">Select type</option>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (Rs)</option>
          </Select>

          <Input
            label="Discount Value"
            type="number"
            step="0.01"
            error={discountForm.formState.errors.discountValue?.message}
            {...discountForm.register('discountValue', { valueAsNumber: true })}
          />

          <Input
            label="Reference (Optional)"
            placeholder="e.g., Promo Code, Manager Approval"
            {...discountForm.register('discountReference')}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDiscountModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              Apply Discount
            </Button>
          </div>
        </form>
      </Modal>

      {/* Complete Order Modal */}
      <Modal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        title="Complete Order"
        size="md"
      >
        <form onSubmit={completeForm.handleSubmit(handleCompleteOrder)} className="space-y-4">
          {currentOrder && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Amount:</span>
                <span className="text-primary-600">{formatCurrency(currentOrder.total)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isPaid"
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              {...completeForm.register('isPaid')}
            />
            <label htmlFor="isPaid" className="text-sm font-medium text-gray-700">
              Payment Received
            </label>
          </div>

          {completeForm.watch('isPaid') && (
            <>
              <Select
                label="Payment Method"
                {...completeForm.register('paymentMethod')}
              >
                <option value="">Select method</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online">Online Transfer</option>
                <option value="other">Other</option>
              </Select>

              <Input
                label="Amount Tendered"
                type="number"
                step="0.01"
                placeholder={currentOrder?.total.toString()}
                helperText="Used for change calculation only. Recorded payment is capped to remaining order balance."
                {...completeForm.register('paymentAmount', { valueAsNumber: true })}
              />

              {/* Change Due Calculator */}
              {(() => {
                const paymentAmount = completeForm.watch('paymentAmount');
                const orderTotal = currentOrder?.total || 0;
                const change = (paymentAmount || 0) - orderTotal;

                if (paymentAmount && change > 0) {
                  return (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-green-700 font-medium">Change to Return:</span>
                        <span className="text-2xl font-bold text-green-600">
                          {formatCurrency(change)}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <Input
                label="Payment Reference (Optional)"
                placeholder="Transaction ID, Receipt Number, etc."
                {...completeForm.register('paymentReference')}
              />
            </>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCompleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="success" isLoading={isLoading}>
              Complete Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reprint KOT Confirmation Modal */}
      <Modal
        isOpen={isReprintKOTModalOpen}
        onClose={() => setIsReprintKOTModalOpen(false)}
        title="No New Items"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            There are no new items to print. All items have already been sent to the kitchen.
          </p>
          <p className="text-gray-700 font-semibold">
            Would you like to reprint the entire KOT?
          </p>
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setIsReprintKOTModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => handlePrintKOT(true)}
            >
              Yes, Reprint All
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
