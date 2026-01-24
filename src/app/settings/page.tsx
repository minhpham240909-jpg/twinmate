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
} from 'lucide-react'

export default function SettingsPage() {
  const { user, loading, profile, signOut, refreshUser } = useAuth()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { isSupported, isSubscribed, subscribe, unsubscribe } = usePushNotifications()

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

  // Initialize name from profile
  useEffect(() => {
    if (profile?.name) {
      setName(profile.name)
    }
  }, [profile])

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
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
