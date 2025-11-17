'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'
import GradientText from '@/components/landing/GradientText'
import WebGLDotGrid from '@/components/landing/WebGLDotGrid'
import WebGLBorder from '@/components/landing/WebGLBorder'
import ElectricBorder from '@/components/landing/ElectricBorder'
import DarkVeil from '@/components/landing/DarkVeil'
import FloatingSignupButton from '@/components/landing/FloatingSignupButton'
import Footer from '@/components/landing/Footer'

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set())

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      {/* Floating Signup Button - Only on main page */}
      <FloatingSignupButton />

      {/* Hero Section with DarkVeil Background */}
      <section className="relative pt-32 pb-48 overflow-hidden gpu-accelerated" style={{ contain: 'layout style paint' }}>
        {/* DarkVeil Background */}
        <div className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
          <DarkVeil 
            hueShift={0}
            noiseIntensity={0}
            scanlineIntensity={0}
            speed={0.5}
            scanlineFrequency={0}
            warpAmount={0}
            resolutionScale={1}
          />
        </div>
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-blue-900/30 to-transparent" />

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
              Connect with study partners who share your subjects, goals, and learning style.
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
                <span className="relative z-10">Get Started Now</span>
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
                description: 'Browse through thousands of profiles and connect with study partners who share your interests and goals.',
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
                <ElectricBorder
                  color={item.color}
                  speed={1}
                  chaos={0.5}
                  thickness={2}
                  style={{ borderRadius: 24 }}
                  className="h-full"
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
                </ElectricBorder>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-100 to-transparent rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-100 to-transparent rounded-full blur-3xl opacity-30" />
      </section>

      {/* Partner Matching Section */}
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
                Find partners that <GradientText colors={['#3b82f6', '#8b5cf6', '#3b82f6']} animationSpeed={3} className="text-5xl md:text-6xl font-bold inline-block">fit your goals.</GradientText>
              </h2>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                Search and filter profiles by subjects, learning preferences, goals, and availability. Find study partners who share your interests and help you succeed.
              </p>
              <ul className="space-y-4">
                {[
                  'Filter by subjects and interests',
                  'Match by availability and timezone',
                  'Discover shared learning goals',
                  'Connect with compatible study styles',
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
              <ElectricBorder color="#6366f1" speed={1} chaos={0.5} thickness={3} style={{ borderRadius: 24 }}>
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                    </motion.div>
                    <h3 className="text-3xl font-bold mb-4">Partner Matching</h3>
                    <p className="text-blue-100 text-lg">Connecting 10,000+ students worldwide</p>
                  </div>
                </div>
              </ElectricBorder>
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
              <ElectricBorder color="#ec4899" speed={1} chaos={0.5} thickness={2} style={{ borderRadius: 24 }}>
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
              </ElectricBorder>
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
      <section id="features" className="py-32 bg-gradient-to-b from-white to-slate-50 relative overflow-hidden gpu-accelerated" style={{ contain: 'layout style paint' }}>
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
                title: 'Find Study Partners',
                description: 'Search and filter through profiles by subjects, interests, and goals. View compatibility scores based on your learning preferences and send connection requests to find your perfect study match.',
                icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
                gradient: 'from-blue-500 to-indigo-600',
                href: '/auth/signup',
              },
              {
                title: 'Study Groups',
                description: 'Create or join study groups with up to 50 members. Choose between public, private, or invite-only groups with role-based permissions for organized collaborative learning.',
                icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
                gradient: 'from-purple-500 to-pink-600',
                href: '/auth/signup',
              },
              {
                title: 'Live Study Sessions',
                description: 'Start video calls with up to 10 participants. Collaborate with shared whiteboards, real-time notes, flashcards with spaced repetition, and built-in Pomodoro timers for focused study sessions.',
                icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
                gradient: 'from-indigo-500 to-purple-600',
                href: '/auth/signup',
              },
              {
                title: 'Direct Messaging',
                description: 'Chat with study partners and groups in real-time. Send messages, share files, and make voice or video calls with typing indicators and read receipts to stay connected.',
                icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
                gradient: 'from-pink-500 to-red-600',
                href: '/auth/signup',
              },
              {
                title: 'Community Feed',
                description: 'Share posts, like, and engage with thousands of students. Choose between recommended, chronological, or trending feeds with privacy controls for your content.',
                icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z',
                gradient: 'from-orange-500 to-yellow-600',
                href: '/auth/signup',
              },
            ].map((feature, index) => {
              const isFlipped = flippedCards.has(index)

              const toggleFlip = () => {
                setFlippedCards(prev => {
                  const newSet = new Set(prev)
                  if (newSet.has(index)) {
                    newSet.delete(index)
                  } else {
                    newSet.add(index)
                  }
                  return newSet
                })
              }

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  style={{ perspective: '1000px' }}
                  className="h-full min-h-[320px]"
                >
                  <motion.div
                    whileHover={{ y: -5 }}
                    onClick={toggleFlip}
                    className="h-full relative cursor-pointer"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <motion.div
                      animate={{ rotateY: isFlipped ? 180 : 0 }}
                      transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
                      className="h-full w-full relative"
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      {/* Front of Card */}
                      <div
                        className="absolute inset-0"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(0deg)'
                        }}
                      >
                        <ElectricBorder
                          color={index % 3 === 0 ? '#3b82f6' : index % 3 === 1 ? '#8b5cf6' : '#ec4899'}
                          speed={1}
                          chaos={0.5}
                          thickness={1.5}
                          style={{ borderRadius: 24 }}
                          className="h-full"
                        >
                          <div className="bg-white rounded-3xl p-8 h-full flex flex-col items-center justify-center">
                            <div className={`w-20 h-20 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                              </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 text-center">{feature.title}</h3>
                          </div>
                        </ElectricBorder>
                      </div>

                      {/* Back of Card */}
                      <div
                        className="absolute inset-0"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)'
                        }}
                      >
                        <ElectricBorder
                          color={index % 3 === 0 ? '#3b82f6' : index % 3 === 1 ? '#8b5cf6' : '#ec4899'}
                          speed={1}
                          chaos={0.5}
                          thickness={1.5}
                          style={{ borderRadius: 24 }}
                          className="h-full"
                        >
                          <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl p-8 h-full flex flex-col justify-center">
                            <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-5 shadow-lg mx-auto`}>
                              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                              </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">{feature.title}</h3>
                            <p className="text-slate-700 leading-relaxed text-base text-center px-2">{feature.description}</p>
                          </div>
                        </ElectricBorder>
                      </div>
                    </motion.div>
                  </motion.div>
                </motion.div>
              )
            })}
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
                <span>Get Started Now</span>
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
                question: 'How does partner matching work?',
                answer: 'Browse through student profiles and filter by subjects, interests, learning goals, and study preferences. Each profile shows a compatibility score based on how well your preferences align. Send connection requests to partners you\'d like to study with.',
              },
              {
                question: 'How many people can join a study session?',
                answer: 'Live study sessions support up to 10 participants with video calls, shared whiteboards, collaborative notes, and flashcards. Sessions include a 30-minute waiting lobby before they start, giving everyone time to prepare.',
              },
              {
                question: 'What are the study group limits?',
                answer: 'Each study group can have up to 50 members. You can create public groups (anyone can join), private groups (members must request to join), or invite-only groups. Group owners and moderators can manage roles and permissions.',
              },
              {
                question: 'Is Clerva completely free?',
                answer: 'Yes! Clerva is 100% free with no hidden fees or premium tiers. All features including video calls, messaging, study groups, and community access are available to every user at no cost.',
              },
              {
                question: 'How does the community feed work?',
                answer: 'The community feed has three viewing modes: Recommended (shows posts from your study partners first), Chronological (newest posts first), and Trending (most popular posts). You can control who sees your posts with privacy settings for each post you share.',
              },
              {
                question: 'Can I message study partners directly?',
                answer: 'Yes! Once connected, you can chat with partners in real-time with typing indicators and read receipts. You can also send messages in group chats, share files, and make voice or video calls directly through the messaging feature.',
              },
              {
                question: 'What study tools are available in sessions?',
                answer: 'Study sessions include collaborative whiteboards, shared notes that everyone can edit in real-time, flashcards with spaced repetition (SM-2 algorithm), and Pomodoro timers to help you stay focused during study blocks.',
              },
              {
                question: 'Is my data private and secure?',
                answer: 'We take privacy seriously. Your data is stored securely, and you control who sees your profile information. Posts can be set to public, friends-only, or private. We never share your personal information with third parties.',
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
