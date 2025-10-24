'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-20 pb-40 bg-white overflow-hidden">
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

          {/* 3D Hero Illustration */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="max-w-5xl mx-auto relative"
            style={{ perspective: '1000px' }}
          >
            <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
              {/* 3D Floating Cards */}
              <motion.div
                animate={{
                  rotateY: [0, 5, 0],
                  rotateX: [0, -5, 0],
                }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="relative z-10"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-3xl p-12 shadow-2xl">
                  <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur"></div>
                    <div className="flex-1">
                      <div className="h-6 bg-white/30 rounded-lg w-2/3 mb-3"></div>
                      <div className="h-4 bg-white/20 rounded-lg w-1/2"></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-white/20 rounded-lg"></div>
                    <div className="h-4 bg-white/20 rounded-lg w-5/6"></div>
                    <div className="h-4 bg-white/20 rounded-lg w-4/6"></div>
                  </div>
                </div>
              </motion.div>

              {/* Background 3D Elements */}
              <motion.div
                animate={{
                  y: [0, -20, 0],
                  rotateZ: [0, 5, 0]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-10 -right-10 w-64 h-64 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full opacity-20 blur-3xl"
              ></motion.div>

              <motion.div
                animate={{
                  y: [0, 20, 0],
                  rotateZ: [0, -5, 0]
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-10 -left-10 w-64 h-64 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-full opacity-20 blur-3xl"
              ></motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-40 bg-gray-50">
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
                description: 'Sign up and tell us about your subjects, learning style, and study goals.'
              },
              {
                step: '2',
                title: 'Get Matched',
                description: 'Our AI analyzes thousands of profiles to find your perfect study partners.'
              },
              {
                step: '3',
                title: 'Start Studying',
                description: 'Connect instantly and collaborate with video calls, chat, and whiteboards.'
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
                {/* 3D Step Card */}
                <div className="relative" style={{ perspective: '800px' }}>
                  <motion.div
                    whileHover={{
                      rotateY: 5,
                      rotateX: -5,
                      scale: 1.02
                    }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-2xl p-10 shadow-xl border border-gray-100"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mb-6 shadow-lg">
                      {item.step}
                    </div>
                    <h3 className="text-3xl font-semibold text-gray-900 mb-4">{item.title}</h3>
                    <p className="text-lg text-gray-600 font-light leading-relaxed">{item.description}</p>
                  </motion.div>
                </div>

                {/* Connection Line */}
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-6 w-12 h-0.5 bg-gray-300"></div>
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
      <section className="py-40 bg-white">
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
              style={{ perspective: '1000px' }}
            >
              {/* 3D AI Visualization */}
              <motion.div
                animate={{
                  rotateY: [0, 10, 0],
                  rotateX: [0, -10, 0],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative"
              >
                <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl p-12 shadow-2xl">
                  {/* AI Network Nodes */}
                  <div className="relative h-64">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-blue-600 rounded-full shadow-xl"
                    ></motion.div>

                    {[0, 72, 144, 216, 288].map((angle, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 1, 0.5]
                        }}
                        transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                        className="absolute w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full shadow-lg"
                        style={{
                          top: `${50 + 35 * Math.sin((angle * Math.PI) / 180)}%`,
                          left: `${50 + 35 * Math.cos((angle * Math.PI) / 180)}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      ></motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Collaboration Section */}
      <section className="py-40 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-2 md:order-1"
              style={{ perspective: '1000px' }}
            >
              {/* 3D Collaboration Visualization */}
              <motion.div
                animate={{
                  rotateY: [0, -10, 0],
                  rotateX: [0, 10, 0],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative"
              >
                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-8 shadow-2xl">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {[1, 2, 3, 4].map((i) => (
                      <motion.div
                        key={i}
                        animate={{
                          scale: [1, 1.05, 1],
                          opacity: [0.8, 1, 0.8]
                        }}
                        transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
                        className="aspect-square bg-white/10 backdrop-blur rounded-xl border border-white/20"
                      ></motion.div>
                    ))}
                  </div>
                  <div className="flex justify-center gap-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full border border-white/30"></div>
                    <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full border border-white/30"></div>
                    <div className="w-12 h-12 bg-red-500 rounded-full shadow-lg"></div>
                  </div>
                </div>
              </motion.div>
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
      <section id="features" className="py-40 bg-white">
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
                  <motion.div
                    whileHover={{ scale: 1.02, y: -5 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-2xl p-10 border border-gray-200 hover:border-blue-300 hover:shadow-2xl transition-all duration-300 h-full"
                  >
                    <h3 className="text-3xl font-semibold text-gray-900 mb-4">{feature.title}</h3>
                    <p className="text-lg text-gray-600 font-light leading-relaxed mb-6">{feature.description}</p>
                    <span className="text-blue-600 font-medium group-hover:underline">Learn more →</span>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-40 bg-gray-50">
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
                  className="w-full px-6 py-8 text-left flex items-start justify-between hover:bg-white transition-colors rounded-lg"
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
