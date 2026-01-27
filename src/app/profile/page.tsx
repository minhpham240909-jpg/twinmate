'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

export default function ProfilePage() {
  const { user, profile, loading } = useAuth()
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
  })

  const [customInputs, setCustomInputs] = useState({
    subject: '',
    interest: '',
    goal: '',
  })

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
        skillLevelDescription: '',
        studyStyle: profile.studyStyle || 'COLLABORATIVE',
        studyStyleDescription: '',
        availableDays: profile.availableDays || [],
        availableHours: Array.isArray(profile.availableHours) ? profile.availableHours.join(', ') : (profile.availableHours || ''),
        availabilityDescription: '',
      })
      setPreviewImage(profile.avatarUrl || '')
    }
  }, [user, profile, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" aria-label="Loading"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
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

  const addCustomItem = (field: 'subject' | 'interest' | 'goal') => {
    const value = customInputs[field].trim()
    if (!value) return

    if (field === 'subject' && !formData.subjects.includes(value)) {
      setFormData({ ...formData, subjects: [...formData.subjects, value] })
    } else if (field === 'interest' && !formData.interests.includes(value)) {
      setFormData({ ...formData, interests: [...formData.interests, value] })
    } else if (field === 'goal' && !formData.goals.includes(value)) {
      setFormData({ ...formData, goals: [...formData.goals, value] })
    }

    setCustomInputs({ ...customInputs, [field]: '' })
  }

  const removeCustomItem = (field: 'subjects' | 'interests' | 'goals', item: string) => {
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
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: formData.name,
          bio: formData.bio,
          avatarUrl: formData.avatarUrl,
          subjects: formData.subjects,
          interests: formData.interests,
          goals: formData.goals,
          skillLevel: formData.skillLevel,
          studyStyle: formData.studyStyle,
          availableDays: formData.availableDays,
          availableHours: formData.availableHours,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save profile')
      }

      alert('Profile saved successfully!')
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="bg-white dark:bg-neutral-900 shadow-sm dark:shadow-none dark:border-b dark:border-neutral-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              aria-label="Go back to dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Edit Profile</h1>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
            aria-label="Cancel and return to dashboard"
          >
            Cancel
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm dark:shadow-none dark:border dark:border-neutral-800 p-8">
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
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  {user.email}
                </h2>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  aria-label="Upload profile picture"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={isUploading ? 'Uploading profile picture' : 'Upload profile picture'}
                >
                  {isUploading ? 'Uploading...' : 'Upload Profile Picture'}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">JPG, PNG or GIF (max 5MB)</p>
              </div>
            </div>

            {/* Name */}
            <div className="mb-6">
              <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Full Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your name"
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Bio */}
            <div className="mb-6">
              <label htmlFor="profile-bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bio
              </label>
              <textarea
                id="profile-bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell others about yourself and your learning goals..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Subjects */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subjects I&apos;m Learning
              </label>
              <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Select subjects">
                {allSubjects.map((subject) => (
                  <button
                    key={subject}
                    onClick={() => toggleArrayItem(formData.subjects, subject, (val) => setFormData({ ...formData, subjects: val }))}
                    aria-pressed={formData.subjects.includes(subject)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      formData.subjects.includes(subject)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
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
                      className="hover:bg-blue-700 rounded-full p-0.5 cursor-pointer"
                      role="button"
                      aria-label={`Remove ${subject}`}
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
                  onKeyPress={(e) => e.key === 'Enter' && addCustomItem('subject')}
                  placeholder="Add custom subject..."
                  aria-label="Add custom subject"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  onClick={() => addCustomItem('subject')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
                  aria-label="Add subject"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Interests */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Learning Interests
              </label>
              <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Select learning interests">
                {allInterests.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleArrayItem(formData.interests, interest, (val) => setFormData({ ...formData, interests: val }))}
                    aria-pressed={formData.interests.includes(interest)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      formData.interests.includes(interest)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
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
                      className="hover:bg-purple-700 rounded-full p-0.5 cursor-pointer"
                      role="button"
                      aria-label={`Remove ${interest}`}
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
                  onKeyPress={(e) => e.key === 'Enter' && addCustomItem('interest')}
                  placeholder="Add custom interest..."
                  aria-label="Add custom interest"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  onClick={() => addCustomItem('interest')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition"
                  aria-label="Add interest"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Goals */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                My Learning Goals
              </label>
              <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Select learning goals">
                {allGoals.map((goal) => (
                  <button
                    key={goal}
                    onClick={() => toggleArrayItem(formData.goals, goal, (val) => setFormData({ ...formData, goals: val }))}
                    aria-pressed={formData.goals.includes(goal)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      formData.goals.includes(goal)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
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
                      className="hover:bg-green-700 rounded-full p-0.5 cursor-pointer"
                      role="button"
                      aria-label={`Remove ${goal}`}
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
                  onKeyPress={(e) => e.key === 'Enter' && addCustomItem('goal')}
                  placeholder="Add custom goal..."
                  aria-label="Add custom goal"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  onClick={() => addCustomItem('goal')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
                  aria-label="Add goal"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Skill Level */}
            <div className="mb-6">
              <label htmlFor="skill-level" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Skill Level
              </label>
              <select
                id="skill-level"
                value={formData.skillLevel}
                onChange={(e) => setFormData({ ...formData, skillLevel: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
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
                aria-label="Skill level description"
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Study Style */}
            <div className="mb-6">
              <label htmlFor="study-style" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preferred Study Style
              </label>
              <select
                id="study-style"
                value={formData.studyStyle}
                onChange={(e) => setFormData({ ...formData, studyStyle: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
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
                aria-label="Study style description"
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Availability */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                When I&apos;m Available
              </label>
              <div className="mb-3">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Select days you&apos;re available:</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Select available days">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleArrayItem(formData.availableDays, day, (val) => setFormData({ ...formData, availableDays: val }))}
                      aria-pressed={formData.availableDays.includes(day)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        formData.availableDays.includes(day)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
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
                aria-label="Available hours"
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm mb-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <textarea
                value={formData.availabilityDescription}
                onChange={(e) => setFormData({ ...formData, availabilityDescription: e.target.value })}
                placeholder="Describe your availability in detail (e.g., 'Flexible on weekends, prefer evening sessions during weekdays')..."
                rows={2}
                aria-label="Availability description"
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Save Button */}
            <div className="flex gap-4">
              <button
                onClick={handleSave}
                disabled={isSaving || isUploading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={isSaving ? 'Saving profile' : 'Save profile'}
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-neutral-700 transition"
                aria-label="Cancel and return to dashboard"
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
