'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

export default function FloatingSignupButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Show button after scrolling down 300px
      setIsVisible(window.scrollY > 300)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: isVisible ? 1 : 0,
        opacity: isVisible ? 1 : 0,
      }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
      }}
      className="fixed top-8 right-8 z-50"
    >
      <Link href="/auth/signup">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="group relative px-8 py-4 bg-slate-900 border border-white/10 text-white font-semibold rounded-full shadow-2xl overflow-hidden hover:border-blue-500/50 hover:shadow-blue-500/20 transition-all duration-300"
        >
          {/* Subtle animated gradient background on hover */}
          <motion.div
            animate={{
              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-blue-700/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ backgroundSize: '200% 100%' }}
          />

          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-400 blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-300" />

          {/* Button text */}
          <span className="relative z-10 flex items-center gap-2">
            Get Started Now
            <motion.span
              animate={{
                x: [0, 4, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              →
            </motion.span>
          </span>
        </motion.div>
      </Link>
    </motion.div>
  )
}
