'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { LocationForm } from '@/components/profile/LocationForm'

export default function ProfilePage() {
  const { user, profile, loading, refreshUser } = useAuth()
  const router = useRouter()
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    age: undefined as number | undefined,
    role: '',
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
    aboutYourselfItems: [] as string[],
    aboutYourself: '',
    school: '',
    languages: '',
    postPrivacy: 'PUBLIC' as 'PUBLIC' | 'PARTNERS_ONLY',
    locationCity: '',
    locationState: '',
    locationCountry: '',
    locationLat: null as number | null,
    locationLng: null as number | null,
    locationVisibility: 'match-only' as 'private' | 'match-only' | 'public',
  })

  const [customInputs, setCustomInputs] = useState({
    subject: '',
    interest: '',
    goal: '',
    aboutYourselfItem: '',
  })

  const [showAboutYourself, setShowAboutYourself] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [previewImage, setPreviewImage] = useState<string>('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
    if (profile) {
      const initialFormData = {
        name: profile.name || '',
        bio: profile.bio || '',
        age: (profile as { age?: number }).age || undefined,
        role: (profile as { role?: string }).role || '',
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
        aboutYourselfItems: (profile as { aboutYourselfItems?: string[] }).aboutYourselfItems || [],
        aboutYourself: (profile as { aboutYourself?: string }).aboutYourself || '',
        school: (profile as { school?: string }).school || '',
        languages: (profile as { languages?: string }).languages || '',
        postPrivacy: (profile as { postPrivacy?: 'PUBLIC' | 'PARTNERS_ONLY' }).postPrivacy || 'PUBLIC',
        locationCity: (profile as { location_city?: string }).location_city || '',
        locationState: (profile as { location_state?: string }).location_state || '',
        locationCountry: (profile as { location_country?: string }).location_country || '',
        locationLat: (profile as { location_lat?: number }).location_lat || null,
        locationLng: (profile as { location_lng?: number }).location_lng || null,
        locationVisibility: ((profile as { location_visibility?: string }).location_visibility || 'match-only') as 'private' | 'match-only' | 'public',
      }
      
      setFormData(initialFormData)
      
      if (typeof window !== 'undefined') {
        const bannerClicked = localStorage.getItem('profileCompletionBannerClicked') === 'true'
        if (bannerClicked) {
          const snapshot = JSON.stringify({
            bio: initialFormData.bio,
            age: initialFormData.age,
            role: initialFormData.role,
            subjects: initialFormData.subjects,
            interests: initialFormData.interests,
            goals: initialFormData.goals,
            skillLevel: initialFormData.skillLevel,
            studyStyle: initialFormData.studyStyle,
            school: initialFormData.school,
            languages: initialFormData.languages,
            availableDays: initialFormData.availableDays,
            availableHours: initialFormData.availableHours,
          })
          localStorage.setItem('profileSnapshot', snapshot)
        }
      }
      
      const profileWithAbout = profile as { aboutYourself?: string; aboutYourselfItems?: string[] }
      if (profileWithAbout.aboutYourself || (profileWithAbout.aboutYourselfItems && profileWithAbout.aboutYourselfItems.length > 0)) {
        setShowAboutYourself(true)
      }
      setPreviewImage(profile.avatarUrl || '')
    }
  }, [user, profile, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{tCommon('loading')}</p>
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

    if (!file.type.startsWith('image/')) {
      alert(t('pleaseUploadImageFile'))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(t('imageSizeLimit'))
      return
    }

    setIsUploading(true)

    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewImage(reader.result as string)
      }
      reader.readAsDataURL(file)

      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('userId', user.id)

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formDataUpload,
      })

      if (!response.ok) {
        throw new Error(t('uploadFailed'))
      }

      const data = await response.json()
      setFormData({ ...formData, avatarUrl: data.url })
    } catch (error) {
      console.error('Upload error:', error)
      alert(t('failedToUploadImage'))
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
        age: formData.age || undefined,
        role: formData.role || undefined,
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
        aboutYourselfItems: formData.aboutYourselfItems,
        aboutYourself: formData.aboutYourself || undefined,
        school: formData.school || undefined,
        languages: formData.languages || undefined,
        postPrivacy: formData.postPrivacy,
      }

      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: t('unknownError') }))
        console.error('[CLIENT] Failed to save profile:', errorData)
        throw new Error(errorData.error || 'Failed to save profile')
      }

      if (formData.locationCity || formData.locationState || formData.locationCountry) {
        const locationResponse = await fetch('/api/location/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city: formData.locationCity || null,
            state: formData.locationState || null,
            country: formData.locationCountry || null,
            lat: formData.locationLat,
            lng: formData.locationLng,
            visibility: formData.locationVisibility,
          }),
        })

        if (!locationResponse.ok) {
          console.error('[CLIENT] Failed to save location')
        }
      }

      await refreshUser()
      
      const updatedProfile = {
        bio: requestData.bio,
        subjects: requestData.subjects,
        interests: requestData.interests,
        age: requestData.age,
        role: requestData.role,
      }
      
      const isComplete = 
        updatedProfile.bio && updatedProfile.bio.trim().length > 0 &&
        updatedProfile.subjects && updatedProfile.subjects.length > 0 &&
        updatedProfile.interests && updatedProfile.interests.length > 0 &&
        updatedProfile.age !== null && updatedProfile.age !== undefined &&
        updatedProfile.role && updatedProfile.role.trim().length > 0
      
      if (typeof window !== 'undefined') {
        const bannerClicked = localStorage.getItem('profileCompletionBannerClicked') === 'true'
        const snapshotStr = localStorage.getItem('profileSnapshot')
        
        if (bannerClicked && snapshotStr) {
          try {
            const snapshot = JSON.parse(snapshotStr)
            const currentProfile = {
              bio: requestData.bio || '',
              age: requestData.age,
              role: requestData.role || '',
              subjects: requestData.subjects || [],
              interests: requestData.interests || [],
              goals: requestData.goals || [],
              skillLevel: requestData.skillLevel || '',
              studyStyle: requestData.studyStyle || '',
              school: requestData.school || '',
              languages: requestData.languages || '',
              availableDays: requestData.availableDays || [],
              availableHours: requestData.availableHours || '',
            }
            
            const hasChanges = 
              snapshot.bio !== currentProfile.bio ||
              snapshot.age !== currentProfile.age ||
              snapshot.role !== currentProfile.role ||
              JSON.stringify(snapshot.subjects?.sort()) !== JSON.stringify(currentProfile.subjects?.sort()) ||
              JSON.stringify(snapshot.interests?.sort()) !== JSON.stringify(currentProfile.interests?.sort()) ||
              JSON.stringify(snapshot.goals?.sort()) !== JSON.stringify(currentProfile.goals?.sort()) ||
              snapshot.skillLevel !== currentProfile.skillLevel ||
              snapshot.studyStyle !== currentProfile.studyStyle ||
              snapshot.school !== currentProfile.school ||
              snapshot.languages !== currentProfile.languages ||
              JSON.stringify(snapshot.availableDays?.sort()) !== JSON.stringify(currentProfile.availableDays?.sort()) ||
              snapshot.availableHours !== currentProfile.availableHours
            
            if (hasChanges) {
              localStorage.setItem('profileCompletionBannerDismissed', 'true')
            }
          } catch (e) {
            console.error('Error comparing profile snapshot:', e)
          }
        }
        
        if (isComplete && bannerClicked) {
          localStorage.setItem('profileCompletionBannerDismissed', 'true')
        }
      }
      
      alert(t('profileSavedSuccessfully'))
      router.push('/dashboard')
    } catch (error) {
      console.error('Save error:', error)
      alert(`${t('failedToSaveProfile')}: ${error instanceof Error ? error.message : tCommon('pleaseTryRefreshing')}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                try {
                  router.back()
                } catch (e) {
                  router.push('/dashboard')
                }
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Back</span>
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {t('editProfile')}
            </h1>
          </div>
          <button
            onClick={() => {
              try {
                router.push('/dashboard')
              } catch (e) {
                window.location.href = '/dashboard'
              }
            }}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition font-medium"
          >
            {tCommon('cancel')}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Profile Picture Section */}
          <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-2xl"
                  />
                ) : (
                  <div className="w-32 h-32 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white font-bold text-4xl border-4 border-white shadow-2xl">
                    {formData.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                  </div>
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white cursor-pointer hover:bg-blue-700 transition-colors group-hover:scale-110">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
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
                  className="absolute inset-0 rounded-full cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-2xl font-bold text-white mb-1">
                  {formData.name || user.email}
                </h2>
                <p className="text-blue-100 mb-2">{user.email}</p>
                <p className="text-sm text-blue-50">JPG, PNG or GIF (max 5MB)</p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-8 space-y-8">
            {/* Basic Information Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                <h3 className="text-xl font-bold text-gray-900">Basic Information</h3>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('enterYourName')}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bio <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder={t('tellOthersAboutYourself')}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                />
              </div>

              {/* Age and Role */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="150"
                    value={formData.age || ''}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder={t('enterYourAge')}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Role / Position <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g., Student, Software Engineer"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200"></div>

            {/* Learning Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                <h3 className="text-xl font-bold text-gray-900">Learning Preferences</h3>
              </div>

              {/* Subjects */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Subjects I&apos;m Learning <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {allSubjects.map((subject) => (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleArrayItem(formData.subjects, subject, (val) => setFormData({ ...formData, subjects: val }))}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        formData.subjects.includes(subject)
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {subject}
                    </button>
                  ))}
                  {formData.subjects.filter(s => !allSubjects.includes(s)).map((subject) => (
                    <span key={subject} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-medium shadow-lg">
                      {subject}
                      <button
                        type="button"
                        onClick={() => removeCustomItem('subjects', subject)}
                        className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInputs.subject}
                    onChange={(e) => setCustomInputs({ ...customInputs, subject: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomItem('subject')}
                    placeholder={t('addCustomSubject')}
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => addCustomItem('subject')}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Interests */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Learning Interests <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {allInterests.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleArrayItem(formData.interests, interest, (val) => setFormData({ ...formData, interests: val }))}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        formData.interests.includes(interest)
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                  {formData.interests.filter(i => !allInterests.includes(i)).map((interest) => (
                    <span key={interest} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-medium shadow-lg">
                      {interest}
                      <button
                        type="button"
                        onClick={() => removeCustomItem('interests', interest)}
                        className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInputs.interest}
                    onChange={(e) => setCustomInputs({ ...customInputs, interest: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomItem('interest')}
                    placeholder={t('addCustomInterest')}
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => addCustomItem('interest')}
                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Goals */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  My Learning Goals
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {allGoals.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => toggleArrayItem(formData.goals, goal, (val) => setFormData({ ...formData, goals: val }))}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        formData.goals.includes(goal)
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {goal}
                    </button>
                  ))}
                  {formData.goals.filter(g => !allGoals.includes(g)).map((goal) => (
                    <span key={goal} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl text-sm font-medium shadow-lg">
                      {goal}
                      <button
                        type="button"
                        onClick={() => removeCustomItem('goals', goal)}
                        className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInputs.goal}
                    onChange={(e) => setCustomInputs({ ...customInputs, goal: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomItem('goal')}
                    placeholder={t('addCustomGoal')}
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => addCustomItem('goal')}
                    className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200"></div>

            {/* Additional Information */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                <h3 className="text-xl font-bold text-gray-900">Additional Information</h3>
              </div>

              {/* School */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  School / University
                </label>
                <textarea
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  placeholder="e.g., Harvard University, MIT, Stanford..."
                  rows={2}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">This helps you find partners from the same school</p>
              </div>

              {/* Languages */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Languages Spoken
                </label>
                <textarea
                  value={formData.languages}
                  onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
                  placeholder="e.g., English, Spanish, Mandarin, French..."
                  rows={2}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">This helps you find partners who speak the same languages</p>
              </div>

              {/* Location */}
              <div className="pb-6 border-b border-gray-200">
                <LocationForm
                  initialLocation={{
                    city: formData.locationCity,
                    state: formData.locationState,
                    country: formData.locationCountry,
                    lat: formData.locationLat,
                    lng: formData.locationLng,
                    visibility: formData.locationVisibility,
                  }}
                  onLocationChange={(location) => {
                    setFormData({
                      ...formData,
                      locationCity: location.city,
                      locationState: location.state,
                      locationCountry: location.country,
                      locationLat: location.lat,
                      locationLng: location.lng,
                      locationVisibility: location.visibility,
                    })
                  }}
                />
              </div>

              {/* Skill Level */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Skill Level
                </label>
                <input
                  type="text"
                  value={formData.skillLevelDescription}
                  onChange={(e) => setFormData({ ...formData, skillLevelDescription: e.target.value })}
                  placeholder={t('describeSkillLevel')}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Study Style */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Preferred Study Style
                </label>
                <select
                  value={formData.studyStyle}
                  onChange={(e) => setFormData({ ...formData, studyStyle: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all mb-3"
                >
                  <option value="COLLABORATIVE">Collaborative (Group Study)</option>
                  <option value="INDEPENDENT">Independent (Self-Study)</option>
                  <option value="MIXED">Mixed (Both)</option>
                </select>
                <input
                  type="text"
                  value={formData.studyStyleDescription}
                  onChange={(e) => setFormData({ ...formData, studyStyleDescription: e.target.value })}
                  placeholder={t('describeStudyStyle')}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                />
              </div>

              {/* Availability */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  When I&apos;m Available
                </label>
                <p className="text-xs text-gray-600 mb-3">Select days you&apos;re available:</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleArrayItem(formData.availableDays, day, (val) => setFormData({ ...formData, availableDays: val }))}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        formData.availableDays.includes(day)
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.availableHours}
                  onChange={(e) => setFormData({ ...formData, availableHours: e.target.value })}
                  placeholder={t('typicalHours')}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm mb-3"
                />
                <textarea
                  value={formData.availabilityDescription}
                  onChange={(e) => setFormData({ ...formData, availabilityDescription: e.target.value })}
                  placeholder={t('describeAvailability')}
                  rows={2}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none text-sm"
                />
              </div>
            </div>

            {/* About Yourself Section */}
            <div className="border-t border-gray-200 pt-8">
              <button
                type="button"
                onClick={() => setShowAboutYourself(!showAboutYourself)}
                className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 rounded-xl transition-all w-full text-left group"
              >
                <svg className={`w-5 h-5 text-blue-600 transition-transform ${showAboutYourself ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-semibold text-gray-900">{showAboutYourself ? 'Hide' : 'Add more about yourself'}</span>
              </button>

              {showAboutYourself && (
                <div className="mt-6 space-y-6">
                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Add Tags
                    </label>
                    <p className="text-xs text-gray-600 mb-3">
                      Add keywords that describe you (e.g., &quot;Startup&quot;, &quot;AI&quot;, &quot;Co-founder&quot;, &quot;React Developer&quot;)
                    </p>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={customInputs.aboutYourselfItem}
                        onChange={(e) => setCustomInputs({ ...customInputs, aboutYourselfItem: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomItem('aboutYourselfItem'))}
                        placeholder={t('addTag')}
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => addCustomItem('aboutYourselfItem')}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
                      >
                        Add
                      </button>
                    </div>
                    {formData.aboutYourselfItems.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.aboutYourselfItems.map((item) => (
                          <span key={item} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 rounded-xl text-sm font-medium border border-blue-200">
                            {item}
                            <button
                              type="button"
                              onClick={() => removeCustomItem('aboutYourselfItems', item)}
                              className="text-blue-600 hover:text-blue-800 font-bold text-lg leading-none"
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tell us more about yourself
                    </label>
                    <p className="text-xs text-gray-600 mb-3">
                      Share anything you&apos;d like others to know - your collaboration preferences, what you&apos;re looking for, your goals, or anything else that helps others understand you better.
                    </p>
                    <textarea
                      value={formData.aboutYourself}
                      onChange={(e) => setFormData({ ...formData, aboutYourself: e.target.value })}
                      placeholder={t('aboutYourselfPlaceholder')}
                      rows={6}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Save Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
              <button
                onClick={handleSave}
                disabled={isSaving || isUploading}
                className="flex-1 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isSaving ? `${tCommon('save')}...` : tCommon('save')}
              </button>
              <button
                onClick={() => {
                  try {
                    router.push('/dashboard')
                  } catch (e) {
                    window.location.href = '/dashboard'
                  }
                }}
                className="px-8 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
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
