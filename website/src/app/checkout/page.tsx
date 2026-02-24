'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MapPin,
  Phone,
  User,
  Truck,
  ShoppingBag,
  Upload,
  CreditCard,
  Banknote,
  Check,
  AlertCircle,
  ArrowLeft,
  X,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { api, CMSBankDetails } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';

type PaymentMethod = 'cod' | 'bank_transfer';

interface BankDetails {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
  instructions: string;
}

const DEFAULT_BANK_DETAILS: BankDetails = {
  bankName: 'Bank Al Habib',
  accountTitle: 'Zone 4 Kitchen',
  accountNumber: '1234567890123',
  iban: 'PK00BAHL0000001234567890123',
  instructions: 'Please transfer the exact amount and upload the payment screenshot. Your order will be confirmed after verification.',
};

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const {
    items,
    orderType,
    setOrderType,
    deliveryAddress,
    setDeliveryAddress,
    subtotal,
    deliveryCharge,
    total,
    clearCart,
  } = useCart();

  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails>(DEFAULT_BANK_DETAILS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });

  // Pre-fill form with user data
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || deliveryAddress || '',
      }));
    }
  }, [user, deliveryAddress]);

  // Fetch bank details from CMS
  useEffect(() => {
    const fetchBankDetails = async () => {
      try {
        const data = await api.get<BankDetails>('/website/settings/bank-details');
        if (data) {
          setBankDetails(data);
        }
      } catch (error) {
        console.log('Using default bank details');
      }
    };
    fetchBankDetails();
  }, []);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      router.push('/menu');
    }
  }, [items, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setPaymentScreenshot(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.phone) {
      toast.error('Please fill in your name and phone number');
      return;
    }

    if (orderType === 'delivery' && !formData.address) {
      toast.error('Please enter your delivery address');
      return;
    }

    if (paymentMethod === 'bank_transfer' && !paymentScreenshot) {
      toast.error('Please upload your payment screenshot');
      return;
    }

    setIsLoading(true);

    try {
      // Prepare order data
      const orderData = {
        orderType: orderType === 'delivery' ? 'delivery' : 'take_away',
        customerName: formData.name,
        customerPhone: formData.phone,
        deliveryAddress: orderType === 'delivery' ? formData.address : null,
        notes: formData.notes || null,
        paymentMethod,
        items: items.map((item) => ({
          itemType: item.itemType,
          menuItemId: item.menuItemId || null,
          dealId: item.dealId || null,
          quantity: item.quantity,
          unitPrice: item.price,
          selectedVariants: item.selectedVariants || null,
          notes: item.notes || null,
        })),
      };

      let response;

      if (paymentMethod === 'bank_transfer' && paymentScreenshot) {
        // Upload with form data
        const formDataObj = new FormData();
        formDataObj.append('order', JSON.stringify(orderData));
        formDataObj.append('paymentScreenshot', paymentScreenshot);
        response = await api.uploadFile('/website/orders', formDataObj);
      } else {
        response = await api.post('/website/orders', orderData);
      }

      // Success
      clearCart();
      toast.success('Order placed successfully!');
      router.push(`/order-confirmation?id=${response.id}`);
    } catch (error) {
      console.error('Failed to place order:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen py-8 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href="/menu"
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-primary-600 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Menu</span>
        </Link>

        <h1 className="text-3xl font-display font-bold text-gray-900 mb-8">
          Checkout
        </h1>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Forms */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Type */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="font-display font-semibold text-lg mb-4">
                  Order Type
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setOrderType('delivery')}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all text-left',
                      orderType === 'delivery'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <Truck
                      className={cn(
                        'w-6 h-6 mb-2',
                        orderType === 'delivery' ? 'text-primary-600' : 'text-gray-400'
                      )}
                    />
                    <p className="font-semibold">Delivery</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(150)} delivery fee
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType('pickup')}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all text-left',
                      orderType === 'pickup'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <ShoppingBag
                      className={cn(
                        'w-6 h-6 mb-2',
                        orderType === 'pickup' ? 'text-primary-600' : 'text-gray-400'
                      )}
                    />
                    <p className="font-semibold">Pickup</p>
                    <p className="text-sm text-gray-500">No delivery fee</p>
                  </button>
                </div>
              </div>

              {/* Contact Details */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="font-display font-semibold text-lg mb-4">
                  Contact Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="input-field pl-10"
                        placeholder="Enter your name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        className="input-field pl-10"
                        placeholder="03XX-XXXXXXX"
                      />
                    </div>
                  </div>

                  {orderType === 'delivery' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Delivery Address *
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <textarea
                          required
                          rows={2}
                          value={formData.address}
                          onChange={(e) =>
                            setFormData({ ...formData, address: e.target.value })
                          }
                          className="input-field pl-10 resize-none"
                          placeholder="Enter your complete delivery address"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Order Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      className="input-field resize-none"
                      placeholder="Any special instructions?"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="font-display font-semibold text-lg mb-4">
                  Payment Method
                </h2>
                <div className="space-y-4">
                  {/* COD Option */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={cn(
                      'w-full p-4 rounded-xl border-2 transition-all text-left flex items-center space-x-4',
                      paymentMethod === 'cod'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <Banknote
                      className={cn(
                        'w-6 h-6',
                        paymentMethod === 'cod' ? 'text-primary-600' : 'text-gray-400'
                      )}
                    />
                    <div className="flex-1">
                      <p className="font-semibold">Cash on Delivery</p>
                      <p className="text-sm text-gray-500">
                        Pay when you receive your order
                      </p>
                    </div>
                    {paymentMethod === 'cod' && (
                      <Check className="w-5 h-5 text-primary-600" />
                    )}
                  </button>

                  {/* Bank Transfer Option */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={cn(
                      'w-full p-4 rounded-xl border-2 transition-all text-left flex items-center space-x-4',
                      paymentMethod === 'bank_transfer'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <CreditCard
                      className={cn(
                        'w-6 h-6',
                        paymentMethod === 'bank_transfer'
                          ? 'text-primary-600'
                          : 'text-gray-400'
                      )}
                    />
                    <div className="flex-1">
                      <p className="font-semibold">Bank Transfer</p>
                      <p className="text-sm text-gray-500">
                        Transfer and upload screenshot
                      </p>
                    </div>
                    {paymentMethod === 'bank_transfer' && (
                      <Check className="w-5 h-5 text-primary-600" />
                    )}
                  </button>

                  {/* Bank Transfer Details */}
                  {paymentMethod === 'bank_transfer' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 bg-gray-50 rounded-xl space-y-4">
                        {/* Bank Info */}
                        <div className="space-y-2">
                          <h3 className="font-semibold text-sm text-gray-700">
                            Bank Details
                          </h3>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">Bank:</span>
                              <p className="font-medium">{bankDetails.bankName}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Account Title:</span>
                              <p className="font-medium">{bankDetails.accountTitle}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Account No:</span>
                              <p className="font-medium">{bankDetails.accountNumber}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">IBAN:</span>
                              <p className="font-medium text-xs">{bankDetails.iban}</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            {bankDetails.instructions}
                          </p>
                        </div>

                        {/* Amount to Pay */}
                        <div className="p-3 bg-primary-100 rounded-lg">
                          <p className="text-sm text-primary-700">Amount to Pay:</p>
                          <p className="text-2xl font-bold text-primary-700">
                            {formatCurrency(total)}
                          </p>
                        </div>

                        {/* Screenshot Upload */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Payment Screenshot *
                          </label>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />

                          {previewUrl ? (
                            <div className="relative">
                              <img
                                src={previewUrl}
                                alt="Payment screenshot"
                                className="w-full max-h-48 object-contain rounded-lg border"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentScreenshot(null);
                                  setPreviewUrl(null);
                                }}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full p-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-400 transition-colors"
                            >
                              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                              <p className="text-sm text-gray-600">
                                Click to upload screenshot
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                PNG, JPG up to 5MB
                              </p>
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
                <h2 className="font-display font-semibold text-lg mb-4">
                  Order Summary
                </h2>

                {/* Items */}
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {items.map((item) => {
                    const variantTotal =
                      item.selectedVariants?.reduce((sum, v) => sum + v.priceModifier, 0) ||
                      0;
                    const itemTotal = (item.price + variantTotal) * item.quantity;

                    return (
                      <div key={item.id} className="flex justify-between text-sm">
                        <div className="flex-1">
                          <p className="font-medium">
                            {item.quantity}x {item.name}
                          </p>
                          {item.selectedVariants && item.selectedVariants.length > 0 && (
                            <p className="text-xs text-gray-500">
                              {item.selectedVariants.map((v) => v.optionName).join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="font-medium">{formatCurrency(itemTotal)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {orderType === 'delivery' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Delivery</span>
                      <span>{formatCurrency(deliveryCharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total</span>
                    <span className="text-primary-600">{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full mt-6"
                >
                  {isLoading ? 'Placing Order...' : 'Place Order'}
                </button>

                {!isAuthenticated && (
                  <p className="text-xs text-gray-500 text-center mt-4">
                    <Link href="/auth/login" className="text-primary-600 hover:underline">
                      Sign in
                    </Link>{' '}
                    to track your orders
                  </p>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
