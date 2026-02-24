'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Plus } from 'lucide-react';
import { api, MenuItem, Category } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import toast from 'react-hot-toast';

export default function FeaturedMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addItem } = useCart();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [menuItems, cats] = await Promise.all([
          api.get<MenuItem[]>('/website/menu'),
          api.get<Category[]>('/website/categories'),
        ]);
        // Get only first 8 active items that are not deal-only
        const filteredItems = menuItems
          .filter((item) => item.isActive && !item.isDealOnly)
          .slice(0, 8);
        setItems(filteredItems);
        setCategories(cats);
      } catch (error) {
        console.error('Failed to fetch menu:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || '';
  };

  const handleAddToCart = (item: MenuItem) => {
    if (item.hasVariants) {
      // Redirect to menu page for variant selection
      window.location.href = `/menu?item=${item.id}`;
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

  if (isLoading) {
    return (
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="section-title">Our Popular Menu</h2>
            <p className="section-subtitle">Discover our most loved dishes</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-4">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-6 bg-gray-200 rounded w-2/3 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-title"
          >
            Our Popular Menu
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="section-subtitle"
          >
            Discover our most loved dishes
          </motion.p>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="card group hover:shadow-xl transition-shadow duration-300"
            >
              {/* Image Placeholder */}
              <div className="relative h-48 bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center">
                <span className="text-5xl">🍽️</span>
                
                {/* Quick Add Button */}
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
                <h3 className="font-semibold text-gray-900 mt-1 mb-2 line-clamp-1">
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

        {/* View All Link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link
            href="/menu"
            className="inline-flex items-center space-x-2 text-primary-600 font-semibold hover:text-primary-700 transition-colors"
          >
            <span>View Full Menu</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
