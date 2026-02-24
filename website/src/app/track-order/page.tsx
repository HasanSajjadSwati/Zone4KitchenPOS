'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Package,
  CheckCircle,
  Clock,
  Truck,
  ChefHat,
  MapPin,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { api, Order } from '@/lib/api';
import {
  formatCurrency,
  formatDateTime,
  getDeliveryStatusLabel,
  getDeliveryStatusColor,
  cn,
} from '@/lib/utils';

const statusSteps = [
  { key: 'pending', label: 'Order Placed', icon: Package },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: CheckCircle },
  { key: 'out_for_delivery', label: 'On the Way', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export default function TrackOrderPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async (id?: string) => {
    const orderIdToFetch = id || orderId;
    if (!orderIdToFetch) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.get<Order>(`/website/orders/track/${orderIdToFetch}`);
      setOrder(data);
    } catch (err) {
      setError('Order not found. Please check your order number.');
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    } else {
      setIsLoading(false);
    }
  }, [orderId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchOrder(searchQuery.trim());
    }
  };

  const getCurrentStepIndex = () => {
    if (!order?.deliveryStatus) return 0;
    return statusSteps.findIndex((s) => s.key === order.deliveryStatus);
  };

  const currentStepIndex = getCurrentStepIndex();

  return (
    <div className="min-h-screen py-12 bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-gray-900">
            Track Your Order
          </h1>
          <p className="text-gray-600 mt-2">
            Enter your order number to see the status
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter order number (e.g., ORD-00001)"
              className="input-field flex-1"
            />
            <button type="submit" className="btn-primary">
              Track
            </button>
          </div>
        </form>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center">
            {error}
          </div>
        )}

        {order && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Order Info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">Order Number</p>
                  <p className="text-xl font-bold text-primary-600">
                    {order.orderNumber}
                  </p>
                </div>
                <button
                  onClick={() => fetchOrder()}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={cn(
                    'px-3 py-1 rounded-full text-sm font-medium',
                    getDeliveryStatusColor(order.deliveryStatus)
                  )}
                >
                  {getDeliveryStatusLabel(order.deliveryStatus)}
                </span>
                <span className="text-sm text-gray-500">
                  • {formatDateTime(order.createdAt)}
                </span>
              </div>
            </div>

            {/* Progress Tracker */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-semibold text-lg mb-6">Order Progress</h2>
              
              <div className="relative">
                {/* Progress Line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div
                  className="absolute left-6 top-0 w-0.5 bg-primary-600 transition-all duration-500"
                  style={{
                    height: `${(currentStepIndex / (statusSteps.length - 1)) * 100}%`,
                  }}
                />

                {/* Steps */}
                <div className="space-y-6">
                  {statusSteps.map((step, index) => {
                    const Icon = step.icon;
                    const isCompleted = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;

                    return (
                      <div key={step.key} className="relative flex items-center">
                        <div
                          className={cn(
                            'relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                            isCompleted
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-200 text-gray-400'
                          )}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="ml-4">
                          <p
                            className={cn(
                              'font-medium',
                              isCompleted ? 'text-gray-900' : 'text-gray-400'
                            )}
                          >
                            {step.label}
                          </p>
                          {isCurrent && (
                            <p className="text-sm text-primary-600">Current Status</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Delivery Details */}
            {order.orderType === 'delivery' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="font-semibold text-lg mb-4">Delivery Details</h2>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Delivery Address</p>
                      <p className="font-medium">{order.deliveryAddress}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Phone className="w-5 h-5 text-primary-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-600">Contact</p>
                      <p className="font-medium">
                        {order.customerName} • {order.customerPhone}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-semibold text-lg mb-4">Order Summary</h2>
              
              <div className="space-y-3 mb-4">
                {order.items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(item.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                {order.deliveryCharge > 0 && (
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Delivery</span>
                    <span>{formatCurrency(order.deliveryCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold mt-2">
                  <span>Total</span>
                  <span className="text-primary-600">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Help */}
            <div className="text-center">
              <p className="text-sm text-gray-500">
                Need help?{' '}
                <a
                  href="tel:03084559944"
                  className="text-primary-600 hover:underline"
                >
                  Call us at 0308-4559944
                </a>
              </p>
            </div>
          </motion.div>
        )}

        {!orderId && !isLoading && !order && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">
              Enter your order number above to track your order
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
