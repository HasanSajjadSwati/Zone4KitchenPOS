import Link from 'next/link';
import { MapPin, Phone, Mail, Clock, Facebook, Instagram, Twitter } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand & About */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">Z4</span>
              </div>
              <span className="font-display font-bold text-xl text-white">
                Zone 4 Kitchen
              </span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Serving delicious food with love since day one. Fresh ingredients, 
              amazing taste, delivered right to your doorstep.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="hover:text-primary-500 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="hover:text-primary-500 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="hover:text-primary-500 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-display font-semibold text-white text-lg mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2">
              {[
                { href: '/menu', label: 'Our Menu' },
                { href: '/deals', label: 'Special Deals' },
                { href: '/about', label: 'About Us' },
                { href: '/contact', label: 'Contact' },
                { href: '/track-order', label: 'Track Order' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-primary-500 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-display font-semibold text-white text-lg mb-4">
              Contact Us
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm">
                  Jinnah Ave, Mohran Jejan, Islamabad, Pakistan
                </span>
              </li>
              <li className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-primary-500 flex-shrink-0" />
                <a href="tel:03084559944" className="text-sm hover:text-primary-500">
                  0308-4559944
                </a>
              </li>
              <li className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-primary-500 flex-shrink-0" />
                <a href="mailto:info@zone4kitchen.com" className="text-sm hover:text-primary-500">
                  info@zone4kitchen.com
                </a>
              </li>
            </ul>
          </div>

          {/* Opening Hours */}
          <div>
            <h3 className="font-display font-semibold text-white text-lg mb-4">
              Opening Hours
            </h3>
            <ul className="space-y-2">
              <li className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-primary-500 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-white">Mon - Fri</p>
                  <p>11:00 AM - 11:00 PM</p>
                </div>
              </li>
              <li className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-primary-500 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-white">Sat - Sun</p>
                  <p>12:00 PM - 12:00 AM</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-gray-400">
            © {currentYear} Zone 4 Kitchen. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <Link href="/privacy" className="text-sm text-gray-400 hover:text-primary-500">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-gray-400 hover:text-primary-500">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
