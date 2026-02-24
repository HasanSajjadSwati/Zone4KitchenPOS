'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, Truck, Star } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-2 bg-primary-600/20 text-primary-400 rounded-full text-sm font-medium mb-6">
              🎉 Free Delivery on First Order!
            </span>
            
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Delicious Food,
              <br />
              <span className="text-primary-500">Delivered Fast</span>
            </h1>
            
            <p className="text-lg text-gray-300 mb-8 max-w-lg">
              Experience the finest cuisine from Zone 4 Kitchen. Fresh ingredients, 
              authentic flavors, delivered right to your doorstep.
            </p>

            <div className="flex flex-wrap gap-4 mb-10">
              <Link href="/menu" className="btn-primary inline-flex items-center">
                Order Now
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link href="/menu" className="btn-outline border-white text-white hover:bg-white hover:text-gray-900">
                View Menu
              </Link>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-8">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-primary-500" />
                <span className="text-sm text-gray-300">30 Min Delivery</span>
              </div>
              <div className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-primary-500" />
                <span className="text-sm text-gray-300">Free Delivery</span>
              </div>
              <div className="flex items-center space-x-2">
                <Star className="w-5 h-5 text-primary-500" />
                <span className="text-sm text-gray-300">4.8+ Rating</span>
              </div>
            </div>
          </motion.div>

          {/* Hero Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative w-full aspect-square max-w-lg mx-auto">
              {/* Decorative circles */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/30 to-secondary-500/30 rounded-full blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4/5 h-4/5 bg-gradient-to-br from-primary-600/20 to-secondary-600/20 rounded-full" />
              
              {/* Placeholder for food image */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-full flex items-center justify-center">
                <span className="text-6xl">🍔</span>
              </div>

              {/* Floating elements */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute top-10 right-10 bg-white rounded-xl p-3 shadow-xl"
              >
                <span className="text-2xl">🍕</span>
              </motion.div>
              
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                className="absolute bottom-20 left-5 bg-white rounded-xl p-3 shadow-xl"
              >
                <span className="text-2xl">🥗</span>
              </motion.div>

              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
                className="absolute top-32 left-0 bg-white rounded-xl p-3 shadow-xl"
              >
                <span className="text-2xl">🍟</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Wave Bottom */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}
