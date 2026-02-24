'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tag, Plus, Check, X } from 'lucide-react';
import { api, Deal, DealItem, MenuItem, Variant } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import toast from 'react-hot-toast';

interface DealWithDetails extends Deal {
  items: (DealItem & { menuItem?: MenuItem })[];
}

export default function DealsPage() {
  const [deals, setDeals] = useState<DealWithDetails[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<DealWithDetails | null>(null);
  const { addItem } = useCart();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dealsData, menuData] = await Promise.all([
          api.get<Deal[]>('/website/deals'),
          api.get<MenuItem[]>('/website/menu'),
        ]);

        // Fetch full details for each active deal
        const activeDeals = dealsData.filter((d) => d.isActive);
        const dealsWithDetails = await Promise.all(
          activeDeals.map(async (deal) => {
            const fullDeal = await api.get<DealWithDetails>(`/website/deals/${deal.id}`);
            return fullDeal;
          })
        );

        setDeals(dealsWithDetails);
        setMenuItems(menuData);
      } catch (error) {
        console.error('Failed to fetch deals:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getMenuItemName = (menuItemId: string) => {
    const item = menuItems.find((m) => m.id === menuItemId);
    return item?.name || 'Item';
  };

  const handleAddToCart = (deal: DealWithDetails) => {
    if (deal.hasVariants) {
      setSelectedDeal(deal);
      return;
    }

    addItem({
      itemType: 'deal',
      dealId: deal.id,
      name: deal.name,
      price: deal.price,
      quantity: 1,
    });
    toast.success(`${deal.name} added to cart!`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen py-8 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-gray-200 rounded w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card p-6">
                  <div className="h-6 bg-gray-200 rounded w-1/2 mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
                  <div className="h-8 bg-gray-200 rounded w-1/3" />
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
          <div className="inline-flex items-center space-x-2 bg-secondary-100 text-secondary-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Tag className="w-4 h-4" />
            <span>Special Offers</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900">
            Our Deals
          </h1>
          <p className="text-gray-600 mt-2">
            Amazing value combos and special offers
          </p>
        </div>

        {/* Deals Grid */}
        {deals.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No deals available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {deals.map((deal, index) => (
              <motion.div
                key={deal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white"
              >
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10 p-6 md:p-8">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-display font-bold text-xl md:text-2xl mb-2">
                        {deal.name}
                      </h3>
                      {deal.description && (
                        <p className="text-white/80 text-sm md:text-base mb-4">
                          {deal.description}
                        </p>
                      )}

                      {/* Deal Items */}
                      {deal.items && deal.items.length > 0 && (
                        <div className="space-y-1 mb-4">
                          <p className="text-xs text-white/60 uppercase tracking-wider">
                            Includes:
                          </p>
                          <ul className="space-y-1">
                            {deal.items.map((item) => (
                              <li
                                key={item.id}
                                className="text-sm text-white/90 flex items-center space-x-2"
                              >
                                <span className="w-1.5 h-1.5 bg-secondary-400 rounded-full" />
                                <span>
                                  {item.quantity}x {getMenuItemName(item.menuItemId)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0 ml-4">
                      <span className="text-3xl md:text-4xl font-bold">
                        {formatCurrency(deal.price)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddToCart(deal)}
                    className="inline-flex items-center space-x-2 bg-white text-primary-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
