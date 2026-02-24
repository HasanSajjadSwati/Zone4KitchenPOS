'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, MapPin, Phone, ArrowRight } from 'lucide-react';
import { api, Order } from '@/lib/api';
import { formatCurrency, formatDateTime, getDeliveryStatusLabel } from '@/lib/utils';

export default function OrderConfirmationPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;
      try {
        const data = await api.get<Order>(`/website/orders/${orderId}`);
        setOrder(data);
      } catch (error) {
        console.error('Failed to fetch order:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Order Not Found</h1>
        <Link href="/menu" className="btn-primary">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden"
        >
          {/* Success Header */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
            >
              <CheckCircle className="w-16 h-16 mx-auto mb-4" />
            </motion.div>
            <h1 className="text-2xl font-display font-bold mb-2">
              Order Placed Successfully!
            </h1>
            <p className="text-green-100">
              Thank you for your order. We'll start preparing it soon.
            </p>
          </div>

          {/* Order Details */}
          <div className="p-6 space-y-6">
            {/* Order Number */}
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-600 mb-1">Order Number</p>
              <p className="text-2xl font-bold text-primary-600">
                {order.orderNumber}
              </p>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <span className="font-medium">
                Status: {getDeliveryStatusLabel(order.deliveryStatus)}
              </span>
            </div>

            {/* Delivery Info */}
            {order.orderType === 'delivery' && order.deliveryAddress && (
              <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-xl">
                <MapPin className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Delivery Address</p>
                  <p className="font-medium">{order.deliveryAddress}</p>
                </div>
              </div>
            )}

            {/* Contact */}
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl">
              <Phone className="w-5 h-5 text-primary-600 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-600">Contact</p>
                <p className="font-medium">
                  {order.customerName} • {order.customerPhone}
                </p>
              </div>
            </div>

            {/* Order Items */}
            <div>
              <h3 className="font-semibold mb-3">Order Items</h3>
              <div className="space-y-2">
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
            </div>

            {/* Total */}
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

            {/* Actions */}
            <div className="space-y-3 pt-4">
              <Link
                href={`/track-order?id=${order.id}`}
                className="btn-primary w-full block text-center"
              >
                Track Order
              </Link>
              <Link
                href="/menu"
                className="btn-outline w-full block text-center flex items-center justify-center space-x-2"
              >
                <span>Continue Shopping</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
