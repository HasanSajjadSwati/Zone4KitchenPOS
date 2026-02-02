import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button, Card, Modal, Input, Select, Badge, CategoryFilter } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getAllMenuItemsUnfiltered,
  getAllCategories,
  getAllVariants,
  getMenuItemVariants,
  setMenuItemVariants,
  getVariantOptions,
} from '@/services/menuService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { formatCurrency } from '@/utils/validation';
import type { MenuItem, Category, Variant } from '@/db/types';

const menuItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  price: z.number().min(0, 'Price must be positive'),
  description: z.string().nullable(),
  isActive: z.boolean(),
  isDealOnly: z.boolean(),
  hasVariants: z.boolean(),
});

type MenuItemFormData = z.infer<typeof menuItemSchema>;

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

export const MenuItems: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedVariants, setSelectedVariants] = useState<{ variantId: string; isRequired: boolean; selectionMode: 'single' | 'multiple' | 'all'; availableOptionIds: string[] }[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<MenuItemFormData>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: '',
      categoryId: '',
      price: 0,
      description: null,
      isActive: true,
      isDealOnly: false,
      hasVariants: false,
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [allItems, allCategories, allVariants] = await Promise.all([
      getAllMenuItemsUnfiltered(),
      getAllCategories(),
      getAllVariants(),
    ]);
    setItems(allItems);
    // Show all active categories (both major and sub) for item assignment
    setCategories(allCategories.filter((cat) => cat.isActive));
    setVariants(allVariants);
  };

  const onSubmit = async (data: MenuItemFormData) => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      let itemId: string;
      if (editingItem) {
        await updateMenuItem(editingItem.id, data, currentUser.id);
        itemId = editingItem.id;
      } else {
        const newItem = await createMenuItem(data, currentUser.id);
        itemId = newItem.id;
      }

      // Save variant assignments if hasVariants is enabled
      if (data.hasVariants && selectedVariants.length > 0) {
        await setMenuItemVariants(itemId, selectedVariants, currentUser.id);
      } else if (!data.hasVariants) {
        // Clear variants if hasVariants is disabled
        await setMenuItemVariants(itemId, [], currentUser.id);
      }

      await loadData();
      closeModal();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to save menu item', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (item: MenuItem) => {
    setEditingItem(item);
    reset({
      name: item.name,
      categoryId: item.categoryId,
      price: item.price,
      description: item.description,
      isActive: item.isActive,
      isDealOnly: item.isDealOnly,
      hasVariants: item.hasVariants,
    });

    // Load existing variant assignments
    if (item.hasVariants) {
      const itemVariants = await getMenuItemVariants(item.id);
      setSelectedVariants(
        itemVariants.map((iv) => ({
          variantId: iv.variantId,
          isRequired: iv.isRequired,
          selectionMode: iv.selectionMode || 'single', // Default to 'single' for backward compatibility
          availableOptionIds: iv.availableOptionIds || [] // Empty array means all options available
        }))
      );
    } else {
      setSelectedVariants([]);
    }

    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!currentUser) return;

    const confirmed = await dialog.confirm({
      title: 'Delete Menu Item',
      message: 'Are you sure you want to delete this menu item?',
      variant: 'danger',
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      await deleteMenuItem(id, currentUser.id);
      await loadData();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to delete menu item', 'Error');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setSelectedVariants([]);
    reset({
      name: '',
      categoryId: '',
      price: 0,
      description: null,
      isActive: true,
      isDealOnly: false,
      hasVariants: false,
    });
  };

  const toggleVariantSelection = (variantId: string) => {
    setSelectedVariants((prev) => {
      const exists = prev.find((v) => v.variantId === variantId);
      if (exists) {
        return prev.filter((v) => v.variantId !== variantId);
      }
      return [...prev, { variantId, isRequired: false, selectionMode: 'single', availableOptionIds: [] }];
    });
  };

  const toggleVariantRequired = (variantId: string) => {
    setSelectedVariants((prev) =>
      prev.map((v) =>
        v.variantId === variantId ? { ...v, isRequired: !v.isRequired } : v
      )
    );
  };

  const updateVariantSelectionMode = (variantId: string, selectionMode: 'single' | 'multiple' | 'all') => {
    setSelectedVariants((prev) =>
      prev.map((v) =>
        v.variantId === variantId ? { ...v, selectionMode } : v
      )
    );
  };

  const toggleVariantOption = (variantId: string, optionId: string) => {
    setSelectedVariants((prev) =>
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

  const getCategoryName = (categoryId: string) => {
    return categories.find((cat) => cat.id === categoryId)?.name || 'Unknown';
  };

  const sortCategories = (a: Category, b: Category) => {
    const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  };

  const majorCategories = categories.filter((cat) => cat.type === 'major').sort(sortCategories);
  const subCategories = categories.filter((cat) => cat.type === 'sub').sort(sortCategories);
  const majorCategoryIds = new Set(majorCategories.map((cat) => cat.id));

  const subCategoriesByParent = new Map<string, Category[]>();
  majorCategories.forEach((major) => {
    const subs = subCategories.filter((cat) => cat.parentId === major.id);
    subCategoriesByParent.set(major.id, subs);
  });
  const orphanSubCategories = subCategories.filter(
    (cat) => !cat.parentId || !majorCategoryIds.has(cat.parentId)
  );

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesCategory = true;

    if (filterCategory !== 'all') {
      const selectedCategory = categories.find((cat) => cat.id === filterCategory);
      if (selectedCategory?.type === 'major') {
        const subIds = categories
          .filter((cat) => cat.parentId === selectedCategory.id)
          .map((cat) => cat.id);
        const validIds = new Set([selectedCategory.id, ...subIds]);
        matchesCategory = validIds.has(item.categoryId);
      } else {
        matchesCategory = item.categoryId === filterCategory;
      }
    }

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && item.isActive) ||
      (filterStatus === 'inactive' && !item.isActive);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Menu Items</h1>
        <Button
          onClick={() => setIsModalOpen(true)}
          leftIcon={<PlusIcon className="w-5 h-5" />}
        >
          Add Menu Item
        </Button>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Search"
            placeholder="Search menu items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
            <option value="all">All Items</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </Select>
        </div>
      </Card>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <Card key={item.id} padding="none" hoverable>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {getCategoryName(item.categoryId)}
                  </p>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <Badge variant={item.isActive ? 'success' : 'default'} size="sm">
                    {item.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {item.hasVariants && (
                    <Badge variant="primary" size="sm">
                      Has Variants
                    </Badge>
                  )}
                  {item.isDealOnly && (
                    <Badge variant="warning" size="sm">
                      Deal Only
                    </Badge>
                  )}
                </div>
              </div>

              {item.description && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                  {item.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <span className="text-xl font-bold text-primary-600">
                  {formatCurrency(item.price)}
                </span>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(item)}
                    leftIcon={<PencilIcon className="w-4 h-4" />}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(item.id)}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <Card padding="lg">
          <div className="text-center text-gray-500">
            <p>No menu items found. Click "Add Menu Item" to create one.</p>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Item Name"
            error={errors.name?.message}
            {...register('name')}
          />

            <Select label="Category" error={errors.categoryId?.message} {...register('categoryId')}>
              <option value="">Select category</option>
              {majorCategories.map((major) => (
                <optgroup key={major.id} label={major.name}>
                  <option value={major.id}>{major.name} (Major)</option>
                  {(subCategoriesByParent.get(major.id) || []).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      -- {sub.name}
                    </option>
                  ))}
                </optgroup>
              ))}
              {orphanSubCategories.length > 0 && (
                <optgroup label="Other Subcategories">
                  {orphanSubCategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      -- {sub.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>

          <Input
            label="Price (Rs)"
            type="number"
            step="0.01"
            error={errors.price?.message}
            {...register('price', { valueAsNumber: true })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              {...register('description')}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-danger-600">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
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

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isDealOnly"
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                {...register('isDealOnly')}
              />
              <label htmlFor="isDealOnly" className="text-sm font-medium text-gray-700">
                Deal Only (Hide from regular menu)
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="hasVariants"
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                {...register('hasVariants')}
              />
              <label htmlFor="hasVariants" className="text-sm font-medium text-gray-700">
                Has Variants (Size, Flavor, etc.)
              </label>
            </div>
          </div>

          {/* Variant Selection - shown when hasVariants is checked */}
          {watch('hasVariants') && variants.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Select Variants for this Item
              </label>
              <p className="text-xs text-gray-500">
                Choose which variants apply to this item. Mark as required if customer must select an option.
              </p>
              <div className="space-y-3">
                {variants.map((variant) => {
                  const selected = selectedVariants.find((v) => v.variantId === variant.id);
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
                          onChange={() => toggleVariantSelection(variant.id)}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <div>
                          <span className="font-medium text-gray-900">{variant.name}</span>
                          <span className="ml-2 text-xs text-gray-500 capitalize">({variant.type})</span>
                        </div>
                      </div>

                      {/* Selection Mode and Required options - shown when variant is selected */}
                      {isSelected && (
                        <div className="ml-7 space-y-2">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`required-${variant.id}`}
                                checked={isRequired}
                                onChange={() => toggleVariantRequired(variant.id)}
                                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                              />
                              <label htmlFor={`required-${variant.id}`} className="text-sm text-gray-600">
                                Required
                              </label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <label className="text-xs text-gray-600 font-medium">Selection Mode:</label>
                              <select
                                value={selectionMode}
                                onChange={(e) => updateVariantSelectionMode(
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
                            onToggleOption={(optionId) => toggleVariantOption(variant.id, optionId)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {watch('hasVariants') && variants.length === 0 && (
            <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                No variants available. Please create variants first in the Variants section.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
