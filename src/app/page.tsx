'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-20 pb-40 bg-gradient-to-b from-white to-blue-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-5xl mx-auto mb-20"
          >
            <h1 className="text-7xl md:text-8xl font-bold text-gray-900 mb-8 tracking-tight leading-none">
              Find your perfect<br />study partner.
            </h1>
            <p className="text-2xl md:text-3xl text-gray-600 mb-12 font-light max-w-3xl mx-auto leading-relaxed">
              AI-powered matching connects you with compatible study partners. Collaborate in real-time and achieve more together.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link
                href="/auth/signup"
                className="px-10 py-5 bg-blue-600 text-white text-xl font-medium rounded-full hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
              >
                Get Started
              </Link>
              <Link
                href="#how-it-works"
                className="px-10 py-5 text-blue-600 text-xl font-medium rounded-full border-2 border-blue-600 hover:bg-blue-50 transition-all"
              >
                Learn More
              </Link>
            </div>
          </motion.div>

          {/* Beautiful 3D Hero Visual */}
          <div className="max-w-6xl mx-auto relative">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Left Card */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-100"
              >
                <div className="w-full aspect-square bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl mb-6 overflow-hidden p-6 flex items-center justify-center">
                  <img
                    src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/book-open.svg"
                    alt="Student studying"
                    className="w-full h-full object-contain opacity-40"
                  />
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded-lg"></div>
                  <div className="h-4 bg-gray-100 rounded-lg w-4/5"></div>
                  <div className="h-4 bg-gray-100 rounded-lg w-3/5"></div>
                </div>
              </motion.div>

              {/* Center Card - Elevated */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 shadow-2xl md:-translate-y-8"
              >
                <div className="w-full aspect-square bg-white/10 rounded-2xl mb-6 overflow-hidden backdrop-blur p-6 flex items-center justify-center">
                  <img
                    src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/users.svg"
                    alt="AI matching profiles"
                    className="w-full h-full object-contain opacity-90"
                  />
                </div>
                <div className="space-y-3">
                  <div className="h-3 bg-white/30 rounded-lg"></div>
                  <div className="h-3 bg-white/30 rounded-lg w-5/6"></div>
                  <div className="h-3 bg-white/30 rounded-lg w-4/6"></div>
                </div>
                <div className="mt-6 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white font-semibold">
                  Connect
                </div>
              </motion.div>

              {/* Right Card */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-100"
              >
                <div className="w-full aspect-square bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl mb-6 overflow-hidden p-6 flex items-center justify-center">
                  <img
                    src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/message-circle.svg"
                    alt="Collaboration"
                    className="w-full h-full object-contain opacity-40"
                  />
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded-lg"></div>
                  <div className="h-4 bg-gray-100 rounded-lg w-4/5"></div>
                  <div className="h-4 bg-gray-100 rounded-lg w-3/5"></div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-40 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-6xl font-bold text-gray-900 mb-6">
              Get started in minutes.
            </h2>
            <p className="text-xl text-gray-600 font-light max-w-2xl mx-auto">
              Three simple steps to find your perfect study partner.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: '1',
                title: 'Create Your Profile',
                description: 'Sign up and tell us about your subjects, learning style, and study goals.',
                color: 'from-blue-500 to-indigo-600'
              },
              {
                step: '2',
                title: 'Get Matched',
                description: 'Our AI analyzes thousands of profiles to find your perfect study partners.',
                color: 'from-indigo-500 to-purple-600'
              },
              {
                step: '3',
                title: 'Start Studying',
                description: 'Connect instantly and collaborate with video calls, chat, and whiteboards.',
                color: 'from-purple-500 to-pink-600'
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="relative"
              >
                <motion.div
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100"
                >
                  <div className={`w-20 h-20 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center text-white text-4xl font-bold mb-6 shadow-lg`}>
                    {item.step}
                  </div>
                  <h3 className="text-3xl font-semibold text-gray-900 mb-4">{item.title}</h3>
                  <p className="text-lg text-gray-600 font-light leading-relaxed">{item.description}</p>
                </motion.div>

                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-6 w-12 h-0.5 bg-gradient-to-r from-gray-300 to-transparent"></div>
                )}
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-16"
          >
            <Link
              href="/auth/signup"
              className="inline-block px-10 py-5 bg-blue-600 text-white text-xl font-medium rounded-full hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
            >
              Get Started Free
            </Link>
          </motion.div>
        </div>
      </section>

      {/* AI Matching Section */}
      <section className="py-40 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-6xl font-bold text-gray-900 mb-6 leading-tight">
                AI finds your perfect match.
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed font-light">
                Describe your ideal study partner and our intelligent AI analyzes thousands of profiles to find the best matches for you.
              </p>
              <Link href="/features/ai-agent" className="text-blue-600 text-lg font-medium hover:underline">
                Learn more about AI matching →
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              {/* Beautiful AI Visualization */}
              <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl p-12 shadow-2xl">
                <div className="relative h-80">
                  {/* Center Node */}
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-white rounded-full shadow-2xl flex items-center justify-center"
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full"></div>
                  </motion.div>

                  {/* Orbiting Nodes */}
                  {[0, 60, 120, 180, 240, 300].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        rotate: [0, 360],
                      }}
                      transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "linear",
                        delay: i * 0.5
                      }}
                      className="absolute top-1/2 left-1/2"
                      style={{
                        width: '200px',
                        height: '200px',
                        marginLeft: '-100px',
                        marginTop: '-100px',
                      }}
                    >
                      <motion.div
                        animate={{
                          scale: [1, 1.2, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.3
                        }}
                        className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-white/30 backdrop-blur rounded-full border-2 border-white/50"
                      ></motion.div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Collaboration Section */}
      <section className="py-40 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-2 md:order-1"
            >
              {/* Beautiful Video Call Visual */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 shadow-2xl">
                <div className="grid grid-cols-2 gap-4 mb-8">
                  {[1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      animate={{
                        opacity: [0.6, 1, 0.6],
                      }}
                      transition={{
                        duration: 3,
                        delay: i * 0.5,
                        repeat: Infinity
                      }}
                      className="aspect-square bg-white/10 backdrop-blur-sm rounded-2xl border-2 border-white/20 flex items-center justify-center"
                    >
                      <div className="w-12 h-12 bg-white/20 rounded-full"></div>
                    </motion.div>
                  ))}
                </div>
                <div className="flex justify-center gap-4 bg-black/20 backdrop-blur rounded-2xl p-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 bg-white/40 rounded"></div>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 bg-white/40 rounded-full"></div>
                  </div>
                  <div className="w-12 h-12 bg-red-500 rounded-full shadow-lg"></div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-1 md:order-2"
            >
              <h2 className="text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Study together, anywhere.
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed font-light">
                Connect through HD video calls, real-time chat, and shared whiteboards. Everything you need for productive study sessions.
              </p>
              <Link href="/features/real-time-collaboration" className="text-blue-600 text-lg font-medium hover:underline">
                Explore collaboration tools →
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-40 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-6xl font-bold text-gray-900 mb-6">
              Everything you need.
            </h2>
            <p className="text-xl text-gray-600 font-light max-w-2xl mx-auto">
              Powerful features designed for collaborative learning.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: 'AI Agent',
                description: 'Intelligent matching finds your perfect study partners automatically.',
                href: '/features/ai-agent',
                gradient: 'from-blue-500 to-indigo-600'
              },
              {
                title: 'Real-time Collaboration',
                description: 'Video calls, chat, and whiteboards for seamless studying together.',
                href: '/features/real-time-collaboration',
                gradient: 'from-indigo-500 to-purple-600'
              },
              {
                title: 'Study Groups',
                description: 'Create and join groups tailored to your subjects and goals.',
                href: '/features/study-groups',
                gradient: 'from-purple-500 to-pink-600'
              },
              {
                title: 'Community',
                description: 'Connect with thousands of learners and share knowledge.',
                href: '/features/community',
                gradient: 'from-pink-500 to-rose-600'
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={feature.href} className="block group">
                  <motion.div
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 h-full relative overflow-hidden"
                  >
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${feature.gradient} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2`}></div>
                    <h3 className="text-3xl font-semibold text-gray-900 mb-4 relative">{feature.title}</h3>
                    <p className="text-lg text-gray-600 font-light leading-relaxed mb-6 relative">{feature.description}</p>
                    <span className="text-blue-600 font-medium group-hover:underline relative">Learn more →</span>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-40 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-6xl font-bold text-gray-900 mb-6">
              Questions?
            </h2>
            <p className="text-xl text-gray-600 font-light">
              Everything you need to know about Clerva.
            </p>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                q: 'How does the AI matching work?',
                a: 'Our AI analyzes your profile including subjects, learning style, goals, and availability. It then finds partners who complement your needs and preferences, creating optimal study matches.'
              },
              {
                q: 'Is Clerva free to use?',
                a: 'Yes! Clerva is completely free for all students. We believe everyone deserves access to quality study resources and connections.'
              },
              {
                q: 'How do study sessions work?',
                a: 'Once matched with a partner, you can schedule sessions, chat in real-time, join video calls, use shared whiteboards, and collaborate on notes - all within the platform.'
              },
              {
                q: 'Can I create private study groups?',
                a: 'Absolutely! You can create both public and private study groups, invite specific members, and manage group settings to fit your needs.'
              },
              {
                q: 'What subjects are supported?',
                a: 'All subjects! From mathematics and sciences to languages, arts, and professional development - if you\'re learning it, Clerva supports it.'
              },
              {
                q: 'Is my data private and secure?',
                a: 'Yes. We use enterprise-grade encryption and never share your personal information. Your privacy and security are our top priorities.'
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="border-b border-gray-200 last:border-0"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-8 text-left flex items-start justify-between hover:bg-gray-50 transition-colors rounded-lg"
                >
                  <span className="text-xl font-semibold text-gray-900 pr-8">{faq.q}</span>
                  <motion.svg
                    animate={{ rotate: openFaq === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-6 h-6 text-gray-400 flex-shrink-0 mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </motion.svg>
                </button>
                <motion.div
                  initial={false}
                  animate={{
                    height: openFaq === index ? 'auto' : 0,
                    opacity: openFaq === index ? 1 : 0
                  }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-8 text-lg text-gray-600 leading-relaxed font-light">
                    {faq.a}
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-6xl md:text-7xl font-bold text-white mb-8 leading-tight">
              Start learning<br />together today.
            </h2>
            <p className="text-2xl text-blue-100 mb-12 font-light">
              Join thousands of students achieving their goals with Clerva.
            </p>
            <Link
              href="/auth/signup"
              className="inline-block px-12 py-5 bg-white text-blue-600 rounded-full text-xl font-semibold hover:bg-gray-50 transition-all shadow-xl"
            >
              Get Started
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-center items-center gap-12 mb-8">
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-gray-600 hover:text-gray-900 transition font-medium"
            >
              Features
            </button>
            <button
              onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-gray-600 hover:text-gray-900 transition font-medium"
            >
              FAQ
            </button>
          </div>
          <div className="text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} Clerva. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
