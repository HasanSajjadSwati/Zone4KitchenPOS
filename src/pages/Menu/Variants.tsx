import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button, Card, Modal, Input, Select, Badge } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createVariant,
  updateVariant,
  deleteVariant,
  getAllVariants,
  createVariantOption,
  getVariantOptions,
  deleteVariantOption,
} from '@/services/menuService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { formatCurrency } from '@/utils/validation';
import type { Variant, VariantOption } from '@/db/types';

const variantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['size', 'flavour', 'custom']),
  sortOrder: z.number().min(0),
  isActive: z.boolean(),
});

const optionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  priceModifier: z.number(),
  sortOrder: z.number().min(0),
  isActive: z.boolean(),
});

type VariantFormData = z.infer<typeof variantSchema>;
type OptionFormData = z.infer<typeof optionSchema>;

export const Variants: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);

  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const variantForm = useForm<VariantFormData>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      name: '',
      type: 'size',
      sortOrder: 0,
      isActive: true,
    },
  });

  const optionForm = useForm<OptionFormData>({
    resolver: zodResolver(optionSchema),
    defaultValues: {
      name: '',
      priceModifier: 0,
      sortOrder: 0,
      isActive: true,
    },
  });

  useEffect(() => {
    loadVariants();
  }, []);

  useEffect(() => {
    if (selectedVariant) {
      loadOptions(selectedVariant.id);
    }
  }, [selectedVariant]);

  const loadVariants = async () => {
    const allVariants = await getAllVariants();
    setVariants(allVariants);
    if (allVariants.length > 0 && !selectedVariant) {
      setSelectedVariant(allVariants[0]);
    }
  };

  const loadOptions = async (variantId: string) => {
    const options = await getVariantOptions(variantId);
    setVariantOptions(options);
  };

  const onSubmitVariant = async (data: VariantFormData) => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      if (editingVariant) {
        await updateVariant(editingVariant.id, data, currentUser.id);
      } else {
        await createVariant(data, currentUser.id);
      }
      await loadVariants();
      closeVariantModal();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to save variant', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitOption = async (data: OptionFormData) => {
    if (!currentUser || !selectedVariant) return;

    setIsLoading(true);
    try {
      await createVariantOption(
        {
          variantId: selectedVariant.id,
          ...data,
        },
        currentUser.id
      );
      await loadOptions(selectedVariant.id);
      closeOptionModal();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to save option', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditVariant = (variant: Variant) => {
    setEditingVariant(variant);
    variantForm.reset({
      name: variant.name,
      type: variant.type,
      sortOrder: variant.sortOrder,
      isActive: variant.isActive,
    });
    setIsVariantModalOpen(true);
  };

  const handleDeleteVariant = async (id: string) => {
    if (!currentUser) return;

    const confirmed = await dialog.confirm({
      title: 'Delete Variant',
      message: 'Are you sure? This will delete all options and remove this variant from all items.',
      variant: 'danger',
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      await deleteVariant(id, currentUser.id);
      await loadVariants();
      if (selectedVariant?.id === id) {
        setSelectedVariant(variants.length > 1 ? variants[0] : null);
      }
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to delete variant', 'Error');
    }
  };

  const handleDeleteOption = async (id: string) => {
    if (!currentUser || !selectedVariant) return;

    const confirmed = await dialog.confirm({
      title: 'Delete Option',
      message: 'Are you sure you want to delete this option?',
      variant: 'danger',
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      await deleteVariantOption(id, currentUser.id);
      await loadOptions(selectedVariant.id);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to delete option', 'Error');
    }
  };

  const closeVariantModal = () => {
    setIsVariantModalOpen(false);
    setEditingVariant(null);
    variantForm.reset({
      name: '',
      type: 'size',
      sortOrder: 0,
      isActive: true,
    });
  };

  const closeOptionModal = () => {
    setIsOptionModalOpen(false);
    optionForm.reset({
      name: '',
      priceModifier: 0,
      sortOrder: 0,
      isActive: true,
    });
  };

  const filteredVariants = variants.filter((variant) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return variant.isActive;
    if (filterStatus === 'inactive') return !variant.isActive;
    return true;
  });

  const filteredOptions = variantOptions.filter((option) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return option.isActive;
    if (filterStatus === 'inactive') return !option.isActive;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Variants & Options</h1>
        <Button
          onClick={() => setIsVariantModalOpen(true)}
          leftIcon={<PlusIcon className="w-5 h-5" />}
        >
          Add Variant
        </Button>
      </div>

      {/* Filter */}
      <Card padding="md">
        <div className="max-w-xs">
          <Select
            label="Filter by Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </Select>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Variant List */}
        <Card padding="none">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Variant Types</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {filteredVariants.map((variant) => (
              <div
                key={variant.id}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                  selectedVariant?.id === variant.id ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                }`}
                onClick={() => setSelectedVariant(variant)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{variant.name}</h3>
                  <Badge
                    variant={variant.isActive ? 'success' : 'default'}
                    size="sm"
                  >
                    {variant.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 capitalize">{variant.type}</span>
                  <div className="flex items-center space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditVariant(variant);
                      }}
                    >
                      <PencilIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVariant(variant.id);
                      }}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {filteredVariants.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <p>No variants found</p>
                <p className="text-sm mt-1">{variants.length === 0 ? 'Create your first variant type' : 'Try changing the filter'}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Right: Options List */}
        <div className="lg:col-span-2">
          {selectedVariant ? (
            <Card padding="none">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">
                    Options for: {selectedVariant.name}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Define the available options and their price modifiers
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsOptionModalOpen(true)}
                  leftIcon={<PlusIcon className="w-5 h-5" />}
                >
                  Add Option
                </Button>
              </div>

              <div className="p-4">
                <div className="space-y-2">
                  {filteredOptions.map((option) => (
                    <div
                      key={option.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="font-medium text-gray-900">
                            {option.name}
                          </span>
                          <Badge
                            variant={option.isActive ? 'success' : 'default'}
                            size="sm"
                          >
                            {option.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                          <span>
                            Price Modifier:{' '}
                            <span
                              className={`font-semibold ${
                                option.priceModifier > 0
                                  ? 'text-green-600'
                                  : option.priceModifier < 0
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                              }`}
                            >
                              {option.priceModifier > 0 ? '+' : ''}
                              {formatCurrency(option.priceModifier)}
                            </span>
                          </span>
                          <span>Sort: {option.sortOrder}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDeleteOption(option.id)}
                        leftIcon={<TrashIcon className="w-4 h-4" />}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}

                  {filteredOptions.length === 0 && (
                    <div className="py-12 text-center text-gray-500">
                      <p>No options found</p>
                      <p className="text-sm mt-1">
                        {variantOptions.length === 0 ? 'Add options like Small, Medium, Large' : 'Try changing the filter'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card padding="lg">
              <div className="text-center text-gray-500 py-12">
                <p>Select a variant type to manage its options</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Variant Modal */}
      <Modal
        isOpen={isVariantModalOpen}
        onClose={closeVariantModal}
        title={editingVariant ? 'Edit Variant' : 'Add Variant'}
        size="md"
      >
        <form onSubmit={variantForm.handleSubmit(onSubmitVariant)} className="space-y-4">
          <Input
            label="Variant Name"
            placeholder="e.g., Size, Flavor, Spice Level"
            error={variantForm.formState.errors.name?.message}
            {...variantForm.register('name')}
          />

          <Select
            label="Type"
            error={variantForm.formState.errors.type?.message}
            options={[
              { value: 'size', label: 'Size' },
              { value: 'flavour', label: 'Flavour' },
              { value: 'custom', label: 'Custom' },
            ]}
            {...variantForm.register('type')}
          />

          <Input
            label="Sort Order"
            type="number"
            error={variantForm.formState.errors.sortOrder?.message}
            {...variantForm.register('sortOrder', { valueAsNumber: true })}
          />

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="variantActive"
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              {...variantForm.register('isActive')}
            />
            <label htmlFor="variantActive" className="text-sm font-medium text-gray-700">
              Active
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeVariantModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {editingVariant ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Option Modal */}
      <Modal
        isOpen={isOptionModalOpen}
        onClose={closeOptionModal}
        title="Add Option"
        size="md"
      >
        <form onSubmit={optionForm.handleSubmit(onSubmitOption)} className="space-y-4">
          <Input
            label="Option Name"
            placeholder="e.g., Small, Medium, Large"
            error={optionForm.formState.errors.name?.message}
            {...optionForm.register('name')}
          />

          <Input
            label="Price Modifier (Rs)"
            type="number"
            step="0.01"
            helperText="Use negative numbers for discounts, positive for upcharges"
            error={optionForm.formState.errors.priceModifier?.message}
            {...optionForm.register('priceModifier', { valueAsNumber: true })}
          />

          <Input
            label="Sort Order"
            type="number"
            error={optionForm.formState.errors.sortOrder?.message}
            {...optionForm.register('sortOrder', { valueAsNumber: true })}
          />

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="optionActive"
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              {...optionForm.register('isActive')}
            />
            <label htmlFor="optionActive" className="text-sm font-medium text-gray-700">
              Active
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeOptionModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
