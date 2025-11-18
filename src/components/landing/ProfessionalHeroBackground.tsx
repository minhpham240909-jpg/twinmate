'use client'

import React from 'react'

/**
 * Professional, restrained hero background
 * Minimal color palette (2-3 colors max)
 * Bold, clean design with generous whitespace
 */
export default function ProfessionalHeroBackground() {
  return (
    <>
      {/* Main background - Restrained palette */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      
      {/* Single accent gradient - Very subtle */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-indigo-600/5" />
      
      {/* Minimal grid pattern - Very subtle */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px'
        }}
      />

      {/* Single accent orb - Minimal */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
    </>
  )
}

