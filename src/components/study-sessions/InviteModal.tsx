'use client'

import { useAuth } from '@/lib/auth/context'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Image from 'next/image'

interface Partner {
  id: string
  userId: string
  name: string
  email: string
  avatarUrl: string | null
}

interface GroupMember {
  id: string
  userId: string
  name: string
  email: string
  avatarUrl: string | null
  groupId: string
  groupName: string
}

interface InviteModalProps {
  sessionId: string
  isOpen: boolean
  onClose: () => void
}

export default function InviteModal({ sessionId, isOpen, onClose }: InviteModalProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'partners' | 'groups'>('partners')
  const [partners, setPartners] = useState<Partner[]>([])
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)

  // Fetch partners and group members
  useEffect(() => {
    if (!isOpen || !user) return

    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch partners (accepted matches) - use /api/partners/active
        const partnersRes = await fetch('/api/partners/active')
        const partnersData = await partnersRes.json()

        if (partnersData.success && partnersData.partners) {
          // Map partners to the format we need
          const formattedPartners = partnersData.partners.map((p: any) => ({
            id: p.id,
            userId: p.id,
            name: p.name,
            email: p.email,
            avatarUrl: p.avatarUrl,
          }))
          setPartners(formattedPartners)
        }

        // Fetch group members
        const groupsRes = await fetch('/api/groups/my-groups')
        const groupsData = await groupsRes.json()

        if (groupsData.success && groupsData.groups) {
          // Flatten all group members from all groups
          const allMembers: GroupMember[] = []
          groupsData.groups.forEach((group: any) => {
            if (group.members && Array.isArray(group.members)) {
              group.members.forEach((member: any) => {
                // Don't include the current user
                if (member.user && member.user.id !== user.id) {
                  allMembers.push({
                    id: member.userId,
                    userId: member.user.id,
                    name: member.user.name,
                    email: member.user.email,
                    avatarUrl: member.user.avatarUrl,
                    groupId: group.id,
                    groupName: group.name,
                  })
                }
              })
            }
          })
          setGroupMembers(allMembers)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load contacts')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isOpen, user])

  const handleInvite = async (userId: string) => {
    setInviting(userId)
    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteUserIds: [userId] }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Invitation sent!')
      } else {
        toast.error(data.error || 'Failed to send invitation')
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      toast.error('Failed to send invitation')
    } finally {
      setInviting(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Invite to Study Session</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('partners')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              activeTab === 'partners'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Partners ({partners.length})
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              activeTab === 'groups'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Group Members ({groupMembers.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* Partners Tab */}
              {activeTab === 'partners' && (
                <div className="space-y-3">
                  {partners.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="text-gray-500 text-sm">No partners yet</p>
                      <p className="text-gray-400 text-xs mt-2">Connect with others to add them as partners</p>
                    </div>
                  ) : (
                    partners.map((partner) => (
                      <div
                        key={partner.id}
                        className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        {partner.avatarUrl ? (
                          <Image
                            src={partner.avatarUrl}
                            alt={partner.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                            {partner.name[0]}
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{partner.name}</h3>
                          <p className="text-sm text-gray-500">{partner.email}</p>
                        </div>
                        <button
                          onClick={() => handleInvite(partner.userId)}
                          disabled={inviting === partner.userId}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium"
                        >
                          {inviting === partner.userId ? 'Inviting...' : 'Invite'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Group Members Tab */}
              {activeTab === 'groups' && (
                <div className="space-y-3">
                  {groupMembers.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="text-gray-500 text-sm">No group members yet</p>
                      <p className="text-gray-400 text-xs mt-2">Join or create a group to see members</p>
                    </div>
                  ) : (
                    groupMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        {member.avatarUrl ? (
                          <Image
                            src={member.avatarUrl}
                            alt={member.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                            {member.name[0]}
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{member.name}</h3>
                          <p className="text-sm text-gray-500">{member.email}</p>
                          <p className="text-xs text-gray-400 mt-1">From: {member.groupName}</p>
                        </div>
                        <button
                          onClick={() => handleInvite(member.userId)}
                          disabled={inviting === member.userId}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium"
                        >
                          {inviting === member.userId ? 'Inviting...' : 'Invite'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
