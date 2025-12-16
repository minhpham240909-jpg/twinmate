'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { TypingUser } from '@/lib/supabase/realtime'

interface TypingIndicatorProps {
  typingUsers: TypingUser[]
  className?: string
}

export default function TypingIndicator({ typingUsers, className = '' }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null

  // Build the "X is typing" text
  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].name} is typing`
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].name} and ${typingUsers[1].name} are typing`
    } else {
      return `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing`
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center gap-2 px-4 py-2 ${className}`}
      >
        {/* Bouncing dots */}
        <div className="flex items-center gap-1">
          <motion.span
            className="w-2 h-2 bg-gray-400 dark:bg-slate-400 rounded-full"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
          />
          <motion.span
            className="w-2 h-2 bg-gray-400 dark:bg-slate-400 rounded-full"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
          />
          <motion.span
            className="w-2 h-2 bg-gray-400 dark:bg-slate-400 rounded-full"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
          />
        </div>

        {/* Typing text */}
        <span className="text-xs text-gray-500 dark:text-slate-400">
          {getTypingText()}
        </span>
      </motion.div>
    </AnimatePresence>
  )
}
