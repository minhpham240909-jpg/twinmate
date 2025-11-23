'use client'

import { motion } from 'framer-motion'

export default function Footer() {
  const handleFeaturesClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const featuresSection = document.querySelector('section.py-32.bg-gradient-to-b')
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

  return (
    <footer className="relative z-20 bg-slate-900/50 backdrop-blur-md border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
          {/* Brand */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent mb-4">
                CLERVA
              </h3>
              <p className="text-slate-300 leading-relaxed">
                Connect with study partners who share your goals. Collaborate in real-time and achieve academic success together.
              </p>
            </motion.div>
          </div>

          {/* Quick Links */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h4 className="text-lg font-bold text-white mb-6">Quick Links</h4>
              <ul className="space-y-3">
                <motion.li
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3 }}
                >
                  <a
                    href="#features"
                    onClick={handleFeaturesClick}
                    className="text-slate-300 hover:text-blue-400 transition-colors duration-200 flex items-center gap-2 group cursor-pointer"
                  >
                    <span className="w-1 h-1 rounded-full bg-slate-500 group-hover:bg-blue-400 transition-colors duration-200" />
                    Features
                  </a>
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <a
                    href="#faq"
                    onClick={handleFAQClick}
                    className="text-slate-300 hover:text-blue-400 transition-colors duration-200 flex items-center gap-2 group cursor-pointer"
                  >
                    <span className="w-1 h-1 rounded-full bg-slate-500 group-hover:bg-blue-400 transition-colors duration-200" />
                    FAQ
                  </a>
                </motion.li>
              </ul>
            </motion.div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-700 mb-8" />

        {/* Copyright */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center"
        >
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} Clerva. All rights reserved.
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
