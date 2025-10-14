'use client'

import { useState, useEffect } from 'react'

interface Message {
  id: string
  content: string
  sender: {
    id: string
    name: string
    avatarUrl: string | null
  }
}

interface InCallMessagePopupProps {
  message: Message
  onDismiss: () => void
  onViewChat: () => void
}

export default function InCallMessagePopup({ message, onDismiss, onViewChat }: InCallMessagePopupProps) {
  const [isVisible, setIsVisible] = useState(true)

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss()
    }, 10000)

    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(onDismiss, 300) // Wait for animation
  }

  const contentPreview = message.content.length > 80
    ? message.content.substring(0, 80) + '...'
    : message.content

  return (
    <div
      className={`fixed bottom-24 left-6 z-50 transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="bg-gray-900/95 backdrop-blur-lg rounded-xl shadow-2xl border border-white/10 p-4 max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {message.sender.avatarUrl ? (
              <img
                src={message.sender.avatarUrl}
                alt={message.sender.name}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {message.sender.name[0]}
              </div>
            )}
            <div>
              <p className="text-white font-semibold text-sm">{message.sender.name}</p>
              <p className="text-white/50 text-xs">sent a message</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/50 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message Content */}
        <div className="bg-white/10 rounded-lg p-3 mb-3">
          <p className="text-white text-sm leading-relaxed">{contentPreview}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onViewChat}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium"
          >
            View in Chat
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
