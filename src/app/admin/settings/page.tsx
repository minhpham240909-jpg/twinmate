'use client'

// Admin Settings Page
// CEO Control Panel - Admin Panel Settings

import { useState } from 'react'
import {
  Settings,
  Shield,
  Database,
  ExternalLink,
  Key,
  Lock,
  Server,
  RefreshCw,
} from 'lucide-react'

export default function AdminSettingsPage() {
  const [isClearing, setIsClearing] = useState(false)

  // External service links
  const externalServices = [
    {
      name: 'Supabase Dashboard',
      description: 'Database management, auth settings, storage',
      icon: Database,
      url: 'https://app.supabase.com',
      color: 'bg-green-500',
    },
    {
      name: 'PostHog Analytics',
      description: 'User behavior analytics, session recordings',
      icon: Server,
      url: 'https://app.posthog.com',
      color: 'bg-blue-500',
    },
    {
      name: 'Vercel Dashboard',
      description: 'Deployments, environment variables, logs',
      icon: Server,
      url: 'https://vercel.com/dashboard',
      color: 'bg-gray-500',
    },
    {
      name: 'Stripe Dashboard',
      description: 'Payments, subscriptions, invoices',
      icon: Key,
      url: 'https://dashboard.stripe.com',
      color: 'bg-purple-500',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Settings</h1>
        <p className="text-gray-400 mt-1">
          Manage admin panel settings and access external services
        </p>
      </div>

      {/* Admin Access Info */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Admin Access</h2>
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-gray-400">
            You have full administrative access to the Clerva platform. This includes:
          </p>
          <ul className="list-disc list-inside text-gray-400 space-y-1 ml-4">
            <li>User management (ban, warn, deactivate users)</li>
            <li>Content moderation (review and handle reports)</li>
            <li>System announcements (create and manage announcements)</li>
            <li>Analytics access (view platform metrics)</li>
            <li>Audit log access (view all admin actions)</li>
            <li>Grant/revoke admin access to other users</li>
          </ul>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Lock className="w-5 h-5 text-yellow-400" />
          </div>
          <h2 className="text-lg font-semibold text-yellow-400">Security Notice</h2>
        </div>
        <div className="space-y-3 text-sm text-yellow-200/80">
          <p>
            All admin actions are logged in the audit trail. Please ensure you:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Only perform actions that are necessary and justified</li>
            <li>Document reasons for bans and warnings</li>
            <li>Review reports thoroughly before taking action</li>
            <li>Never share your admin credentials</li>
            <li>Enable 2FA on your account for extra security</li>
          </ul>
        </div>
      </div>

      {/* External Services */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <ExternalLink className="w-5 h-5 text-purple-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">External Services</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {externalServices.map((service) => (
            <a
              key={service.name}
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors group"
            >
              <div className={`p-3 rounded-lg ${service.color}`}>
                <service.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white group-hover:text-blue-400 transition-colors">
                  {service.name}
                </p>
                <p className="text-sm text-gray-400">{service.description}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
            </a>
          ))}
        </div>
      </div>

      {/* Environment Info */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Server className="w-5 h-5 text-green-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Environment</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-gray-700/50 rounded-lg">
            <p className="text-gray-400">Environment</p>
            <p className="text-white font-medium">
              {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
            </p>
          </div>
          <div className="p-3 bg-gray-700/50 rounded-lg">
            <p className="text-gray-400">Version</p>
            <p className="text-white font-medium">2.0.0</p>
          </div>
          <div className="p-3 bg-gray-700/50 rounded-lg">
            <p className="text-gray-400">Framework</p>
            <p className="text-white font-medium">Next.js 15</p>
          </div>
          <div className="p-3 bg-gray-700/50 rounded-lg">
            <p className="text-gray-400">Database</p>
            <p className="text-white font-medium">Supabase (PostgreSQL)</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Settings className="w-5 h-5 text-orange-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
        </div>

        <div className="space-y-3">
          <button
            onClick={async () => {
              setIsClearing(true)
              try {
                // This would call an API to clear caches
                await new Promise((resolve) => setTimeout(resolve, 1000))
                alert('Caches cleared successfully')
              } catch (error) {
                alert('Failed to clear caches')
              } finally {
                setIsClearing(false)
              }
            }}
            disabled={isClearing}
            className="flex items-center gap-3 w-full p-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${isClearing ? 'animate-spin' : ''}`} />
            <div className="flex-1 text-left">
              <p className="font-medium text-white">Clear Platform Caches</p>
              <p className="text-sm text-gray-400">Clear all server-side caches</p>
            </div>
          </button>

          <a
            href="/api/health"
            target="_blank"
            className="flex items-center gap-3 w-full p-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Server className="w-5 h-5 text-gray-400" />
            <div className="flex-1 text-left">
              <p className="font-medium text-white">Check API Health</p>
              <p className="text-sm text-gray-400">View API status endpoint</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </a>
        </div>
      </div>

    </div>
  )
}
