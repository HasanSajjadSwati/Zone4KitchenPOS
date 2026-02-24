'use client';

import { motion } from 'framer-motion';
import { Utensils, Heart, Award, Users, Clock, MapPin } from 'lucide-react';
import Image from 'next/image';

export default function AboutPage() {
  const values = [
    {
      icon: Utensils,
      title: 'Fresh Ingredients',
      description:
        'We source only the freshest, locally-sourced ingredients to ensure every dish meets our high standards of quality.',
    },
    {
      icon: Heart,
      title: 'Made with Love',
      description:
        'Every dish is prepared with care and passion by our experienced chefs who take pride in their craft.',
    },
    {
      icon: Award,
      title: 'Quality First',
      description:
        'We maintain the highest standards of quality in food preparation, hygiene, and customer service.',
    },
    {
      icon: Users,
      title: 'Customer Focused',
      description:
        'Your satisfaction is our top priority. We value every customer and strive to exceed expectations.',
    },
  ];

  const timeline = [
    {
      year: '2020',
      title: 'The Beginning',
      description: 'Zone 4 Kitchen started as a small home kitchen with a dream to serve authentic Pakistani cuisine.',
    },
    {
      year: '2021',
      title: 'Growing Family',
      description: 'We expanded our team and menu, introducing new dishes that quickly became customer favorites.',
    },
    {
      year: '2022',
      title: 'New Location',
      description: 'Moved to our current location at Jinnah Ave, with a larger kitchen to serve more customers.',
    },
    {
      year: '2023',
      title: 'Going Digital',
      description: 'Launched our online ordering system to make it easier for customers to enjoy our food.',
    },
    {
      year: '2024',
      title: 'Continuing Growth',
      description: 'Expanding our delivery area and introducing new menu items based on customer feedback.',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 to-primary-800 text-white py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6"
          >
            Our Story
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-white/80 max-w-2xl mx-auto"
          >
            Serving delicious food with love since 2020. Discover the passion
            behind Zone 4 Kitchen.
          </motion.p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-primary-600 font-semibold text-sm uppercase tracking-wider">
                Our Mission
              </span>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900 mt-2 mb-6">
                Bringing Authentic Flavors to Your Table
              </h2>
              <p className="text-gray-600 mb-6">
                At Zone 4 Kitchen, we believe that good food brings people
                together. Our mission is to serve authentic, delicious meals
                that remind you of home-cooked goodness, made with the freshest
                ingredients and prepared with love.
              </p>
              <p className="text-gray-600">
                Whether you're ordering a quick lunch, planning a family
                dinner, or celebrating a special occasion, we're here to make
                every meal memorable. Our commitment to quality, taste, and
                service sets us apart.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-[4/3] bg-gradient-to-br from-primary-100 to-secondary-100 rounded-2xl flex items-center justify-center">
                <span className="text-9xl">👨‍🍳</span>
              </div>
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">5+ Years</p>
                    <p className="text-sm text-gray-500">Of Experience</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900">
              Our Core Values
            </h2>
            <p className="text-gray-600 mt-2">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-7 h-7 text-primary-600" />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-gray-900 mb-2">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 text-sm">{value.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900">
              Our Journey
            </h2>
            <p className="text-gray-600 mt-2">
              From humble beginnings to where we are today
            </p>
          </div>

          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-primary-200 lg:left-1/2 lg:-translate-x-1/2" />

            {/* Timeline Items */}
            <div className="space-y-8">
              {timeline.map((item, index) => (
                <motion.div
                  key={item.year}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative flex items-start ${
                    index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
                  }`}
                >
                  {/* Dot */}
                  <div className="absolute left-8 lg:left-1/2 lg:-translate-x-1/2 w-4 h-4 bg-primary-600 rounded-full border-4 border-white shadow" />

                  {/* Content */}
                  <div
                    className={`ml-16 lg:ml-0 lg:w-1/2 ${
                      index % 2 === 0 ? 'lg:pr-12 lg:text-right' : 'lg:pl-12'
                    }`}
                  >
                    <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold mb-2">
                      {item.year}
                    </span>
                    <h3 className="font-display font-semibold text-lg text-gray-900 mb-1">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 text-sm">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Location Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-primary-600 font-semibold text-sm uppercase tracking-wider">
                Visit Us
              </span>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900 mt-2 mb-6">
                Our Location
              </h2>
              <div className="flex items-start space-x-4 mb-6">
                <MapPin className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900">Address</p>
                  <p className="text-gray-600">
                    Jinnah Ave, Mohran Jejan,
                    <br />
                    Islamabad, Pakistan
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <Clock className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900">Opening Hours</p>
                  <p className="text-gray-600">
                    Mon - Fri: 11:00 AM - 11:00 PM
                    <br />
                    Sat - Sun: 12:00 PM - 12:00 AM
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-200 rounded-2xl aspect-video flex items-center justify-center">
              <p className="text-gray-500">Map placeholder</p>
              {/* You can integrate Google Maps here */}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
