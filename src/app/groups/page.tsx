'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { uploadGroupAvatar } from '@/lib/supabase/storage'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'
import ElectricBorder from '@/components/landing/ElectricBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'

interface Group {
  id: string
  name: string
  description?: string
  subject: string
  subjectCustomDescription?: string
  skillLevel?: string
  skillLevelCustomDescription?: string
  memberCount: number
  maxMembers: number
  ownerId: string
  ownerName: string
  isMember: boolean
  isOwner: boolean
  avatarUrl?: string
  membersList?: { id: string; name: string; avatarUrl?: string; role?: string }[]
}

interface GroupInvite {
  id: string
  groupId: string
  groupName: string
  inviterName: string
  createdAt: string
}

export default function GroupsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const t = useTranslations('groups')
  const tCommon = useTranslations('common')
  const [activeTab, setActiveTab] = useState<'my-groups' | 'find-groups'>('my-groups')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  // Load cached groups immediately from localStorage
  const [myGroups, setMyGroups] = useState<Group[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('myGroups')
      if (cached) {
        try {
          return JSON.parse(cached)
        } catch (e) {
          return []
        }
      }
    }
    return []
  })
  const [searchResults, setSearchResults] = useState<Group[]>([])

  // Create group form state
  const [groupName, setGroupName] = useState('')
  const [subject, setSubject] = useState('')
  const [subjectCustomDescription, setSubjectCustomDescription] = useState('')
  const [description, setDescription] = useState('')
  const [skillLevel, setSkillLevel] = useState('')
  const [skillLevelCustomDescription, setSkillLevelCustomDescription] = useState('')
  const [maxMembers, setMaxMembers] = useState(10)
  const [inviteUsername, setInviteUsername] = useState('')
  const [invitedUsers, setInvitedUsers] = useState<string[]>([])
  const [usernameSuggestions, setUsernameSuggestions] = useState<{ id: string; name: string; email: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Find groups filters
  const [searchSubject, setSearchSubject] = useState('')
  const [searchSubjectDesc, setSearchSubjectDesc] = useState('')
  const [searchSkillLevel, setSearchSkillLevel] = useState('')
  const [searchSkillLevelDesc, setSearchSkillLevelDesc] = useState('')
  const [searchDescription, setSearchDescription] = useState('')

  // Manage group state
  const [manageInviteUsername, setManageInviteUsername] = useState('')
  const [manageUserSuggestions, setManageUserSuggestions] = useState<{ id: string; name: string; email: string }[]>([])
  const [showManageSuggestions, setShowManageSuggestions] = useState(false)

  // Group invites
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([])
  const [showInvitesModal, setShowInvitesModal] = useState(false)

  // Delete group state
  const [deletingGroup, setDeletingGroup] = useState(false)
  const [forceDeleting, setForceDeleting] = useState(false)

  // Avatar upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    } else if (user) {
      // Fetch user's groups when user is loaded
      fetchMyGroups()
      fetchGroupInvites()
    }
  }, [user, loading, router])

  // Fetch pending group invites
  const fetchGroupInvites = async () => {
    try {
      const response = await fetch('/api/groups/invites')
      if (response.ok) {
        const data = await response.json()
        setGroupInvites(data.invites || [])
      }
    } catch (error) {
      console.error('Error fetching group invites:', error)
    }
  }

  // Auto-load groups when switching to Find Groups tab
  useEffect(() => {
    if (activeTab === 'find-groups' && user) {
      handleFindGroups()
    }
  }, [activeTab])

  // Fetch user's groups
  const fetchMyGroups = async () => {
    try {
      const response = await fetch('/api/groups/my-groups')
      if (response.ok) {
        const data = await response.json()
        const groups = data.groups || []
        setMyGroups(groups)
        // Cache the groups for instant display on next visit
        localStorage.setItem('myGroups', JSON.stringify(groups))
      }
    } catch (error) {
      console.error('Error fetching my groups:', error)
    }
  }

  // Search for users as they type (for create group)
  const handleUsernameSearch = async (value: string) => {
    setInviteUsername(value)

    if (value.trim().length < 2) {
      setUsernameSuggestions([])
      setShowSuggestions(false)
      return
    }

    try {
      const response = await fetch('/api/users/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: value }),
      })

      if (response.ok) {
        const data = await response.json()
        setUsernameSuggestions(data.users || [])
        setShowSuggestions(true)
      }
    } catch (error) {
      console.error('Error searching users:', error)
    }
  }

  // Search for users (for manage group)
  const handleManageUsernameSearch = async (value: string) => {
    setManageInviteUsername(value)

    if (value.trim().length < 2) {
      setManageUserSuggestions([])
      setShowManageSuggestions(false)
      return
    }

    try {
      const response = await fetch('/api/users/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: value }),
      })

      if (response.ok) {
        const data = await response.json()
        setManageUserSuggestions(data.users || [])
        setShowManageSuggestions(true)
      }
    } catch (error) {
      console.error('Error searching users:', error)
    }
  }

  const handleInviteUser = (username: string) => {
    if (!invitedUsers.includes(username)) {
      setInvitedUsers([...invitedUsers, username])
    }
    setInviteUsername('')
    setShowSuggestions(false)
    setUsernameSuggestions([])
  }

  const removeInvitedUser = (username: string) => {
    setInvitedUsers(invitedUsers.filter(u => u !== username))
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreateGroup = async () => {
    // Validate max members range
    if (maxMembers < 2 || maxMembers > 50) {
      toast.error(t('maxMembersRange'))
      return
    }

    try {
      // First create the group
      const response = await fetch('/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          subject,
          subjectCustomDescription,
          description,
          skillLevel,
          skillLevelCustomDescription,
          maxMembers,
          invitedUsernames: invitedUsers,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || t('failedToCreateGroup'))
        return
      }

      const data = await response.json()
      const groupId = data.group.id

      // Upload avatar if provided
      if (avatarFile && groupId) {
        setUploadingAvatar(true)
        const uploadResult = await uploadGroupAvatar(avatarFile, groupId)

        if (uploadResult.success && uploadResult.url) {
          // Update group with avatar URL
          await fetch(`/api/groups/${groupId}/avatar`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarUrl: uploadResult.url }),
          })
        } else {
          toast.error(uploadResult.error || t('failedToUploadAvatar'))
        }
        setUploadingAvatar(false)
      }

      toast.success(t('groupCreatedSuccessfully'))
      setShowCreateModal(false)
      // Reset form
      setGroupName('')
      setSubject('')
      setSubjectCustomDescription('')
      setDescription('')
      setSkillLevel('')
      setSkillLevelCustomDescription('')
      setMaxMembers(10)
      setInvitedUsers([])
      setAvatarFile(null)
      setAvatarPreview(null)
      // Refresh groups list
      await fetchMyGroups()
    } catch (error) {
      console.error('Error creating group:', error)
      toast.error(t('failedToCreateGroup'))
    }
  }

  const handleFindGroups = async () => {
    try {
      const response = await fetch('/api/groups/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: searchSubject,
          subjectCustomDescription: searchSubjectDesc,
          skillLevel: searchSkillLevel,
          skillLevelCustomDescription: searchSkillLevelDesc,
          description: searchDescription,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.groups || [])
      }
    } catch (error) {
      console.error('Error searching groups:', error)
    }
  }

  const handleJoinGroup = async (groupId: string) => {
    try {
      const response = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      })

      if (response.ok) {
        toast.success(t('successfullyJoinedGroup'))
        await fetchMyGroups() // Refresh my groups (also updates cache)
        if (activeTab === 'find-groups') {
          // Refresh search results and update isMember flag
          const updatedResults = searchResults.map(g =>
            g.id === groupId ? { ...g, isMember: true } : g
          )
          setSearchResults(updatedResults)
        }
      } else {
        const data = await response.json()
        toast.error(data.error || t('failedToJoinGroup'))
      }
    } catch (error) {
      console.error('Error joining group:', error)
      toast.error(t('failedToJoinGroup'))
    }
  }

  const handleLeaveGroup = async (groupId: string) => {
    if (!confirm(t('confirmLeaveGroup'))) return

    try {
      const response = await fetch('/api/groups/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      })

      if (response.ok) {
        toast.success(t('successfullyLeftGroup'))
        await fetchMyGroups() // Refresh my groups (also updates cache)
        if (activeTab === 'find-groups') {
          // Update search results to reflect left status
          const updatedResults = searchResults.map(g =>
            g.id === groupId ? { ...g, isMember: false } : g
          )
          setSearchResults(updatedResults)
        }
      } else {
        const data = await response.json()
        toast.error(data.error || t('failedToLeaveGroup'))
      }
    } catch (error) {
      console.error('Error leaving group:', error)
      toast.error(t('failedToLeaveGroup'))
    }
  }

  const handleKickMember = async (userId: string) => {
    if (!selectedGroup || !confirm(t('confirmRemoveMember'))) return

    try {
      const response = await fetch('/api/groups/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          userId,
        }),
      })

      if (response.ok) {
        toast.success(t('memberRemovedSuccessfully'))
        // Fetch fresh group data
        const groupsResponse = await fetch('/api/groups/my-groups')
        if (groupsResponse.ok) {
          const data = await groupsResponse.json()
          const updatedGroups = data.groups || []
          setMyGroups(updatedGroups)
          // Update selectedGroup with fresh data
          const updatedGroup = updatedGroups.find((g: Group) => g.id === selectedGroup.id)
          if (updatedGroup) {
            setSelectedGroup(updatedGroup)
          }
        }
      } else {
        const data = await response.json()
        toast.error(data.error || t('failedToRemoveMember'))
      }
    } catch (error) {
      console.error('Error kicking member:', error)
      toast.error(t('failedToRemoveMember'))
    }
  }

  const handleInviteFromManage = async (username: string) => {
    if (!selectedGroup) return

    try {
      const response = await fetch('/api/groups/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          username: username,
        }),
      })

      if (response.ok) {
        toast.success(`Invited ${username} to the group!`)
        setManageInviteUsername('')
        setShowManageSuggestions(false)
      } else {
        const data = await response.json()
        toast.error(data.error || t('failedToInviteUser'))
      }
    } catch (error) {
      console.error('Error inviting user:', error)
      toast.error(t('failedToInviteUser'))
    }
  }

  const handleRespondToInvite = async (inviteId: string, accept: boolean) => {
    try {
      const response = await fetch('/api/groups/invites/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteId,
          action: accept ? 'accept' : 'decline',
        }),
      })

      if (response.ok) {
        toast.success(accept ? t('joinedGroupSuccessfully') : t('inviteDeclined'))
        // Refresh invites and groups (also updates cache)
        await fetchGroupInvites()
        await fetchMyGroups()
      } else {
        const data = await response.json()
        toast.error(data.error || t('failedToRespondToInvite'))
      }
    } catch (error) {
      console.error('Error responding to invite:', error)
      toast.error(t('failedToRespondToInvite'))
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm(t('confirmDeleteGroup'))) {
      return
    }

    try {
      setDeletingGroup(true)

      console.log(`[FRONTEND] Attempting to delete group: ${groupId}`)

      const response = await fetch('/api/groups/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      })

      console.log(`[FRONTEND] Delete API response status: ${response.status}`)

      // Handle 401 Unauthorized
      if (response.status === 401) {
        toast.error(t('sessionExpired'))
        console.error('[FRONTEND] Authentication failed (401) - redirecting to signin')
        setTimeout(() => router.push('/auth/signin'), 2000)
        return
      }

      const data = await response.json()

      if (response.ok && data.success) {
        console.log(`[FRONTEND] Group ${data.groupId} deleted successfully from database`)
        toast.success(`Group permanently deleted. ${data.notifiedMembers} member(s) notified.`)
        setShowManageModal(false)
        setSelectedGroup(null)

        // Refresh groups list to ensure it's gone
        await fetchMyGroups()

        // Remove from search results immediately
        setSearchResults(prev => prev.filter(g => g.id !== groupId))

        // If user has performed a search, refresh the search to verify deletion
        if (searchResults.length > 0) {
          console.log(`[FRONTEND] Refreshing search results to verify deletion`)
          // Wait a moment for database to propagate, then refresh search
          setTimeout(() => {
            if (searchSubject || searchSubjectDesc || searchSkillLevel || searchSkillLevelDesc || searchDescription) {
              handleFindGroups()
            }
          }, 500)
        }
      } else {
        toast.error(data.error || t('failedToDeleteGroupRetry'))
        console.error(`[FRONTEND] Failed to delete group: ${data.error}`)
      }
    } catch (error) {
      console.error('[FRONTEND] Error deleting group:', error)
      toast.error(t('failedToDeleteGroupRetry'))
    } finally {
      setDeletingGroup(false)
    }
  }

  const handleShowDetails = (group: Group) => {
    setSelectedGroup(group)
    setShowDetailsModal(true)
  }

  const handleShowManage = (group: Group) => {
    setSelectedGroup(group)
    setShowManageModal(true)
  }

  const handleForceDeleteAll = async () => {
    if (!confirm(t('confirmForceDeleteGroups'))) {
      return
    }

    try {
      setForceDeleting(true)
      console.log('[FORCE DELETE] Initiating force delete all...')

      const response = await fetch('/api/groups/force-delete-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      console.log('[FORCE DELETE] Response:', data)

      if (response.ok && data.success) {
        toast.success(`✅ Successfully deleted ${data.deletedCount} groups permanently!`)
        console.log('[FORCE DELETE] Deleted groups:', data.deletedGroups)

        // Clear all local state
        setMyGroups([])
        setSearchResults([])
        localStorage.removeItem('myGroups')

        // Refresh to verify
        await fetchMyGroups()
      } else {
        toast.error(data.error || t('failedToForceDeleteGroups'))
        console.error('[FORCE DELETE] Failed:', data)
      }
    } catch (error) {
      console.error('[FORCE DELETE] Error:', error)
      toast.error(t('failedToForceDeleteGroups'))
    } finally {
      setForceDeleting(false)
    }
  }

  // Only show loading screen if we don't have cached groups to display
  if (loading && myGroups.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (!user && !loading) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{t('title')}</h1>
          </div>
          <div className="flex gap-2">
            {groupInvites.length > 0 && (
              <Bounce>
                <Pulse>
                  <button
                    onClick={() => setShowInvitesModal(true)}
                    className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 hover:scale-105 transition-all relative shadow-lg"
                  >
                    Invites
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {groupInvites.length}
                    </span>
                  </button>
                </Pulse>
              </Bounce>
            )}
            <Bounce>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 hover:scale-105 transition-all shadow-lg font-medium"
              >
                {t('createGroup')}
              </button>
            </Bounce>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              {tCommon('backToDashboard')}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Tabs */}
          <FadeIn delay={0.1}>
            <ElectricBorder color="#3b82f6" speed={1} chaos={0.2} thickness={2} style={{ borderRadius: 12 }}>
              <div className="bg-white rounded-xl shadow-sm mb-6">
                <div className="border-b border-gray-200">
                  <nav className="flex items-center justify-between">
                    <div className="flex">
                      <button
                        onClick={() => setActiveTab('my-groups')}
                        className={`px-6 py-4 text-sm font-medium transition-all hover:scale-105 ${
                          activeTab === 'my-groups'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {t('myGroups')} {myGroups.length > 0 && (
                          <Pulse>
                            <span className="ml-1 text-blue-600">({myGroups.length})</span>
                          </Pulse>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTab('find-groups')}
                        className={`px-6 py-4 text-sm font-medium transition-all hover:scale-105 ${
                          activeTab === 'find-groups'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {t('findGroups')}
                      </button>
                    </div>
                {activeTab === 'my-groups' && myGroups.length > 0 && (
                  <button
                    onClick={handleForceDeleteAll}
                    disabled={forceDeleting}
                    className="mr-4 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {forceDeleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Force Delete All My Groups
                      </>
                    )}
                  </button>
                )}
              </nav>
            </div>
              </div>
            </ElectricBorder>
          </FadeIn>

          {/* My Groups Tab */}
          {activeTab === 'my-groups' && (
            <FadeIn delay={0.2}>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {myGroups.length === 0 ? (
                  <Bounce>
                    <div className="col-span-2 bg-white rounded-xl shadow-sm p-12 text-center">
                      <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {t('noGroups')}
                      </h3>
                      <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        {t('noGroupsDesc')}
                      </p>
                      <div className="flex gap-4 justify-center">
                        <Bounce delay={0.1}>
                          <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 hover:scale-105 transition-all shadow-lg"
                          >
                            {t('createGroup')}
                          </button>
                        </Bounce>
                        <Bounce delay={0.2}>
                          <button
                            onClick={() => setActiveTab('find-groups')}
                            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 hover:scale-105 transition-all shadow-lg"
                          >
                            {t('findGroups')}
                          </button>
                        </Bounce>
                      </div>
                    </div>
                  </Bounce>
                ) : (
                  myGroups.map((group, index) => (
                  <FadeIn key={group.id} delay={index * 0.05}>
                    <ElectricBorder color="#8b5cf6" speed={1} chaos={0.3} thickness={2} style={{ borderRadius: 12 }}>
                      <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{group.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {group.memberCount} {t('members')}
                        </span>
                        <Pulse>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                            {group.subject}
                          </span>
                        </Pulse>
                      </div>
                    </div>
                    <Bounce delay={index * 0.1}>
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                        {group.avatarUrl ? (
                          <img src={group.avatarUrl} alt={group.name} className="w-full h-full object-cover" />
                        ) : (
                          <Pulse>
                            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-xl">
                              {group.name[0]}
                            </div>
                          </Pulse>
                        )}
                      </div>
                    </Bounce>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {group.isMember && (
                      <Bounce delay={index * 0.1 + 0.1}>
                        <button
                          onClick={() => router.push(`/chat/groups?conversation=${group.id}`)}
                          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 hover:scale-105 transition-all shadow-md font-medium"
                        >
                          {t('openChat')}
                        </button>
                      </Bounce>
                    )}
                    {group.isMember ? (
                      <Bounce delay={index * 0.1 + 0.2}>
                        <button
                          onClick={() => handleLeaveGroup(group.id)}
                          className="flex-1 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 hover:scale-105 transition-all shadow-md font-medium"
                        >
                          {t('leaveGroup')}
                        </button>
                      </Bounce>
                    ) : (
                      <Bounce delay={index * 0.1 + 0.2}>
                        <button
                          onClick={() => handleJoinGroup(group.id)}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 hover:scale-105 transition-all shadow-md font-medium"
                        >
                          {t('joinGroup')}
                        </button>
                      </Bounce>
                    )}
                    <Bounce delay={index * 0.1 + 0.3}>
                      <button
                        onClick={() => handleShowDetails(group)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 hover:scale-105 transition-all font-medium"
                      >
                        {t('viewDetails')}
                      </button>
                    </Bounce>
                    {group.isOwner && (
                      <Bounce delay={index * 0.1 + 0.4}>
                        <button
                          onClick={() => handleShowManage(group)}
                          className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 hover:scale-105 transition-all shadow-md font-medium"
                        >
                          {t('manage')}
                        </button>
                      </Bounce>
                    )}
                  </div>
                      </div>
                    </ElectricBorder>
                  </FadeIn>
                ))
                )}
              </div>
            </FadeIn>
          )}

          {/* Find Groups Tab */}
          {activeTab === 'find-groups' && (
            <div>
              {/* Search Filters */}
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('searchFilters')}</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('subject')}</label>
                    <input
                      type="text"
                      value={searchSubject}
                      onChange={(e) => setSearchSubject(e.target.value)}
                      placeholder="e.g., Mathematics"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('skillLevel')}</label>
                    <select
                      value={searchSkillLevel}
                      onChange={(e) => setSearchSkillLevel(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">{t('anyLevel')}</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Expert">Expert</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('subjectDescription')}</label>
                    <input
                      type="text"
                      value={searchSubjectDesc}
                      onChange={(e) => setSearchSubjectDesc(e.target.value)}
                      placeholder={t('searchSubjectPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('skillLevelDescription')}</label>
                    <input
                      type="text"
                      value={searchSkillLevelDesc}
                      onChange={(e) => setSearchSkillLevelDesc(e.target.value)}
                      placeholder={t('searchSkillLevelPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('description')}</label>
                    <input
                      type="text"
                      value={searchDescription}
                      onChange={(e) => setSearchDescription(e.target.value)}
                      placeholder={t('searchGroupDescPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  onClick={handleFindGroups}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Search Groups
                </button>
              </div>

              {/* Search Results */}
              <FadeIn delay={0.2}>
                <div className="grid md:grid-cols-2 gap-6">
                  {searchResults.map((group, index) => (
                    <FadeIn key={group.id} delay={index * 0.05}>
                      <ElectricBorder color="#3b82f6" speed={1} chaos={0.3} thickness={2} style={{ borderRadius: 12 }}>
                        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{group.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            {group.memberCount}/{group.maxMembers} {t('members')}
                          </span>
                          <Pulse>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                              {group.subject}
                            </span>
                          </Pulse>
                        </div>
                        {group.description && (
                          <p className="text-sm text-gray-600 mb-2">{group.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {group.isMember ? (
                        <Bounce delay={index * 0.1 + 0.1}>
                          <button
                            onClick={() => handleLeaveGroup(group.id)}
                            className="flex-1 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 hover:scale-105 transition-all shadow-md font-medium"
                          >
                            {t('leaveGroup')}
                          </button>
                        </Bounce>
                      ) : (
                        <Bounce delay={index * 0.1 + 0.1}>
                          <button
                            onClick={() => handleJoinGroup(group.id)}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 hover:scale-105 transition-all shadow-md font-medium"
                          >
                            {t('joinGroup')}
                          </button>
                        </Bounce>
                      )}
                      <Bounce delay={index * 0.1 + 0.2}>
                        <button
                          onClick={() => handleShowDetails(group)}
                          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 hover:scale-105 transition-all font-medium"
                        >
                          {t('viewDetails')}
                        </button>
                      </Bounce>
                    </div>
                        </div>
                      </ElectricBorder>
                    </FadeIn>
                  ))}
                </div>
              </FadeIn>
            </div>
          )}
        </div>
      </main>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Create Study Group</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Group Name</label>
                <input
                  id="group-name-field"
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      document.getElementById('avatar-field')?.focus()
                    }
                  }}
                  placeholder="e.g., Calculus Study Group"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Group Avatar (Optional)</label>
                <div className="flex items-center gap-4">
                  {avatarPreview && (
                    <img src={avatarPreview} alt={t('avatarPreview')} className="w-16 h-16 rounded-xl object-cover" />
                  )}
                  <input
                    id="avatar-field"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAvatarChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        document.getElementById('subject-field')?.focus()
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Max 5MB. JPEG, PNG, WebP, or GIF.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <input
                  id="subject-field"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      document.getElementById('subject-desc-field')?.focus()
                    }
                  }}
                  placeholder="e.g., Mathematics, Physics, Computer Science"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Description (Optional)</label>
                <textarea
                  id="subject-desc-field"
                  rows={2}
                  value={subjectCustomDescription}
                  onChange={(e) => setSubjectCustomDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      document.getElementById('group-desc-field')?.focus()
                    }
                  }}
                  placeholder={t('subjectDetailsPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Group Description</label>
                <textarea
                  id="group-desc-field"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      document.getElementById('skill-level-field')?.focus()
                    }
                  }}
                  placeholder={t('groupDescriptionPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Skill Level Suggestion</label>
                <select
                  id="skill-level-field"
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('noPreference')}</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Skill Level Description (Optional)</label>
                <textarea
                  id="skill-level-desc-field"
                  rows={2}
                  value={skillLevelCustomDescription}
                  onChange={(e) => setSkillLevelCustomDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      document.getElementById('max-members-field')?.focus()
                    }
                  }}
                  placeholder="e.g., High school level, College freshman, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Members</label>
                <input
                  id="max-members-field"
                  type="number"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(parseInt(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      document.getElementById('invite-members-field')?.focus()
                    }
                  }}
                  min={2}
                  max={50}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Invite Members (Optional) - Press Enter to Create</label>
                <div className="relative">
                  <input
                    id="invite-members-field"
                    type="text"
                    value={inviteUsername}
                    onChange={(e) => handleUsernameSearch(e.target.value)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onFocus={() => inviteUsername.length >= 2 && setShowSuggestions(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (groupName.trim()) {
                          handleCreateGroup()
                        }
                      }
                    }}
                    placeholder={t('inviteUsernamePlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {showSuggestions && usernameSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {usernameSuggestions.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleInviteUser(user.name)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                        >
                          <span className="font-medium">{user.name}</span>
                          <span className="text-sm text-gray-500">{user.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {invitedUsers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {invitedUsers.map((username) => (
                      <span
                        key={username}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                      >
                        {username}
                        <button
                          onClick={() => removeInvitedUser(username)}
                          className="hover:text-blue-900"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateGroup}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Create Group
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Details Modal */}
      {showDetailsModal && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Group Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Group Name</h3>
                <p className="text-lg font-semibold text-gray-900">{selectedGroup.name}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Subject</h3>
                <p className="text-gray-900">{selectedGroup.subject}</p>
              </div>

              {selectedGroup.subjectCustomDescription && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Subject Description</h3>
                  <p className="text-gray-700">{selectedGroup.subjectCustomDescription}</p>
                </div>
              )}

              {selectedGroup.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Group Description</h3>
                  <p className="text-gray-700">{selectedGroup.description}</p>
                </div>
              )}

              {selectedGroup.skillLevel && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Skill Level</h3>
                  <p className="text-gray-900">{selectedGroup.skillLevel}</p>
                </div>
              )}

              {selectedGroup.skillLevelCustomDescription && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Skill Level Description</h3>
                  <p className="text-gray-700">{selectedGroup.skillLevelCustomDescription}</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Created By</h3>
                <p className="text-gray-900">{selectedGroup.ownerName}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Members ({selectedGroup.memberCount})</h3>
                <div className="space-y-2">
                  {selectedGroup.membersList?.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <PartnerAvatar
                        avatarUrl={member.avatarUrl || null}
                        name={member.name}
                        size="sm"
                        showStatus={false}
                      />
                      <span className="text-gray-900">{member.name}</span>
                      {member.role === 'OWNER' && (
                        <span className="ml-auto px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Owner</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Group Modal */}
      {showManageModal && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Manage Group</h2>
              <button
                onClick={() => setShowManageModal(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Invite Section */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Invite Members</h3>
              <div className="relative">
                <input
                  type="text"
                  value={manageInviteUsername}
                  onChange={(e) => handleManageUsernameSearch(e.target.value)}
                  onBlur={() => setTimeout(() => setShowManageSuggestions(false), 200)}
                  onFocus={() => manageInviteUsername.length >= 2 && setShowManageSuggestions(true)}
                  placeholder={t('inviteUserPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {showManageSuggestions && manageUserSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {manageUserSuggestions.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleInviteFromManage(user.name)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                      >
                        <span className="font-medium">{user.name}</span>
                        <span className="text-sm text-gray-500">{user.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Members List */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Current Members ({selectedGroup.memberCount})</h3>
              <div className="space-y-2">
                {selectedGroup.membersList?.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <PartnerAvatar
                        avatarUrl={member.avatarUrl || null}
                        name={member.name}
                        size="sm"
                        showStatus={false}
                      />
                      <div>
                        <span className="text-gray-900 font-medium">{member.name}</span>
                        {member.role === 'OWNER' && (
                          <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Owner</span>
                        )}
                      </div>
                    </div>
                    {member.role !== 'OWNER' && (
                      <button
                        onClick={() => handleKickMember(member.id)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition"
                      >
                        Kick
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {/* Delete Group Button - Only for Owner */}
              <button
                onClick={() => handleDeleteGroup(selectedGroup.id)}
                disabled={deletingGroup}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingGroup ? 'Deleting Group...' : 'Delete Group'}
              </button>
              <button
                onClick={() => setShowManageModal(false)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Invites Modal */}
      {showInvitesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Group Invitations</h2>
              <button
                onClick={() => setShowInvitesModal(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {groupInvites.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No pending invitations</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupInvites.map((invite) => (
                  <div key={invite.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{invite.groupName}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Invited by <span className="font-medium">{invite.inviterName}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(invite.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespondToInvite(invite.id, true)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRespondToInvite(invite.id, false)}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => setShowInvitesModal(false)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
