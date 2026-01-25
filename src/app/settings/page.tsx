'use client'

/**
 * MVP Settings Page - Minimal & Functional
 *
 * Only essential settings for the MVP:
 * - Profile (name, avatar)
 * - Account (email, password)
 * - Notifications (push notifications toggle)
 * - Theme (light/dark)
 * - Sign out / Delete account
 */

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useTheme } from '@/contexts/ThemeContext'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { usePWA } from '@/hooks/usePWA'
import GuestEmptyState from '@/components/GuestEmptyState'
import BottomNav from '@/components/BottomNav'
import {
  ArrowLeft,
  User,
  Bell,
  Moon,
  Sun,
  LogOut,
  Trash2,
  ChevronRight,
  Camera,
  Check,
  Loader2,
  Lock,
  AlertTriangle,
  X,
  Shield,
  MessageSquare,
  Star,
  Image as ImageIcon,
  Send,
  Download,
  Smartphone,
  Share,
  Plus,
} from 'lucide-react'

// Install App Section Component
function InstallAppSection({ onClose }: { onClose: () => void }) {
  const { isIOS, isInstallable, isInstalled, isStandalone, promptInstall } = usePWA()
  const [installing, setInstalling] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true)
      return
    }

    setInstalling(true)
    try {
      const installed = await promptInstall()
      if (installed) {
        toast.success('App installed successfully!')
        onClose()
      }
    } finally {
      setInstalling(false)
    }
  }

  // iOS Instructions Modal
  if (showIOSInstructions) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">
            Install on iOS
          </h3>

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
                  2. Tap &quot;Add to Home Screen&quot;
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
                  3. Tap &quot;Add&quot;
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

  // Already installed state
  if (isInstalled || isStandalone) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-2">
            App Installed!
          </h3>
          <p className="text-sm text-green-600 dark:text-green-400">
            You&apos;re using Clerva as an installed app. Enjoy the full experience!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Install Card */}
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
                Add to your home screen for quick access and a better experience.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={handleInstall}
              disabled={installing || (!isInstallable && !isIOS)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {installing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>{isIOS ? 'Show Instructions' : 'Install App'}</span>
                </>
              )}
            </button>
          </div>

          {!isInstallable && !isIOS && (
            <div className="text-center mt-3 space-y-2">
              <p className="text-xs text-neutral-400">
                Install button not ready? Try these steps:
              </p>
              <ul className="text-xs text-neutral-500 space-y-1">
                <li>• Use Chrome, Edge, or Safari (iOS)</li>
                <li>• Refresh the page (Ctrl/Cmd + Shift + R)</li>
                <li>• Or use browser menu → &quot;Install app&quot;</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Benefits */}
      <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
        <h4 className="font-medium text-neutral-900 dark:text-white mb-2">
          Why install the app?
        </h4>
        <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Quick access from your home screen</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Works offline with cached content</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Full-screen experience without browser UI</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Push notifications for study reminders</span>
          </li>
        </ul>
      </div>

      <p className="text-sm text-neutral-500 text-center">
        Your account syncs automatically between browser and app.
      </p>
    </div>
  )
}

