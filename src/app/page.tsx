'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'
import GradientText from '@/components/landing/GradientText'
import ModernHeroBackground from '@/components/landing/ModernHeroBackground'
import ModernDotPattern from '@/components/landing/ModernDotPattern'
import GlowBorder from '@/components/ui/GlowBorder'
import FloatingSignupButton from '@/components/landing/FloatingSignupButton'
import Footer from '@/components/landing/Footer'

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set())

  return (
    <div className="min-h-screen bg-white">
      {/* Floating Signup Button */}
      <FloatingSignupButton />

      {/* Hero Section - Modern & Professional */}
      <section className="relative pt-40 pb-32 overflow-hidden">
        <div className="absolute inset-0">
          <ModernHeroBackground />
        </div>
        
        {/* Professional overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-slate-900/30 to-transparent" />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-center max-w-5xl mx-auto"
          >
            {/* Professional Gradient Headline */}
            <div className="mb-8">
              <GradientText
                colors={['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#3b82f6']}
                animationSpeed={5}
                className="text-6xl md:text-7xl lg:text-8xl font-bold mb-4 tracking-tight leading-tight"
              >
                Find your perfect
                <br />
                study partner.
              </GradientText>
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-xl md:text-2xl text-slate-200 mb-12 font-light max-w-3xl mx-auto leading-relaxed"
            >
              Connect with study partners who share your subjects, goals, and learning style.
              <br className="hidden md:block" />
              Collaborate in real-time and achieve more together.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link
                href="/auth/signup"
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:shadow-2xl hover:shadow-blue-500/50 hover:scale-105 transition-all duration-300 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Get Started Now
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>

              <Link
                href="#how-it-works"
                className="px-8 py-4 text-white text-lg font-semibold rounded-xl border-2 border-white/20 hover:bg-white/10 hover:border-white/30 hover:scale-105 transition-all duration-300 backdrop-blur-sm bg-white/5"
              >
                Learn More
              </Link>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="mt-16 flex flex-wrap items-center justify-center gap-8 text-slate-300 text-sm"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>10,000+ Students</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>100% Free</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Secure & Private</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section - Professional Cards */}
      <section id="how-it-works" className="py-24 bg-gradient-to-b from-white to-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
              Get started in <span className="text-blue-600">minutes.</span>
            </h2>
            <p className="text-lg md:text-xl text-slate-600 font-light max-w-2xl mx-auto">
              Three simple steps to find your perfect study partner.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
            {[
              {
                step: '1',
                title: 'Create Your Profile',
                description: 'Sign up and tell us about your subjects, learning style, and study goals.',
                color: '#3b82f6',
                gradient: 'from-blue-500 to-indigo-600',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                ),
              },
              {
                step: '2',
                title: 'Get Matched',
                description: 'Browse through thousands of profiles and connect with study partners who share your interests and goals.',
                color: '#8b5cf6',
                gradient: 'from-indigo-500 to-purple-600',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                ),
              },
              {
                step: '3',
                title: 'Start Studying',
                description: 'Connect instantly and collaborate with video calls, chat, and whiteboards.',
                color: '#ec4899',
                gradient: 'from-purple-500 to-pink-600',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: index * 0.1, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                className="group"
              >
                <div className="h-full bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-slate-100 group-hover:border-blue-200 group-hover:-translate-y-1">
                  {/* Step Number Badge */}
                  <div className="mb-6 flex items-center justify-between">
                    <div className={`w-16 h-16 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center shadow-lg text-white`}>
                      {item.icon}
                    </div>
                    <div className={`w-12 h-12 bg-gradient-to-br ${item.gradient} rounded-full flex items-center justify-center shadow-md`}>
                      <span className="text-xl font-bold text-white">{item.step}</span>
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner Matching Section - Professional Layout */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 tracking-tight">
                Find partners that <GradientText colors={['#3b82f6', '#6366f1', '#8b5cf6']} animationSpeed={4} className="text-4xl md:text-5xl lg:text-6xl font-bold inline-block">fit your goals.</GradientText>
              </h2>
              <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed">
                Search and filter profiles by subjects, learning preferences, goals, and availability. Find study partners who share your interests and help you succeed.
              </p>
              <ul className="space-y-5">
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
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="flex items-center gap-4 text-slate-700 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-lg font-medium">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Visual Element - Professional Card */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-3xl p-10 relative overflow-hidden shadow-2xl">
                {/* Professional background pattern */}
                <div className="absolute inset-0 opacity-10">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-16 bg-white rounded-full"
                      style={{
                        left: `${i * 8}%`,
                        bottom: 0,
                        animation: `slideUp 5s linear infinite`,
                        animationDelay: `${i * 0.4}s`,
                      }}
                    />
                  ))}
                </div>

                {/* Center content */}
                <div className="relative z-10 text-center text-white">
                  <div className="mb-8">
                    <div className="w-32 h-32 mx-auto bg-white/20 rounded-2xl backdrop-blur-md flex items-center justify-center shadow-xl border border-white/30">
                      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold mb-3">Partner Matching</h3>
                  <p className="text-blue-100 text-lg font-light">Connecting 10,000+ students worldwide</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Video Call Section - Professional Design */}
      <section className="py-24 bg-gradient-to-b from-white to-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Visual First */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
              className="order-2 lg:order-1"
            >
              <div className="bg-gradient-to-br from-pink-600 via-purple-700 to-indigo-800 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
                {/* Professional Video Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="aspect-square bg-white/10 backdrop-blur-md rounded-xl border-2 border-white/20 flex items-center justify-center relative overflow-hidden"
                    >
                      <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Professional Control Bar */}
                <div className="bg-black/30 backdrop-blur-md rounded-xl p-4 flex justify-center gap-3">
                  {[
                    { icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
                    { icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
                    { icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' },
                  ].map((btn, idx) => (
                    <div key={idx} className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center cursor-pointer hover:bg-white/30 transition-all hover:scale-110">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={btn.icon} />
                      </svg>
                    </div>
                  ))}
                  <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center cursor-pointer hover:bg-red-600 transition-all hover:scale-110 shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
              className="order-1 lg:order-2"
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 tracking-tight">
                Study together, <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-purple-600">anywhere.</span>
              </h2>
              <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed">
                Built-in video calls, screen sharing, and collaborative whiteboards make it easy to study together in real-time.
              </p>
              <ul className="space-y-5">
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
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="flex items-center gap-4 text-slate-700 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-lg font-medium">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid Section - Professional Cards */}
      <section id="features" className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
              Everything you need to <span className="text-blue-600">succeed.</span>
            </h2>
            <p className="text-lg md:text-xl text-slate-600 font-light max-w-2xl mx-auto">
              Powerful features designed to enhance your learning experience.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Find Study Partners',
                description: 'Search and filter through profiles by subjects, interests, and goals. View compatibility scores based on your learning preferences and send connection requests to find your perfect study match.',
                icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
                gradient: 'from-blue-500 to-indigo-600',
                color: '#3b82f6',
              },
              {
                title: 'Study Groups',
                description: 'Create or join study groups with up to 50 members. Choose between public, private, or invite-only groups with role-based permissions for organized collaborative learning.',
                icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
                gradient: 'from-purple-500 to-pink-600',
                color: '#8b5cf6',
              },
              {
                title: 'Live Study Sessions',
                description: 'Start video calls with up to 10 participants. Collaborate with shared whiteboards, real-time notes, flashcards with spaced repetition, and built-in Pomodoro timers for focused study sessions.',
                icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
                gradient: 'from-indigo-500 to-purple-600',
                color: '#6366f1',
              },
              {
                title: 'Direct Messaging',
                description: 'Chat with study partners and groups in real-time. Send messages, share files, and make voice or video calls with typing indicators and read receipts to stay connected.',
                icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
                gradient: 'from-pink-500 to-red-600',
                color: '#ec4899',
              },
              {
                title: 'Community Feed',
                description: 'Share posts, like, and engage with thousands of students. Choose between recommended, chronological, or trending feeds with privacy controls for your content.',
                icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z',
                gradient: 'from-orange-500 to-yellow-600',
                color: '#f59e0b',
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
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ delay: index * 0.08, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                  style={{ perspective: '1000px' }}
                  className="h-full min-h-[360px]"
                >
                  <div
                    onClick={toggleFlip}
                    className="h-full relative cursor-pointer group"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <div
                      className="h-full w-full relative transition-transform duration-700 ease-out"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      }}
                    >
                      {/* Front of Card */}
                      <div
                        className="absolute inset-0"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                        }}
                      >
                        <div className="h-full bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-slate-100 group-hover:border-blue-200 group-hover:-translate-y-1 flex flex-col items-center justify-center">
                          <div className={`w-20 h-20 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-xl`}>
                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                            </svg>
                          </div>
                          <h3 className="text-2xl font-bold text-slate-900 text-center mb-2">{feature.title}</h3>
                          <p className="text-sm text-slate-500 text-center">Click to learn more</p>
                        </div>
                      </div>

                      {/* Back of Card */}
                      <div
                        className="absolute inset-0"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                        }}
                      >
                        <div className="h-full bg-gradient-to-br from-slate-50 to-white rounded-2xl p-8 shadow-2xl border-2 border-slate-200 flex flex-col justify-center">
                          <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-5 shadow-lg mx-auto`}>
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                            </svg>
                          </div>
                          <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">{feature.title}</h3>
                          <p className="text-slate-700 leading-relaxed text-sm text-center">{feature.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Section - Professional Design */}
      <section className="py-32 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <ModernDotPattern dotSize={2} gap={40} color="rgba(255,255,255,0.2)" />
        </div>

        <div className="max-w-5xl mx-auto px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
              Ready to find your study partner?
            </h2>
            <p className="text-xl md:text-2xl text-blue-100 mb-12 font-light max-w-3xl mx-auto">
              Join thousands of students already studying smarter, not harder.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Link
                href="/auth/signup"
                className="group px-10 py-5 bg-white text-blue-600 text-xl font-bold rounded-xl hover:scale-105 hover:shadow-2xl transition-all duration-300 flex items-center gap-2"
              >
                <span>Get Started Now</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>

              <Link
                href="#how-it-works"
                className="px-10 py-5 text-white text-xl font-bold rounded-xl border-2 border-white/30 hover:bg-white/10 hover:scale-105 transition-all duration-300 backdrop-blur-sm"
              >
                Watch Demo
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-blue-200 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Free forever</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>2 minute setup</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section - Professional Accordion */}
      <section id="faq" className="py-24 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
              Frequently asked <span className="text-blue-600">questions.</span>
            </h2>
            <p className="text-lg md:text-xl text-slate-600">
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
                transition={{ delay: index * 0.05, duration: 0.4 }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full text-left bg-white hover:bg-slate-50 rounded-xl p-6 transition-all duration-300 shadow-sm hover:shadow-md border border-slate-100"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg md:text-xl font-bold text-slate-900 pr-8">{faq.question}</h3>
                    <motion.div
                      animate={{ rotate: openFaq === index ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"
                    >
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes slideUp {
          0% {
            transform: translateY(100%);
            opacity: 0;
          }
          10% {
            opacity: 0.5;
          }
          90% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(-100%);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
