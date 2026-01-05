'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { UserCircle, Users, Book, TrendingUp, Calendar, MessageCircle } from 'lucide-react'

type GroupMember = {
  id: string
  name: string
  avatarUrl: string | null
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  onlineStatus: 'ONLINE' | 'OFFLINE'
  joinedAt: string
}

type GroupData = {
  id: string
  name: string
  description: string | null
  subject: string
  subjectCustomDescription: string | null
  skillLevel: string
  skillLevelCustomDescription: string | null
  maxMembers: number
  memberCount: number
  avatarUrl: string | null
  owner: {
    id: string
    name: string
    avatarUrl: string | null
  }
  members: GroupMember[]
  isMember: boolean
  isOwner: boolean
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null
  createdAt: string
}

export default function ViewGroupPage() {
  const { user: currentUser, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const t = useTranslations('groups')
  const tCommon = useTranslations('common')

  const [groupData, setGroupData] = useState<GroupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/auth')
      return
    }

    if (currentUser && groupId) {
      fetchGroupData()
    }
  }, [currentUser, authLoading, groupId])

  const fetchGroupData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/groups/${groupId}`)

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load group')
        setLoading(false)
        return
      }

      const data = await response.json()
      setGroupData(data.group)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching group:', err)
      setError('Failed to load group')
      setLoading(false)
    }
  }

  const handleJoinGroup = async () => {
    if (!groupId || !currentUser) return

    setActionLoading(true)
    try {
      const response = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      })

      if (response.ok) {
        await fetchGroupData()
        alert('Successfully joined the group!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to join group')
      }
    } catch (error) {
      console.error('Error joining group:', error)
      alert('Failed to join group')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLeaveGroup = async () => {
    if (!groupId || !currentUser || !groupData) return

    // Prevent owner from leaving
    if (groupData.isOwner) {
      alert('As the owner, you cannot leave the group. Please transfer ownership or delete the group.')
      return
    }

    const confirmed = confirm('Are you sure you want to leave this group?')
    if (!confirmed) return

    setActionLoading(true)
    try {
      const response = await fetch('/api/groups/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      })

      if (response.ok) {
        alert('Successfully left the group')
        router.push('/groups')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to leave group')
      }
    } catch (error) {
      console.error('Error leaving group:', error)
      alert('Failed to leave group')
    } finally {
      setActionLoading(false)
    }
  }

  const handleMessage = () => {
    router.push(`/chat/groups?conversation=${groupId}`)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-slate-400">Loading group...</p>
        </div>
      </div>
    )
  }

  if (error || !groupData) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-white/10 backdrop-blur-xl rounded-2xl shadow-xl p-8 text-center border border-gray-200 dark:border-white/20">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Group Not Found</h1>
          <p className="text-gray-700 dark:text-slate-300 mb-6">{error || 'This group could not be found.'}</p>
          <button
            onClick={() => router.push('/groups')}
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-full hover:from-blue-700 hover:to-blue-700 transition font-semibold shadow-lg hover:shadow-xl"
          >
            Back to Groups
          </button>
        </div>
      </div>
    )
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
      case 'ADMIN':
        return 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
      default:
        return 'bg-slate-500/20 text-slate-300 border border-slate-400/30'
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header Navigation */}
      <header className="sticky top-0 z-50 bg-gray-50 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center">
          <button
            onClick={() => router.push('/groups')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors -ml-2"
          >
            <svg className="w-5 h-5 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {/* Group Avatar in Header */}
          <div className="ml-3 w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
            {groupData.avatarUrl ? (
              <img
                src={groupData.avatarUrl}
                alt={groupData.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                {groupData.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{groupData.name}</h1>
            <p className="text-xs text-gray-600 dark:text-slate-400">{groupData.memberCount} {groupData.memberCount === 1 ? 'member' : 'members'}</p>
          </div>
        </div>
      </header>

      {/* Banner */}
      <div className="relative h-52 bg-gradient-to-r from-blue-600 via-blue-600 to-blue-600">
        {groupData.avatarUrl && (
          <img
            src={groupData.avatarUrl}
            alt={groupData.name}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      {/* Group Header */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="relative -mt-24 mb-4">
          {/* Group Avatar */}
          <div className="inline-block relative">
            <div className="w-40 h-40 rounded-full bg-slate-900 p-1 shadow-xl border-2 border-white/20">
              {groupData.avatarUrl ? (
                <img
                  src={groupData.avatarUrl}
                  alt={groupData.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-500 rounded-full flex items-center justify-center text-white">
                  <Users size={64} />
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Group Info */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{groupData.name}</h1>

          {groupData.description && (
            <p className="text-gray-700 dark:text-slate-200 mb-3 whitespace-pre-wrap leading-relaxed">{groupData.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-slate-400 mb-4">
            <div className="flex items-center gap-1">
              <Users size={16} />
              <span>{groupData.memberCount}/{groupData.maxMembers} members</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span>Created {new Date(groupData.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-6">
          {!groupData.isMember ? (
            <button
              onClick={handleJoinGroup}
              disabled={actionLoading || groupData.memberCount >= groupData.maxMembers}
              className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-full font-semibold hover:from-blue-700 hover:to-blue-700 hover:scale-105 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Joining...' : groupData.memberCount >= groupData.maxMembers ? 'Group Full' : 'Join Group'}
            </button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleMessage}
                className="flex-1 md:flex-none px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-full font-semibold hover:from-blue-700 hover:to-blue-700 hover:scale-105 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <MessageCircle size={18} />
                Message
              </button>
              {!groupData.isOwner && (
                <button
                  onClick={handleLeaveGroup}
                  disabled={actionLoading}
                  className="flex-1 md:flex-none px-8 py-3 border-2 border-white/20 text-white rounded-full font-semibold hover:bg-white/10 hover:scale-105 transition-all shadow-lg disabled:opacity-50"
                >
                  {actionLoading ? 'Leaving...' : 'Leave Group'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-white/10 mb-6">
          <nav className="flex gap-8">
            <button className="pb-3 border-b-2 border-blue-500 font-semibold text-sm text-gray-900 dark:text-white">
              About
            </button>
          </nav>
        </div>

        {/* About Content */}
        <div className="pb-8">
          {/* Group Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Subject */}
            <div>
              <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300 font-semibold mb-2">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-400/30">
                  <Book size={20} className="text-blue-400" />
                </div>
                <span>Subject</span>
              </div>
              <p className="text-gray-900 dark:text-white ml-12">{groupData.subject}</p>
              {groupData.subjectCustomDescription && (
                <p className="text-sm text-gray-600 dark:text-slate-400 ml-12 mt-1">{groupData.subjectCustomDescription}</p>
              )}
            </div>

            {/* Skill Level */}
            <div>
              <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300 font-semibold mb-2">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center border border-green-400/30">
                  <TrendingUp size={20} className="text-green-400" />
                </div>
                <span>Skill Level</span>
              </div>
              <p className="text-gray-900 dark:text-white ml-12">{groupData.skillLevel}</p>
              {groupData.skillLevelCustomDescription && (
                <p className="text-sm text-gray-600 dark:text-slate-400 ml-12 mt-1">{groupData.skillLevelCustomDescription}</p>
              )}
            </div>

            {/* Owner */}
            <div>
              <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300 font-semibold mb-2">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-400/30">
                  <UserCircle size={20} className="text-blue-400" />
                </div>
                <span>Group Owner</span>
              </div>
              <button
                onClick={() => router.push(`/profile/${groupData.owner.id}`)}
                className="flex items-center gap-3 ml-12 hover:bg-gray-100 dark:hover:bg-white/10 p-2 -ml-2 rounded-lg transition-colors"
              >
                {groupData.owner.avatarUrl ? (
                  <img src={groupData.owner.avatarUrl} alt={groupData.owner.name} className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                    <UserCircle size={24} className="text-gray-600 dark:text-slate-400" />
                  </div>
                )}
                <span className="text-gray-900 dark:text-white font-medium">{groupData.owner.name}</span>
              </button>
            </div>
          </div>

          {/* Members Section */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Members <span className="text-gray-600 dark:text-slate-400 font-normal">({groupData.memberCount})</span>
            </h2>
            <div className="space-y-2">
              {groupData.members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => {
                    // Navigate to own profile or other user's profile
                    if (currentUser && member.id === currentUser.id) {
                      router.push('/profile')
                    } else {
                      router.push(`/profile/${member.id}`)
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors text-left bg-white dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-white/10 shadow-lg dark:shadow-none"
                >
                  <div className="relative">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.name} className="w-12 h-12 rounded-full" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                        <UserCircle size={24} className="text-gray-600 dark:text-slate-400" />
                      </div>
                    )}
                    {member.onlineStatus === 'ONLINE' && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{member.name}</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                        {member.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-slate-400">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
