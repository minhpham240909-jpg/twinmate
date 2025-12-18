'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import GradientText from '@/components/landing/GradientText'
import Footer from '@/components/landing/Footer'

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 relative overflow-x-hidden selection:bg-blue-500/30">

      {/* Floating Header */}
      <header className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${
        scrolled ? 'w-[95%] max-w-5xl' : 'w-[90%] max-w-4xl'
      }`}>
        <div className={`bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-lg shadow-slate-900/5 px-6 py-3 flex items-center justify-between transition-all duration-500 ${
          scrolled ? 'bg-white/95' : ''
        }`}>
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Clerva" width={100} height={32} className="h-8 w-auto" />
            <span className="text-slate-900 text-lg font-bold tracking-tight">
              Clerva<sup className="text-[10px] font-medium text-slate-500 ml-0.5">™</sup>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#how-it-works" className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium">
              How it works
            </Link>
            <Link href="#features" className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium">
              Features
            </Link>
            <Link href="/auth/signin" className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium">
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-all hover:shadow-lg hover:shadow-slate-900/20 hover:-translate-y-0.5"
            >
              Get Started
            </Link>
          </nav>
          {/* Mobile menu button */}
          <button className="md:hidden p-2 text-slate-600 hover:text-slate-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Hero Section - Light Theme */}
      <section className="relative pt-40 pb-32 overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 via-white to-slate-50" />

        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-t from-slate-100 to-transparent" />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-center max-w-5xl mx-auto"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm mb-8"
            >
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-slate-600 text-sm font-medium">Now available for students worldwide</span>
            </motion.div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight leading-[1.1]">
              <span className="text-slate-900">Find your perfect</span>
              <br />
              <GradientText
                colors={['#3b82f6', '#8b5cf6', '#ec4899', '#8b5cf6', '#3b82f6']}
                animationSpeed={6}
                className="text-5xl md:text-6xl lg:text-7xl font-bold"
              >
                study partner.
              </GradientText>
            </h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-lg md:text-xl text-slate-600 mb-10 font-normal max-w-2xl mx-auto leading-relaxed"
            >
              Connect with study partners who share your subjects, goals, and learning style.
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
                className="group px-8 py-4 bg-slate-900 text-white text-base font-semibold rounded-xl hover:bg-slate-800 transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/20 hover:-translate-y-1 flex items-center gap-2"
              >
                Get Started Free
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>

              <Link
                href="#how-it-works"
                className="px-8 py-4 text-slate-700 text-base font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-300 hover:-translate-y-1 shadow-sm"
              >
                See How It Works
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Find Partner Section */}
      <section className="py-24 relative bg-gradient-to-b from-white via-slate-50 to-slate-900 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7 }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
                Find partners that{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600">
                  fit your goals.
                </span>
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
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
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="flex items-center gap-4 text-slate-700 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-lg font-medium">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Screenshot Display */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7 }}
              className="relative"
            >
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-rose-500/20 rounded-3xl blur-2xl" />

              {/* Screenshot */}
              <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xl">
                <div className="relative aspect-[4/3] bg-slate-100">
                  <Image
                    src="/screenshots/find-partner.png"
                    alt="Find Study Partners"
                    fill
                    className="object-cover object-top"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section - Dark Theme */}
      <section id="how-it-works" className="py-32 relative bg-slate-900 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-slate-900/0 to-transparent" />
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
              Get started in <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">minutes.</span>
            </h2>
            <p className="text-lg md:text-xl text-slate-400 font-normal max-w-2xl mx-auto">
              Three simple steps to find your perfect study partner.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                step: '1',
                title: 'Create Your Profile',
                description: 'Sign up and tell us about your subjects, learning style, and study goals.',
                gradient: 'from-blue-500 to-cyan-500',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                ),
              },
              {
                step: '2',
                title: 'Get Matched',
                description: 'Browse through thousands of profiles and connect with study partners who share your interests.',
                gradient: 'from-purple-500 to-pink-500',
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
                gradient: 'from-orange-500 to-red-500',
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
                transition={{ delay: index * 0.15, duration: 0.6 }}
                className="group"
              >
                <div className="h-full bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/10">
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`w-14 h-14 bg-gradient-to-br ${item.gradient} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                      {item.icon}
                    </div>
                    <div className="w-10 h-10 bg-slate-700/50 rounded-full flex items-center justify-center border border-slate-600/50">
                      <span className="text-lg font-bold text-white">{item.step}</span>
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Community Section - Dark to Light */}
      <section className="py-24 relative bg-gradient-to-b from-slate-900 to-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Screenshot First */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7 }}
              className="relative"
            >
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-yellow-500/20 rounded-3xl blur-2xl" />

              {/* Screenshot */}
              <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xl">
                <div className="relative aspect-[4/3] bg-slate-100">
                  <Image
                    src="/screenshots/community.png"
                    alt="Community Feed"
                    fill
                    className="object-cover object-top"
                  />
                </div>
              </div>
            </motion.div>

            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7 }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
                Connect and share with the{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                  community.
                </span>
              </h2>
              <p className="text-lg text-slate-300 mb-8 leading-relaxed">
                Share your study journey, ask questions, and engage with other students. Discover trending topics, follow study partners, and build your learning network.
              </p>
              <ul className="space-y-4">
                {[
                  'Share posts and study tips',
                  'Like and comment on content',
                  'Follow your favorite study partners',
                  'Discover trending topics',
                ].map((feature, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="flex items-center gap-4 text-slate-200 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform">
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

      {/* Group Chat Section - Light Theme */}
      <section className="py-24 relative bg-white overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-20 right-0 w-96 h-96 bg-green-100/50 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-0 w-72 h-72 bg-emerald-100/50 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7 }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
                Stay connected with{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
                  real-time messaging.
                </span>
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                Message your study partners and groups instantly. Share files, send voice messages, and coordinate study sessions all in one place.
              </p>
              <ul className="space-y-4">
                {[
                  'Instant messaging with read receipts',
                  'Group chats for study teams',
                  'File and image sharing',
                  'Voice and video call integration',
                ].map((feature, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="flex items-center gap-4 text-slate-700 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-lg font-medium">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Screenshot Display */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7 }}
              className="relative"
            >
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20 rounded-3xl blur-2xl" />

              {/* Screenshot */}
              <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xl">
                <div className="relative aspect-[4/3] bg-slate-100">
                  <Image
                    src="/screenshots/group-chat.png"
                    alt="Group Chat"
                    fill
                    className="object-cover object-top"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Video Call Section - Light to Dark */}
      <section className="py-32 relative bg-gradient-to-b from-white to-slate-900 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Real Screenshot */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7 }}
              className="order-2 lg:order-1"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/20 border border-slate-200/50">
                <Image
                  src="/screenshots/video-call.png"
                  alt="Clerva video call - Study together with multiple participants"
                  width={1468}
                  height={877}
                  className="w-full h-auto"
                  priority
                />
                {/* Overlay gradient for polish */}
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 to-transparent pointer-events-none" />
              </div>
            </motion.div>

            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7 }}
              className="order-1 lg:order-2"
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 tracking-tight">
                Study together,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">anywhere.</span>
              </h2>
              <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed">
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
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="flex items-center gap-4 text-slate-700 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform">
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

      {/* AI Partner Section - Dark Theme */}
      <section className="py-32 relative bg-gradient-to-b from-slate-900 via-purple-950/30 to-slate-900 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full mb-6">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-purple-300 text-sm font-medium">AI-Powered Study Assistant</span>
            </div>

            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
              Meet your{' '}
              <GradientText colors={['#a855f7', '#3b82f6', '#06b6d4']} animationSpeed={4} className="text-4xl md:text-5xl lg:text-6xl font-bold inline-block">
                AI Partner.
              </GradientText>
            </h2>
            <p className="text-lg md:text-xl text-slate-400 font-normal max-w-3xl mx-auto">
              Can't find a study partner? Our AI Partner is here to help. Chat, create quizzes, study with flashcards, and stay focused with the built-in Pomodoro timer.
            </p>
          </motion.div>

          {/* AI Interface Showcase */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
            className="relative max-w-6xl mx-auto"
          >
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20 rounded-3xl blur-2xl" />

            <div className="relative bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl">
              {/* Interface Header */}
              <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-lg">AI Study Partner</h4>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-blue-100 text-sm">Online - Ready to help</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-1 bg-white/10 rounded-xl p-1">
                    <div className="px-4 py-2 bg-white/20 rounded-lg text-white text-sm font-medium">Chat</div>
                    <div className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium cursor-pointer transition-colors">Flashcards</div>
                    <div className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium cursor-pointer transition-colors">Whiteboard</div>
                  </div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid lg:grid-cols-3 gap-0">
                {/* Chat Area */}
                <div className="lg:col-span-2 p-6 border-r border-slate-700/50">
                  <div className="space-y-4 mb-6 min-h-[280px]">
                    <div className="flex justify-end">
                      <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-br-md max-w-[85%]">
                        <p className="text-sm">Can you explain the difference between a stack and a queue?</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div className="bg-slate-700/50 text-slate-200 px-4 py-3 rounded-2xl rounded-bl-md max-w-[85%]">
                        <p className="text-sm leading-relaxed">
                          Great question! Both are linear data structures, but they differ in how elements are added and removed:
                        </p>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="text-purple-400 font-bold">Stack:</span>
                            <span className="text-sm">LIFO (Last In, First Out)</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-blue-400 font-bold">Queue:</span>
                            <span className="text-sm">FIFO (First In, First Out)</span>
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed mt-3">
                          Would you like me to create a quiz to test your understanding?
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mb-4">
                    <button className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-xl text-purple-300 text-sm font-medium hover:bg-purple-600/30 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Generate Quiz
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-300 text-sm font-medium hover:bg-blue-600/30 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Create Flashcards
                    </button>
                  </div>

                  <div className="bg-slate-700/30 rounded-xl border border-slate-600/50 px-4 py-3 flex items-center gap-3">
                    <span className="text-slate-500 text-sm flex-1">Ask anything about your studies...</span>
                    <div className="w-9 h-9 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Tools Panel */}
                <div className="p-6 bg-slate-900/50 space-y-6">
                  <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-white font-semibold">Pomodoro Timer</span>
                    </div>
                    <div className="text-center mb-4">
                      <div className="text-5xl font-bold text-white font-mono">25:00</div>
                    </div>
                    <button className="w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl text-sm hover:from-green-600 hover:to-emerald-600 transition-all">
                      Start Focus Session
                    </button>
                  </div>

                  <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-white font-semibold">Session Stats</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-slate-700/50 rounded-xl">
                        <div className="text-2xl font-bold text-white">5</div>
                        <div className="text-xs text-slate-400">Messages</div>
                      </div>
                      <div className="text-center p-3 bg-slate-700/50 rounded-xl">
                        <div className="text-2xl font-bold text-purple-400">0</div>
                        <div className="text-xs text-slate-400">Quizzes</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Study Tools */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { icon: '💬', title: 'AI Chat & Quiz', desc: 'Ask questions, get explanations', gradient: 'from-purple-500 to-indigo-500' },
              { icon: '🗂️', title: 'Interactive Flashcards', desc: 'Spaced repetition learning', gradient: 'from-blue-500 to-cyan-500' },
              { icon: '✏️', title: 'Digital Whiteboard', desc: 'Visual problem solving', gradient: 'from-pink-500 to-rose-500' },
              { icon: '⏱️', title: 'Pomodoro Timer', desc: 'Track focus time', gradient: 'from-green-500 to-emerald-500' },
            ].map((tool, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * index, duration: 0.5 }}
                className="group"
              >
                <div className="h-full bg-slate-800/50 backdrop-blur-xl rounded-2xl p-5 border border-slate-700/50 hover:border-purple-500/30 transition-all duration-300 hover:-translate-y-1">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform`}>
                    {tool.icon}
                  </div>
                  <h4 className="text-white font-semibold mb-1">{tool.title}</h4>
                  <p className="text-slate-400 text-sm">{tool.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-center mt-12"
          >
            <Link
              href="/auth/signup"
              className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-lg font-semibold rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg shadow-purple-500/20 hover:-translate-y-1"
            >
              Try AI Partner Free
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <p className="mt-4 text-slate-500 text-sm">No credit card required. Start learning immediately.</p>
          </motion.div>
        </div>
      </section>

      {/* CTA Section - Beautiful Gradient */}
      <section className="py-32 relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" />

        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-3xl" />

        <div className="max-w-5xl mx-auto px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
              Ready to find your{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
                study partner?
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-slate-300 mb-12 font-normal max-w-3xl mx-auto">
              Join students already studying smarter, not harder.
            </p>

            <Link
              href="/auth/signup"
              className="group inline-flex items-center gap-3 px-12 py-5 bg-white text-slate-900 text-xl font-bold rounded-2xl hover:scale-105 transition-all duration-300 shadow-2xl shadow-white/20"
            >
              Get Started Free
              <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section - Light Theme */}
      <section id="faq" className="py-32 relative bg-white overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
              Frequently asked{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">questions.</span>
            </h2>
            <p className="text-lg md:text-xl text-slate-600">
              Everything you need to know about Clerva™.
            </p>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                question: 'How does partner matching work?',
                answer: 'Browse through student profiles and filter by subjects, interests, learning goals, and study preferences. Each profile shows a compatibility score based on how well your preferences align.',
              },
              {
                question: 'How many people can join a study session?',
                answer: 'Live study sessions support up to 10 participants with video calls, shared whiteboards, collaborative notes, and flashcards. Sessions include a 30-minute waiting lobby.',
              },
              {
                question: 'What are the study group limits?',
                answer: 'Each study group can have up to 50 members. You can create public groups (anyone can join), private groups (members must request to join), or invite-only groups.',
              },
              {
                question: 'Is Clerva completely free?',
                answer: 'Yes! Clerva is 100% free with no hidden fees or premium tiers. All features including video calls, messaging, study groups, and community access are available to every user.',
              },
              {
                question: 'How does the community feed work?',
                answer: 'The community feed has three viewing modes: Recommended (shows posts from your study partners first), Chronological (newest posts first), and Trending (most popular posts).',
              },
              {
                question: 'Can I message study partners directly?',
                answer: 'Yes! Once connected, you can chat with partners in real-time with typing indicators and read receipts. You can also send messages in group chats, share files, and make video calls.',
              },
              {
                question: 'What study tools are available in sessions?',
                answer: 'Study sessions include collaborative whiteboards, shared notes, flashcards with spaced repetition (SM-2 algorithm), and Pomodoro timers to help you stay focused.',
              },
              {
                question: 'Is my data private and secure?',
                answer: 'We take privacy seriously. Your data is stored securely, and you control who sees your profile information. Posts can be set to public, friends-only, or private.',
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
                  className="w-full text-left bg-slate-50 hover:bg-slate-100 rounded-2xl p-6 transition-all duration-300 border border-slate-200 hover:border-slate-300"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg md:text-xl font-bold text-slate-900 pr-8">{faq.question}</h3>
                    <motion.div
                      animate={{ rotate: openFaq === index ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center border border-blue-200"
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
    </div>
  )
}
