'use client';

import { useEffect, useState } from 'react';
import { Save, Megaphone } from 'lucide-react';
import toast from 'react-hot-toast';

interface AnnouncementSettings {
  text: string;
  isActive: boolean;
  type: 'info' | 'warning' | 'success' | 'error';
}

export default function AnnouncementSettingsPage() {
  const [settings, setSettings] = useState<AnnouncementSettings>({
    text: '',
    isActive: false,
    type: 'info',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/website/settings/announcement`
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
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/website/admin/settings/announcement`,
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

      toast.success('Announcement updated successfully!');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const typeColors = {
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    success: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
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
          Announcement Banner
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
        <div className="flex items-center space-x-3 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Megaphone className="w-6 h-6 text-blue-600" />
          <p className="text-blue-800">
            The announcement banner appears at the top of every page when active.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Enable Announcement</p>
              <p className="text-sm text-gray-500">Show banner on the website</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.isActive}
                onChange={(e) =>
                  setSettings({ ...settings, isActive: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Announcement Text
            </label>
            <input
              type="text"
              value={settings.text}
              onChange={(e) =>
                setSettings({ ...settings, text: e.target.value })
              }
              className="input-field"
              placeholder="e.g., 🎉 Free delivery on orders above Rs. 2000!"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Banner Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['info', 'success', 'warning', 'error'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSettings({ ...settings, type })}
                  className={`p-3 rounded-lg border-2 capitalize transition-all ${
                    settings.type === type
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span>{type}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      {settings.text && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
          <div className={`p-3 text-center border rounded-lg ${typeColors[settings.type]}`}>
            {settings.text}
          </div>
        </div>
      )}
    </div>
  );
}
