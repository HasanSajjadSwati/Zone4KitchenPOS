import React, { useEffect, useState, useRef } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Button, Card, Modal, Input, Select, CategoryFilter } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createId } from '@/utils/uuid';
import {
  createDeal,
  updateDeal,
  deleteDeal,
  getDealItems,
  getAllCategories,
  getAllMenuItems,
  getAllVariants,
  getDealVariants,
  setDealVariants,
  getVariantOptions,
  createVariant,
  createVariantOption,
  createMenuItem,
} from '@/services/menuService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { formatCurrency } from '@/utils/validation';
import type { Deal, DealItem, MenuItem, Category, Variant } from '@/db/types';
import { db } from '@/db';

const dealSchema = z.object({
  name: z.string().min(1, 'Deal name is required'),
  description: z.string().nullable(),
  price: z.number().min(0, 'Price must be positive'),
  categoryId: z.string().nullable(),
  isActive: z.boolean(),
});

type DealFormData = z.infer<typeof dealSchema>;

// Helper component to select which variant options are available
const VariantOptionsSelector: React.FC<{
  variant: Variant;
  availableOptionIds: string[];
  onToggleOption: (optionId: string) => void;
}> = ({ variant, availableOptionIds, onToggleOption }) => {
  const [options, setOptions] = useState<any[]>([]);

  useEffect(() => {
    const loadOptions = async () => {
      const opts = await getVariantOptions(variant.id);
      setOptions(opts.filter(o => o.isActive));
    };
    loadOptions();
  }, [variant.id]);

  if (options.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic mt-1">
        No options available for this variant
      </div>
    );
  }

  const allSelected = availableOptionIds.length === 0;

  return (
    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
        Available Options {allSelected && <span className="text-gray-500 dark:text-gray-400">(All selected)</span>}
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {allSelected ? 'Select specific options to limit choices, or leave all selected for all options' : 'Only checked options will be available to customers'}
      </p>
      <div className="space-y-1">
        {options.map((option) => {
          const isChecked = allSelected || availableOptionIds.includes(option.id);
          return (
            <label
              key={option.id}
              className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleOption(option.id)}
                className="w-3 h-3 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-gray-700 dark:text-gray-200">{option.name}</span>
              {option.priceModifier !== 0 && (
                <span className="text-gray-500 dark:text-gray-400">
                  ({option.priceModifier > 0 ? '+' : ''}{formatCurrency(option.priceModifier)})
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
};

interface DealItemSelection {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  sortOrder: number;
  hasVariants: boolean;
}

export const Deals: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [selectedDealItems, setSelectedDealItems] = useState<DealItemSelection[]>([]);
  const [selectedDealVariants, setSelectedDealVariants] = useState<{ variantId: string; isRequired: boolean; selectionMode: 'single' | 'multiple' | 'all'; availableOptionIds: string[] }[]>([]);
  const [viewingDealItems, setViewingDealItems] = useState<{
    deal: Deal;
    items: Array<DealItem & { menuItemName: string }>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const itemSearchRef = useRef<HTMLDivElement>(null);
  const [variantSearchQuery, setVariantSearchQuery] = useState('');
  const [isVariantDropdownOpen, setIsVariantDropdownOpen] = useState(false);
  const variantSearchRef = useRef<HTMLDivElement>(null);
  const [isNewVariantModalOpen, setIsNewVariantModalOpen] = useState(false);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantType, setNewVariantType] = useState<'size' | 'flavour' | 'custom'>('custom');
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);
  const [newVariantOptions, setNewVariantOptions] = useState<{ name: string; priceModifier: number }[]>([]);
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionPrice, setNewOptionPrice] = useState(0);

  // New Item Modal state
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(0);
  const [newItemCategoryId, setNewItemCategoryId] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [isCreatingItem, setIsCreatingItem] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      name: '',
      description: null,
      price: 0,
      categoryId: null,
      isActive: true,
    },
  });

  const selectedCategoryId = watch('categoryId');

  useEffect(() => {
    loadData();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (itemSearchRef.current && !itemSearchRef.current.contains(event.target as Node)) {
        setIsItemDropdownOpen(false);
      }
      if (variantSearchRef.current && !variantSearchRef.current.contains(event.target as Node)) {
        setIsVariantDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    const allDeals = await db.deals.toArray();
    setDeals(allDeals);

    const cats = await getAllCategories();
    setCategories(cats.filter((c) => c.isActive));

    const vars = await getAllVariants();
    setVariants(vars);

    const items = await getAllMenuItems();
    // Include all active items (both regular and deal-only) for deal creation
    setMenuItems(items.filter((i) => i.isActive));
  };

  const onSubmit = async (data: DealFormData) => {
    if (!currentUser) return;

    if (selectedDealItems.length === 0) {
      await dialog.alert('Please add at least one item to the deal', 'Validation Error');
      return;
    }

    const dealHasVariants = selectedDealItems.some((item) => item.hasVariants) || selectedDealVariants.length > 0;

    setIsLoading(true);
    try {
      let dealId: string;

      if (editingDeal) {
        // Update existing deal
        await updateDeal(editingDeal.id, { ...data, hasVariants: dealHasVariants }, currentUser.id);
        dealId = editingDeal.id;

        // Delete old deal items and create new ones
        await db.dealItems.where('dealId').equals(editingDeal.id).delete();

        for (const item of selectedDealItems) {
          await db.dealItems.add({
            id: createId(),
            dealId: editingDeal.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            requiresVariantSelection: item.hasVariants,
            sortOrder: item.sortOrder,
            createdAt: new Date(),
          });
        }
      } else {
        // Create new deal
        const newDeal = await createDeal(
          { ...data, hasVariants: dealHasVariants },
          selectedDealItems.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            requiresVariantSelection: item.hasVariants,
            sortOrder: item.sortOrder,
          })),
          currentUser.id
        );
        dealId = newDeal.id;
      }

      // Save deal variant assignments
      if (selectedDealVariants.length > 0) {
        await setDealVariants(dealId, selectedDealVariants, currentUser.id);
      } else {
        // Clear variants if none selected
        await setDealVariants(dealId, [], currentUser.id);
      }

      await loadData();
      closeModal();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to save deal', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (deal: Deal) => {
    setEditingDeal(deal);
    reset({
      name: deal.name,
      description: deal.description,
      price: deal.price,
      categoryId: deal.categoryId,
      isActive: deal.isActive,
    });

    // Load deal items
    const items = await getDealItems(deal.id);
    const itemsWithNames = await Promise.all(
      items.map(async (item) => {
        const menuItem = await db.menuItems.get(item.menuItemId);
        return {
          menuItemId: item.menuItemId,
          menuItemName: menuItem?.name || 'Unknown',
          quantity: item.quantity,
          sortOrder: item.sortOrder,
          hasVariants: menuItem?.hasVariants ?? false,
        };
      })
    );
    setSelectedDealItems(itemsWithNames);

    // Load existing deal variant assignments
    if (deal.hasVariants) {
      const dealVariants = await getDealVariants(deal.id);
      setSelectedDealVariants(
        dealVariants.map((dv) => ({
          variantId: dv.variantId,
          isRequired: dv.isRequired,
          selectionMode: dv.selectionMode || 'single', // Default to 'single' for backward compatibility
          availableOptionIds: dv.availableOptionIds || [] // Empty array means all options available
        }))
      );
    } else {
      setSelectedDealVariants([]);
    }

    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!currentUser) return;

    const confirmed = await dialog.confirm({
      title: 'Delete Deal',
      message: 'Are you sure you want to delete this deal?',
      variant: 'danger',
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      await deleteDeal(id, currentUser.id);
      await loadData();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to delete deal', 'Error');
    }
  };

  const handleViewItems = async (deal: Deal) => {
    const items = await getDealItems(deal.id);
    const itemsWithNames = await Promise.all(
      items.map(async (item) => {
        const menuItem = await db.menuItems.get(item.menuItemId);
        return {
          ...item,
          menuItemName: menuItem?.name || 'Unknown',
        };
      })
    );

    setViewingDealItems({ deal, items: itemsWithNames });
    setIsItemsModalOpen(true);
  };

  const handleAddItemToDeal = async (menuItemId: string) => {
    const menuItem = menuItems.find((m) => m.id === menuItemId);
    if (!menuItem) return;

    // Check if already added
    if (selectedDealItems.find((i) => i.menuItemId === menuItemId)) {
      await dialog.alert('Item already added to this deal', 'Duplicate Item');
      return;
    }

    setSelectedDealItems([
      ...selectedDealItems,
      {
        menuItemId,
        menuItemName: menuItem.name,
        quantity: 1,
        sortOrder: selectedDealItems.length,
        hasVariants: menuItem.hasVariants,
      },
    ]);
  };

  const handleUpdateItemQuantity = (menuItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setSelectedDealItems(selectedDealItems.filter((i) => i.menuItemId !== menuItemId));
    } else {
      setSelectedDealItems(
        selectedDealItems.map((i) =>
          i.menuItemId === menuItemId ? { ...i, quantity: newQuantity } : i
        )
      );
    }
  };

  const handleRemoveItemFromDeal = (menuItemId: string) => {
    setSelectedDealItems(selectedDealItems.filter((i) => i.menuItemId !== menuItemId));
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDeal(null);
    setSelectedDealItems([]);
    setSelectedDealVariants([]);
    setItemSearchQuery('');
    setIsItemDropdownOpen(false);
    setVariantSearchQuery('');
    setIsVariantDropdownOpen(false);
    reset({
      name: '',
      description: null,
      price: 0,
      categoryId: null,
      isActive: true,
    });
  };

  const handleCreateNewVariant = async () => {
    if (!currentUser || !newVariantName.trim()) return;

    setIsCreatingVariant(true);
    try {
      const newVariant = await createVariant(
        {
          name: newVariantName.trim(),
          type: newVariantType,
          sortOrder: variants.length,
          isActive: true,
        },
        currentUser.id
      );

      // Create variant options if any were added
      for (let i = 0; i < newVariantOptions.length; i++) {
        const opt = newVariantOptions[i];
        await createVariantOption(
          {
            variantId: newVariant.id,
            name: opt.name,
            priceModifier: opt.priceModifier,
            sortOrder: i,
            isActive: true,
          },
          currentUser.id
        );
      }

      // Reload variants and auto-select the new one
      const vars = await getAllVariants();
      setVariants(vars);
      setSelectedDealVariants((prev) => [
        ...prev,
        { variantId: newVariant.id, isRequired: false, selectionMode: 'single', availableOptionIds: [] },
      ]);
      setIsNewVariantModalOpen(false);
      setNewVariantName('');
      setNewVariantType('custom');
      setNewVariantOptions([]);
      setNewOptionName('');
      setNewOptionPrice(0);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to create variant', 'Error');
    } finally {
      setIsCreatingVariant(false);
    }
  };

  const handleAddNewOption = () => {
    if (!newOptionName.trim()) return;
    setNewVariantOptions([...newVariantOptions, { name: newOptionName.trim(), priceModifier: newOptionPrice }]);
    setNewOptionName('');
    setNewOptionPrice(0);
  };

  const handleRemoveNewOption = (index: number) => {
    setNewVariantOptions(newVariantOptions.filter((_, i) => i !== index));
  };

  const handleCreateNewItem = async () => {
    if (!currentUser || !newItemName.trim()) return;

    setIsCreatingItem(true);
    try {
      const newItem = await createMenuItem(
        {
          name: newItemName.trim(),
          description: newItemDescription || null,
          price: newItemPrice,
          categoryId: newItemCategoryId,
          isActive: true,
          isDealOnly: true, // Mark as deal-only item
          hasVariants: false,
        },
        currentUser.id
      );

      // Reload menu items
      const items = await getAllMenuItems();
      setMenuItems(items.filter((i) => i.isActive));
      
      // Directly add the new item to selectedDealItems (don't use handleAddItemToDeal 
      // since menuItems state hasn't updated yet)
      setSelectedDealItems((prev) => [
        ...prev,
        {
          menuItemId: newItem.id,
          menuItemName: newItem.name,
          quantity: 1,
          sortOrder: prev.length,
          hasVariants: false,
        },
      ]);
      
      // Close modal and reset form
      setIsNewItemModalOpen(false);
      setNewItemName('');
      setNewItemPrice(0);
      setNewItemCategoryId('');
      setNewItemDescription('');
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to create item', 'Error');
    } finally {
      setIsCreatingItem(false);
    }
  };

  const toggleDealVariantSelection = (variantId: string) => {
    setSelectedDealVariants((prev) => {
      const exists = prev.find((v) => v.variantId === variantId);
      if (exists) {
        return prev.filter((v) => v.variantId !== variantId);
      }
      return [...prev, { variantId, isRequired: false, selectionMode: 'single', availableOptionIds: [] }];
    });
  };

  const toggleDealVariantRequired = (variantId: string) => {
    setSelectedDealVariants((prev) =>
      prev.map((v) =>
        v.variantId === variantId ? { ...v, isRequired: !v.isRequired } : v
      )
    );
  };

  const updateDealVariantSelectionMode = (variantId: string, selectionMode: 'single' | 'multiple' | 'all') => {
    setSelectedDealVariants((prev) =>
      prev.map((v) =>
        v.variantId === variantId ? { ...v, selectionMode } : v
      )
    );
  };

  const toggleDealVariantOption = (variantId: string, optionId: string) => {
    setSelectedDealVariants((prev) =>
      prev.map((v) => {
        if (v.variantId === variantId) {
          const availableOptionIds = v.availableOptionIds || [];
          if (availableOptionIds.includes(optionId)) {
            // Remove option
            return { ...v, availableOptionIds: availableOptionIds.filter(id => id !== optionId) };
          } else {
            // Add option
            return { ...v, availableOptionIds: [...availableOptionIds, optionId] };
          }
        }
        return v;
      })
    );
  };

  const filteredDeals = deals.filter((deal) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!deal.name.toLowerCase().includes(query) && 
          !(deal.description?.toLowerCase().includes(query))) {
        return false;
      }
    }

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && deal.isActive) ||
      (filterStatus === 'inactive' && !deal.isActive);

    let matchesCategory = true;
    if (filterCategory !== 'all') {
      if (!deal.categoryId) {
        matchesCategory = false;
      } else {
        const selectedCategory = categories.find((cat) => cat.id === filterCategory);
        if (selectedCategory?.type === 'major') {
          const subIds = categories
            .filter((cat) => cat.parentId === selectedCategory.id)
            .map((cat) => cat.id);
          const validIds = new Set([selectedCategory.id, ...subIds]);
          matchesCategory = validIds.has(deal.categoryId);
        } else {
          matchesCategory = deal.categoryId === filterCategory;
        }
      }
    }

    return matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Deals Management</h1>
        <Button
          onClick={() => setIsModalOpen(true)}
          leftIcon={<PlusIcon className="w-5 h-5" />}
        >
          Add Deal
        </Button>
      </div>

      {/* Filter */}
      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deals..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <CategoryFilter
            categories={categories}
            value={filterCategory === 'all' ? '' : filterCategory}
            onChange={(value) => setFilterCategory(value || 'all')}
          />
          <Select
            label="Filter by Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All Deals</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </Select>
        </div>
      </Card>

      {/* Deals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDeals.map((deal) => (
          <Card key={deal.id} padding="md" hoverable>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-semibold text-gray-900 text-lg">{deal.name}</h3>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      deal.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {deal.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {deal.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{deal.description}</p>
                )}
                <p className="text-2xl font-bold text-primary-600">
                  {formatCurrency(deal.price)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleViewItems(deal)}
              >
                View Items
              </Button>
              <div className="flex items-center space-x-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(deal)}
                >
                  <PencilIcon className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(deal.id)}
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {filteredDeals.length === 0 && (
          <div className="col-span-full">
            <Card padding="lg">
              <div className="text-center text-gray-500 py-12">
                <p>{deals.length === 0 ? 'No deals yet. Create your first combo deal.' : 'No deals found matching the filter.'}</p>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Add/Edit Deal Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingDeal ? 'Edit Deal' : 'Add Deal'}
        size="lg"
        preventBackdropClose={isNewVariantModalOpen || isNewItemModalOpen}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Deal Name"
            error={errors.name?.message}
            placeholder="e.g., Family Meal Deal"
            {...register('name')}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={2}
              placeholder="Brief description of the deal..."
              {...register('description')}
            />
          </div>

          <Input
            label="Deal Price (Rs)"
            type="number"
            step="0.01"
            error={errors.price?.message}
            {...register('price', { valueAsNumber: true })}
          />

          <input type="hidden" {...register('categoryId')} />
          <CategoryFilter
            categories={categories}
            value={selectedCategoryId || ''}
            onChange={(value) => {
              setValue('categoryId', value || null, { shouldDirty: true });
            }}
            label="Category (Optional)"
            placeholder="No Category"
          />

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              {...register('isActive')}
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Active
            </label>
          </div>

          {/* Deal Items Section */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-900">
                Deal Items
                {selectedDealItems.length === 0 && (
                  <span className="text-red-600 ml-1">* (Required)</span>
                )}
              </label>
              <span className="text-sm text-gray-600">
                {selectedDealItems.length} item(s)
              </span>
            </div>

            {/* Add Item Selector with Search */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Add Menu Item
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative" ref={itemSearchRef}>
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={itemSearchQuery}
                      onChange={(e) => {
                        setItemSearchQuery(e.target.value);
                        setIsItemDropdownOpen(true);
                      }}
                      onFocus={() => setIsItemDropdownOpen(true)}
                      placeholder="Search items to add..."
                      className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  {isItemDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                      {menuItems
                        .filter((item) => {
                          const query = itemSearchQuery.toLowerCase();
                          return (
                            item.name.toLowerCase().includes(query) &&
                            !selectedDealItems.find((i) => i.menuItemId === item.id)
                          );
                        })
                        .map((item, index, arr) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              handleAddItemToDeal(item.id);
                              setItemSearchQuery('');
                              setIsItemDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors flex items-center justify-between ${
                              index !== arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                            }`}
                          >
                            <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                            <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                              {formatCurrency(item.price)}
                            </span>
                          </button>
                        ))}
                      {menuItems.filter((item) => {
                        const query = itemSearchQuery.toLowerCase();
                        return (
                          item.name.toLowerCase().includes(query) &&
                          !selectedDealItems.find((i) => i.menuItemId === item.id)
                        );
                      }).length === 0 && (
                      <div className="px-4 py-4 text-gray-500 dark:text-gray-400 text-center text-sm">
                        {itemSearchQuery ? 'No items found' : 'All items already added'}
                      </div>
                    )}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsNewItemModalOpen(true)}
                  leftIcon={<PlusIcon className="w-4 h-4" />}
                  className="h-[42px]"
                >
                  New
                </Button>
              </div>
            </div>

            {/* Selected Items List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedDealItems.map((item) => (
                <div
                  key={item.menuItemId}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.menuItemName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Quantity: {item.quantity}</p>
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    <button
                      type="button"
                      onClick={() => handleUpdateItemQuantity(item.menuItemId, item.quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium transition-colors"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-semibold text-gray-900 dark:text-gray-100">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateItemQuantity(item.menuItemId, item.quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium transition-colors"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveItemFromDeal(item.menuItemId)}
                      className="ml-1 p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}

              {selectedDealItems.length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">
                  No items added yet. Select items from the dropdown above.
                </div>
              )}
            </div>
          </div>

          {/* Deal Variants Section */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                Deal Variants (Optional)
              </label>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedDealVariants.length} selected
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Choose variants that apply to the entire deal. Customers will select these when ordering the deal.
            </p>

            {/* Search and Add Variant */}
            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative" ref={variantSearchRef}>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={variantSearchQuery}
                    onChange={(e) => {
                      setVariantSearchQuery(e.target.value);
                      setIsVariantDropdownOpen(true);
                    }}
                    onFocus={() => setIsVariantDropdownOpen(true)}
                    placeholder="Search variants to add..."
                    className="block w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
                {isVariantDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {variants
                      .filter((v) => v.isActive)
                      .filter((v) => {
                        const query = variantSearchQuery.toLowerCase();
                        return (
                          v.name.toLowerCase().includes(query) &&
                          !selectedDealVariants.find((sv) => sv.variantId === v.id)
                        );
                      })
                      .map((variant, index, arr) => (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => {
                            toggleDealVariantSelection(variant.id);
                            setVariantSearchQuery('');
                            setIsVariantDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors flex items-center justify-between ${
                            index !== arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                          }`}
                        >
                          <span className="font-medium text-gray-900 dark:text-gray-100">{variant.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                            {variant.type}
                          </span>
                        </button>
                      ))}
                    {variants
                      .filter((v) => v.isActive)
                      .filter((v) => {
                        const query = variantSearchQuery.toLowerCase();
                        return (
                          v.name.toLowerCase().includes(query) &&
                          !selectedDealVariants.find((sv) => sv.variantId === v.id)
                        );
                      }).length === 0 && (
                      <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center text-sm">
                        {variantSearchQuery ? 'No variants found' : 'All variants already added'}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setIsNewVariantModalOpen(true)}
                leftIcon={<PlusIcon className="w-4 h-4" />}
              >
                New
              </Button>
            </div>

            {/* Selected Variants List */}
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {selectedDealVariants.map((sv) => {
                const variant = variants.find((v) => v.id === sv.variantId);
                if (!variant) return null;
                return (
                  <div
                    key={variant.id}
                    className="border rounded-lg p-3 space-y-2 border-primary-500 bg-primary-50 dark:bg-primary-900/40 dark:border-primary-400"
                  >
                    {/* Variant header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{variant.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300 capitalize">
                          {variant.type}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleDealVariantSelection(variant.id)}
                        className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Selection Mode and Required options */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`deal-required-${variant.id}`}
                            checked={sv.isRequired}
                            onChange={() => toggleDealVariantRequired(variant.id)}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                          <label htmlFor={`deal-required-${variant.id}`} className="text-sm text-gray-600 dark:text-gray-300">
                            Required
                          </label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Mode:</label>
                          <select
                            value={sv.selectionMode}
                            onChange={(e) => updateDealVariantSelectionMode(
                              variant.id,
                              e.target.value as 'single' | 'multiple' | 'all'
                            )}
                            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            <option value="single">Select One</option>
                            <option value="multiple">Select Multiple</option>
                            <option value="all">Select All</option>
                          </select>
                        </div>
                      </div>

                      {/* Variant Options Selection */}
                      <VariantOptionsSelector
                        variant={variant}
                        availableOptionIds={sv.availableOptionIds || []}
                        onToggleOption={(optionId) => toggleDealVariantOption(variant.id, optionId)}
                      />
                    </div>
                  </div>
                );
              })}

              {selectedDealVariants.length === 0 && (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                  No variants added. Search above to add variants.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {editingDeal ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Deal Items Modal */}
      <Modal
        isOpen={isItemsModalOpen}
        onClose={() => setIsItemsModalOpen(false)}
        title={`Items in: ${viewingDealItems?.deal.name}`}
        size="md"
      >
        {viewingDealItems && (
          <div className="space-y-4">
            <div className="bg-primary-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Deal Price:</span>
                <span className="text-2xl font-bold text-primary-600">
                  {formatCurrency(viewingDealItems.deal.price)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {viewingDealItems.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{item.menuItemName}</p>
                    <p className="text-xs text-gray-600">Quantity: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={() => setIsItemsModalOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create New Variant Modal */}
      <Modal
        isOpen={isNewVariantModalOpen}
        onClose={() => {
          setIsNewVariantModalOpen(false);
          setNewVariantName('');
          setNewVariantType('custom');
          setNewVariantOptions([]);
          setNewOptionName('');
          setNewOptionPrice(0);
        }}
        title="Create New Variant"
        size="md"
        zIndex="z-[60]"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Variant Name
            </label>
            <input
              type="text"
              value={newVariantName}
              onChange={(e) => setNewVariantName(e.target.value)}
              placeholder="e.g., Size, Flavor, Crust Type"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <Select
            label="Variant Type"
            value={newVariantType}
            onChange={(e) => setNewVariantType(e.target.value as 'size' | 'flavour' | 'custom')}
          >
            <option value="size">Size</option>
            <option value="flavour">Flavour</option>
            <option value="custom">Custom</option>
          </Select>

          {/* Variant Options Section */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Variant Options (Optional)
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Add options for this variant (e.g., Small, Medium, Large for Size)
            </p>

            {/* Add Option Form */}
            <div className="grid grid-cols-12 gap-2 mb-3">
              <div className="col-span-5">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Option Name</label>
                <input
                  type="text"
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  placeholder="e.g., Large"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="col-span-4">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Price Modifier (Rs)</label>
                <input
                  type="number"
                  value={newOptionPrice}
                  onChange={(e) => setNewOptionPrice(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="col-span-3 flex items-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddNewOption}
                  disabled={!newOptionName.trim()}
                  className="w-full"
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Options List */}
            {newVariantOptions.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {newVariantOptions.map((opt, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{opt.name}</span>
                      {opt.priceModifier !== 0 && (
                        <span className={`text-sm ${opt.priceModifier > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {opt.priceModifier > 0 ? '+' : ''}{formatCurrency(opt.priceModifier)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveNewOption(index)}
                      className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {newVariantOptions.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center py-2">
                No options added yet. You can add them now or later.
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsNewVariantModalOpen(false);
                setNewVariantName('');
                setNewVariantType('custom');
                setNewVariantOptions([]);
                setNewOptionName('');
                setNewOptionPrice(0);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNewVariant}
              isLoading={isCreatingVariant}
              disabled={!newVariantName.trim()}
            >
              Create & Add
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create New Item Modal */}
      <Modal
        isOpen={isNewItemModalOpen}
        onClose={() => {
          setIsNewItemModalOpen(false);
          setNewItemName('');
          setNewItemPrice(0);
          setNewItemCategoryId('');
          setNewItemDescription('');
        }}
        title="Create Deal Item"
        size="md"
        zIndex="z-[60]"
        preventBackdropClose
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Create a new item that will only be available as part of deals.
          </p>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Item Name
            </label>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="e.g., Deal Burger, Combo Drink"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Price (Rs)
            </label>
            <input
              type="number"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(Number(e.target.value))}
              placeholder="0"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Set to 0 if the item price is included in the deal price.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category (Optional)
            </label>
            <CategoryFilter
              categories={categories}
              value={newItemCategoryId}
              onChange={setNewItemCategoryId}
              placeholder="Select category"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={newItemDescription}
              onChange={(e) => setNewItemDescription(e.target.value)}
              placeholder="Brief description of the item..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsNewItemModalOpen(false);
                setNewItemName('');
                setNewItemPrice(0);
                setNewItemCategoryId('');
                setNewItemDescription('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNewItem}
              isLoading={isCreatingItem}
              disabled={!newItemName.trim()}
            >
              Create & Add
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
