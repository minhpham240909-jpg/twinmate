'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'
import { useAuth } from '@/lib/auth/context'

interface Member {
  id: string
  name: string
  avatarUrl: string | null
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  onlineStatus?: string
}

interface GroupMembersModalProps {
  isOpen: boolean
  onClose: () => void
  groupId: string
  groupName: string
}

export default function GroupMembersModal({ isOpen, onClose, groupId, groupName }: GroupMembersModalProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { user } = useAuth()
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')

  useEffect(() => {
    if (isOpen && groupId) {
      fetchMembers()
    }
  }, [isOpen, groupId])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/groups/${groupId}/members`)
      const data = await res.json()

      if (data.success) {
        setMembers(data.members || [])
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewProfile = (userId: string) => {
    onClose()
    // Use setTimeout to ensure modal closes before navigation
    setTimeout(() => {
      // If viewing own profile, go to /profile, otherwise go to /profile/[userId]
      if (user && userId === user.id) {
        router.push('/profile')
      } else {
        router.push(`/profile/${userId}`)
      }
    }, 100)
  }

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
      case 'ADMIN':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
      default:
        return 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-6">
        {/* Backdrop - lighter and more subtle */}
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal - Professional Design */}
        <div className="relative bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-2xl transform transition-all w-full max-w-md border border-slate-700/50">
          {/* Header - Modern gradient */}
          <div className="bg-gradient-to-r from-slate-700/80 to-slate-600/80 backdrop-blur-sm px-6 py-5 rounded-t-2xl border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="text-lg font-bold text-white">Group Members</h3>
                </div>
                <p className="text-sm text-slate-300">{groupName}</p>
                {!loading && (
                  <p className="text-xs text-slate-400 mt-1">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Members List */}
          <div className="px-4 py-4 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-slate-300 font-medium">{tCommon('loading')}</p>
              </div>
            ) : members.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-slate-700/40 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-300 font-medium">{t('noMembers')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member, index) => (
                  <button
                    key={member.id}
                    onClick={() => handleViewProfile(member.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-700/40 hover:backdrop-blur-sm rounded-xl transition-all text-left group border border-slate-700/30 hover:border-slate-600 hover:shadow-lg"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="relative">
                      <PartnerAvatar
                        avatarUrl={member.avatarUrl}
                        name={member.name}
                        size="md"
                        onlineStatus={member.onlineStatus as 'ONLINE' | 'OFFLINE'}
                        showStatus={true}
                      />
                      {member.onlineStatus === 'ONLINE' && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                          {member.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getRoleBadgeStyle(member.role)}`}>
                          {member.role === 'OWNER' ? t('owner') : member.role === 'ADMIN' ? t('admin') : 'Member'}
                        </span>
                        {member.onlineStatus && (
                          <span className={`text-xs font-medium ${member.onlineStatus === 'ONLINE' ? 'text-green-400' : 'text-slate-500'}`}>
                            {member.onlineStatus === 'ONLINE' ? '● Online' : '○ Offline'}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-slate-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer - subtle info */}
          <div className="px-6 py-3 bg-slate-900/30 backdrop-blur-sm rounded-b-2xl border-t border-slate-700/50">
            <p className="text-xs text-slate-400 text-center">
              Click on a member to view their profile
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
