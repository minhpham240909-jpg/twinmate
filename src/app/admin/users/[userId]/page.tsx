'use client'

/**
 * Admin User Detail Page
 * CEO Control Panel - View Complete User Profile, Activity & Behavior
 *
 * Similar to Facebook/ChatGPT admin panels for user investigation
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft,
  User,
  Calendar,
  Clock,
  Shield,
  Ban,
  AlertTriangle,
  MessageSquare,
  FileText,
  Users,
  Video,
  Flag,
  Smartphone,
  Globe,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Crown,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Bot,
  Sparkles,
  Star,
} from 'lucide-react'

interface UserDetails {
  user: {
    id: string
    email: string
    name: string
    avatarUrl: string | null
    coverPhotoUrl: string | null
    role: string
    emailVerified: boolean
    signupMethod: string
    stripeCustomerId: string | null
    subscriptionStatus: string | null
    subscriptionEndsAt: string | null
    deactivatedAt: string | null
    deactivationReason: string | null
    twoFactorEnabled: boolean
    isAdmin: boolean
    adminGrantedAt: string | null
    adminGrantedBy: string | null
    createdAt: string
    updatedAt: string
    lastLoginAt: string | null
    profile: {
      bio: string | null
      age: number | null
      role: string | null
      timezone: string | null
      location_city: string | null
      location_state: string | null
      location_country: string | null
      location_visibility: string
      subjects: string[]
      interests: string[]
      goals: string[]
      skillLevel: string | null
      studyStyle: string | null
      school: string | null
      languages: string | null
      availableDays: string[]
      availableHours: string[]
      aboutYourself: string | null
      aboutYourselfItems: string[]
      isLookingForPartner: boolean
      studyStreak: number
      totalStudyHours: number
      lastStudyDate: string | null
    } | null
    learningProfile: {
      strengths: string[]
      weaknesses: string[]
      recommendedFocus: string[]
      learningVelocity: number | null
      retentionRate: number | null
      preferredDifficulty: string | null
    } | null
    settings: {
      theme: string
      language: string
      notifyMessages: boolean
      notifyConnectionRequests: boolean
      profileVisibility: string
      showOnlineStatus: boolean
    } | null
  }
  activityStats: {
    totalMessages: number
    totalPosts: number
    totalComments: number
    totalLikes: number
    totalSessions: number
    totalGroups: number
    totalPartners: number
    totalReportsAgainst: number
    totalWarnings: number
    accountAge: number
  }
  recentMessages: Array<{
    id: string
    content: string
    type: string
    createdAt: string
    isEdited: boolean
    isDeleted: boolean
    recipientId: string | null
    groupId: string | null
  }>
  recentPosts: Array<{
    id: string
    content: string
    imageUrls: string[]
    isDeleted: boolean
    createdAt: string
    updatedAt: string
    _count: { likes: number; comments: number; reposts: number }
  }>
  groupMemberships: Array<{
    role: string
    joinedAt: string
    group: { id: string; name: string; description: string | null; subject: string | null; memberCount: number }
  }>
  studySessions: Array<{
    joinedAt: string
    leftAt: string | null
    session: {
      id: string
      title: string
      status: string
      scheduledAt: string | null
      startedAt: string | null
      endedAt: string | null
      creator: { id: string; name: string }
      _count: { participants: number }
    }
  }>
  partnerConnections: Array<{
    matchId: string
    status: string
    connectedAt: string
    partner: { id: string; name: string; email: string; avatarUrl: string | null }
  }>
  reportsAgainst: Array<{
    id: string
    type: string
    description: string | null
    status: string
    createdAt: string
    handledAt: string | null
    resolution: string | null
    reporter: { id: string; name: string; email: string }
    handledBy: { id: string; name: string } | null
  }>
  reportsFiled: Array<{
    id: string
    type: string
    description: string | null
    status: string
    createdAt: string
    handledAt: string | null
    reportedUser: { id: string; name: string; email: string }
  }>
  warnings: Array<{
    id: string
    reason: string
    severity: string
    issuedById: string
    createdAt: string
    expiresAt: string | null
  }>
  ban: {
    id: string
    type: string
    reason: string
    issuedById: string
    createdAt: string
    expiresAt: string | null
  } | null
  deviceSessions: Array<{
    id: string
    deviceId: string
    userAgent: string | null
    ipAddress: string | null
    createdAt: string
    lastHeartbeatAt: string
    isActive: boolean
  }>
  onlineStatus: {
    isOnline: boolean
    status: 'ONLINE' | 'OFFLINE'
    lastSeenAt: string | null
    lastActivityAt: string | null
    activeDevices: number
    lastSeenMinutesAgo: number | null
  }
  riskIndicators: {
    hasWarnings: boolean
    warningCount: number
    hasReportsAgainst: boolean
    reportCount: number
    isBanned: boolean
    banType: string | null
    isDeactivated: boolean
    recentActivity: number | null
    hasAIFlaggedContent?: boolean
    aiFlaggedCount?: number
  }
  aiPartner?: {
    sessions: Array<{
      id: string
      subject: string | null
      status: string
      startedAt: string
      endedAt: string | null
      totalDuration: number | null
      durationFormatted: string | null
      messageCount: number
      quizCount: number
      flashcardCount: number
      rating: number | null
      flaggedCount: number
      wasSafetyBlocked: boolean
      createdAt: string
    }>
    stats: {
      totalSessions: number
      totalMessages: number
      totalDuration: number
      totalDurationFormatted: string
      averageRating: number | null
      totalFlagged: number
    }
    flaggedMessages: Array<{
      id: string
      content: string
      role: string
      flagCategories: string[]
      createdAt: string
      session: { id: string; subject: string | null }
    }>
    hasAIPartnerActivity: boolean
    hasFlaggedContent: boolean
  }
}

// Collapsible Section Component
function Section({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = false,
  badge,
  badgeColor = 'blue',
}: {
  title: string
  icon: React.ElementType
  count?: number
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: string
  badgeColor?: 'blue' | 'green' | 'red' | 'yellow' | 'gray'
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const badgeColors = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    gray: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/30 transition"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-gray-600 dark:text-slate-400" />
          <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
          {count !== undefined && (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs rounded-full">
              {count}
            </span>
          )}
          {badge && (
            <span className={`px-2 py-0.5 ${badgeColors[badgeColor]} text-xs rounded-full font-medium`}>
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700/50 pt-4">{children}</div>}
    </div>
  )
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string

  const [data, setData] = useState<UserDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUserDetails = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/users/${userId}/details`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || 'Failed to fetch user details')
      }
    } catch (err) {
      setError('Failed to fetch user details')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchUserDetails()
  }, [fetchUserDetails])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatRelativeTime = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(dateString)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-slate-400">Loading user details...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error || 'User not found'}</p>
          <button
            onClick={() => router.push('/admin/users')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Back to Users
          </button>
        </div>
      </div>
    )
  }

  const { user, activityStats, riskIndicators, onlineStatus } = data

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/users')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">User Investigation</h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">CEO Control Panel</p>
              </div>
            </div>
            <button
              onClick={fetchUserDetails}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Risk Alert Banner */}
        {(riskIndicators.isBanned || riskIndicators.hasWarnings || riskIndicators.hasReportsAgainst) && (
          <div className={`p-4 rounded-xl border ${
            riskIndicators.isBanned
              ? 'bg-red-500/10 border-red-500/30'
              : riskIndicators.hasWarnings
              ? 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-orange-500/10 border-orange-500/30'
          }`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                riskIndicators.isBanned ? 'text-red-500' : riskIndicators.hasWarnings ? 'text-yellow-500' : 'text-orange-500'
              }`} />
              <div>
                <h3 className={`font-semibold ${
                  riskIndicators.isBanned ? 'text-red-400' : riskIndicators.hasWarnings ? 'text-yellow-400' : 'text-orange-400'
                }`}>
                  {riskIndicators.isBanned
                    ? `User is ${riskIndicators.banType === 'PERMANENT' ? 'Permanently' : 'Temporarily'} Banned`
                    : riskIndicators.hasWarnings
                    ? `User has ${riskIndicators.warningCount} Warning(s)`
                    : `User has ${riskIndicators.reportCount} Report(s) Against Them`}
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                  {riskIndicators.isBanned
                    ? 'This account is currently restricted from accessing the platform.'
                    : 'Review the warnings and reports section below for more details.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* User Overview Card */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700/50 overflow-hidden">
          {/* Cover Photo */}
          <div className="h-32 bg-gradient-to-r from-blue-500 to-blue-600 relative">
            {user.coverPhotoUrl && (
              <Image src={user.coverPhotoUrl} alt="Cover" fill className="object-cover" />
            )}
          </div>

          {/* User Info */}
          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-12 mb-4">
              <div className="relative">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.name}
                    width={96}
                    height={96}
                    className="rounded-full border-4 border-white dark:border-slate-800"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 border-4 border-white dark:border-slate-800 flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">{user.name.charAt(0)}</span>
                  </div>
                )}
                {/* Status indicator - Online/Offline based on real-time presence */}
                <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white dark:border-slate-800 ${
                  riskIndicators.isBanned
                    ? 'bg-red-500'
                    : riskIndicators.isDeactivated
                    ? 'bg-gray-500'
                    : onlineStatus?.isOnline
                    ? 'bg-green-500'
                    : 'bg-gray-400'
                }`} title={
                  riskIndicators.isBanned
                    ? 'Banned'
                    : riskIndicators.isDeactivated
                    ? 'Deactivated'
                    : onlineStatus?.isOnline
                    ? 'Online'
                    : onlineStatus?.lastSeenMinutesAgo != null
                    ? `Offline - last seen ${onlineStatus.lastSeenMinutesAgo}m ago`
                    : 'Offline'
                } />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
                  {user.isAdmin && (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full font-medium flex items-center gap-1">
                      <Crown className="w-3 h-3" /> Admin
                    </span>
                  )}
                  {user.emailVerified ? (
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Verified
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Unverified
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    user.role === 'PREMIUM' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {user.role}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-slate-400">{user.email}</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
              <div className="text-center p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{activityStats.totalMessages}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400">Messages</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{activityStats.totalPosts}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400">Posts</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{activityStats.totalPartners}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400">Partners</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{activityStats.totalGroups}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400">Groups</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{activityStats.accountAge}d</div>
                <div className="text-xs text-gray-500 dark:text-slate-400">Account Age</div>
              </div>
            </div>

            {/* Online Status Banner */}
            <div className={`mt-4 px-4 py-2 rounded-lg flex items-center gap-2 ${
              riskIndicators.isBanned
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : riskIndicators.isDeactivated
                ? 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                : onlineStatus?.isOnline
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${
                riskIndicators.isBanned
                  ? 'bg-red-500'
                  : riskIndicators.isDeactivated
                  ? 'bg-gray-500'
                  : onlineStatus?.isOnline
                  ? 'bg-green-500 animate-pulse'
                  : 'bg-gray-400'
              }`} />
              <span className="text-sm font-medium">
                {riskIndicators.isBanned
                  ? 'BANNED'
                  : riskIndicators.isDeactivated
                  ? 'DEACTIVATED'
                  : onlineStatus?.isOnline
                  ? 'ONLINE NOW'
                  : onlineStatus?.lastSeenMinutesAgo != null
                  ? `OFFLINE • Last seen ${onlineStatus.lastSeenMinutesAgo < 60
                      ? `${onlineStatus.lastSeenMinutesAgo}m ago`
                      : `${Math.floor(onlineStatus.lastSeenMinutesAgo / 60)}h ago`}`
                  : 'OFFLINE • Never seen'}
              </span>
              {onlineStatus?.activeDevices > 0 && onlineStatus.isOnline && (
                <span className="text-xs opacity-75">
                  ({onlineStatus.activeDevices} active device{onlineStatus.activeDevices > 1 ? 's' : ''})
                </span>
              )}
            </div>

            {/* Account Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                <Calendar className="w-4 h-4" />
                <span>Joined {formatDate(user.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                <Clock className="w-4 h-4" />
                <span>Last login {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : 'Never'}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                <Globe className="w-4 h-4" />
                <span>Signup via {user.signupMethod === 'google' ? 'Google' : 'Email'}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                <Shield className="w-4 h-4" />
                <span>2FA {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Profile Details */}
            <Section title="Profile Details" icon={User} defaultOpen={true}>
              {user.profile ? (
                <div className="space-y-4">
                  {user.profile.bio && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Bio</label>
                      <p className="text-gray-900 dark:text-white mt-1">{user.profile.bio}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {user.profile.age && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Age</label>
                        <p className="text-gray-900 dark:text-white">{user.profile.age}</p>
                      </div>
                    )}
                    {user.profile.role && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Role</label>
                        <p className="text-gray-900 dark:text-white">{user.profile.role}</p>
                      </div>
                    )}
                    {user.profile.school && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-slate-400">School</label>
                        <p className="text-gray-900 dark:text-white">{user.profile.school}</p>
                      </div>
                    )}
                    {user.profile.timezone && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Timezone</label>
                        <p className="text-gray-900 dark:text-white">{user.profile.timezone}</p>
                      </div>
                    )}
                    {(user.profile.location_city || user.profile.location_country) && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Location</label>
                        <p className="text-gray-900 dark:text-white">
                          {[user.profile.location_city, user.profile.location_state, user.profile.location_country]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      </div>
                    )}
                    {user.profile.skillLevel && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Skill Level</label>
                        <p className="text-gray-900 dark:text-white capitalize">{user.profile.skillLevel.toLowerCase()}</p>
                      </div>
                    )}
                    {user.profile.studyStyle && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Study Style</label>
                        <p className="text-gray-900 dark:text-white capitalize">{user.profile.studyStyle.toLowerCase().replace('_', ' ')}</p>
                      </div>
                    )}
                  </div>
                  {user.profile.subjects.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Subjects</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {user.profile.subjects.map((subject, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                            {subject}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {user.profile.interests.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Interests</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {user.profile.interests.map((interest, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {user.profile.goals.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Goals</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {user.profile.goals.map((goal, idx) => (
                          <span key={idx} className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                            {goal}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-slate-400 text-sm">No profile data available</p>
              )}
            </Section>

            {/* Recent Messages */}
            <Section
              title="Recent Messages"
              icon={MessageSquare}
              count={data.recentMessages.length}
              badge={activityStats.totalMessages > 0 ? `${activityStats.totalMessages} total` : undefined}
            >
              {data.recentMessages.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {data.recentMessages.map(msg => (
                    <div key={msg.id} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          {msg.groupId ? `Group: ${msg.groupId.slice(0, 8)}...` : msg.recipientId ? `DM: ${msg.recipientId.slice(0, 8)}...` : 'Unknown'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${msg.type === 'TEXT' ? 'bg-gray-500/20 text-gray-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {msg.type}
                          </span>
                          <span className="text-xs text-gray-400">{formatRelativeTime(msg.createdAt)}</span>
                        </div>
                      </div>
                      <p className={`text-sm break-words ${msg.isDeleted ? 'text-gray-400 italic line-through' : 'text-gray-900 dark:text-white'}`}>
                        {msg.isDeleted ? '[Deleted]' : msg.content}
                      </p>
                      {msg.isEdited && !msg.isDeleted && (
                        <span className="text-xs text-gray-400 italic">(edited)</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-slate-400 text-sm">No messages found</p>
              )}
            </Section>

            {/* Recent Posts */}
            <Section
              title="Recent Posts"
              icon={FileText}
              count={data.recentPosts.length}
              badge={activityStats.totalPosts > 0 ? `${activityStats.totalPosts} total` : undefined}
            >
              {data.recentPosts.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {data.recentPosts.map(post => (
                    <div key={post.id} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {post.isDeleted && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                              Deleted
                            </span>
                          )}
                          {post.imageUrls.length > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                              {post.imageUrls.length} image{post.imageUrls.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{formatRelativeTime(post.createdAt)}</span>
                      </div>
                      <p className={`text-sm break-words line-clamp-3 ${post.isDeleted ? 'text-gray-400 italic line-through' : 'text-gray-900 dark:text-white'}`}>
                        {post.content}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-slate-400">
                        <span>{post._count.likes} likes</span>
                        <span>{post._count.comments} comments</span>
                        <span>{post._count.reposts} reposts</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-slate-400 text-sm">No posts found</p>
              )}
            </Section>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Warnings & Ban */}
            <Section
              title="Warnings & Bans"
              icon={AlertTriangle}
              count={data.warnings.length}
              badge={data.ban ? 'BANNED' : undefined}
              badgeColor={data.ban ? 'red' : 'gray'}
              defaultOpen={riskIndicators.hasWarnings || riskIndicators.isBanned}
            >
              {data.ban && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Ban className="w-4 h-4 text-red-500" />
                    <span className="font-semibold text-red-400">
                      {data.ban.type === 'PERMANENT' ? 'Permanently Banned' : 'Temporarily Banned'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Reason: {data.ban.reason}</p>
                  {data.ban.expiresAt && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                      Expires: {formatDate(data.ban.expiresAt)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">Banned on {formatDate(data.ban.createdAt)}</p>
                </div>
              )}
              {data.warnings.length > 0 ? (
                <div className="space-y-2">
                  {data.warnings.map(warning => (
                    <div key={warning.id} className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-yellow-400">Severity: {warning.severity}</span>
                        <span className="text-xs text-gray-400">{formatRelativeTime(warning.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-slate-400">{warning.reason}</p>
                      {warning.expiresAt && (
                        <p className="text-xs mt-1 text-gray-500">
                          Expires: {formatDate(warning.expiresAt)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : !data.ban ? (
                <p className="text-gray-500 dark:text-slate-400 text-sm">No warnings or bans</p>
              ) : null}
            </Section>

            {/* Reports Against */}
            <Section
              title="Reports Against User"
              icon={Flag}
              count={data.reportsAgainst.length}
              badgeColor={data.reportsAgainst.length > 0 ? 'red' : 'gray'}
            >
              {data.reportsAgainst.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {data.reportsAgainst.map(report => (
                    <div key={report.id} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          report.status === 'RESOLVED' ? 'bg-green-500/20 text-green-400' :
                          report.status === 'DISMISSED' ? 'bg-gray-500/20 text-gray-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {report.status}
                        </span>
                        <span className="text-xs text-gray-400">{formatRelativeTime(report.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{report.type}</p>
                      {report.description && (
                        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">{report.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">Reported by: {report.reporter.name}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-slate-400 text-sm">No reports against this user</p>
              )}
            </Section>

            {/* Partner Connections */}
            <Section title="Partner Connections" icon={Users} count={data.partnerConnections.length}>
              {data.partnerConnections.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.partnerConnections.map(conn => (
                    <div key={conn.matchId} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-700/30 rounded-lg">
                      {conn.partner.avatarUrl ? (
                        <Image
                          src={conn.partner.avatarUrl}
                          alt={conn.partner.name}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{conn.partner.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{conn.partner.name}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{conn.partner.email}</p>
                      </div>
                      <button
                        onClick={() => router.push(`/admin/users/${conn.partner.id}`)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-slate-400 text-sm">No partner connections</p>
              )}
            </Section>

            {/* Groups */}
            <Section title="Group Memberships" icon={BookOpen} count={data.groupMemberships.length}>
              {data.groupMemberships.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.groupMemberships.map((membership, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white">{membership.group.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          membership.role === 'OWNER' ? 'bg-blue-500/20 text-blue-400' :
                          membership.role === 'ADMIN' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {membership.role}
                        </span>
                      </div>
                      {membership.group.subject && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{membership.group.subject}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {membership.group.memberCount} members • Joined {formatRelativeTime(membership.joinedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-slate-400 text-sm">Not a member of any groups</p>
              )}
            </Section>

            {/* Device Sessions / Login History */}
            <Section title="Login History & Devices" icon={Smartphone} count={data.deviceSessions.length}>
              {data.deviceSessions.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.deviceSessions.map(session => (
                    <div key={session.id} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-sm text-gray-900 dark:text-white">
                            Device {session.deviceId.slice(0, 8)}...
                          </span>
                          {session.isActive && (
                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 space-y-0.5">
                        {session.userAgent && (
                          <p className="truncate" title={session.userAgent}>
                            UA: {session.userAgent.slice(0, 50)}...
                          </p>
                        )}
                        {session.ipAddress && <p>IP: {session.ipAddress}</p>}
                        <p>Last active: {formatRelativeTime(session.lastHeartbeatAt)}</p>
                        <p>Created: {formatRelativeTime(session.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-slate-400 text-sm">No device session data</p>
              )}
            </Section>

            {/* Study Sessions */}
            <Section title="Study Sessions" icon={Video} count={data.studySessions.length}>
              {data.studySessions.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.studySessions.map((participation, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {participation.session.title}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          participation.session.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                          participation.session.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {participation.session.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Created by {participation.session.creator.name} • {participation.session._count.participants} participants
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Joined {formatRelativeTime(participation.joinedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-slate-400 text-sm">No study session participation</p>
              )}
            </Section>

            {/* AI Partner Section */}
            {data.aiPartner && (
              <Section
                title="AI Study Partner"
                icon={Bot}
                count={data.aiPartner.stats.totalSessions}
                badge={data.aiPartner.hasFlaggedContent ? `${data.aiPartner.flaggedMessages.length} flagged` : undefined}
                badgeColor={data.aiPartner.hasFlaggedContent ? 'red' : 'blue'}
                defaultOpen={data.aiPartner.hasAIPartnerActivity}
              >
                {data.aiPartner.hasAIPartnerActivity ? (
                  <div className="space-y-4">
                    {/* AI Partner Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                        <div className="text-xl font-bold text-blue-400">{data.aiPartner.stats.totalSessions}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">Sessions</div>
                      </div>
                      <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                        <div className="text-xl font-bold text-blue-400">{data.aiPartner.stats.totalMessages}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">Messages</div>
                      </div>
                      <div className="text-center p-3 bg-green-500/10 rounded-lg">
                        <div className="text-xl font-bold text-green-400">{data.aiPartner.stats.totalDurationFormatted}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">Total Time</div>
                      </div>
                      <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                        <div className="text-xl font-bold text-yellow-400 flex items-center justify-center gap-1">
                          {data.aiPartner.stats.averageRating ? (
                            <>
                              <Star className="w-4 h-4 fill-current" />
                              {data.aiPartner.stats.averageRating}
                            </>
                          ) : (
                            'N/A'
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">Avg Rating</div>
                      </div>
                    </div>

                    {/* Flagged Messages Alert */}
                    {data.aiPartner.hasFlaggedContent && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <span className="font-semibold text-red-400">
                            {data.aiPartner.flaggedMessages.length} Flagged Message(s)
                          </span>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {data.aiPartner.flaggedMessages.map(msg => (
                            <div key={msg.id} className="p-2 bg-red-500/5 rounded text-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-red-400">
                                  {msg.role === 'USER' ? 'User message' : 'AI response'} • {msg.session.subject || 'General'}
                                </span>
                                <span className="text-xs text-gray-400">{formatRelativeTime(msg.createdAt)}</span>
                              </div>
                              <p className="text-gray-600 dark:text-slate-400 line-clamp-2">{msg.content}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {msg.flagCategories.map((cat, idx) => (
                                  <span key={idx} className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                                    {cat}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent AI Sessions */}
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        Recent Sessions
                      </h4>
                      {data.aiPartner.sessions.slice(0, 10).map(session => (
                        <div key={session.id} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                              {session.subject || 'General Study'}
                            </span>
                            <div className="flex items-center gap-2">
                              {session.flaggedCount > 0 && (
                                <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full">
                                  {session.flaggedCount} flagged
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                session.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                                session.status === 'PAUSED' ? 'bg-amber-500/20 text-amber-400' :
                                session.status === 'COMPLETED' ? 'bg-blue-500/20 text-blue-400' :
                                session.status === 'BLOCKED' ? 'bg-red-500/20 text-red-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {session.status}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
                            <span>{session.messageCount} msgs</span>
                            {session.quizCount > 0 && <span>{session.quizCount} quizzes</span>}
                            {session.flashcardCount > 0 && <span>{session.flashcardCount} flashcards</span>}
                            {session.durationFormatted && <span>{session.durationFormatted}</span>}
                            {session.rating && (
                              <span className="flex items-center gap-0.5">
                                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                {session.rating}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatRelativeTime(session.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* View Full AI History Button */}
                    <button
                      onClick={() => window.open(`/admin/ai-partner/user/${userId}`, '_blank')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Full AI Partner History
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-slate-400 text-sm">No AI Partner activity</p>
                )}
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
