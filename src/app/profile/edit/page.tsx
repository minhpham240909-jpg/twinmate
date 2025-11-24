'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { LocationForm } from '@/components/profile/LocationForm'
import GlowBorder from '@/components/ui/GlowBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'

export default function ProfilePage() {
  const { user, profile, loading, refreshUser } = useAuth()
  const router = useRouter()
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')

  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    age: undefined as number | undefined,
    role: '',
    subjects: [] as string[],
    interests: [] as string[],
    goals: [] as string[],
    skillLevel: 'BEGINNER',
    skillLevelDescription: '',
    studyStyle: 'COLLABORATIVE',
    studyStyleDescription: '',
    availableDays: [] as string[],
    availableHours: '',
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
        subjects: profile.subjects || [],
        interests: profile.interests || [],
        goals: profile.goals || [],
        skillLevel: profile.skillLevel || 'BEGINNER',
        skillLevelDescription: profile.skillLevelCustomDescription || '',
        studyStyle: profile.studyStyle || 'COLLABORATIVE',
        studyStyleDescription: profile.studyStyleCustomDescription || '',
        availableDays: profile.availableDays || [],
        availableHours: (Array.isArray(profile.availableHours) && profile.availableHours.length > 0) ? profile.availableHours[0] : '',
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
    }
  }, [user, profile, loading, router])

  // Memoized callback to prevent infinite loop
  const handleLocationChange = useCallback((location: {
    city: string
    state: string
    country: string
    lat: number | null
    lng: number | null
    visibility: 'match-only' | 'private' | 'public'
  }) => {
    setFormData(prev => ({
      ...prev,
      locationCity: location.city,
      locationState: location.state,
      locationCountry: location.country,
      locationLat: location.lat,
      locationLng: location.lng,
      locationVisibility: location.visibility,
    }))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const requestData = {
        userId: user.id,
        name: formData.name,
        bio: formData.bio || undefined,
        age: formData.age || undefined,
        role: formData.role || undefined,
        avatarUrl: undefined, // Not updating avatar here
        subjects: formData.subjects,
        interests: formData.interests,
        goals: formData.goals,
        skillLevel: formData.skillLevel || undefined,
        skillLevelCustomDescription: formData.skillLevelDescription || undefined,
        studyStyle: formData.studyStyle || undefined,
        studyStyleCustomDescription: formData.studyStyleDescription || undefined,
        availableDays: formData.availableDays,
        availableHours: formData.availableHours || undefined,
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
      router.push(`/profile/${user.id}`)
    } catch (error) {
      console.error('Save error:', error)
      alert(`${t('failedToSaveProfile')}: ${error instanceof Error ? error.message : tCommon('pleaseTryRefreshing')}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                try {
                  router.back()
                } catch (e) {
                  router.push(`/profile/${user.id}`)
                }
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors -ml-2"
            >
              <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900">Edit Profile</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-black text-white rounded-full font-semibold hover:bg-gray-800 hover:scale-105 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </span>
            ) : (
              <Bounce>
                <span>Save</span>
              </Bounce>
            )}
          </button>
        </div>
      </header>

      {/* Form Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Basic Information */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>

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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none bg-white"
              />
            </div>

            {/* Age and Role */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Learning Preferences */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Learning Preferences</h2>

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
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      formData.subjects.includes(subject)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {subject}
                  </button>
                ))}
                {formData.subjects.filter(s => !allSubjects.includes(s)).map((subject) => (
                  <Bounce key={subject} delay={formData.subjects.indexOf(subject) * 0.05}>
                    <Pulse>
                      <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-full text-sm font-medium hover:scale-105 transition-all cursor-default">
                        {subject}
                        <button
                          type="button"
                          onClick={() => removeCustomItem('subjects', subject)}
                          className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    </Pulse>
                  </Bounce>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInputs.subject}
                  onChange={(e) => setCustomInputs({ ...customInputs, subject: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomItem('subject')}
                  placeholder={t('addCustomSubject')}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => addCustomItem('subject')}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-all"
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
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      formData.interests.includes(interest)
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
                {formData.interests.filter(i => !allInterests.includes(i)).map((interest) => (
                  <span key={interest} className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-full text-sm font-medium">
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => addCustomItem('interest')}
                  className="px-6 py-2 bg-purple-500 text-white rounded-lg text-sm font-semibold hover:bg-purple-600 transition-all"
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
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      formData.goals.includes(goal)
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {goal}
                  </button>
                ))}
                {formData.goals.filter(g => !allGoals.includes(g)).map((goal) => (
                  <span key={goal} className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full text-sm font-medium">
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => addCustomItem('goal')}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-all"
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
            <h2 className="text-xl font-bold text-gray-900">Additional Information</h2>

            {/* School */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                School / University
              </label>
              <input
                type="text"
                value={formData.school}
                onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                placeholder="e.g., Harvard University, MIT, Stanford..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
              />
              <p className="text-xs text-gray-500 mt-2">This helps you find partners from the same school</p>
            </div>

            {/* Languages */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Languages Spoken
              </label>
              <input
                type="text"
                value={formData.languages}
                onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
                placeholder="e.g., English, Spanish, Mandarin, French..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
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
                onLocationChange={handleLocationChange}
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all mb-3 bg-white"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white"
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
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      formData.availableDays.includes(day)
                        ? 'bg-indigo-500 text-white'
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white"
              />
            </div>
          </div>

          {/* About Yourself Section */}
          <div className="border-t border-gray-200 pt-8">
            <button
              type="button"
              onClick={() => setShowAboutYourself(!showAboutYourself)}
              className="flex items-center gap-3 px-6 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all w-full text-left group"
            >
              <svg className={`w-5 h-5 text-gray-600 transition-transform ${showAboutYourself ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    Add keywords that describe you (e.g., &quot;Startup&quot;, &quot;Tech&quot;, &quot;Co-founder&quot;, &quot;React Developer&quot;)
                  </p>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={customInputs.aboutYourselfItem}
                      onChange={(e) => setCustomInputs({ ...customInputs, aboutYourselfItem: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomItem('aboutYourselfItem'))}
                      placeholder={t('addTag')}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => addCustomItem('aboutYourselfItem')}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-all"
                    >
                      Add
                    </button>
                  </div>
                  {formData.aboutYourselfItems.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.aboutYourselfItems.map((item) => (
                        <span key={item} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                          {item}
                          <button
                            type="button"
                            onClick={() => removeCustomItem('aboutYourselfItems', item)}
                            className="text-gray-600 hover:text-gray-800 font-bold text-lg leading-none"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none text-sm bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
