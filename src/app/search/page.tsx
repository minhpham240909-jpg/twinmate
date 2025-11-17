'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'
import GlowBorderOptimized from '@/components/ui/GlowBorderOptimized'
import PulseOptimized from '@/components/ui/PulseOptimized'
import FadeInOptimized from '@/components/ui/FadeInOptimized'
import BounceOptimized from '@/components/ui/BounceOptimized'

interface Partner {
  id: string
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
  bio: string | null
  subjects: string[]
  interests: string[]
  goals: string[]
  skillLevel: string
  studyStyle: string
  availableDays: string[]
  availableHours: string[]
  aboutYourself?: string | null
  aboutYourselfItems?: string[]
  matchScore?: number
  matchReasons?: string[]
  isAlreadyPartner?: boolean // Flag from backend if ACCEPTED connection exists
}

export default function SearchPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const t = useTranslations('search')
  const tCommon = useTranslations('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<string>('')
  const [selectedStudyStyle, setSelectedStudyStyle] = useState<string>('')
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([])
  const [showSubjectDescription, setShowSubjectDescription] = useState(false)
  const [showSkillLevelDescription, setShowSkillLevelDescription] = useState(false)
  const [showStudyStyleDescription, setShowStudyStyleDescription] = useState(false)
  const [showInterestsDescription, setShowInterestsDescription] = useState(false)
  const [showAvailabilityDescription, setShowAvailabilityDescription] = useState(false)
  const [subjectCustomDescription, setSubjectCustomDescription] = useState('')
  const [skillLevelCustomDescription, setSkillLevelCustomDescription] = useState('')
  const [studyStyleCustomDescription, setStudyStyleCustomDescription] = useState('')
  const [interestsCustomDescription, setInterestsCustomDescription] = useState('')
  const [availabilityCustomDescription, setAvailabilityCustomDescription] = useState('')
  // NEW: School and Languages filters
  const [schoolFilter, setSchoolFilter] = useState('')
  const [languagesFilter, setLanguagesFilter] = useState('')
  const [showFilters, setShowFilters] = useState(() => {
    // Load filter visibility from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('findPartnerShowFilters')
      return saved !== null ? saved === 'true' : true // Default to true if not set
    }
    return true
  })
  const [partners, setPartners] = useState<Partner[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [sendingRequest, setSendingRequest] = useState<string | null>(null)

  // Ref to track abort controller for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // Independent search bar functionality - MUST be before early returns
  const handleSearchBarSearch = useCallback(async () => {
    if (!searchQuery.trim()) return

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setIsSearching(true)
    setSearchError('')

    try {
      const response = await fetch('/api/partners/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchQuery: searchQuery,
        }),
        signal: abortController.signal,
      })

      const data = await response.json()

      if (!response.ok) {
        // Show the actual error message from the API
        const errorMessage = data.details || data.error || t('searchFailed')
        throw new Error(errorMessage)
      }

      // Only update if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setPartners(data.profiles || [])
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      console.error('Search error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to search partners. Please try again.'
      setSearchError(errorMessage)
    } finally {
      // Only clear loading state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setIsSearching(false)
      }
    }
  }, [searchQuery])

  // Function to load random partners
  const loadRandomPartners = useCallback(async () => {
    try {
      const response = await fetch('/api/partners/random')
      if (response.ok) {
        const data = await response.json()
        setPartners(data.partners || [])
      }
    } catch (error) {
      console.error('Error loading random partners:', error)
    }
  }, [])

  // Handle connection request
  const handleConnect = useCallback(async (partnerId: string) => {
    // Prevent duplicate requests
    if (sendingRequest === partnerId) {
      return
    }

    setSendingRequest(partnerId)

    // Store the partner before removing (for error recovery)
    const partnerToRemove = partners.find(p => p.user.id === partnerId)

    // Immediately remove from UI to prevent double-clicks
    setPartners(prev => prev.filter(p => p.user.id !== partnerId))

    try {
      const response = await fetch('/api/connections/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: partnerId })
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle specific error cases - these are expected, so don't restore partner
        if (data.error === 'Connection request already sent') {
          toast.error(t('alreadySentRequest'))
          return
        } else if (data.error === 'You are already connected with this user') {
          toast.error(t('alreadyConnected'))
          return
        } else if (data.error === 'This user has already sent you a request') {
          toast(t('userAlreadySentRequest'), { icon: '📬' })
          return
        } else {
          // Unexpected error - restore the partner
          throw new Error(data.error || 'Failed to send connection request')
        }
      }

      toast.success(t('connectionRequestSent'))
    } catch (error) {
      console.error('Connection request error:', error)
      toast.error(error instanceof Error ? error.message : t('failedToSendConnectionRequest'))

      // Restore the partner to the list on unexpected errors
      if (partnerToRemove) {
        setPartners(prev => [partnerToRemove, ...prev])
      }
    } finally {
      setSendingRequest(null)
    }
  }, [sendingRequest, partners])

  // Save filter visibility to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('findPartnerShowFilters', showFilters.toString())
    }
  }, [showFilters])

  // Load random partners on initial page load
  useEffect(() => {
    if (user && !loading) {
      loadRandomPartners()
    }
  }, [user, loading, loadRandomPartners])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  // Search as user types in search bar - optimized debounce
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const debounceTimer = setTimeout(() => {
        handleSearchBarSearch()
      }, 300) // Reduced from 800ms to 300ms for better responsiveness

      return () => clearTimeout(debounceTimer)
    } else if (searchQuery.trim().length === 0) {
      // When search is cleared, reload random partners instead of showing empty
      loadRandomPartners()
    }
  }, [searchQuery, handleSearchBarSearch, loadRandomPartners])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  // Filters + Find Partner button functionality
  const handleFindPartner = async () => {
    // Check if any filters are selected
    const hasFilters =
      selectedSubjects.length > 0 ||
      selectedSkillLevel !== '' ||
      selectedStudyStyle !== '' ||
      selectedInterests.length > 0 ||
      selectedAvailability.length > 0 ||
      subjectCustomDescription.trim() !== '' ||
      skillLevelCustomDescription.trim() !== '' ||
      studyStyleCustomDescription.trim() !== '' ||
      interestsCustomDescription.trim() !== '' ||
      availabilityCustomDescription.trim() !== '' ||
      schoolFilter.trim() !== '' ||
      languagesFilter.trim() !== ''

    if (!hasFilters) {
      setSearchError('Please select at least one filter to find partners.')
      return
    }

    setIsSearching(true)
    setSearchError('')

    try {
      const response = await fetch('/api/partners/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjects: selectedSubjects,
          skillLevel: selectedSkillLevel,
          studyStyle: selectedStudyStyle,
          interests: selectedInterests,
          availability: selectedAvailability,
          subjectCustomDescription,
          skillLevelCustomDescription,
          studyStyleCustomDescription,
          interestsCustomDescription,
          availabilityCustomDescription,
          school: schoolFilter,
          languages: languagesFilter,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Show the actual error message from the API
        const errorMessage = data.details || data.error || t('searchFailed')
        throw new Error(errorMessage)
      }

      setPartners(data.profiles || [])
    } catch (error) {
      console.error('Search error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to find partners. Please try again.'
      setSearchError(errorMessage)
    } finally {
      setIsSearching(false)
    }
  }

  const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'History', 'Literature', 'Languages']
  const skillLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']
  const studyStyles = ['COLLABORATIVE', 'INDEPENDENT', 'MIXED']
  const interests = ['Group Study', 'One-on-One', 'Video Calls', 'Text Chat', 'Problem Solving', 'Project-Based', 'Exam Prep', 'Research']
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    )
  }

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    )
  }

  const toggleAvailability = (day: string) => {
    setSelectedAvailability(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
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
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{t('title')}</h1>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {showFilters ? t('hideFilters') : t('showFilters')}
            </button>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            {tCommon('backToDashboard')}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Independent Search Bar - Above Filters */}
          <div className="mb-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Search</h2>
              <p className="text-sm text-gray-600 mb-4">Search by name, interest, or subject</p>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base text-gray-900 placeholder-gray-400"
                />
                <svg
                  className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {isSearching && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center mb-6">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-4 text-sm text-gray-500 font-medium">OR</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          <div className={`grid gap-6 ${showFilters ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
            {/* Filters Sidebar */}
            {showFilters && (
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-sm p-6 sticky top-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Advanced Filters</h2>

                {/* Subjects */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Subjects
                    </label>
                    <button
                      onClick={() => setShowSubjectDescription(!showSubjectDescription)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {showSubjectDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showSubjectDescription && (
                    <p className="text-xs text-gray-600 mb-2 p-2 bg-blue-50 rounded">
                      Filter partners by the subjects they&apos;re studying. Select multiple subjects to find partners interested in similar topics.
                    </p>
                  )}
                  <div className="space-y-2 mb-2">
                    {subjects.map((subject) => (
                      <label key={subject} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedSubjects.includes(subject)}
                          onChange={() => toggleSubject(subject)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{subject}</span>
                      </label>
                    ))}
                  </div>
                  <textarea
                    value={subjectCustomDescription}
                    onChange={(e) => setSubjectCustomDescription(e.target.value)}
                    placeholder={t('subjectCustomDescPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                  />
                </div>

                {/* Skill Level */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Skill Level
                    </label>
                    <button
                      onClick={() => setShowSkillLevelDescription(!showSkillLevelDescription)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {showSkillLevelDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showSkillLevelDescription && (
                    <p className="text-xs text-gray-600 mb-2 p-2 bg-blue-50 rounded">
                      Filter by the skill level of potential partners. Choose &quot;All Levels&quot; to see everyone, or select a specific level to find partners at a similar learning stage.
                    </p>
                  )}
                  <select
                    value={selectedSkillLevel}
                    onChange={(e) => setSelectedSkillLevel(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                  >
                    <option value="">All Levels</option>
                    {skillLevels.map((level) => (
                      <option key={level} value={level}>
                        {level.charAt(0) + level.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={skillLevelCustomDescription}
                    onChange={(e) => setSkillLevelCustomDescription(e.target.value)}
                    placeholder={t('skillLevelCustomDescPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                  />
                </div>

                {/* Study Style */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Study Style
                    </label>
                    <button
                      onClick={() => setShowStudyStyleDescription(!showStudyStyleDescription)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {showStudyStyleDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showStudyStyleDescription && (
                    <p className="text-xs text-gray-600 mb-2 p-2 bg-purple-50 rounded">
                      Find partners who prefer similar study approaches. Collaborative learners enjoy group sessions, independent learners prefer self-study, and mixed learners are flexible.
                    </p>
                  )}
                  <select
                    value={selectedStudyStyle}
                    onChange={(e) => setSelectedStudyStyle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-2"
                  >
                    <option value="">All Styles</option>
                    <option value="COLLABORATIVE">Collaborative (Group Study)</option>
                    <option value="INDEPENDENT">Independent (Self-Study)</option>
                    <option value="MIXED">Mixed (Both)</option>
                  </select>
                  <textarea
                    value={studyStyleCustomDescription}
                    onChange={(e) => setStudyStyleCustomDescription(e.target.value)}
                    placeholder={t('studyStyleCustomDescPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs"
                  />
                </div>

                {/* Learning Interests */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Learning Interests
                    </label>
                    <button
                      onClick={() => setShowInterestsDescription(!showInterestsDescription)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {showInterestsDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showInterestsDescription && (
                    <p className="text-xs text-gray-600 mb-2 p-2 bg-green-50 rounded">
                      Select learning activities and interests to find partners who share your preferred study methods. You can select multiple interests.
                    </p>
                  )}
                  <div className="space-y-2 max-h-48 overflow-y-auto mb-2">
                    {interests.map((interest) => (
                      <label key={interest} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedInterests.includes(interest)}
                          onChange={() => toggleInterest(interest)}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{interest}</span>
                      </label>
                    ))}
                  </div>
                  <textarea
                    value={interestsCustomDescription}
                    onChange={(e) => setInterestsCustomDescription(e.target.value)}
                    placeholder={t('interestsCustomDescPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs"
                  />
                </div>

                {/* Availability */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Availability
                    </label>
                    <button
                      onClick={() => setShowAvailabilityDescription(!showAvailabilityDescription)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {showAvailabilityDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showAvailabilityDescription && (
                    <p className="text-xs text-gray-600 mb-2 p-2 bg-indigo-50 rounded">
                      Filter partners by the days they&apos;re available to study. Select the days that work best for you to find partners with matching schedules.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {daysOfWeek.map((day) => (
                      <label key={day} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedAvailability.includes(day)}
                          onChange={() => toggleAvailability(day)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{day.slice(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                  <textarea
                    value={availabilityCustomDescription}
                    onChange={(e) => setAvailabilityCustomDescription(e.target.value)}
                    placeholder={t('availabilityCustomDescPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs"
                  />
                </div>

                {/* School Filter */}
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('schoolUniversity')}
                  </label>
                  <textarea
                    value={schoolFilter}
                    onChange={(e) => setSchoolFilter(e.target.value)}
                    placeholder={t('schoolPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('findPartnersFromSameSchool')}</p>
                </div>

                {/* Languages Filter */}
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('languages')}
                  </label>
                  <textarea
                    value={languagesFilter}
                    onChange={(e) => setLanguagesFilter(e.target.value)}
                    placeholder={t('languagesPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('findPartnersWhoSpeak')}</p>
                </div>

                <button
                  onClick={handleFindPartner}
                  disabled={isSearching}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearching ? t('searching') : t('searchPartners')}
                </button>
              </div>
            </div>
            )}

            {/* Results */}
            <div className={showFilters ? 'lg:col-span-2' : 'lg:col-span-1'}>
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t('availableStudyPartners')} {partners.length > 0 && `(${partners.length})`}
                  </h2>
                  <button
                    onClick={loadRandomPartners}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title={t('loadNewRandomPartners')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {t('refresh')}
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  {t('connectWithLearners')}
                </p>
              </div>

              {/* Error Message */}
              {searchError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-700">{searchError}</p>
                  </div>
                </div>
              )}

              {/* Partner Cards */}
              <FadeInOptimized delay={0.1}>
                <div className="space-y-4">
                  {partners.length > 0 ? (
                    partners.map((partner, index) => {
                      const cardContent = (
                        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all border border-gray-200">
                          <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <PartnerAvatar
                            avatarUrl={partner.user.avatarUrl}
                            name={partner.user.name}
                            size="md"
                            showStatus={false}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{partner.user.name}</h3>
                              {partner.matchScore && partner.matchScore > 0 && (
                                <PulseOptimized onlyWhenVisible={true}>
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                    {partner.matchScore}% Match
                                  </span>
                                </PulseOptimized>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {partner.skillLevel.charAt(0) + partner.skillLevel.slice(1).toLowerCase()} • {partner.studyStyle.charAt(0) + partner.studyStyle.slice(1).toLowerCase().replace('_', ' ')}
                            </p>
                            {partner.subjects.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {partner.subjects.slice(0, 3).map((subject, idx) => (
                                  <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full hover:scale-105 transition-transform cursor-default">
                                    {subject}
                                  </span>
                                ))}
                                {partner.subjects.length > 3 && (
                                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                    +{partner.subjects.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                            {partner.matchReasons && partner.matchReasons.length > 0 && (
                              <p className="text-xs text-green-600 mb-2">
                                ✓ {partner.matchReasons.join(', ')}
                              </p>
                            )}
                            {partner.bio && (
                              <p className="text-sm text-gray-700 line-clamp-2">
                                {partner.bio}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push(`/profile/${partner.user.id}`)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 hover:scale-105 transition-all whitespace-nowrap shadow-sm"
                          >
                            {t('viewProfile')}
                          </button>
                          {partner.isAlreadyPartner ? (
                            <PulseOptimized onlyWhenVisible={true}>
                              <div className="px-4 py-2 bg-green-100 text-green-700 text-sm rounded-lg font-medium whitespace-nowrap flex items-center gap-2 shadow-sm">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                {t('alreadyPartners')}
                              </div>
                            </PulseOptimized>
                          ) : (
                            <button
                              onClick={() => handleConnect(partner.user.id)}
                              disabled={sendingRequest === partner.user.id}
                              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 hover:scale-105 transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-md font-medium"
                            >
                              {sendingRequest === partner.user.id ? t('sending') : t('connect')}
                            </button>
                          )}
                        </div>
                      </div>
                        </div>
                      )

                      return (
                        <FadeInOptimized key={partner.id} delay={Math.min(index * 0.03, 0.3)}>
                          {/* Only use ElectricBorder on high match scores (>80) */}
                          {partner.matchScore && partner.matchScore > 80 ? (
                            <GlowBorderOptimized color="#10b981" animated={false}  style={{ borderRadius: 12 }} onlyWhenVisible={true}>
                              {cardContent}
                            </GlowBorderOptimized>
                          ) : (
                            cardContent
                          )}
                        </FadeInOptimized>
                      )
                    })
                  ) : (
                  <div className="bg-gray-50 rounded-xl p-12 text-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {t('noPartnersFound')}
                    </h3>
                    <p className="text-gray-600 mb-6">
                      {searchQuery || selectedSubjects.length > 0 || selectedInterests.length > 0
                        ? t('noPartnersFoundWithFilters')
                        : t('noPartnersFoundDescription')}
                    </p>
                    {!searchQuery && selectedSubjects.length === 0 && selectedInterests.length === 0 && (
                      <button
                        onClick={loadRandomPartners}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                      >
                        Load Random Partners
                      </button>
                    )}
                  </div>
                )}
                </div>
              </FadeInOptimized>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
