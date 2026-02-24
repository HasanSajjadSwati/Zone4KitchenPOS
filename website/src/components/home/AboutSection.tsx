'use client';

import { motion } from 'framer-motion';
import { Utensils, Heart, Award, Users } from 'lucide-react';

export default function AboutSection() {
  const features = [
    {
      icon: Utensils,
      title: 'Fresh Ingredients',
      description: 'We use only the freshest, locally-sourced ingredients in all our dishes.',
    },
    {
      icon: Heart,
      title: 'Made with Love',
      description: 'Every dish is prepared with care and passion by our experienced chefs.',
    },
    {
      icon: Award,
      title: 'Quality First',
      description: 'We maintain the highest standards of quality in food preparation.',
    },
    {
      icon: Users,
      title: 'Customer Focused',
      description: 'Your satisfaction is our top priority. We value every customer.',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Image Side */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden">
              {/* Placeholder for restaurant image */}
              <div className="aspect-[4/3] bg-gradient-to-br from-primary-200 to-secondary-200 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-8xl">👨‍🍳</span>
                  <p className="text-gray-600 mt-4 font-medium">Our Kitchen</p>
                </div>
              </div>
            </div>

            {/* Stats Box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="absolute -bottom-6 -right-6 bg-white rounded-xl shadow-xl p-6 hidden md:block"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary-600">5+</p>
                  <p className="text-sm text-gray-600">Years</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary-600">10K+</p>
                  <p className="text-sm text-gray-600">Orders</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Content Side */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-primary-600 font-semibold text-sm uppercase tracking-wider">
              About Us
            </span>
            <h2 className="section-title mt-2 mb-4">
              We Serve Delicious Food With Love
            </h2>
            <p className="text-gray-600 mb-8">
              Zone 4 Kitchen started with a simple mission: to bring authentic, 
              delicious food to the people of Islamabad. What began as a small 
              kitchen has grown into a beloved destination for food lovers across 
              the city.
            </p>
            <p className="text-gray-600 mb-8">
              Our chefs bring years of experience and a passion for cooking that 
              you can taste in every bite. We believe good food brings people 
              together, and we're honored to be a part of your special moments.
            </p>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * index }}
                    className="flex items-start space-x-3"
                  >
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {feature.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {feature.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
