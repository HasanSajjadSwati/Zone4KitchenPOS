import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
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
    <div className="mt-2 pt-2 border-t border-gray-200">
      <label className="block text-xs font-medium text-gray-700 mb-1">
        Available Options {allSelected && <span className="text-gray-500">(All selected)</span>}
      </label>
      <p className="text-xs text-gray-500 mb-2">
        {allSelected ? 'Select specific options to limit choices, or leave all selected for all options' : 'Only checked options will be available to customers'}
      </p>
      <div className="space-y-1">
        {options.map((option) => {
          const isChecked = allSelected || availableOptionIds.includes(option.id);
          return (
            <label
              key={option.id}
              className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleOption(option.id)}
                className="w-3 h-3 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-gray-700">{option.name}</span>
              {option.priceModifier !== 0 && (
                <span className="text-gray-500">
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

  const {
    register,
    handleSubmit,
    reset,
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

  useEffect(() => {
    loadData();
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
    reset({
      name: '',
      description: null,
      price: 0,
      categoryId: null,
      isActive: true,
    });
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <Select
            label="Category (Optional)"
            {...register('categoryId')}
          >
            <option value="">No Category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>

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

            {/* Add Item Selector */}
            <div className="mb-3">
              <Select
                label="Add Menu Item"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddItemToDeal(e.target.value);
                    e.target.value = '';
                  }
                }}
              >
                <option value="">Select item to add...</option>
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {formatCurrency(item.price)}
                  </option>
                ))}
              </Select>
            </div>

            {/* Selected Items List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedDealItems.map((item) => (
                <div
                  key={item.menuItemId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.menuItemName}</p>
                    <p className="text-xs text-gray-600">Quantity: {item.quantity}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateItemQuantity(item.menuItemId, item.quantity - 1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateItemQuantity(item.menuItemId, item.quantity + 1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveItemFromDeal(item.menuItemId)}
                      className="ml-2 text-red-600 hover:text-red-800"
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
          {variants.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Deal Variants (Optional)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Choose variants that apply to the entire deal. Customers will select these when ordering the deal.
              </p>
              <div className="space-y-3">
                {variants.map((variant) => {
                  const selected = selectedDealVariants.find((v) => v.variantId === variant.id);
                  const isSelected = !!selected;
                  const isRequired = selected?.isRequired || false;
                  const selectionMode = selected?.selectionMode || 'single';
                  return (
                    <div
                      key={variant.id}
                      className={`border rounded-lg p-3 space-y-2 ${
                        isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                      }`}
                    >
                      {/* Variant checkbox */}
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDealVariantSelection(variant.id)}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <div>
                          <span className="font-medium text-gray-900">{variant.name}</span>
                          <span className="ml-2 text-xs text-gray-500 capitalize">({variant.type})</span>
                        </div>
                      </div>

                      {/* Selection Mode and Required options */}
                      {isSelected && (
                        <div className="ml-7 space-y-2">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`deal-required-${variant.id}`}
                                checked={isRequired}
                                onChange={() => toggleDealVariantRequired(variant.id)}
                                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                              />
                              <label htmlFor={`deal-required-${variant.id}`} className="text-sm text-gray-600">
                                Required
                              </label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <label className="text-xs text-gray-600 font-medium">Selection Mode:</label>
                              <select
                                value={selectionMode}
                                onChange={(e) => updateDealVariantSelectionMode(
                                  variant.id,
                                  e.target.value as 'single' | 'multiple' | 'all'
                                )}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                              >
                                <option value="single">Select One (Radio)</option>
                                <option value="multiple">Select Multiple (Checkbox)</option>
                                <option value="all">Select All (Pre-selected)</option>
                              </select>
                            </div>
                          </div>

                          {/* Helper text */}
                          <p className="text-xs text-gray-500">
                            {selectionMode === 'single' && 'Customer picks exactly one option'}
                            {selectionMode === 'multiple' && 'Customer can pick multiple options'}
                            {selectionMode === 'all' && 'All options are pre-selected (customer can unselect)'}
                          </p>

                          {/* Variant Options Selection */}
                          <VariantOptionsSelector
                            variant={variant}
                            availableOptionIds={selected?.availableOptionIds || []}
                            onToggleOption={(optionId) => toggleDealVariantOption(variant.id, optionId)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
    </div>
  );
};
