'use client'

// Admin Dashboard Layout
// CEO Control Panel - Protected Layout with Navigation

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard,
  Users,
  FileText,
  Megaphone,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  AlertTriangle,
  Home,
  MessageSquare,
  RefreshCw,
  Bot,
  Clock,
} from 'lucide-react'

// Fetch with timeout to prevent infinite loading
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`)
    }
    throw error
  }
}

interface AdminUser {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  adminGrantedAt: string | null
  twoFactorEnabled?: boolean
}

interface AdminCheckResponse {
  isAdmin: boolean
  user?: AdminUser | null
  requires2FASetup?: boolean
  sessionExpired?: boolean
  sessionTimeout?: number
  error?: string
}

const navItems = [
  {
    name: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Dashboard overview and key metrics',
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: Users,
    description: 'Manage users, bans, and warnings',
  },
  {
    name: 'AI Partner',
    href: '/admin/ai-partner',
    icon: Bot,
    description: 'AI Study Partner analytics & moderation',
  },
  {
    name: 'Messages',
    href: '/admin/messages',
    icon: MessageSquare,
    description: 'Message moderation and monitoring',
  },
  {
    name: 'Reports',
    href: '/admin/reports',
    icon: AlertTriangle,
    description: 'Content moderation and reports',
  },
  {
    name: 'Announcements',
    href: '/admin/announcements',
    icon: Megaphone,
    description: 'System-wide announcements',
  },
  {
    name: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    description: 'Real-time analytics and insights',
  },
  {
    name: 'Audit Log',
    href: '/admin/audit',
    icon: FileText,
    description: 'Admin action history',
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'Admin panel settings',
  },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requires2FA, setRequires2FA] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Verify admin access on mount
  const checkAdminAccess = async () => {
    setIsLoading(true)
    setError(null)
    setRequires2FA(false)
    setSessionExpired(false)
    try {
      const response = await fetchWithTimeout('/api/admin/check', {}, 15000)
      const data: AdminCheckResponse = await response.json()

      // Handle 2FA requirement
      if (data.requires2FASetup) {
        setRequires2FA(true)
        setAdminUser(data.user || null)
        setIsAdmin(false)
        return
      }

      // Handle session expiration
      if (data.sessionExpired) {
        setSessionExpired(true)
        setIsAdmin(false)
        return
      }

      if (!data.isAdmin) {
        // Not an admin, redirect to home
        router.replace('/')
        return
      }

      setIsAdmin(true)
      setAdminUser(data.user || null)
    } catch (error) {
      console.error('Error checking admin access:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify admin access'
      if (errorMessage.includes('timed out')) {
        setError('Connection timed out. The server may be slow or unavailable.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkAdminAccess()
  }, [router])

  // SECURITY: Refresh admin session periodically to prevent timeout during active use
  useEffect(() => {
    if (!isAdmin) return

    // Refresh session every 5 minutes while admin is active
    const interval = setInterval(() => {
      // Only refresh if the page is visible (user is actively using it)
      if (document.visibilityState === 'visible') {
        fetchWithTimeout('/api/admin/check', {}, 5000).catch(() => {
          // Silent fail - next user action will trigger full check
        })
      }
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [isAdmin])

  // Handle logout with confirmation
  const handleLogoutClick = () => {
    setShowLogoutConfirm(true)
  }

  const confirmLogout = async () => {
    setIsLoggingOut(true)
    try {
      // Call signout API to clear server session
      await fetch('/api/auth/signout', { method: 'POST' })

      // Clear client-side Supabase session
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase.auth.signOut()

      // Force redirect to landing page (use replace to prevent back navigation)
      window.location.replace('/')
    } catch (error) {
      console.error('Logout error:', error)
      // Even if there's an error, try to redirect
      window.location.replace('/')
    }
  }

  const cancelLogout = () => {
    setShowLogoutConfirm(false)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  // Error state with retry
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">Connection Error</h2>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={checkAdminAccess}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <button
            onClick={() => router.replace('/')}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  // 2FA required state - admin must enable 2FA first
  if (requires2FA) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-md text-center px-4">
          <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Two-Factor Authentication Required
            </h2>
            <p className="text-gray-400">
              For security purposes, all administrators must have two-factor authentication enabled
              to access the admin panel.
            </p>
          </div>
          {adminUser && (
            <p className="text-sm text-gray-500">
              Logged in as: {adminUser.email}
            </p>
          )}
          <div className="flex flex-col gap-3 w-full">
            <Link
              href="/settings?tab=security"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
            >
              <Settings className="w-5 h-5" />
              Enable 2FA in Settings
            </Link>
            <button
              onClick={checkAdminAccess}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              I&apos;ve enabled 2FA - Check again
            </button>
            <button
              onClick={() => router.replace('/dashboard')}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Session expired state - admin needs to refresh
  if (sessionExpired) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-md text-center px-4">
          <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center">
            <Clock className="w-10 h-10 text-orange-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Session Expired
            </h2>
            <p className="text-gray-400">
              Your admin session has expired due to inactivity. For security purposes, admin
              sessions automatically expire after 30 minutes of inactivity.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={checkAdminAccess}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Continue Session
            </button>
            <button
              onClick={() => router.replace('/dashboard')}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Not authorized
  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-800 border-r border-gray-700`}
      >
        {/* Logo and Toggle */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="Clerva" width={32} height={32} className="rounded-lg" />
              <span className="text-lg font-bold text-white">Admin Panel</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                    title={!sidebarOpen ? item.name : undefined}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
                    {sidebarOpen && (
                      <>
                        <span className="flex-1 font-medium">{item.name}</span>
                        {isActive && <ChevronRight className="w-4 h-4" />}
                      </>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Go to App Link */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <Link
              href="/dashboard?from=admin"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-all duration-200"
              title={!sidebarOpen ? 'Go to App' : undefined}
            >
              <Home className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="font-medium">Go to App</span>}
            </Link>
          </div>
        </nav>

        {/* Admin User Info */}
        <div className="border-t border-gray-700 p-4">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              {adminUser?.avatarUrl ? (
                <Image
                  src={adminUser.avatarUrl}
                  alt={adminUser.name || 'Admin'}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-medium">
                    {adminUser?.name?.charAt(0) || adminUser?.email?.charAt(0) || 'A'}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {adminUser?.name || 'Admin'}
                </p>
                <p className="text-xs text-gray-400 truncate">{adminUser?.email}</p>
              </div>
              <button
                onClick={handleLogoutClick}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogoutClick}
              className="w-full p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors flex justify-center"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700 h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Clerva" width={24} height={24} className="rounded-lg" />
          <span className="text-lg font-bold text-white">Admin</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-gray-700 text-gray-400"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 border-r border-gray-700 transform transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Clerva" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-bold text-white">Admin Panel</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Go to App Link (Mobile) */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <Link
              href="/dashboard?from=admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-all duration-200"
            >
              <Home className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">Go to App</span>
            </Link>
          </div>
        </nav>

        {/* Mobile Admin User Info */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center gap-3">
            {adminUser?.avatarUrl ? (
              <Image
                src={adminUser.avatarUrl}
                alt={adminUser.name || 'Admin'}
                width={40}
                height={40}
                className="rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-medium">
                  {adminUser?.name?.charAt(0) || adminUser?.email?.charAt(0) || 'A'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {adminUser?.name || 'Admin'}
              </p>
              <p className="text-xs text-gray-400 truncate">{adminUser?.email}</p>
            </div>
            <button
              onClick={handleLogoutClick}
              className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-red-400"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        } pt-16 lg:pt-0`}
      >
        <div className="p-6">{children}</div>
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-500/20">
                <LogOut className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Confirm Logout</h2>
                <p className="text-sm text-gray-400">Are you sure you want to log out?</p>
              </div>
            </div>

            <p className="text-gray-400 text-sm mb-6">
              You will be redirected to the landing page and will need to sign in again to access the admin panel.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={cancelLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Logging out...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