export default function SettingsPage() {
  const { user, loading, profile, signOut, refreshUser } = useAuth()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { isSupported, isSubscribed, subscribe, unsubscribe } = usePushNotifications()
  const { isInstalled, isStandalone } = usePWA()

  // State
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Profile editing state
  const [name, setName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // Feedback state
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackImages, setFeedbackImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  // Initialize name from profile
  useEffect(() => {
    if (profile?.name) {
      setName(profile.name)
    }
  }, [profile])

  // Check if user is a guest
  const isGuest = !loading && !user

  // Handle avatar file selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB')
        return
      }
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }

    setSaving(true)
    try {
      let avatarUrl = profile?.avatarUrl

      // Upload avatar if changed
      if (avatarFile) {
        const formData = new FormData()
        formData.append('file', avatarFile)
        formData.append('type', 'avatar')

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          avatarUrl = uploadData.url
        }
      }

      // Update profile
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), avatarUrl }),
      })

      if (res.ok) {
        toast.success('Profile updated')
        refreshUser()
        setActiveSection(null)
        setAvatarFile(null)
        setAvatarPreview(null)
      } else {
        throw new Error('Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  // Change password
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all fields')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      if (res.ok) {
        toast.success('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setActiveSection(null)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to change password')
      }
    } catch (error) {
      console.error('Error changing password:', error)
      toast.error('Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  // Toggle push notifications
  const handleTogglePush = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe()
        toast.success('Push notifications disabled')
      } else {
        await subscribe()
        toast.success('Push notifications enabled')
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error)
      toast.error('Failed to update notification settings')
    }
  }

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm')
      return
    }

    setDeleting(true)
    try {
      const res = await fetch('/api/user/delete', {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Account deleted')
        signOut()
      } else {
        throw new Error('Failed to delete account')
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error('Failed to delete account')
    } finally {
      setDeleting(false)
    }
  }

  // Handle feedback image upload
  const handleFeedbackImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }

    if (feedbackImages.length >= 3) {
      toast.error('Maximum 3 images allowed')
      return
    }

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'feedback')

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setFeedbackImages((prev) => [...prev, data.url])
      } else {
        throw new Error('Upload failed')
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error('Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  // Remove feedback image
  const handleRemoveFeedbackImage = (index: number) => {
    setFeedbackImages((prev) => prev.filter((_, i) => i !== index))
  }

  // Submit feedback
  const handleSubmitFeedback = async () => {
    if (feedbackRating === 0) {
      toast.error('Please select a rating')
      return
    }

    if (feedbackMessage.trim().length < 10) {
      toast.error('Please write at least 10 characters')
      return
    }

    setSubmittingFeedback(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: feedbackRating,
          message: feedbackMessage.trim(),
          screenshots: feedbackImages,
        }),
      })

      if (res.ok) {
        toast.success('Thank you for your feedback!')
        setFeedbackRating(0)
        setFeedbackMessage('')
        setFeedbackImages([])
        setActiveSection(null)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to submit feedback')
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
      toast.error('Failed to submit feedback')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  // Guest state - show empty state with sign up prompt
  if (isGuest) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-20">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border-b border-neutral-200 dark:border-neutral-800">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </button>
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white">
              Settings
            </h1>
          </div>
        </header>

        {/* Guest Empty State */}
        <GuestEmptyState pageType="settings" />

        {/* Bottom Navigation */}
        <BottomNav />
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => activeSection ? setActiveSection(null) : router.push('/dashboard')}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>
          <h1 className="text-lg font-bold text-neutral-900 dark:text-white">
            {activeSection === 'profile' && 'Edit Profile'}
            {activeSection === 'password' && 'Change Password'}
            {activeSection === 'notifications' && 'Notifications'}
            {activeSection === 'theme' && 'Appearance'}
            {activeSection === 'install' && 'Install App'}
            {activeSection === 'feedback' && 'Send Feedback'}
            {!activeSection && 'Settings'}
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Main Settings Menu */}
        {!activeSection && (
          <div className="space-y-6">
            {/* Profile Section */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">Account</h2>
              </div>

              {/* Profile */}
              <button
                onClick={() => setActiveSection('profile')}
                className="w-full flex items-center gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="relative">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-neutral-900 dark:text-white">{profile.name}</p>
                  <p className="text-sm text-neutral-500">{user.email}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-400" />
              </button>

              {/* Change Password */}
              <button
                onClick={() => setActiveSection('password')}
                className="w-full flex items-center gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors border-t border-neutral-200 dark:border-neutral-800"
              >
                <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center">
                  <Lock className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-neutral-900 dark:text-white">Change Password</p>
                  <p className="text-sm text-neutral-500">Update your password</p>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            {/* Preferences Section */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">Preferences</h2>
              </div>

              {/* Notifications */}
              {isSupported && (
                <button
                  onClick={() => setActiveSection('notifications')}
                  className="w-full flex items-center gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <Bell className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-neutral-900 dark:text-white">Notifications</p>
                    <p className="text-sm text-neutral-500">
                      {isSubscribed ? 'Push notifications enabled' : 'Push notifications disabled'}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400" />
                </button>
              )}

              {/* Theme */}
              <button
                onClick={() => setActiveSection('theme')}
                className="w-full flex items-center gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors border-t border-neutral-200 dark:border-neutral-800"
              >
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  {theme === 'DARK' ? (
                    <Moon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <Sun className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-neutral-900 dark:text-white">Appearance</p>
                  <p className="text-sm text-neutral-500">{theme === 'DARK' ? 'Dark' : 'Light'} mode</p>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-400" />
              </button>

              {/* Install App - only show if not installed */}
              {!isInstalled && !isStandalone && (
                <button
                  onClick={() => setActiveSection('install')}
                  className="w-full flex items-center gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors border-t border-neutral-200 dark:border-neutral-800"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-neutral-900 dark:text-white">Install App</p>
                    <p className="text-sm text-neutral-500">Add to your home screen</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400" />
                </button>
              )}

              {/* Already installed indicator */}
              {(isInstalled || isStandalone) && (
                <div className="flex items-center gap-4 p-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-neutral-900 dark:text-white">App Installed</p>
                    <p className="text-sm text-green-600 dark:text-green-400">You're using the app version</p>
                  </div>
                  <Check className="w-5 h-5 text-green-500" />
                </div>
              )}
            </div>

            {/* Admin Section - Only show for admin users */}
            {profile.isAdmin && (
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                  <h2 className="text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Admin</h2>
                </div>

                {/* Admin Dashboard */}
                <button
                  onClick={() => router.push('/admin')}
                  className="w-full flex items-center gap-4 p-4 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors"
                >
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                    <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-neutral-900 dark:text-white">Admin Dashboard</p>
                    <p className="text-sm text-neutral-500">Manage users, feedback & analytics</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400" />
                </button>
              </div>
            )}

            {/* Support Section */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">Support</h2>
              </div>

              {/* Send Feedback */}
              <button
                onClick={() => setActiveSection('feedback')}
                className="w-full flex items-center gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-neutral-900 dark:text-white">Send Feedback</p>
                  <p className="text-sm text-neutral-500">Help us improve the app</p>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            {/* Danger Zone */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wide">Danger Zone</h2>
              </div>

              {/* Sign Out */}
              <button
                onClick={signOut}
                className="w-full flex items-center gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-neutral-900 dark:text-white">Sign Out</p>
                  <p className="text-sm text-neutral-500">Log out of your account</p>
                </div>
              </button>

              {/* Delete Account */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-4 p-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors border-t border-neutral-200 dark:border-neutral-800"
              >
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-red-600 dark:text-red-400">Delete Account</p>
                  <p className="text-sm text-neutral-500">Permanently delete your account</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Edit Profile Section */}
        {activeSection === 'profile' && (
          <div className="space-y-6">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="relative">
                {avatarPreview || profile.avatarUrl ? (
                  <img
                    src={avatarPreview || profile.avatarUrl || ''}
                    alt={profile.name}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <User className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors">
                  <Camera className="w-4 h-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-sm text-neutral-500 mt-2">Tap to change photo</p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Your name"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Email
              </label>
              <div className="w-full px-4 py-3 bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-500">
                {user.email}
              </div>
              <p className="text-xs text-neutral-400 mt-1">Email cannot be changed</p>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveProfile}
              disabled={saving || !name.trim()}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Check className="w-5 h-5" />
              )}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        )}

        {/* Change Password Section */}
        {activeSection === 'password' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Confirm new password"
              />
            </div>

            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {changingPassword ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
              <span>{changingPassword ? 'Changing...' : 'Change Password'}</span>
            </button>
          </div>
        )}

        {/* Notifications Section */}
        {activeSection === 'notifications' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <Bell className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-white">Push Notifications</p>
                    <p className="text-sm text-neutral-500">Get notified about important updates</p>
                  </div>
                </div>
                <button
                  onClick={handleTogglePush}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    isSubscribed ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-neutral-700'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      isSubscribed ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <p className="text-sm text-neutral-500 text-center">
              We'll only send you notifications about your study progress and important updates.
            </p>
          </div>
        )}

        {/* Theme Section */}
        {activeSection === 'theme' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              {/* Light */}
              <button
                onClick={() => setTheme('LIGHT')}
                className="w-full flex items-center gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                  <Sun className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-neutral-900 dark:text-white">Light</p>
                  <p className="text-sm text-neutral-500">Light background with dark text</p>
                </div>
                {theme === 'LIGHT' && (
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>

              {/* Dark */}
              <button
                onClick={() => setTheme('DARK')}
                className="w-full flex items-center gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors border-t border-neutral-200 dark:border-neutral-800"
              >
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                  <Moon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-neutral-900 dark:text-white">Dark</p>
                  <p className="text-sm text-neutral-500">Dark background with light text</p>
                </div>
                {theme === 'DARK' && (
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Install App Section */}
        {activeSection === 'install' && (
          <InstallAppSection onClose={() => setActiveSection(null)} />
        )}

        {/* Feedback Section */}
        {activeSection === 'feedback' && (
          <div className="space-y-6">
            {/* Rating */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                How would you rate your experience?
              </label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setFeedbackRating(star)}
                    className="p-2 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-10 h-10 transition-colors ${
                        star <= feedbackRating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-neutral-300 dark:text-neutral-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-center text-sm text-neutral-500 mt-2">
                {feedbackRating === 0 && 'Tap to rate'}
                {feedbackRating === 1 && 'Poor'}
                {feedbackRating === 2 && 'Fair'}
                {feedbackRating === 3 && 'Good'}
                {feedbackRating === 4 && 'Very Good'}
                {feedbackRating === 5 && 'Excellent!'}
              </p>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Tell us more
              </label>
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                placeholder="What can we improve? What do you like? Any bugs or issues?"
                rows={4}
                maxLength={5000}
              />
              <p className="text-xs text-neutral-400 mt-1 text-right">
                {feedbackMessage.length}/5000
              </p>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Add screenshots (optional)
              </label>

              {/* Uploaded Images */}
              {feedbackImages.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {feedbackImages.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`Screenshot ${index + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-neutral-200 dark:border-neutral-700"
                      />
                      <button
                        onClick={() => handleRemoveFeedbackImage(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              {feedbackImages.length < 3 && (
                <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                  {uploadingImage ? (
                    <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-neutral-400" />
                  )}
                  <span className="text-sm text-neutral-500">
                    {uploadingImage ? 'Uploading...' : 'Add screenshot'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFeedbackImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
              )}
              <p className="text-xs text-neutral-400 mt-1">
                Max 3 images, 5MB each
              </p>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitFeedback}
              disabled={submittingFeedback || feedbackRating === 0 || feedbackMessage.trim().length < 10}
              className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {submittingFeedback ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              <span>{submittingFeedback ? 'Sending...' : 'Send Feedback'}</span>
            </button>

            <p className="text-sm text-neutral-500 text-center">
              Your feedback helps us make Clerva better for everyone.
            </p>
          </div>
        )}
      </main>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText('')
                }}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Delete Account?
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              This action is permanent and cannot be undone. All your data, progress, and history will be permanently deleted.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Type <span className="font-bold text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                placeholder="DELETE"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText('')
                }}
                className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
