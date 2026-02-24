'use client';

import { useEffect, useState } from 'react';
import { Save, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

interface BankDetails {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
  instructions: string;
}

export default function BankDetailsPage() {
  const [settings, setSettings] = useState<BankDetails>({
    bankName: 'Bank Al Habib',
    accountTitle: 'Zone 4 Kitchen',
    accountNumber: '',
    iban: '',
    instructions: 'Please transfer the exact amount and upload the payment screenshot.',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/website/settings/bank-details`
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
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/website/admin/settings/bank-details`,
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

      toast.success('Bank details updated successfully!');
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
          Bank Details
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

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center space-x-3 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <CreditCard className="w-6 h-6 text-amber-600" />
          <p className="text-amber-800">
            These details are shown during checkout when customers select bank transfer payment.
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bank Name
              </label>
              <input
                type="text"
                value={settings.bankName}
                onChange={(e) =>
                  setSettings({ ...settings, bankName: e.target.value })
                }
                className="input-field"
                placeholder="e.g., Bank Al Habib"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Title
              </label>
              <input
                type="text"
                value={settings.accountTitle}
                onChange={(e) =>
                  setSettings({ ...settings, accountTitle: e.target.value })
                }
                className="input-field"
                placeholder="e.g., Zone 4 Kitchen"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Number
              </label>
              <input
                type="text"
                value={settings.accountNumber}
                onChange={(e) =>
                  setSettings({ ...settings, accountNumber: e.target.value })
                }
                className="input-field"
                placeholder="Enter account number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                IBAN
              </label>
              <input
                type="text"
                value={settings.iban}
                onChange={(e) =>
                  setSettings({ ...settings, iban: e.target.value })
                }
                className="input-field"
                placeholder="e.g., PK00BAHL0000001234567890123"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Instructions
            </label>
            <textarea
              value={settings.instructions}
              onChange={(e) =>
                setSettings({ ...settings, instructions: e.target.value })
              }
              rows={3}
              className="input-field resize-none"
              placeholder="Instructions shown to customers..."
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Customer View Preview
        </h2>
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Bank Transfer Details</h3>
          <div className="space-y-3 mb-4">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Bank</span>
              <span className="font-medium">{settings.bankName || '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Account Title</span>
              <span className="font-medium">{settings.accountTitle || '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Account Number</span>
              <span className="font-medium font-mono">{settings.accountNumber || '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">IBAN</span>
              <span className="font-medium font-mono text-sm">{settings.iban || '-'}</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            {settings.instructions}
          </p>
        </div>
      </div>
    </div>
  );
}
