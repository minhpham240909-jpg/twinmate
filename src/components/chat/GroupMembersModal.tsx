'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'

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
    router.push(`/profile/${userId}`)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{t('groupMembers')}</h3>
                <p className="text-sm text-purple-100 mt-1">{groupName}</p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-purple-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Members List */}
          <div className="px-6 py-4 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center">
                <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">{tCommon('loading')}</p>
              </div>
            ) : members.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">{t('noMembers')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleViewProfile(member.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition text-left group"
                  >
                    <PartnerAvatar
                      avatarUrl={member.avatarUrl}
                      name={member.name}
                      size="md"
                      onlineStatus={member.onlineStatus as 'ONLINE' | 'OFFLINE'}
                      showStatus={true}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{member.name}</p>
                        {member.role === 'OWNER' && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                            {t('owner')}
                          </span>
                        )}
                        {member.role === 'ADMIN' && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                            {t('admin')}
                          </span>
                        )}
                      </div>
                      {member.onlineStatus && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {member.onlineStatus === 'ONLINE' ? t('online') : t('offline')}
                        </p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

