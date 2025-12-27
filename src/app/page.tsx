'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Footer from '@/components/landing/Footer'

export default function HomePage() {
  const router = useRouter()
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Check if user is authenticated and redirect to dashboard
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/dashboard')
      }
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close mobile menu when clicking a link
  const closeMobileMenu = () => setMobileMenuOpen(false)

  // Smooth scroll to section when clicking nav links
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault()
    const element = document.getElementById(sectionId)
    if (element) {
      const headerOffset = 100 // Account for floating header
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
    closeMobileMenu()
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 relative overflow-x-hidden selection:bg-blue-500/20">

      {/* Floating Header */}
      <header className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        scrolled ? 'w-[95%] max-w-5xl' : 'w-[90%] max-w-4xl'
      }`}>
        <div className={`bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-200 shadow-sm px-6 py-3 flex items-center justify-between transition-all duration-300 ${
          scrolled ? 'shadow-md' : ''
        }`}>
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Clerva" width={100} height={32} className="h-8 w-auto" />
            <span className="text-slate-900 text-lg font-bold tracking-tight">
              Clerva
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <a
              href="#how-it-works"
              onClick={(e) => scrollToSection(e, 'how-it-works')}
              className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium cursor-pointer"
            >
              How it works
            </a>
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, 'features')}
              className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium cursor-pointer"
            >
              Features
            </a>
            <Link href="/auth/signin" className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium">
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors"
            >
              Get Started
            </Link>
          </nav>
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden mt-2 bg-white rounded-2xl border border-slate-200 shadow-lg p-4"
          >
            <nav className="flex flex-col gap-2">
              <a
                href="#how-it-works"
                onClick={(e) => scrollToSection(e, 'how-it-works')}
                className="px-4 py-3 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors text-sm font-medium cursor-pointer"
              >
                How it works
              </a>
              <a
                href="#features"
                onClick={(e) => scrollToSection(e, 'features')}
                className="px-4 py-3 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors text-sm font-medium cursor-pointer"
              >
                Features
              </a>
              <Link
                href="/auth/signin"
                onClick={closeMobileMenu}
                className="px-4 py-3 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors text-sm font-medium"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                onClick={closeMobileMenu}
                className="px-4 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors text-center mt-2"
              >
                Get Started — it's free
              </Link>
            </nav>
          </motion.div>
        )}
      </header>

      {/* Hero Section - Clean, minimal */}
      <section className="relative pt-36 pb-24 overflow-hidden">
        {/* Simple subtle background */}
        <div className="absolute inset-0 bg-slate-50/50" />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight leading-[1.15] text-slate-900">
              Study smarter, not harder.
              <br />
              <span className="text-blue-600">With your perfect study crew.</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 mb-8 font-normal max-w-2xl mx-auto leading-relaxed">
              Tired of cramming solo at midnight? Connect with classmates who share your classes, study style, and goals. Get matched instantly, hop on video calls, and actually enjoy studying together. No more empty GroupMe chats or awkward "anyone free?" messages.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
              <Link
                href="/auth/signup"
                className="group px-8 py-4 bg-blue-600 text-white text-base font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                Start studying smarter
                <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>

              <a
                href="#how-it-works"
                onClick={(e) => scrollToSection(e, 'how-it-works')}
                className="px-8 py-4 text-slate-700 text-base font-medium rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                See how it works
              </a>
            </div>

            <p className="text-sm text-slate-500">Free forever. No credit card needed. Seriously.</p>
          </motion.div>
        </div>
      </section>


      {/* Find Partner Section - Clean layout */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-blue-600 font-semibold text-sm uppercase tracking-wide">Find Partners</span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mt-2 mb-4">
                No more "anyone wanna study?" posts
              </h2>
              <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                Remember posting in the class GroupMe hoping someone would reply? Yeah, we fixed that. Browse actual profiles, see what people are studying, and connect with students who match your vibe.
              </p>
              <ul className="space-y-3">
                {[
                  { text: 'Filter by your actual classes', detail: 'Not just "biology" — your specific section' },
                  { text: 'See when people are free', detail: 'No more scheduling nightmares' },
                  { text: 'Match by study style', detail: 'Night owl? Find other night owls' },
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <span className="font-medium">{feature.text}</span>
                      <span className="text-slate-500 ml-1">— {feature.detail}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Screenshot */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
                <Image
                  src="/screenshots/find-partner.png?v=2"
                  alt="Find Study Partners"
                  width={800}
                  height={600}
                  className="w-full h-auto"
                  unoptimized
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section - Clean */}
      <section id="how-it-works" className="py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              Up and running in 2 minutes
            </h2>
            <p className="text-lg text-slate-600">
              No complicated setup. No tutorials needed.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '1',
                title: 'Quick signup',
                description: 'Add your classes and when you like to study. Takes about 60 seconds.',
                icon: '✍️',
              },
              {
                step: '2',
                title: 'Browse & connect',
                description: 'See who else is taking your classes. Send a study invite.',
                icon: '🔍',
              },
              {
                step: '3',
                title: 'Start a session',
                description: 'Hop on a video call, share your screen, get stuff done.',
                icon: '🚀',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
              >
                <div className="h-full bg-white rounded-2xl p-6 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bento Grid - Feature Overview */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              Everything you need to study better
            </h2>
            <p className="text-lg text-slate-600">
              Built by students who were tired of bad study tools. We get it.
            </p>
          </motion.div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Large card - Video calls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-2 lg:row-span-2 bg-slate-900 rounded-2xl p-6 text-white overflow-hidden relative"
            >
              <div className="relative z-10">
                <span className="text-blue-400 font-medium text-sm">Video Sessions</span>
                <h3 className="text-2xl font-bold mt-2 mb-2">Study face-to-face, from anywhere</h3>
                <p className="text-slate-400 mb-4">HD video with up to 8 people. Screen sharing included. No awkward Zoom links.</p>
              </div>
              <div className="mt-4 relative z-10">
                <Image
                  src="/screenshots/video-call.png?v=2"
                  alt="Video call feature"
                  width={800}
                  height={450}
                  className="rounded-lg border border-slate-700 shadow-xl"
                  unoptimized
                />
              </div>
            </motion.div>

            {/* Messaging card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100"
            >
              <span className="text-3xl">💬</span>
              <h3 className="text-lg font-bold text-slate-900 mt-3 mb-2">Group chats that don't suck</h3>
              <p className="text-slate-600 text-sm">Like iMessage, but for study groups. Share files, create threads, stay organized.</p>
            </motion.div>

            {/* Community card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-amber-50 rounded-2xl p-6 border border-amber-100"
            >
              <span className="text-3xl">🌐</span>
              <h3 className="text-lg font-bold text-slate-900 mt-3 mb-2">Community feed</h3>
              <p className="text-slate-600 text-sm">Share tips, ask questions, celebrate wins. It's like Twitter but actually useful.</p>
            </motion.div>

            {/* Screenshot - Community */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
            >
              <Image
                src="/screenshots/community.png"
                alt="Community feed"
                width={400}
                height={300}
                className="w-full h-full object-cover"
              />
            </motion.div>

            {/* Screenshot - Chat */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
            >
              <Image
                src="/screenshots/group-chat.png"
                alt="Group chat"
                width={400}
                height={300}
                className="w-full h-full object-cover"
              />
            </motion.div>

            {/* Quick feature list */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25 }}
              className="bg-slate-50 rounded-2xl p-6 border border-slate-200"
            >
              <h3 className="font-bold text-slate-900 mb-4">Also included:</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">✓</span> Shared whiteboards
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">✓</span> File sharing
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">✓</span> Calendar sync
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">✓</span> Session recordings
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">✓</span> Mobile app <span className="text-slate-400">(coming soon)</span>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* AI Partner Section - Clean */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-300 text-sm font-medium mb-4">
              <span>✨</span> New Feature
            </span>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Can't find a partner? Meet your Temporary AI Partner.
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Sometimes you need to study while waiting for a real partner. Our Temporary AI Partner helps you stay focused with quizzes, flashcards, and a built-in pomodoro timer.
            </p>
          </motion.div>

          {/* AI Tools Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '💬', title: 'AI Chat', desc: 'Ask anything, get clear explanations' },
              { icon: '📝', title: 'Auto Quizzes', desc: 'Generate practice tests instantly' },
              { icon: '🗂️', title: 'Flashcards', desc: 'Spaced repetition that works' },
              { icon: '⏱️', title: 'Pomodoro', desc: '25 min focus, 5 min break' },
            ].map((tool, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * index, duration: 0.4 }}
              >
                <div className="h-full bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-colors">
                  <span className="text-2xl">{tool.icon}</span>
                  <h4 className="text-white font-semibold mt-3 mb-1">{tool.title}</h4>
                  <p className="text-slate-400 text-sm">{tool.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-10">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors"
            >
              Try Temporary AI Partner
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <p className="mt-3 text-slate-500 text-sm">Study while waiting for a real partner</p>
          </div>
        </div>
      </section>

      {/* FAQ Section - Clean */}
      <section id="faq" className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              Questions? We got you.
            </h2>
            <p className="text-slate-600">
              The stuff people actually ask us.
            </p>
          </motion.div>

          <div className="space-y-3">
            {[
              {
                question: 'Is this free?',
                answer: 'Yes, Clerva is currently free to use! We\'re still developing and improving the app, so you can enjoy all features at no cost during this phase.',
              },
              {
                question: 'How do I find study partners?',
                answer: 'Add your classes, set your schedule, and browse profiles. You can filter by subject, availability, and study style. When you find someone cool, send them a study invite.',
              },
              {
                question: 'How many people can join a video session?',
                answer: 'Up to 8 people per session. You get video, screen sharing, whiteboards, and chat. No time limits on calls either.',
              },
              {
                question: 'What about study groups?',
                answer: 'Groups can have up to 50 members. Make them public, private, or invite-only. Great for class group projects or recurring study sessions.',
              },
              {
                question: 'Is my data safe?',
                answer: 'We take privacy seriously. Your data is encrypted, you control who sees your profile, and we never sell your information. Ever.',
              },
              {
                question: 'What if I can\'t find a partner?',
                answer: 'That\'s what our Temporary AI Partner is for! Chat with it, create quizzes, use flashcards — it helps you study while you wait for a real partner.',
              },
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full text-left bg-white hover:bg-slate-50 rounded-xl p-5 transition-colors border border-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 pr-4">{faq.question}</h3>
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === index ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {openFaq === index && (
                    <p className="mt-3 text-slate-600 text-sm leading-relaxed">{faq.answer}</p>
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA - Clean */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to stop studying alone?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Join thousands of students who found their study crew on Clerva.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors"
          >
            Get started — it's free
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <p className="mt-4 text-blue-200 text-sm">No credit card required. Takes 60 seconds.</p>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}
