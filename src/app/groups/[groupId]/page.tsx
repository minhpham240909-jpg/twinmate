'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import GlowBorder from '@/components/ui/GlowBorder'
import { UserCircle, Users, Book, TrendingUp, Calendar } from 'lucide-react'

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
      router.push('/auth/signin')
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading group...</p>
        </div>
      </div>
    )
  }

  if (error || !groupData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-6">{error || 'Group not found'}</p>
          <button
            onClick={() => router.push('/groups')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
        return 'bg-purple-100 text-purple-800'
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header Section */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/groups')}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
          >
            ← Back to Groups
          </button>
        </div>

        {/* Group Info Card */}
        <GlowBorder color="#3b82f6" intensity="medium" animated={false} style={{ borderRadius: 16 }}>
          <div className="bg-white p-8 rounded-2xl">
            {/* Group Header */}
            <div className="flex items-start gap-6 mb-6">
              {/* Group Avatar */}
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                {groupData.avatarUrl ? (
                  <img src={groupData.avatarUrl} alt={groupData.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <Users size={48} />
                )}
              </div>

              {/* Group Info */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{groupData.name}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <span className="flex items-center gap-1">
                    <Users size={16} />
                    {groupData.memberCount}/{groupData.maxMembers} members
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={16} />
                    Created {new Date(groupData.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {!groupData.isMember ? (
                    <button
                      onClick={handleJoinGroup}
                      disabled={actionLoading || groupData.memberCount >= groupData.maxMembers}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                      {actionLoading ? 'Joining...' : groupData.memberCount >= groupData.maxMembers ? 'Group Full' : 'Join Group'}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleMessage}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                      >
                        Message
                      </button>
                      {!groupData.isOwner && (
                        <button
                          onClick={handleLeaveGroup}
                          disabled={actionLoading}
                          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold"
                        >
                          {actionLoading ? 'Leaving...' : 'Leave Group'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Group Description */}
            {groupData.description && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">About</h2>
                <p className="text-gray-700">{groupData.description}</p>
              </div>
            )}

            {/* Group Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Subject */}
              <div>
                <div className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                  <Book size={18} className="text-blue-600" />
                  Subject
                </div>
                <p className="text-gray-900">{groupData.subject}</p>
                {groupData.subjectCustomDescription && (
                  <p className="text-sm text-gray-600 mt-1">{groupData.subjectCustomDescription}</p>
                )}
              </div>

              {/* Skill Level */}
              <div>
                <div className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                  <TrendingUp size={18} className="text-green-600" />
                  Skill Level
                </div>
                <p className="text-gray-900">{groupData.skillLevel}</p>
                {groupData.skillLevelCustomDescription && (
                  <p className="text-sm text-gray-600 mt-1">{groupData.skillLevelCustomDescription}</p>
                )}
              </div>

              {/* Owner */}
              <div>
                <div className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                  <UserCircle size={18} className="text-purple-600" />
                  Group Owner
                </div>
                <div className="flex items-center gap-2">
                  {groupData.owner.avatarUrl ? (
                    <img src={groupData.owner.avatarUrl} alt={groupData.owner.name} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <UserCircle size={20} className="text-gray-600" />
                    </div>
                  )}
                  <span className="text-gray-900">{groupData.owner.name}</span>
                </div>
              </div>
            </div>

            {/* Members Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Members ({groupData.memberCount})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupData.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                    onClick={() => router.push(`/profile/${member.id}`)}
                  >
                    <div className="relative">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.name} className="w-12 h-12 rounded-full" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                          <UserCircle size={24} className="text-gray-600" />
                        </div>
                      )}
                      {member.onlineStatus === 'ONLINE' && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{member.name}</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                        {member.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlowBorder>
      </div>
    </div>
  )
}
