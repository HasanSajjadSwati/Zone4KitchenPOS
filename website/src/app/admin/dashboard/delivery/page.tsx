'use client';

import { useEffect, useState } from 'react';
import { Save, Truck } from 'lucide-react';
import toast from 'react-hot-toast';

interface DeliverySettings {
  fee: number;
  minimumOrder: number;
  freeDeliveryThreshold: number;
  estimatedTime: string;
  isEnabled: boolean;
  pickupEnabled: boolean;
  pickupTime: string;
}

export default function DeliverySettingsPage() {
  const [settings, setSettings] = useState<DeliverySettings>({
    fee: 150,
    minimumOrder: 500,
    freeDeliveryThreshold: 2000,
    estimatedTime: '30-45 min',
    isEnabled: true,
    pickupEnabled: true,
    pickupTime: '15-20 min',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/website/settings/delivery`
      );
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('zone4kitchen_admin_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/website/admin/settings/delivery`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(settings),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success('Delivery settings updated successfully!');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-gray-900">
          Delivery Settings
        </h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="space-y-6">
        {/* Delivery Options */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Truck className="w-5 h-5" />
            <span>Delivery Options</span>
          </h2>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Enable Delivery</p>
                <p className="text-sm text-gray-500">Allow customers to order for delivery</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.isEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, isEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Enable Pickup</p>
                <p className="text-sm text-gray-500">Allow customers to order for pickup</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.pickupEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, pickupEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h2>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Fee (Rs.)
              </label>
              <input
                type="number"
                value={settings.fee}
                onChange={(e) =>
                  setSettings({ ...settings, fee: parseInt(e.target.value) || 0 })
                }
                className="input-field"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Order (Rs.)
              </label>
              <input
                type="number"
                value={settings.minimumOrder}
                onChange={(e) =>
                  setSettings({ ...settings, minimumOrder: parseInt(e.target.value) || 0 })
                }
                className="input-field"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Free Delivery Above (Rs.)
              </label>
              <input
                type="number"
                value={settings.freeDeliveryThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, freeDeliveryThreshold: parseInt(e.target.value) || 0 })
                }
                className="input-field"
                min="0"
              />
              <p className="text-xs text-gray-500 mt-1">Set to 0 to disable free delivery</p>
            </div>
          </div>
        </div>

        {/* Timing */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Estimated Times</h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Time
              </label>
              <input
                type="text"
                value={settings.estimatedTime}
                onChange={(e) =>
                  setSettings({ ...settings, estimatedTime: e.target.value })
                }
                className="input-field"
                placeholder="e.g., 30-45 min"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pickup Time
              </label>
              <input
                type="text"
                value={settings.pickupTime}
                onChange={(e) =>
                  setSettings({ ...settings, pickupTime: e.target.value })
                }
                className="input-field"
                placeholder="e.g., 15-20 min"
              />
            </div>
          </div>
        </div>

        {/* Summary Preview */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-3">Current Settings Summary</h3>
          <ul className="space-y-2 text-blue-800">
            <li>• Delivery Fee: Rs. {settings.fee}</li>
            <li>• Minimum Order: Rs. {settings.minimumOrder}</li>
            {settings.freeDeliveryThreshold > 0 && (
              <li>• Free delivery on orders above Rs. {settings.freeDeliveryThreshold}</li>
            )}
            <li>• Estimated delivery time: {settings.estimatedTime}</li>
            <li>• Estimated pickup time: {settings.pickupTime}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
