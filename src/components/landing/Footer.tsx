'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

export default function Footer() {
  const features = [
    { name: 'AI-Powered Matching', href: '/features/ai-agent' },
    { name: 'Real-Time Collaboration', href: '/features/real-time-collaboration' },
    { name: 'Study Groups', href: '/features/study-groups' },
    { name: 'Community Forums', href: '/features/community' },
    { name: 'Progress Tracking', href: '/dashboard' },
    { name: 'Smart Scheduling', href: '/dashboard' },
  ]

  const handleFAQClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const faqSection = document.getElementById('faq')
    if (faqSection) {
      faqSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <footer className="bg-gradient-to-b from-slate-50 to-slate-100 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                CLERVA
              </h3>
              <p className="text-slate-600 leading-relaxed">
                AI-powered study partner matching platform. Find your perfect study partner and achieve more together.
              </p>
            </motion.div>
          </div>

          {/* Features Links */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h4 className="text-lg font-bold text-slate-900 mb-6">Features</h4>
              <ul className="space-y-3">
                {features.map((feature, index) => (
                  <motion.li
                    key={feature.name}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 0.05 * index }}
                  >
                    <Link
                      href={feature.href}
                      className="text-slate-600 hover:text-blue-600 transition-colors duration-200 flex items-center gap-2 group"
                    >
                      <span className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-blue-600 transition-colors duration-200" />
                      {feature.name}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* FAQ Link */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h4 className="text-lg font-bold text-slate-900 mb-6">Resources</h4>
              <ul className="space-y-3">
                <motion.li
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3 }}
                >
                  <a
                    href="#faq"
                    onClick={handleFAQClick}
                    className="text-slate-600 hover:text-blue-600 transition-colors duration-200 flex items-center gap-2 group cursor-pointer"
                  >
                    <span className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-blue-600 transition-colors duration-200" />
                    Frequently Asked Questions
                  </a>
                </motion.li>
              </ul>
            </motion.div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-300 mb-8" />

        {/* Copyright */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center"
        >
          <p className="text-slate-600 text-sm">
            © {new Date().getFullYear()} Clerva. All rights reserved.
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
