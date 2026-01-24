'use client'

/**
 * PWA Install Banner
 *
 * Shows a banner prompting users to install the app as a PWA.
 * - On Android/Desktop: Shows install button that triggers beforeinstallprompt
 * - On iOS: Shows instructions to use Safari's "Add to Home Screen"
 *
 * Features:
 * - Dismissable (remembers for 7 days)
 * - Auto-hides when app is installed
 * - Platform-specific UI and instructions
 */

import { useState } from 'react'
import { X, Download, Share, Plus, Smartphone } from 'lucide-react'
import { usePWA } from '@/hooks/usePWA'

interface PWAInstallBannerProps {
  variant?: 'banner' | 'modal'
  onDismiss?: () => void
}

export default function PWAInstallBanner({
  variant = 'banner',
  onDismiss,
}: PWAInstallBannerProps) {
  const {
    isIOS,
    isInstallable,
    canShowInstallBanner,
    promptInstall,
    dismissInstallPrompt,
  } = usePWA()

  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [installing, setInstalling] = useState(false)

  // Don't render if we shouldn't show the banner
  if (!canShowInstallBanner) return null

  const handleDismiss = () => {
    dismissInstallPrompt()
    onDismiss?.()
  }

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true)
      return
    }

    setInstalling(true)
    try {
      const installed = await promptInstall()
      if (installed) {
        handleDismiss()
      }
    } finally {
      setInstalling(false)
    }
  }

  // iOS Instructions Modal
  if (showIOSInstructions) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
              Install Clerva
            </h3>
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <Share className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">
                  1. Tap the Share button
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  At the bottom of Safari
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">
                  2. Tap "Add to Home Screen"
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Scroll down in the share menu
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">
                  3. Tap "Add"
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Clerva will appear on your home screen
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowIOSInstructions(false)}
            className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    )
  }

  // Banner variant
  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {isIOS ? 'Add to Home Screen' : 'Install Clerva'}
              </p>
              <p className="text-xs text-white/70 truncate hidden sm:block">
                Get the full mobile app experience
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleInstall}
              disabled={installing || (!isInstallable && !isIOS)}
              className="px-4 py-1.5 bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 text-sm font-semibold rounded-full hover:bg-indigo-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {installing ? 'Installing...' : isIOS ? 'How?' : 'Install'}
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Modal variant (for settings page)
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Download className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-neutral-900 dark:text-white">
              Install Clerva App
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              Add to your home screen for quick access, offline support, and a better experience.
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleInstall}
            disabled={installing || (!isInstallable && !isIOS)}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            <span>{installing ? 'Installing...' : isIOS ? 'Show Instructions' : 'Install App'}</span>
          </button>
        </div>

        {!isInstallable && !isIOS && (
          <p className="text-xs text-neutral-400 text-center mt-3">
            Already installed or not available in this browser
          </p>
        )}
      </div>
    </div>
  )
}
