'use client'

/**
 * SHARE MODAL
 *
 * Modal for sharing a completed roadmap.
 * Features:
 * - Generate shareable link
 * - Copy to clipboard
 * - Social share buttons
 * - Privacy toggle
 */

import { useState, useCallback, memo } from 'react'
import {
  X,
  Share2,
  Link2,
  Copy,
  Check,
  Globe,
  Lock,
  Loader2,
  Twitter,
  Linkedin,
  MessageCircle,
} from 'lucide-react'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  roadmapId: string
  roadmapTitle: string
  onShare: (roadmapId: string, userName?: string) => Promise<{ shareUrl: string } | null>
  existingShare?: {
    id: string
    slug: string
    shareUrl: string
    isPublic: boolean
    viewCount: number
    copyCount: number
  }
}

export const ShareModal = memo(function ShareModal({
  isOpen,
  onClose,
  roadmapId,
  roadmapTitle,
  onShare,
  existingShare,
}: ShareModalProps) {
  const [userName, setUserName] = useState('')
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState(existingShare?.shareUrl || '')
  const [copied, setCopied] = useState(false)
  const [isPublic, setIsPublic] = useState(existingShare?.isPublic ?? true)

  const handleShare = async () => {
    setIsSharing(true)
    const result = await onShare(roadmapId, userName || undefined)
    setIsSharing(false)

    if (result) {
      setShareUrl(result.shareUrl)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSocialShare = (platform: 'twitter' | 'linkedin' | 'whatsapp') => {
    if (!shareUrl) return

    const text = `Check out my completed learning roadmap: ${roadmapTitle}`
    let url = ''

    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`
        break
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
        break
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`
        break
    }

    window.open(url, '_blank', 'width=600,height=400')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Share Roadmap
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Roadmap title */}
          <div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
              Sharing
            </p>
            <p className="font-medium text-neutral-900 dark:text-white">
              {roadmapTitle}
            </p>
          </div>

          {/* Share URL input (if shared) */}
          {shareUrl ? (
            <>
              {/* URL display with copy */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Share link
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl">
                    <Link2 className="w-4 h-4 text-neutral-400 shrink-0" />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
                      {shareUrl}
                    </span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`px-4 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                      copied
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Social share buttons */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Share on
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSocialShare('twitter')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1DA1F2] hover:bg-[#1a94da] text-white rounded-xl transition-colors"
                  >
                    <Twitter className="w-4 h-4" />
                    <span className="text-sm font-medium">Twitter</span>
                  </button>
                  <button
                    onClick={() => handleSocialShare('linkedin')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0A66C2] hover:bg-[#095299] text-white rounded-xl transition-colors"
                  >
                    <Linkedin className="w-4 h-4" />
                    <span className="text-sm font-medium">LinkedIn</span>
                  </button>
                  <button
                    onClick={() => handleSocialShare('whatsapp')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Stats */}
              {existingShare && (
                <div className="flex items-center justify-center gap-6 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-neutral-900 dark:text-white">
                      {existingShare.viewCount}
                    </p>
                    <p className="text-xs text-neutral-500">Views</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-neutral-900 dark:text-white">
                      {existingShare.copyCount}
                    </p>
                    <p className="text-xs text-neutral-500">Copies</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Name input (optional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Your name (optional)
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Display name for your shared roadmap"
                  className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Privacy toggle */}
              <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                <div className="flex items-center gap-3">
                  {isPublic ? (
                    <Globe className="w-5 h-5 text-green-600" />
                  ) : (
                    <Lock className="w-5 h-5 text-amber-600" />
                  )}
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {isPublic ? 'Public' : 'Private'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {isPublic
                        ? 'Anyone with the link can view'
                        : 'Only you can see this'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    isPublic ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      isPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Share button */}
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
              >
                {isSharing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating link...
                  </>
                ) : (
                  <>
                    <Share2 className="w-5 h-5" />
                    Create Share Link
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
})
