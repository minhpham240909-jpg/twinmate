'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useState } from 'react'
import GradientText from '@/components/landing/GradientText'
import ModernDotPattern from '@/components/landing/ModernDotPattern'
import Footer from '@/components/landing/Footer'

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set())

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-x-hidden selection:bg-blue-500/30">

      {/* Header with Logo */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-white/5">
        <div className="w-full px-4 lg:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Clerva" width={120} height={40} className="h-10 w-auto" />
            <span className="text-white text-xl font-bold tracking-wide">Clerva</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="#how-it-works" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">
              How it works
            </Link>
            <Link href="#features" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">
              Features
            </Link>
            <Link href="/auth/signin" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-semibold rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-32 overflow-hidden z-10">
        {/* Subtle gradient overlay to ensure text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-transparent to-slate-950/80 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-center max-w-5xl mx-auto"
          >
            <div className="mb-8">
              <GradientText
                colors={['#60a5fa', '#a78bfa', '#f472b6', '#a78bfa', '#60a5fa']}
                animationSpeed={6}
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
              className="text-xl md:text-2xl text-slate-300 mb-12 font-light max-w-3xl mx-auto leading-relaxed"
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
                className="group relative px-8 py-4 bg-slate-900 border border-white/10 text-white text-lg font-semibold rounded-xl hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/20 hover:scale-105 transition-all duration-300 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Get Started Now
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>

              <Link
                href="#how-it-works"
                className="px-8 py-4 text-white text-lg font-semibold rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 hover:scale-105 transition-all duration-300 backdrop-blur-md"
              >
                Learn More
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
              Get started in <span className="text-blue-400">minutes.</span>
            </h2>
            <p className="text-lg md:text-xl text-slate-400 font-light max-w-2xl mx-auto">
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
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="group"
              >
                <div className="h-full bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-white/5 hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-900/20">
                  <div className="mb-6 flex items-center justify-between">
                    <div className={`w-16 h-16 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center shadow-lg text-white`}>
                      {item.icon}
                    </div>
                    <div className={`w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center border border-white/10`}>
                      <span className="text-xl font-bold text-white">{item.step}</span>
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

      {/* Partner Matching Section */}
      <section className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7 }}
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
                Find partners that <GradientText colors={['#60a5fa', '#8b5cf6', '#c084fc']} animationSpeed={4} className="text-4xl md:text-5xl lg:text-6xl font-bold inline-block">fit your goals.</GradientText>
              </h2>
              <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed">
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
                    className="flex items-center gap-4 text-slate-300 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/20 group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-lg font-medium">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Visual Element */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7 }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-blue-900/80 via-indigo-900/80 to-purple-900/80 backdrop-blur-xl rounded-3xl p-10 relative overflow-hidden shadow-2xl border border-white/10">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-20">
                  <ModernDotPattern dotSize={1.5} gap={24} color="rgba(255,255,255,0.3)" />
                </div>

                {/* Center content */}
                <div className="relative z-10 text-center text-white">
                  <div className="mb-8">
                    <div className="w-32 h-32 mx-auto bg-white/10 rounded-2xl backdrop-blur-md flex items-center justify-center shadow-xl border border-white/20 ring-1 ring-white/10">
                      <svg className="w-16 h-16 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold mb-3">Partner Matching</h3>
                  <p className="text-blue-200 text-lg font-light">Connecting 10,000+ students worldwide</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Video Call Section */}
      <section className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Visual First */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7 }}
              className="order-2 lg:order-1"
            >
              <div className="bg-gradient-to-br from-pink-900/80 via-purple-900/80 to-indigo-900/80 backdrop-blur-xl rounded-3xl p-8 relative overflow-hidden shadow-2xl border border-white/10">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="aspect-square bg-black/20 backdrop-blur-md rounded-xl border border-white/10 flex items-center justify-center relative overflow-hidden group"
                    >
                      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                        <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-black/40 backdrop-blur-md rounded-xl p-4 flex justify-center gap-3 border border-white/5">
                  {[
                    { icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
                    { icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
                    { icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' },
                  ].map((btn, idx) => (
                    <div key={idx} className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center cursor-pointer hover:bg-white/20 transition-all hover:scale-110">
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
              transition={{ duration: 0.7 }}
              className="order-1 lg:order-2"
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
                Study together, <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">anywhere.</span>
              </h2>
              <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed">
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
                    className="flex items-center gap-4 text-slate-300 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-pink-900/20 group-hover:scale-110 transition-transform">
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

      {/* Features Grid Section */}
      <section id="features" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
              Everything you need to <span className="text-blue-400">succeed.</span>
            </h2>
            <p className="text-lg md:text-xl text-slate-400 font-light max-w-2xl mx-auto">
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
              },
              {
                title: 'Study Groups',
                description: 'Create or join study groups with up to 50 members. Choose between public, private, or invite-only groups with role-based permissions for organized collaborative learning.',
                icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
                gradient: 'from-purple-500 to-pink-600',
              },
              {
                title: 'Live Study Sessions',
                description: 'Start video calls with up to 10 participants. Collaborate with shared whiteboards, real-time notes, flashcards with spaced repetition, and built-in Pomodoro timers for focused study sessions.',
                icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
                gradient: 'from-indigo-500 to-purple-600',
              },
              {
                title: 'Direct Messaging',
                description: 'Chat with study partners and groups in real-time. Send messages, share files, and make voice or video calls with typing indicators and read receipts to stay connected.',
                icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
                gradient: 'from-pink-500 to-red-600',
              },
              {
                title: 'Community Feed',
                description: 'Share posts, like, and engage with thousands of students. Choose between recommended, chronological, or trending feeds with privacy controls for your content.',
                icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z',
                gradient: 'from-orange-500 to-yellow-600',
              },
            ].map((feature, index) => {
              const isFlipped = flippedCards.has(index)
              const toggleFlip = () => {
                setFlippedCards(prev => {
                  const newSet = new Set(prev)
                  if (newSet.has(index)) newSet.delete(index)
                  else newSet.add(index)
                  return newSet
                })
              }

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ delay: index * 0.08, duration: 0.6 }}
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
                        transformOrigin: 'center center',
                        willChange: 'transform',
                        WebkitFontSmoothing: 'antialiased',
                        MozOsxFontSmoothing: 'grayscale',
                      }}
                    >
                      {/* Front of Card */}
                      <div
                        className="absolute inset-0"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'translateZ(0)',
                          WebkitTransform: 'translateZ(0)',
                        }}
                      >
                        <div className="h-full bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-white/5 group-hover:border-blue-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/20 flex flex-col items-center justify-center">
                          <div className={`w-20 h-20 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-xl`}>
                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                            </svg>
                          </div>
                          <h3 className="text-2xl font-bold text-white text-center mb-2">{feature.title}</h3>
                          <p className="text-sm text-slate-500 text-center group-hover:text-blue-400 transition-colors">Click to learn more</p>
                        </div>
                      </div>

                      {/* Back of Card */}
                      <div
                        className="absolute inset-0"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg) translateZ(1px)',
                          WebkitTransform: 'rotateY(180deg) translateZ(1px)',
                        }}
                      >
                        <div className="h-full bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 border border-white/10 flex flex-col justify-center shadow-2xl">
                          <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-5 shadow-lg mx-auto`}>
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                            </svg>
                          </div>
                          <h3 className="text-xl font-bold text-white mb-4 text-center">{feature.title}</h3>
                          <p className="text-slate-300 leading-relaxed text-sm text-center">{feature.description}</p>
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

      {/* CTA Section */}
      <section className="py-32 bg-gradient-to-br from-blue-900/50 via-indigo-900/50 to-purple-900/50 relative overflow-hidden z-10 backdrop-blur-sm">
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
            <p className="text-xl md:text-2xl text-slate-300 mb-12 font-light max-w-3xl mx-auto">
              Join thousands of students already studying smarter, not harder.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Link
                href="/auth/signup"
                className="group px-10 py-5 bg-slate-900 border border-white/10 text-white text-xl font-bold rounded-xl hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-500/50 transition-all duration-300 flex items-center gap-2 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative z-10">Get Started Now</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>

              <Link
                href="#how-it-works"
                className="px-10 py-5 text-white text-xl font-bold rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 hover:scale-105 transition-all duration-300 backdrop-blur-md"
              >
                Watch Demo
              </Link>
            </div>

          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 relative z-10">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
              Frequently asked <span className="text-blue-400">questions.</span>
            </h2>
            <p className="text-lg md:text-xl text-slate-400">
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
                  className="w-full text-left bg-slate-900/50 hover:bg-slate-900/80 rounded-xl p-6 transition-all duration-300 shadow-sm border border-white/5 hover:border-white/10 backdrop-blur-md"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg md:text-xl font-bold text-white pr-8">{faq.question}</h3>
                    <motion.div
                      animate={{ rotate: openFaq === index ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20"
                    >
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <p className="mt-4 text-slate-400 leading-relaxed">{faq.answer}</p>
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
