'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

type UserPost = {
  id: string
  content: string
  createdAt: string
  imageUrls?: string[]
  likes?: { userId: string; user: { id: string; name: string; avatarUrl: string | null } }[]
  comments?: { id: string; content: string; createdAt: string; user: { id: string; name: string; avatarUrl: string | null } }[]
  _count?: {
    likes: number
    comments: number
    reposts: number
  }
}

type DeletedPost = {
  id: string
  content: string
  deletedAt: string
  daysRemaining: number
  _count?: {
    likes: number
    comments: number
    reposts: number
  }
}

export default function ProfilePage() {
  const { user, profile, loading, refreshUser } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    avatarUrl: '',
    subjects: [] as string[],
    interests: [] as string[],
    goals: [] as string[],
    skillLevel: 'BEGINNER',
    skillLevelDescription: '',
    studyStyle: 'COLLABORATIVE',
    studyStyleDescription: '',
    availableDays: [] as string[],
    availableHours: '',
    availabilityDescription: '',
    // NEW: Add more about yourself
    aboutYourselfItems: [] as string[],
    aboutYourself: '',
    // NEW: School and Languages
    school: '',
    languages: '',
    // NEW: Post Privacy
    postPrivacy: 'PUBLIC' as 'PUBLIC' | 'PARTNERS_ONLY',
  })

  // State for user's posts
  const [userPosts, setUserPosts] = useState<UserPost[]>([])
  const [showPosts, setShowPosts] = useState(false)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editPostContent, setEditPostContent] = useState('')

  // State for deleted posts (Post History)
  const [deletedPosts, setDeletedPosts] = useState<DeletedPost[]>([])
  const [showDeletedPosts, setShowDeletedPosts] = useState(false)

  const [customInputs, setCustomInputs] = useState({
    subject: '',
    interest: '',
    goal: '',
    aboutYourselfItem: '',
  })

  // State for "Add more about yourself" visibility
  const [showAboutYourself, setShowAboutYourself] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [previewImage, setPreviewImage] = useState<string>('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
    if (profile) {
      setFormData({
        name: profile.name || '',
        bio: profile.bio || '',
        avatarUrl: profile.avatarUrl || '',
        subjects: profile.subjects || [],
        interests: profile.interests || [],
        goals: profile.goals || [],
        skillLevel: profile.skillLevel || 'BEGINNER',
        skillLevelDescription: profile.skillLevelCustomDescription || '',
        studyStyle: profile.studyStyle || 'COLLABORATIVE',
        studyStyleDescription: profile.studyStyleCustomDescription || '',
        availableDays: profile.availableDays || [],
        availableHours: (Array.isArray(profile.availableHours) && profile.availableHours.length > 0) ? profile.availableHours[0] : '',
        availabilityDescription: profile.availabilityCustomDescription || '',
        // NEW: Load aboutYourself fields
        aboutYourselfItems: (profile as { aboutYourselfItems?: string[] }).aboutYourselfItems || [],
        aboutYourself: (profile as { aboutYourself?: string }).aboutYourself || '',
        // NEW: Load school and languages
        school: (profile as { school?: string }).school || '',
        languages: (profile as { languages?: string }).languages || '',
        // NEW: Load post privacy
        postPrivacy: (profile as { postPrivacy?: 'PUBLIC' | 'PARTNERS_ONLY' }).postPrivacy || 'PUBLIC',
      })
      // Show "Add more about yourself" if it has content
      const profileWithAbout = profile as { aboutYourself?: string; aboutYourselfItems?: string[] }
      if (profileWithAbout.aboutYourself || (profileWithAbout.aboutYourselfItems && profileWithAbout.aboutYourselfItems.length > 0)) {
        setShowAboutYourself(true)
      }
      setPreviewImage(profile.avatarUrl || '')
    }
  }, [user, profile, loading, router])

  // Fetch user's posts
  useEffect(() => {
    if (user) {
      fetchUserPosts()
      fetchDeletedPosts()
    }
  }, [user])

  const fetchUserPosts = async () => {
    try {
      const response = await fetch(`/api/posts/user/${user?.id}`)
      if (response.ok) {
        const data = await response.json()
        setUserPosts(data.posts)
      }
    } catch (error) {
      console.error('Error fetching user posts:', error)
    }
  }

  const fetchDeletedPosts = async () => {
    try {
      const response = await fetch('/api/posts/deleted')
      if (response.ok) {
        const data = await response.json()
        setDeletedPosts(data.posts)
      }
    } catch (error) {
      console.error('Error fetching deleted posts:', error)
    }
  }

  const handleEditProfilePost = async (postId: string) => {
    if (!editPostContent.trim()) return

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editPostContent }),
      })

      if (response.ok) {
        const data = await response.json()
        setUserPosts(prev =>
          prev.map(post =>
            post.id === postId ? { ...post, content: data.post.content } : post
          )
        )
        setEditingPostId(null)
        setEditPostContent('')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to edit post')
      }
    } catch (error) {
      console.error('Error editing post:', error)
      alert('Failed to edit post')
    }
  }

  const handleDeleteProfilePost = async (postId: string) => {
    if (!confirm('This post will be deleted for 30 days. You can restore it anytime before permanent deletion.')) {
      return
    }

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const data = await response.json()
        setUserPosts(prev => prev.filter(post => post.id !== postId))
        // Refresh deleted posts to show newly deleted post
        await fetchDeletedPosts()
        alert(data.message || 'Post moved to history. You can restore it within 30 days.')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete post')
      }
    } catch (error) {
      console.error('Error deleting post:', error)
      alert('Failed to delete post')
    }
  }

  const handleRestorePost = async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/restore`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        // Remove from deleted posts and refresh active posts
        setDeletedPosts(prev => prev.filter(post => post.id !== postId))
        await fetchUserPosts()
        alert(data.message || 'Post restored successfully')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to restore post')
      }
    } catch (error) {
      console.error('Error restoring post:', error)
      alert('Failed to restore post')
    }
  }

  const handlePermanentlyDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to permanently delete this post? This action CANNOT be undone!')) {
      return
    }

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setDeletedPosts(prev => prev.filter(post => post.id !== postId))
        alert('Post permanently deleted')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete post')
      }
    } catch (error) {
      console.error('Error permanently deleting post:', error)
      alert('Failed to delete post')
    }
  }

  const startEditProfilePost = (post: UserPost) => {
    setEditingPostId(post.id)
    setEditPostContent(post.content)
  }

  const cancelEditProfilePost = () => {
    setEditingPostId(null)
    setEditPostContent('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const allSubjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'History', 'Literature', 'Languages', 'Business', 'Engineering']
  const allInterests = ['Group Study', 'One-on-One', 'Video Calls', 'Text Chat', 'Problem Solving', 'Project-Based', 'Exam Prep', 'Research']
  const allGoals = ['Pass Exam', 'Learn New Skill', 'Career Change', 'Academic Research', 'Personal Growth', 'Certification']
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  const toggleArrayItem = (array: string[], item: string, setter: (val: string[]) => void) => {
    if (array.includes(item)) {
      setter(array.filter(i => i !== item))
    } else {
      setter([...array, item])
    }
  }

  const addCustomItem = (field: 'subject' | 'interest' | 'goal' | 'aboutYourselfItem') => {
    const value = customInputs[field].trim()
    if (!value) return

    if (field === 'subject' && !formData.subjects.includes(value)) {
      setFormData({ ...formData, subjects: [...formData.subjects, value] })
    } else if (field === 'interest' && !formData.interests.includes(value)) {
      setFormData({ ...formData, interests: [...formData.interests, value] })
    } else if (field === 'goal' && !formData.goals.includes(value)) {
      setFormData({ ...formData, goals: [...formData.goals, value] })
    } else if (field === 'aboutYourselfItem' && !formData.aboutYourselfItems.includes(value)) {
      setFormData({ ...formData, aboutYourselfItems: [...formData.aboutYourselfItems, value] })
    }

    setCustomInputs({ ...customInputs, [field]: '' })
  }

  const removeCustomItem = (field: 'subjects' | 'interests' | 'goals' | 'aboutYourselfItems', item: string) => {
    setFormData({ ...formData, [field]: formData[field].filter(i => i !== item) })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB')
      return
    }

    setIsUploading(true)

    try {
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewImage(reader.result as string)
      }
      reader.readAsDataURL(file)

      // Upload to server
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('userId', user.id)

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formDataUpload,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      setFormData({ ...formData, avatarUrl: data.url })
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const requestData = {
        userId: user.id,
        name: formData.name,
        bio: formData.bio || undefined,
        avatarUrl: formData.avatarUrl || undefined,
        subjects: formData.subjects,
        interests: formData.interests,
        goals: formData.goals,
        skillLevel: formData.skillLevel || undefined,
        skillLevelCustomDescription: formData.skillLevelDescription || undefined,
        studyStyle: formData.studyStyle || undefined,
        studyStyleCustomDescription: formData.studyStyleDescription || undefined,
        availableDays: formData.availableDays,
        availableHours: formData.availableHours || undefined,
        availabilityCustomDescription: formData.availabilityDescription || undefined,
        // NEW: Include aboutYourself fields
        aboutYourselfItems: formData.aboutYourselfItems,
        aboutYourself: formData.aboutYourself || undefined,
        // NEW: Include school and languages
        school: formData.school || undefined,
        languages: formData.languages || undefined,
        // NEW: Include post privacy
        postPrivacy: formData.postPrivacy,
      }

      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[CLIENT] Failed to save profile:', errorData)
        console.error('[CLIENT] Response status:', response.status)
        console.error('[CLIENT] Response statusText:', response.statusText)
        throw new Error(errorData.error || 'Failed to save profile')
      }

      // Refresh user data and redirect to dashboard
      await refreshUser()
      alert('Profile saved successfully!')
      router.push('/dashboard')
    } catch (error) {
      console.error('Save error:', error)
      alert(`Failed to save profile: ${error instanceof Error ? error.message : 'Please try again.'}`)
    } finally {
      setIsSaving(false)
    }
  }

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
            <h1 className="text-2xl font-bold text-blue-600">Edit Profile</h1>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-8">
            {/* Profile Picture Upload */}
            <div className="flex items-center gap-6 mb-8 pb-8 border-b">
              <div className="relative">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-3xl">
                    {formData.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                  </div>
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  {user.email}
                </h2>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-sm text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : 'Upload Profile Picture'}
                </button>
                <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF (max 5MB)</p>
              </div>
            </div>

            {/* Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Bio */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell others about yourself and your learning goals..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Subjects */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subjects I&apos;m Learning
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {allSubjects.map((subject) => (
                  <button
                    key={subject}
                    onClick={() => toggleArrayItem(formData.subjects, subject, (val) => setFormData({ ...formData, subjects: val }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      formData.subjects.includes(subject)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {subject}
                  </button>
                ))}
                {formData.subjects.filter(s => !allSubjects.includes(s)).map((subject) => (
                  <button
                    key={subject}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white flex items-center gap-2"
                  >
                    {subject}
                    <span
                      onClick={() => removeCustomItem('subjects', subject)}
                      className="hover:bg-blue-700 rounded-full p-0.5"
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInputs.subject}
                  onChange={(e) => setCustomInputs({ ...customInputs, subject: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomItem('subject')}
                  placeholder="Add custom subject..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  onClick={() => addCustomItem('subject')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Interests */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Learning Interests
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {allInterests.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleArrayItem(formData.interests, interest, (val) => setFormData({ ...formData, interests: val }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      formData.interests.includes(interest)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
                {formData.interests.filter(i => !allInterests.includes(i)).map((interest) => (
                  <button
                    key={interest}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white flex items-center gap-2"
                  >
                    {interest}
                    <span
                      onClick={() => removeCustomItem('interests', interest)}
                      className="hover:bg-purple-700 rounded-full p-0.5"
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInputs.interest}
                  onChange={(e) => setCustomInputs({ ...customInputs, interest: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomItem('interest')}
                  placeholder="Add custom interest..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
                <button
                  onClick={() => addCustomItem('interest')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Goals */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                My Learning Goals
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {allGoals.map((goal) => (
                  <button
                    key={goal}
                    onClick={() => toggleArrayItem(formData.goals, goal, (val) => setFormData({ ...formData, goals: val }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      formData.goals.includes(goal)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {goal}
                  </button>
                ))}
                {formData.goals.filter(g => !allGoals.includes(g)).map((goal) => (
                  <button
                    key={goal}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white flex items-center gap-2"
                  >
                    {goal}
                    <span
                      onClick={() => removeCustomItem('goals', goal)}
                      className="hover:bg-green-700 rounded-full p-0.5"
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInputs.goal}
                  onChange={(e) => setCustomInputs({ ...customInputs, goal: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomItem('goal')}
                  placeholder="Add custom goal..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
                <button
                  onClick={() => addCustomItem('goal')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* School */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                School / University (Optional)
              </label>
              <textarea
                value={formData.school}
                onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                placeholder="e.g., Harvard University, MIT, Stanford..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">This helps you find partners from the same school</p>
            </div>

            {/* Languages */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Languages Spoken (Optional)
              </label>
              <textarea
                value={formData.languages}
                onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
                placeholder="e.g., English, Spanish, Mandarin, French..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">This helps you find partners who speak the same languages</p>
            </div>

            {/* Skill Level */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Skill Level
              </label>
              <select
                value={formData.skillLevel}
                onChange={(e) => setFormData({ ...formData, skillLevel: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
              >
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
                <option value="EXPERT">Expert</option>
              </select>
              <input
                type="text"
                value={formData.skillLevelDescription}
                onChange={(e) => setFormData({ ...formData, skillLevelDescription: e.target.value })}
                placeholder="Describe your skill level (optional)..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Study Style */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Study Style
              </label>
              <select
                value={formData.studyStyle}
                onChange={(e) => setFormData({ ...formData, studyStyle: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
              >
                <option value="COLLABORATIVE">Collaborative (Group Study)</option>
                <option value="INDEPENDENT">Independent (Self-Study)</option>
                <option value="MIXED">Mixed (Both)</option>
              </select>
              <input
                type="text"
                value={formData.studyStyleDescription}
                onChange={(e) => setFormData({ ...formData, studyStyleDescription: e.target.value })}
                placeholder="Describe your study style (optional)..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Availability */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                When I&apos;m Available
              </label>
              <div className="mb-3">
                <p className="text-xs text-gray-600 mb-2">Select days you&apos;re available:</p>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleArrayItem(formData.availableDays, day, (val) => setFormData({ ...formData, availableDays: val }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        formData.availableDays.includes(day)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={formData.availableHours}
                onChange={(e) => setFormData({ ...formData, availableHours: e.target.value })}
                placeholder="Typical hours (e.g., '6-9 PM' or 'Mornings')"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm mb-2"
              />
              <textarea
                value={formData.availabilityDescription}
                onChange={(e) => setFormData({ ...formData, availabilityDescription: e.target.value })}
                placeholder="Describe your availability in detail (e.g., 'Flexible on weekends, prefer evening sessions during weekdays')..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* NEW: Add More About Yourself Section */}
            <div className="mb-8 border-t pt-8">
              <button
                type="button"
                onClick={() => setShowAboutYourself(!showAboutYourself)}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {showAboutYourself ? 'Hide' : 'Add more about yourself'}
              </button>

              {showAboutYourself && (
                <div className="mt-4 space-y-4">
                  {/* Custom Items */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add Tags
                    </label>
                    <p className="text-xs text-gray-600 mb-2">
                      Add keywords that describe you (e.g., &quot;Startup&quot;, &quot;AI&quot;, &quot;Co-founder&quot;, &quot;React Developer&quot;)
                    </p>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={customInputs.aboutYourselfItem}
                        onChange={(e) => setCustomInputs({ ...customInputs, aboutYourselfItem: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomItem('aboutYourselfItem'))}
                        placeholder="Add a tag..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => addCustomItem('aboutYourselfItem')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition font-medium"
                      >
                        Add
                      </button>
                    </div>
                    {formData.aboutYourselfItems.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.aboutYourselfItems.map((item) => (
                          <span key={item} className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                            {item}
                            <button
                              type="button"
                              onClick={() => removeCustomItem('aboutYourselfItems', item)}
                              className="ml-2 text-blue-600 hover:text-blue-800 font-bold"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tell us more about yourself
                    </label>
                    <p className="text-xs text-gray-600 mb-2">
                      Share anything you&apos;d like others to know - your collaboration preferences, what you&apos;re looking for, your goals, or anything else that helps others understand you better.
                    </p>
                    <textarea
                      value={formData.aboutYourself}
                      onChange={(e) => setFormData({ ...formData, aboutYourself: e.target.value })}
                      placeholder="Example: I'm looking for a co-founder to build an AI-powered EdTech startup. I have 5 years of experience in React and Python, and I'm passionate about making education accessible. Also open to finding study partners for machine learning courses..."
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Post Privacy Settings */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Community Privacy Settings</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Who can see your posts?
                </label>
                <div className="space-y-3">
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="radio"
                      name="postPrivacy"
                      value="PUBLIC"
                      checked={formData.postPrivacy === 'PUBLIC'}
                      onChange={(e) => setFormData({ ...formData, postPrivacy: e.target.value as 'PUBLIC' | 'PARTNERS_ONLY' })}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Public</div>
                      <div className="text-sm text-gray-600">Everyone can see your posts</div>
                    </div>
                  </label>
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="radio"
                      name="postPrivacy"
                      value="PARTNERS_ONLY"
                      checked={formData.postPrivacy === 'PARTNERS_ONLY'}
                      onChange={(e) => setFormData({ ...formData, postPrivacy: e.target.value as 'PUBLIC' | 'PARTNERS_ONLY' })}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Partners Only</div>
                      <div className="text-sm text-gray-600">Only your connected study partners can see your posts</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* My Posts Section */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">My Posts</h3>
                <button
                  onClick={() => setShowPosts(!showPosts)}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  {showPosts ? 'Hide Posts' : 'Show Posts'}
                </button>
              </div>

              {showPosts && (
                <div className="space-y-4">
                  {userPosts.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">You haven&apos;t created any posts yet.</p>
                  ) : (
                    userPosts.map((post) => (
                      <div key={post.id} className="border border-gray-200 rounded-lg p-4">
                        {/* Post Header with Edit/Delete buttons */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="text-xs text-gray-500">
                              {new Date(post.createdAt).toLocaleDateString()} at {new Date(post.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEditProfilePost(post)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Edit post"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteProfilePost(post.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                              title="Delete post"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Post Content - Show edit mode or regular content */}
                        {editingPostId === post.id ? (
                          <div className="mb-3">
                            <textarea
                              value={editPostContent}
                              onChange={(e) => setEditPostContent(e.target.value)}
                              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={4}
                              maxLength={5000}
                            />
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm text-gray-500">
                                {editPostContent.length}/5000
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={cancelEditProfilePost}
                                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleEditProfilePost(post.id)}
                                  disabled={!editPostContent.trim()}
                                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mb-3">
                            <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
                          </div>
                        )}

                        {/* Post Stats */}
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3 pb-3 border-b border-gray-200">
                          <span>❤️ {post.likes?.length || 0} likes</span>
                          <span>💬 {post.comments?.length || 0} comments</span>
                          <span>🔁 {post._count?.reposts || 0} reposts</span>
                        </div>

                        {/* Who Liked */}
                        {post.likes && post.likes.length > 0 && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-2">Liked by:</p>
                            <div className="flex flex-wrap gap-2">
                              {post.likes.map((like) => (
                                <div key={like.userId} className="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1">
                                  {like.user.avatarUrl && (
                                    <img
                                      src={like.user.avatarUrl}
                                      alt={like.user.name}
                                      className="w-5 h-5 rounded-full"
                                    />
                                  )}
                                  <span className="text-sm text-gray-700">{like.user.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Comments */}
                        {post.comments && post.comments.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">Comments:</p>
                            <div className="space-y-2">
                              {post.comments.map((comment) => (
                                <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    {comment.user.avatarUrl && (
                                      <img
                                        src={comment.user.avatarUrl}
                                        alt={comment.user.name}
                                        className="w-6 h-6 rounded-full"
                                      />
                                    )}
                                    <span className="font-medium text-sm text-gray-900">{comment.user.name}</span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(comment.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 ml-8">{comment.content}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Post History Section (Deleted Posts) */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Post History</h3>
                  <p className="text-sm text-gray-600">Posts you deleted (restorable for 30 days)</p>
                </div>
                <button
                  onClick={() => setShowDeletedPosts(!showDeletedPosts)}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  {showDeletedPosts ? 'Hide History' : 'Show History'}
                </button>
              </div>

              {showDeletedPosts && (
                <div className="space-y-4">
                  {deletedPosts.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No deleted posts in history.</p>
                  ) : (
                    deletedPosts.map((post) => (
                      <div key={post.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                        {/* Deleted Post Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                                DELETED
                              </span>
                              <span className="text-xs text-red-600 font-medium">
                                {post.daysRemaining} day{post.daysRemaining !== 1 ? 's' : ''} remaining to restore
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">
                              Deleted on {new Date(post.deletedAt).toLocaleDateString()} at {new Date(post.deletedAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRestorePost(post.id)}
                              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition font-medium"
                              title="Restore post"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => handlePermanentlyDeletePost(post.id)}
                              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition font-medium"
                              title="Permanently delete"
                            >
                              Delete Forever
                            </button>
                          </div>
                        </div>

                        {/* Post Content */}
                        <div className="mb-3 opacity-75">
                          <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
                        </div>

                        {/* Post Stats */}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>❤️ {post._count?.likes || 0} likes</span>
                          <span>💬 {post._count?.comments || 0} comments</span>
                          <span>🔁 {post._count?.reposts || 0} reposts</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex gap-4">
              <button
                onClick={handleSave}
                disabled={isSaving || isUploading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
