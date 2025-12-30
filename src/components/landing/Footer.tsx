'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  const handleFeaturesClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const featuresSection = document.getElementById('features')
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleFAQClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const faqSection = document.getElementById('faq')
    if (faqSection) {
      faqSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleHowItWorksClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const section = document.getElementById('how-it-works')
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <footer className="relative z-20 bg-slate-50 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <Link href="/" className="flex items-center gap-2 mb-4">
                <Image src="/logo.png" alt="Clerva" width={100} height={32} className="h-8 w-auto" />
                <span className="text-slate-900 text-xl font-bold tracking-tight">
                  Clerva
                </span>
              </Link>
              <p className="text-slate-600 leading-relaxed max-w-sm">
                Connect with study partners who share your goals. Collaborate in real-time and achieve academic success together.
              </p>
            </motion.div>
          </div>

          {/* Product Links */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Product</h4>
              <ul className="space-y-4">
                <li>
                  <a
                    href="#features"
                    onClick={handleFeaturesClick}
                    className="text-slate-600 hover:text-slate-900 transition-colors duration-200 text-sm"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#how-it-works"
                    onClick={handleHowItWorksClick}
                    className="text-slate-600 hover:text-slate-900 transition-colors duration-200 text-sm"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <a
                    href="#faq"
                    onClick={handleFAQClick}
                    className="text-slate-600 hover:text-slate-900 transition-colors duration-200 text-sm"
                  >
                    FAQ
                  </a>
                </li>
              </ul>
            </motion.div>
          </div>

          {/* Get Started */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Get Started</h4>
              <ul className="space-y-4">
                <li>
                  <Link
                    href="/auth/signup"
                    className="text-slate-600 hover:text-slate-900 transition-colors duration-200 text-sm"
                  >
                    Sign Up
                  </Link>
                </li>
                <li>
                  <Link
                    href="/auth/signin"
                    className="text-slate-600 hover:text-slate-900 transition-colors duration-200 text-sm"
                  >
                    Sign In
                  </Link>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>

        {/* Legal Links */}
        <div className="flex flex-wrap justify-center gap-6 mb-8">
          <Link
            href="/privacy"
            className="text-slate-500 hover:text-slate-700 transition-colors duration-200 text-sm"
          >
            Privacy Policy
          </Link>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 mb-8" />

        {/* Copyright */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center"
        >
          <p className="text-slate-500 text-sm">
            © 2025 Clerva™
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
