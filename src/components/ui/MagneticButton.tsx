'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

interface MagneticButtonProps {
  children: React.ReactNode
  className?: string
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

export default function MagneticButton({ 
  children, 
  className = '', 
  href,
  onClick,
  variant = 'primary'
}: MagneticButtonProps) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const springConfig = { damping: 25, stiffness: 300 }
  const xSpring = useSpring(x, springConfig)
  const ySpring = useSpring(y, springConfig)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    const distanceX = e.clientX - centerX
    const distanceY = e.clientY - centerY
    
    const moveX = distanceX * 0.15
    const moveY = distanceY * 0.15
    
    x.set(moveX)
    y.set(moveY)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    x.set(0)
    y.set(0)
  }

  const baseClasses = variant === 'primary'
    ? 'px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl'
    : 'px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg border-2 border-blue-600 hover:bg-blue-50 transition-colors'

  const content = (
    <motion.div
      style={{ x: xSpring, y: ySpring }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className={`inline-block ${baseClasses} ${className}`}
    >
      {children}
    </motion.div>
  )

  if (href) {
    return (
      <Link href={href} ref={ref as any} className="inline-block">
        {content}
      </Link>
    )
  }

  return (
    <button ref={ref as any} onClick={onClick} className="inline-block">
      {content}
    </button>
  )
}
