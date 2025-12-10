'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Brain,
  Users,
  Clock,
  TrendingUp,
  Database,
  Flame,
  BookOpen,
  Target,
  MessageSquare,
  Award,
  AlertCircle,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

interface MemoryStats {
  totalMemoryUsers: number
  totalMemoryEntries: number
  activeMemoryEntries: number
  totalStudyMinutes: number
  avgSessionsPerUser: number
  categoryCounts: Record<string, number>
}

interface TopUser {
  userId: string
  totalSessions: number
  totalStudyMinutes: number
  streakDays: number
  longestStreak: number
  currentSubjects: string[]
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  } | null
}

interface RecentMemory {
  id: string
  userId: string
  category: string
  content: string
  importance: number
  createdAt: string
}

const categoryIcons: Record<string, any> = {
  PREFERENCE: Target,
  ACADEMIC: BookOpen,
  PERSONAL_FACT: Users,
  STUDY_HABIT: Clock,
  ACHIEVEMENT: Award,
  STRUGGLE: AlertCircle,
  GOAL: TrendingUp,
  FEEDBACK: MessageSquare,
  CONVERSATION_TOPIC: Brain,
}

const categoryColors: Record<string, string> = {
  PREFERENCE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ACADEMIC: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  PERSONAL_FACT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  STUDY_HABIT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  ACHIEVEMENT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  STRUGGLE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  GOAL: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  FEEDBACK: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  CONVERSATION_TOPIC: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours < 24) return `${hours}h ${mins}m`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return `${days}d ${remainingHours}h`
}

export default function AdminAIMemoryPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [topUsers, setTopUsers] = useState<TopUser[]>([])
  const [recentMemories, setRecentMemories] = useState<RecentMemory[]>([])
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/ai-memory')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setTopUsers(data.topUsers || [])
        setRecentMemories(data.recentMemories || [])
      }
    } catch (error) {
      console.error('Failed to fetch AI memory stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredUsers = topUsers.filter(u =>
    !searchQuery ||
    u.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Brain className="w-7 h-7 text-purple-500" />
                AI Memory System
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Monitor and manage AI partner memory across users
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Users with Memory</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.totalMemoryUsers || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Memory Entries</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.activeMemoryEntries || 0}
                  <span className="text-sm text-gray-500 ml-1">
                    / {stats?.totalMemoryEntries || 0}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Study Time</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatDuration(stats?.totalStudyMinutes || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Sessions/User</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.avgSessionsPerUser || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        {stats?.categoryCounts && Object.keys(stats.categoryCounts).length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Memory Categories
            </h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.categoryCounts).map(([category, count]) => {
                const Icon = categoryIcons[category] || Brain
                return (
                  <div
                    key={category}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${categoryColors[category] || 'bg-gray-100 text-gray-800'}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{category.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-bold">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Users */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Top Users by Sessions
              </h2>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="space-y-3">
              {filteredUsers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No users with AI memory yet</p>
              ) : (
                filteredUsers.map((userStat) => (
                  <div
                    key={userStat.userId}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedUser(
                        expandedUser === userStat.userId ? null : userStat.userId
                      )}
                      className="w-full p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                    >
                      <div className="flex items-center gap-3">
                        {userStat.user?.avatarUrl ? (
                          <img
                            src={userStat.user.avatarUrl}
                            alt={userStat.user.name}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <span className="text-purple-600 dark:text-purple-400 font-medium">
                              {userStat.user?.name?.[0] || '?'}
                            </span>
                          </div>
                        )}
                        <div className="text-left">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {userStat.user?.name || 'Unknown User'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {userStat.totalSessions} sessions
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {userStat.streakDays > 0 && (
                          <div className="flex items-center gap-1 text-orange-500">
                            <Flame className="w-4 h-4" />
                            <span className="text-sm font-medium">{userStat.streakDays}</span>
                          </div>
                        )}
                        {expandedUser === userStat.userId ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>
                    {expandedUser === userStat.userId && (
                      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">Study Time:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              {formatDuration(userStat.totalStudyMinutes)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Longest Streak:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              {userStat.longestStreak} days
                            </span>
                          </div>
                          {userStat.currentSubjects.length > 0 && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Subjects:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {userStat.currentSubjects.map((subject, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs"
                                  >
                                    {subject}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/admin/users/${userStat.userId}`}
                          className="mt-3 block text-center text-sm text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          View Full User Profile
                        </Link>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Memories */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Memory Extractions
            </h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {recentMemories.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No memories extracted yet</p>
              ) : (
                recentMemories.map((memory) => {
                  const Icon = categoryIcons[memory.category] || Brain
                  return (
                    <div
                      key={memory.id}
                      className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${categoryColors[memory.category] || 'bg-gray-100'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-500">
                              {memory.category.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-gray-400">
                              Importance: {memory.importance}/10
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                            {memory.content}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(memory.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
