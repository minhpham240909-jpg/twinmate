'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-5xl mx-auto"
          >
            <h1 className="text-7xl md:text-8xl font-bold text-gray-900 mb-8 tracking-tight leading-none">
              Find your perfect<br />study partner.
            </h1>
            <p className="text-2xl md:text-3xl text-gray-600 mb-12 font-light max-w-3xl mx-auto leading-relaxed">
              AI-powered matching connects you with compatible study partners. Collaborate in real-time and achieve more together.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-20">
              <Link
                href="/auth/signup"
                className="px-10 py-5 bg-blue-600 text-white text-xl font-medium rounded-full hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
              >
                Get Started
              </Link>
              <Link
                href="#features"
                className="px-10 py-5 text-blue-600 text-xl font-medium rounded-full border-2 border-blue-600 hover:bg-blue-50 transition-all"
              >
                Learn More
              </Link>
            </div>
          </motion.div>

          {/* Hero Product Screenshot */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="max-w-6xl mx-auto"
          >
            <div className="relative">
              {/* Browser Window Frame */}
              <div className="bg-gray-100 rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
                {/* Browser Chrome */}
                <div className="bg-gray-200 px-4 py-3 flex items-center gap-2 border-b border-gray-300">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-white rounded px-3 py-1 text-sm text-gray-600">clerva.app</div>
                  </div>
                </div>
                {/* App Screenshot Mockup */}
                <div className="bg-white aspect-video flex items-center justify-center relative overflow-hidden">
                  {/* Dashboard mockup */}
                  <div className="w-full h-full bg-gradient-to-br from-blue-50 to-white p-8">
                    <div className="grid grid-cols-3 gap-6 h-full">
                      {/* Left: Profile Card */}
                      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                        <div className="flex flex-col items-center">
                          <div className="w-20 h-20 rounded-full bg-blue-100 mb-4"></div>
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-100 rounded w-1/2 mb-4"></div>
                          <div className="w-full space-y-2">
                            <div className="h-2 bg-blue-100 rounded"></div>
                            <div className="h-2 bg-blue-100 rounded w-4/5"></div>
                            <div className="h-2 bg-blue-100 rounded w-3/4"></div>
                          </div>
                        </div>
                      </div>
                      {/* Center: Match Feed */}
                      <div className="col-span-2 space-y-4">
                        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-full bg-blue-200"></div>
                            <div className="flex-1">
                              <div className="h-3 bg-gray-200 rounded w-1/3 mb-2"></div>
                              <div className="h-2 bg-gray-100 rounded w-1/4"></div>
                            </div>
                            <div className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg">Connect</div>
                          </div>
                          <div className="space-y-2">
                            <div className="h-2 bg-gray-100 rounded"></div>
                            <div className="h-2 bg-gray-100 rounded w-5/6"></div>
                          </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-full bg-indigo-200"></div>
                            <div className="flex-1">
                              <div className="h-3 bg-gray-200 rounded w-1/3 mb-2"></div>
                              <div className="h-2 bg-gray-100 rounded w-1/4"></div>
                            </div>
                            <div className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg">Connect</div>
                          </div>
                          <div className="space-y-2">
                            <div className="h-2 bg-gray-100 rounded"></div>
                            <div className="h-2 bg-gray-100 rounded w-4/5"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* AI Matching Section */}
      <section className="py-40 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
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
                Describe your ideal study partner and our intelligent AI analyzes thousands of profiles to find the best matches for you. No more endless searching.
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
              {/* AI Matching Interface Mockup */}
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                    <div className="h-6 bg-gray-900 rounded w-32"></div>
                    <div className="px-4 py-2 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">95% Match</div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600"></div>
                    <div className="flex-1">
                      <div className="h-5 bg-gray-900 rounded w-1/2 mb-3"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                        <div className="h-3 bg-gray-200 rounded w-4/6"></div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-4">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="h-3 bg-blue-600 rounded w-3/4 mx-auto mb-2"></div>
                      <div className="h-2 bg-blue-200 rounded w-1/2 mx-auto"></div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="h-3 bg-blue-600 rounded w-3/4 mx-auto mb-2"></div>
                      <div className="h-2 bg-blue-200 rounded w-1/2 mx-auto"></div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="h-3 bg-blue-600 rounded w-3/4 mx-auto mb-2"></div>
                      <div className="h-2 bg-blue-200 rounded w-1/2 mx-auto"></div>
                    </div>
                  </div>
                  <button className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg shadow-lg">
                    Connect
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Collaboration Section */}
      <section className="py-40 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-2 md:order-1"
            >
              {/* Video Call Interface Mockup */}
              <div className="bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
                <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 p-6 relative">
                  <div className="grid grid-cols-2 gap-3 h-full">
                    <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-lg border border-white/10"></div>
                    <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg border border-white/10"></div>
                    <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg border border-white/10"></div>
                    <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg border border-white/10"></div>
                  </div>
                  {/* Controls Bar */}
                  <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-3 bg-gray-800/90 backdrop-blur px-6 py-3 rounded-full">
                    <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20"></div>
                    <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20"></div>
                    <div className="w-10 h-10 rounded-full bg-red-500"></div>
                  </div>
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
      <section id="features" className="py-40 bg-gray-50">
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
                href: '/features/ai-agent'
              },
              {
                title: 'Real-time Collaboration',
                description: 'Video calls, chat, and whiteboards for seamless studying together.',
                href: '/features/real-time-collaboration'
              },
              {
                title: 'Study Groups',
                description: 'Create and join groups tailored to your subjects and goals.',
                href: '/features/study-groups'
              },
              {
                title: 'Community',
                description: 'Connect with thousands of learners and share knowledge.',
                href: '/features/community'
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
                  <div className="bg-white rounded-2xl p-10 border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 h-full">
                    <h3 className="text-3xl font-semibold text-gray-900 mb-4">{feature.title}</h3>
                    <p className="text-lg text-gray-600 font-light leading-relaxed mb-6">{feature.description}</p>
                    <span className="text-blue-600 font-medium group-hover:underline">Learn more →</span>
                  </div>
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
      <section className="py-40 bg-blue-600">
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
