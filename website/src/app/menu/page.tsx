'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Plus, Check, X } from 'lucide-react';
import { api, MenuItem, Category, Variant, VariantOption } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import toast from 'react-hot-toast';

interface MenuItemWithDetails extends MenuItem {
  category?: Category;
}

interface VariantModalProps {
  item: MenuItem;
  variants: Variant[];
  onClose: () => void;
  onAddToCart: (selectedVariants: any[], quantity: number) => void;
}

function VariantModal({ item, variants, onClose, onAddToCart }: VariantModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, VariantOption[]>>({});

  // Initialize required variants
  useEffect(() => {
    const initial: Record<string, VariantOption[]> = {};
    item.variants?.forEach((mv) => {
      if (mv.isRequired && mv.options && mv.options.length > 0) {
        initial[mv.variantId] = [mv.options[0]];
      }
    });
    setSelectedOptions(initial);
  }, [item.variants]);

  const handleOptionSelect = (variantId: string, option: VariantOption, selectionMode: string) => {
    setSelectedOptions((prev) => {
      if (selectionMode === 'single') {
        return { ...prev, [variantId]: [option] };
      } else if (selectionMode === 'multiple') {
        const current = prev[variantId] || [];
        const exists = current.find((o) => o.id === option.id);
        if (exists) {
          return { ...prev, [variantId]: current.filter((o) => o.id !== option.id) };
        }
        return { ...prev, [variantId]: [...current, option] };
      }
      return prev;
    });
  };

  const totalPrice = useMemo(() => {
    let price = item.price;
    Object.values(selectedOptions).flat().forEach((option) => {
      price += option.priceModifier;
    });
    return price * quantity;
  }, [item.price, selectedOptions, quantity]);

  const handleAdd = () => {
    const selected = Object.entries(selectedOptions).flatMap(([variantId, options]) =>
      options.map((opt) => {
        const mv = item.variants?.find((v) => v.variantId === variantId);
        return {
          variantId,
          variantName: mv?.variantName || '',
          optionId: opt.id,
          optionName: opt.name,
          priceModifier: opt.priceModifier,
        };
      })
    );
    onAddToCart(selected, quantity);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">{item.name}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {item.description && (
            <p className="text-gray-600 text-sm mb-4">{item.description}</p>
          )}

          {/* Variants */}
          {item.variants?.map((mv) => {
            const variantOptions = mv.options || [];
            return (
              <div key={mv.variantId} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">{mv.variantName}</h4>
                  {mv.isRequired && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                      Required
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {variantOptions.map((option) => {
                    const isSelected = selectedOptions[mv.variantId]?.some(
                      (o) => o.id === option.id
                    );
                    return (
                      <button
                        key={option.id}
                        onClick={() =>
                          handleOptionSelect(mv.variantId, option, mv.selectionMode)
                        }
                        className={cn(
                          'w-full flex items-center justify-between p-3 rounded-lg border transition-colors',
                          isSelected
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <span className="font-medium text-sm">{option.name}</span>
                        <div className="flex items-center space-x-2">
                          {option.priceModifier > 0 && (
                            <span className="text-sm text-gray-600">
                              +{formatCurrency(option.priceModifier)}
                            </span>
                          )}
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary-600" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Quantity */}
          <div className="flex items-center justify-between">
            <span className="font-semibold">Quantity</span>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-100"
              >
                -
              </button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <button onClick={handleAdd} className="btn-primary w-full">
            Add to Cart - {formatCurrency(totalPrice)}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function MenuPage() {
  const [items, setItems] = useState<MenuItemWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const { addItem } = useCart();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [menuItems, cats, vars] = await Promise.all([
          api.get<MenuItem[]>('/website/menu'),
          api.get<Category[]>('/website/categories'),
          api.get<Variant[]>('/website/variants'),
        ]);
        
        const activeItems = menuItems.filter((item) => item.isActive && !item.isDealOnly);
        setItems(activeItems);
        setCategories(cats.filter((c) => c.isActive));
        setVariants(vars);
      } catch (error) {
        console.error('Failed to fetch menu:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || '';
  };

  const handleAddToCart = (item: MenuItem) => {
    if (item.hasVariants) {
      setSelectedItem(item);
      return;
    }

    addItem({
      itemType: 'menu_item',
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
    });
    toast.success(`${item.name} added to cart!`);
  };

  const handleVariantAddToCart = (selectedVariants: any[], quantity: number) => {
    if (!selectedItem) return;

    addItem({
      itemType: 'menu_item',
      menuItemId: selectedItem.id,
      name: selectedItem.name,
      price: selectedItem.price,
      quantity,
      selectedVariants,
    });
    toast.success(`${selectedItem.name} added to cart!`);
    setSelectedItem(null);
  };

  // Group categories by type
  const majorCategories = categories.filter((c) => c.type === 'major');

  if (isLoading) {
    return (
      <div className="min-h-screen py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-gray-200 rounded w-1/3" />
            <div className="h-12 bg-gray-200 rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="card">
                  <div className="h-48 bg-gray-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-6 bg-gray-200 rounded w-2/3" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900">
            Our Menu
          </h1>
          <p className="text-gray-600 mt-2">
            Explore our delicious selection of dishes
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                !selectedCategory
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              )}
            >
              All
            </button>
            {majorCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                  selectedCategory === category.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                )}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No items found matching your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="card group hover:shadow-xl transition-shadow duration-300"
              >
                {/* Image */}
                <div className="relative h-48 bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center">
                  <span className="text-5xl">🍽️</span>
                  
                  <button
                    onClick={() => handleAddToCart(item)}
                    className="absolute bottom-3 right-3 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-primary-700"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4">
                  <span className="text-xs text-primary-600 font-medium">
                    {getCategoryName(item.categoryId)}
                  </span>
                  <h3 className="font-semibold text-gray-900 mt-1 mb-2">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg text-primary-600">
                      {formatCurrency(item.price)}
                    </span>
                    {item.hasVariants && (
                      <span className="text-xs text-gray-500">+ Options</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Variant Modal */}
      {selectedItem && (
        <VariantModal
          item={selectedItem}
          variants={variants}
          onClose={() => setSelectedItem(null)}
          onAddToCart={handleVariantAddToCart}
        />
      )}
    </div>
  );
}
