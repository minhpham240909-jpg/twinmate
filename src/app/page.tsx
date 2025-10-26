'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'
import GradientText from '@/components/landing/GradientText'
import WebGLDotGrid from '@/components/landing/WebGLDotGrid'
import WebGLBorder from '@/components/landing/WebGLBorder'
import FloatingSignupButton from '@/components/landing/FloatingSignupButton'
import Footer from '@/components/landing/Footer'

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      {/* Floating Signup Button - Only on main page */}
      <FloatingSignupButton />

      {/* Hero Section with DotGrid Background */}
      <section className="relative pt-32 pb-48 overflow-hidden gpu-accelerated" style={{ contain: 'layout style paint' }}>
        {/* WebGL DotGrid Background */}
        <div className="absolute inset-0 opacity-40">
          <WebGLDotGrid
            dotSize={3}
            gap={40}
            baseColor="#3b82f6"
            activeColor="#6366f1"
            proximity={120}
            shockRadius={200}
            shockStrength={4}
          />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center max-w-5xl mx-auto"
          >
            {/* Gradient Headline */}
            <GradientText
              colors={['#3b82f6', '#8b5cf6', '#ec4899', '#8b5cf6', '#3b82f6']}
              animationSpeed={4}
              className="text-6xl md:text-8xl font-bold mb-8 tracking-tight"
            >
              Find your perfect
              <br />
              study partner.
            </GradientText>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-xl md:text-2xl text-slate-600 mb-12 font-light max-w-3xl mx-auto leading-relaxed"
            >
              AI-powered matching connects you with compatible study partners.
              <br className="hidden md:block" />
              Collaborate in real-time and achieve more together.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-6 justify-center"
            >
              <Link
                href="/auth/signup"
                className="group relative px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-medium rounded-full hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden"
              >
                <span className="relative z-10">Get Started Free</span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                  }}
                  style={{ backgroundSize: '200% 100%' }}
                />
              </Link>

              <Link
                href="#how-it-works"
                className="px-10 py-5 text-blue-600 text-lg font-medium rounded-full border-2 border-blue-600 hover:bg-blue-50 hover:scale-105 transition-all duration-300"
              >
                Learn More
              </Link>
            </motion.div>
          </motion.div>

          {/* Decorative Floating Elements - Reduced for performance */}
          <div className="mt-24 relative h-64">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: [0.2, 0.4, 0.2],
                  y: [0, -30, 0],
                }}
                transition={{
                  duration: 6 + i * 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.5,
                }}
                className={`absolute w-32 h-32 rounded-2xl bg-gradient-to-br gpu-accelerated ${
                  i % 3 === 0
                    ? 'from-blue-400/20 to-indigo-500/20'
                    : i % 3 === 1
                    ? 'from-purple-400/20 to-pink-500/20'
                    : 'from-indigo-400/20 to-blue-500/20'
                } backdrop-blur-sm`}
                style={{
                  left: `${20 + i * 25}%`,
                  top: `${Math.sin(i) * 30}%`,
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-32 bg-white relative overflow-hidden gpu-accelerated" style={{ contain: 'layout style paint' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
              Get started in <span className="text-blue-600">minutes.</span>
            </h2>
            <p className="text-xl text-slate-600 font-light max-w-2xl mx-auto">
              Three simple steps to find your perfect study partner.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                step: '1',
                title: 'Create Your Profile',
                description: 'Sign up and tell us about your subjects, learning style, and study goals.',
                color: '#3b82f6',
                gradient: 'from-blue-500 to-indigo-600',
              },
              {
                step: '2',
                title: 'Get Matched',
                description: 'Our AI analyzes thousands of profiles to find your perfect study partners.',
                color: '#8b5cf6',
                gradient: 'from-indigo-500 to-purple-600',
              },
              {
                step: '3',
                title: 'Start Studying',
                description: 'Connect instantly and collaborate with video calls, chat, and whiteboards.',
                color: '#ec4899',
                gradient: 'from-purple-500 to-pink-600',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
              >
                <WebGLBorder
                  color={item.color}
                  speed={0.8}
                  thickness={2}
                  glowIntensity={1.2}
                  className="h-full rounded-3xl"
                >
                  <motion.div
                    whileHover={{ y: -5 }}
                    className="bg-gradient-to-br from-white to-slate-50 rounded-3xl p-10 h-full"
                  >
                    {/* Step Number Badge */}
                    <div className="mb-6 flex items-center justify-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.15 + 0.3, type: 'spring' }}
                        className={`w-20 h-20 bg-gradient-to-br ${item.gradient} rounded-2xl flex items-center justify-center shadow-lg`}
                      >
                        <span className="text-3xl font-bold text-white">{item.step}</span>
                      </motion.div>
                    </div>

                    <h3 className="text-2xl font-bold text-slate-900 mb-4 text-center">{item.title}</h3>
                    <p className="text-slate-600 leading-relaxed text-center">{item.description}</p>
                  </motion.div>
                </WebGLBorder>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-100 to-transparent rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-100 to-transparent rounded-full blur-3xl opacity-30" />
      </section>

      {/* AI Matching Section */}
      <section className="py-32 bg-gradient-to-b from-white to-blue-50/50 relative overflow-hidden gpu-accelerated" style={{ contain: 'layout style paint' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
                AI-powered matching that <GradientText colors={['#3b82f6', '#8b5cf6', '#3b82f6']} animationSpeed={3} className="text-5xl md:text-6xl font-bold inline-block">actually works.</GradientText>
              </h2>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                Our advanced AI analyzes your learning style, subject preferences, goals, and availability to find the most compatible study partners.
              </p>
              <ul className="space-y-4">
                {[
                  'Multidimensional compatibility scoring',
                  'Real-time availability matching',
                  'Shared interest discovery',
                  'Learning style alignment',
                ].map((feature, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    className="flex items-center gap-3 text-slate-700"
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-lg">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Visual Element */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <WebGLBorder color="#6366f1" speed={0.6} thickness={3} glowIntensity={1.5} className="rounded-3xl">
                <div className="bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 rounded-3xl p-12 relative overflow-hidden gpu-accelerated">
                  {/* Simplified background pattern */}
                  <div className="absolute inset-0 opacity-10">
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          y: [0, -100],
                          opacity: [0, 0.5, 0],
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          delay: i * 0.5,
                          ease: 'linear',
                        }}
                        className="absolute w-1 h-8 bg-white rounded-full gpu-accelerated"
                        style={{
                          left: `${i * 12}%`,
                          bottom: 0,
                        }}
                      />
                    ))}
                  </div>

                  {/* Center content */}
                  <div className="relative z-10 text-center text-white">
                    <motion.div
                      animate={{
                        scale: [1, 1.05, 1],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                      }}
                      className="mb-6"
                    >
                      <div className="w-32 h-32 mx-auto bg-white/20 rounded-full backdrop-blur-sm flex items-center justify-center">
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                    </motion.div>
                    <h3 className="text-3xl font-bold mb-4">Smart Matching</h3>
                    <p className="text-blue-100 text-lg">Connecting 10,000+ students worldwide</p>
                  </div>
                </div>
              </WebGLBorder>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Video Call Section */}
      <section className="py-32 bg-white relative overflow-hidden gpu-accelerated" style={{ contain: 'layout style paint' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Visual First on this section */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-2 lg:order-1"
            >
              <WebGLBorder color="#ec4899" speed={0.7} thickness={2} glowIntensity={1.3} className="rounded-3xl">
                <div className="bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-700 rounded-3xl p-8 relative overflow-hidden gpu-accelerated">
                  {/* Video Grid Mockup */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {[1, 2, 3, 4].map((i) => (
                      <motion.div
                        key={i}
                        animate={{
                          opacity: [0.8, 1, 0.8],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          delay: i * 0.5,
                          ease: 'easeInOut',
                        }}
                        className="aspect-square bg-white/10 backdrop-blur-md rounded-xl border-2 border-white/30 flex items-center justify-center relative overflow-hidden gpu-accelerated"
                      >
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Control Bar */}
                  <div className="bg-black/30 backdrop-blur-md rounded-2xl p-4 flex justify-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </div>
                    <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </WebGLBorder>
            </motion.div>

            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-1 lg:order-2"
            >
              <h2 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
                Study together, <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">anywhere.</span>
              </h2>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                Built-in video calls, screen sharing, and collaborative whiteboards make it easy to study together in real-time.
              </p>
              <ul className="space-y-4">
                {[
                  'HD video calls with up to 8 participants',
                  'Screen sharing and collaborative whiteboards',
                  'Real-time chat and file sharing',
                  'Session recording and playback',
                ].map((feature, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    className="flex items-center gap-3 text-slate-700"
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-lg">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-gradient-to-bl from-pink-100 to-transparent rounded-full blur-3xl opacity-30" />
      </section>

      {/* Features Grid Section */}
      <section className="py-32 bg-gradient-to-b from-white to-slate-50 relative overflow-hidden gpu-accelerated" style={{ contain: 'layout style paint' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
              Everything you need to <span className="text-blue-600">succeed.</span>
            </h2>
            <p className="text-xl text-slate-600 font-light max-w-2xl mx-auto">
              Powerful features designed to enhance your learning experience.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: 'AI-Powered Matching',
                description: 'Find your perfect study partner with advanced compatibility algorithms.',
                icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
                gradient: 'from-blue-500 to-indigo-600',
                href: '/features/ai-agent',
              },
              {
                title: 'Real-Time Collaboration',
                description: 'Video calls, screen sharing, and collaborative whiteboards in one place.',
                icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
                gradient: 'from-indigo-500 to-purple-600',
                href: '/features/real-time-collaboration',
              },
              {
                title: 'Study Groups',
                description: 'Create and join study groups for collaborative learning.',
                icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
                gradient: 'from-purple-500 to-pink-600',
                href: '/features/study-groups',
              },
              {
                title: 'Community Forums',
                description: 'Connect with thousands of students and share knowledge.',
                icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z',
                gradient: 'from-pink-500 to-red-600',
                href: '/features/community',
              },
              {
                title: 'Progress Tracking',
                description: 'Track your study sessions, goals, and achievements.',
                icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                gradient: 'from-orange-500 to-yellow-600',
                href: '/dashboard',
              },
              {
                title: 'Smart Scheduling',
                description: 'Find the perfect time to study with automated schedule matching.',
                icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
                gradient: 'from-green-500 to-teal-600',
                href: '/dashboard',
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <Link href={feature.href}>
                  <motion.div whileHover={{ y: -5 }} className="h-full">
                    <WebGLBorder
                      color={index % 3 === 0 ? '#3b82f6' : index % 3 === 1 ? '#8b5cf6' : '#ec4899'}
                      speed={0.5 + index * 0.1}
                      thickness={1.5}
                      glowIntensity={1}
                      className="h-full rounded-3xl"
                    >
                      <div className="bg-white rounded-3xl p-8 h-full cursor-pointer flex flex-col gpu-accelerated">
                        <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                          </svg>
                        </div>

                        <h3 className="text-2xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                        <p className="text-slate-600 leading-relaxed mb-4 flex-grow">{feature.description}</p>

                        <span className="text-blue-600 font-medium inline-flex items-center gap-2 group-hover:gap-3 transition-all">
                          Learn more
                          <motion.span
                            animate={{ x: [0, 4, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            →
                          </motion.span>
                        </span>
                      </div>
                    </WebGLBorder>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 relative overflow-hidden gpu-accelerated" style={{ contain: 'layout style paint' }}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <WebGLDotGrid
            dotSize={2}
            gap={30}
            baseColor="#ffffff"
            activeColor="#ffffff"
            proximity={100}
            shockRadius={150}
            shockStrength={3}
          />
        </div>

        <div className="max-w-5xl mx-auto px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Ready to find your study partner?
            </h2>
            <p className="text-xl md:text-2xl text-blue-100 mb-12 font-light">
              Join thousands of students already studying smarter, not harder.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link
                href="/auth/signup"
                className="group px-12 py-6 bg-white text-blue-600 text-xl font-bold rounded-full hover:scale-105 hover:shadow-2xl transition-all duration-300"
              >
                <span>Get Started Free</span>
              </Link>

              <Link
                href="#how-it-works"
                className="px-12 py-6 text-white text-xl font-bold rounded-full border-2 border-white hover:bg-white/10 hover:scale-105 transition-all duration-300"
              >
                Watch Demo
              </Link>
            </div>

            <p className="mt-8 text-blue-200">
              No credit card required • Free forever • 2 minute setup
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-32 bg-white gpu-accelerated" style={{ contain: 'layout style paint' }}>
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
              Frequently asked <span className="text-blue-600">questions.</span>
            </h2>
            <p className="text-xl text-slate-600">
              Everything you need to know about Clerva.
            </p>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                question: 'How does the AI matching work?',
                answer: 'Our AI analyzes your profile including subjects, learning style, goals, availability, and preferences to find the most compatible study partners. We use advanced algorithms to ensure high-quality matches.',
              },
              {
                question: 'Is Clerva free to use?',
                answer: 'Yes! Clerva is completely free for all students. We believe in making quality education accessible to everyone.',
              },
              {
                question: 'Can I study with multiple partners?',
                answer: 'Absolutely! You can connect with as many study partners as you like and create or join multiple study groups.',
              },
              {
                question: 'What subjects are supported?',
                answer: 'We support all subjects and topics! From math and science to languages and humanities, you can find study partners for any subject.',
              },
              {
                question: 'Do I need to download anything?',
                answer: 'No downloads required! Clerva works entirely in your browser. Just sign up and start studying.',
              },
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full text-left bg-slate-50 hover:bg-slate-100 rounded-2xl p-6 transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900 pr-8">{faq.question}</h3>
                    <motion.div
                      animate={{ rotate: openFaq === index ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex-shrink-0"
                    >
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.div>
                  </div>

                  <motion.div
                    initial={false}
                    animate={{
                      height: openFaq === index ? 'auto' : 0,
                      opacity: openFaq === index ? 1 : 0,
                    }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="mt-4 text-slate-600 leading-relaxed">{faq.answer}</p>
                  </motion.div>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}
