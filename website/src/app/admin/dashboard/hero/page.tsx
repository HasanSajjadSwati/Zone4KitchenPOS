'use client';

import { useEffect, useState } from 'react';
import { Save, ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface HeroSettings {
  title: string;
  subtitle: string;
  backgroundImage: string | null;
  ctaText: string;
  ctaLink: string;
}

export default function HeroSettingsPage() {
  const [settings, setSettings] = useState<HeroSettings>({
    title: 'Delicious Food, Delivered Fresh',
    subtitle: 'Experience the authentic taste of Pakistani cuisine, made with love and delivered to your doorstep.',
    backgroundImage: null,
    ctaText: 'Order Now',
    ctaLink: '/menu',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/website/settings/hero`
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
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/website/admin/settings/hero`,
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

      toast.success('Hero section updated successfully!');
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
          Hero Section
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
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Main Title
            </label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) =>
                setSettings({ ...settings, title: e.target.value })
              }
              className="input-field"
              placeholder="Enter hero title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subtitle
            </label>
            <textarea
              value={settings.subtitle}
              onChange={(e) =>
                setSettings({ ...settings, subtitle: e.target.value })
              }
              rows={3}
              className="input-field resize-none"
              placeholder="Enter hero subtitle"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CTA Button Text
              </label>
              <input
                type="text"
                value={settings.ctaText}
                onChange={(e) =>
                  setSettings({ ...settings, ctaText: e.target.value })
                }
                className="input-field"
                placeholder="e.g., Order Now"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CTA Button Link
              </label>
              <input
                type="text"
                value={settings.ctaLink}
                onChange={(e) =>
                  setSettings({ ...settings, ctaLink: e.target.value })
                }
                className="input-field"
                placeholder="e.g., /menu"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Background Image URL
            </label>
            <div className="flex space-x-4">
              <input
                type="text"
                value={settings.backgroundImage || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    backgroundImage: e.target.value || null,
                  })
                }
                className="input-field flex-1"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Enter a URL for the background image. Leave empty to use the default gradient.
            </p>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
        <div
          className="relative rounded-xl overflow-hidden bg-gradient-to-br from-primary-600 to-primary-800 text-white p-8 min-h-[200px] flex items-center"
          style={
            settings.backgroundImage
              ? {
                  backgroundImage: `url(${settings.backgroundImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {}
          }
        >
          {settings.backgroundImage && (
            <div className="absolute inset-0 bg-black/40" />
          )}
          <div className="relative z-10">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">
              {settings.title || 'Hero Title'}
            </h2>
            <p className="text-white/80 mb-4 max-w-lg">
              {settings.subtitle || 'Hero subtitle text'}
            </p>
            <button className="bg-white text-primary-600 px-6 py-2 rounded-full font-semibold">
              {settings.ctaText || 'Button'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
