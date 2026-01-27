'use client'

/**
 * ROADMAP COMPLETION CELEBRATION
 *
 * Shows when user completes their entire roadmap.
 * Features:
 * - Major celebration animation
 * - Stats summary (steps, days, streak, notes)
 * - Share options (LinkedIn, Twitter, Copy link)
 * - Public sharing toggle
 * - Start new goal CTA
 */

import { memo, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Trophy,
  Sparkles,
  Share2,
  CheckCircle2,
  Clock,
  Flame,
  FileText,
  Globe,
  Lock,
  Copy,
  Check,
  ChevronRight,
  X,
} from 'lucide-react'

// Social icons
const TwitterIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

const LinkedInIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
)

const WhatsAppIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

interface RoadmapCelebrationProps {
  isOpen: boolean
  onClose: () => void
  onStartNew: () => void
  onShare: (isPublic: boolean) => Promise<string | null>
  roadmapTitle: string
  totalSteps: number
  daysToComplete: number
  longestStreak: number
  capturesCreated: number
  shareUrl?: string
}

export const RoadmapCelebration = memo(function RoadmapCelebration({
  isOpen,
  onClose,
  onStartNew,
  onShare,
  roadmapTitle,
  totalSteps,
  daysToComplete,
  longestStreak,
  capturesCreated,
  shareUrl: initialShareUrl,
}: RoadmapCelebrationProps) {
  const [mounted, setMounted] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [shareUrl, setShareUrl] = useState(initialShareUrl || '')
  const [copied, setCopied] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setShowContent(true), 100)
      return () => clearTimeout(timer)
    } else {
      setShowContent(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (initialShareUrl) {
      setShareUrl(initialShareUrl)
    }
  }, [initialShareUrl])

  const handleShare = useCallback(async () => {
    if (shareUrl) return // Already shared

    setIsSharing(true)
    try {
      const url = await onShare(isPublic)
      if (url) {
        setShareUrl(url)
      }
    } finally {
      setIsSharing(false)
    }
  }, [shareUrl, onShare, isPublic])

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) {
      await handleShare()
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [shareUrl, handleShare])

  const handleSocialShare = useCallback(async (platform: 'twitter' | 'linkedin' | 'whatsapp') => {
    let url = shareUrl
    if (!url) {
      setIsSharing(true)
      const newUrl = await onShare(isPublic)
      setIsSharing(false)
      if (!newUrl) return
      url = newUrl
      setShareUrl(newUrl)
    }

    const text = `I just completed "${roadmapTitle}" on Clerva! 🎉`
    const encodedText = encodeURIComponent(text)
    const encodedUrl = encodeURIComponent(url)

    let shareLink = ''
    switch (platform) {
      case 'twitter':
        shareLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`
        break
      case 'linkedin':
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
        break
      case 'whatsapp':
        shareLink = `https://wa.me/?text=${encodedText}%20${encodedUrl}`
        break
    }

    window.open(shareLink, '_blank', 'width=600,height=400')
  }, [shareUrl, onShare, isPublic, roadmapTitle])

  if (!mounted || !isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-500 my-8 ${
          showContent ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-yellow-500 via-orange-500 to-pink-500 p-8 text-center text-white">
          {/* Sparkle effects */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <Sparkles
                key={i}
                className="absolute w-4 h-4 text-white/40 animate-pulse"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: `${10 + Math.random() * 80}%`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              />
            ))}
          </div>

          {/* Trophy */}
          <div className="relative mb-4 inline-flex">
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
              <Trophy className="w-12 h-12 text-white" />
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-2">Roadmap Complete!</h2>
          <p className="text-white/90 text-lg font-medium">{roadmapTitle}</p>
        </div>

        {/* Stats */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-2xl font-bold">{totalSteps}</span>
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">steps completed</div>
            </div>

            <div className="text-center p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400 mb-1">
                <Clock className="w-5 h-5" />
                <span className="text-2xl font-bold">{daysToComplete}</span>
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">days to complete</div>
            </div>

            <div className="text-center p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400 mb-1">
                <Flame className="w-5 h-5" />
                <span className="text-2xl font-bold">{longestStreak}</span>
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">day streak</div>
            </div>

            <div className="text-center p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              <div className="flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400 mb-1">
                <FileText className="w-5 h-5" />
                <span className="text-2xl font-bold">{capturesCreated}</span>
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">notes captured</div>
            </div>
          </div>
        </div>

        {/* Share section */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              <span className="font-semibold text-neutral-900 dark:text-white">
                Share Your Achievement
              </span>
            </div>

            {/* Public toggle */}
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                isPublic
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {isPublic ? 'Public' : 'Private'}
            </button>
          </div>

          {/* Social buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => handleSocialShare('twitter')}
              disabled={isSharing}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-black text-white rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              <TwitterIcon />
              <span className="text-sm font-medium">Twitter</span>
            </button>
            <button
              onClick={() => handleSocialShare('linkedin')}
              disabled={isSharing}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#0077B5] text-white rounded-xl hover:bg-[#006699] transition-colors disabled:opacity-50"
            >
              <LinkedInIcon />
              <span className="text-sm font-medium">LinkedIn</span>
            </button>
            <button
              onClick={() => handleSocialShare('whatsapp')}
              disabled={isSharing}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl hover:bg-[#22c55e] transition-colors disabled:opacity-50"
            >
              <WhatsAppIcon />
              <span className="text-sm font-medium">WhatsApp</span>
            </button>
          </div>

          {/* Copy link */}
          <button
            onClick={handleCopyLink}
            disabled={isSharing}
            className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5 text-green-600" />
                <span className="font-medium">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                <span className="font-medium">Copy Link</span>
              </>
            )}
          </button>

          {isPublic && (
            <p className="mt-3 text-xs text-center text-neutral-500 dark:text-neutral-500">
              Others can view and copy your roadmap
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex flex-col gap-3">
          <button
            onClick={onStartNew}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            Start New Learning Goal
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
})

export default RoadmapCelebration
