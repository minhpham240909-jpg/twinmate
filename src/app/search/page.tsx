'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'

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
  const [viewingProfile, setViewingProfile] = useState<Partner | null>(null)
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

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()

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
      setSearchError('Failed to search partners. Please try again.')
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
          toast.error('You have already sent a connection request to this user. Please wait for their response.')
          return
        } else if (data.error === 'You are already connected with this user') {
          toast.error('You are already connected with this user!')
          return
        } else if (data.error === 'This user has already sent you a request') {
          toast('This user has already sent you a connection request! Check your notifications.', { icon: '📬' })
          return
        } else {
          // Unexpected error - restore the partner
          throw new Error(data.error || 'Failed to send connection request')
        }
      }

      toast.success('Connection request sent!')
    } catch (error) {
      console.error('Connection request error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send connection request')

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
          <p className="text-gray-600">Loading...</p>
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

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setPartners(data.profiles || [])
    } catch (error) {
      console.error('Search error:', error)
      setSearchError('Failed to find partners. Please try again.')
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
            <h1 className="text-2xl font-bold text-blue-600">Find Study Partners</h1>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Back to Dashboard
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
                  placeholder="Type to search (e.g., 'Mathematics', 'John', 'Problem Solving')..."
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
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
                      {showSubjectDescription ? 'Hide info' : 'Show info'}
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
                    placeholder="Add custom description for subjects you're looking for..."
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
                      {showSkillLevelDescription ? 'Hide info' : 'Show info'}
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
                    placeholder="Add custom description for skill level you're looking for..."
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
                      {showStudyStyleDescription ? 'Hide info' : 'Show info'}
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
                    placeholder="Add custom description for study style you're looking for..."
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
                      {showInterestsDescription ? 'Hide info' : 'Show info'}
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
                    placeholder="Add custom description for learning interests you're looking for..."
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
                      {showAvailabilityDescription ? 'Hide info' : 'Show info'}
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
                    placeholder="Add custom description for availability you're looking for..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs"
                  />
                </div>

                {/* School Filter */}
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    School / University
                  </label>
                  <textarea
                    value={schoolFilter}
                    onChange={(e) => setSchoolFilter(e.target.value)}
                    placeholder="e.g., Harvard, MIT, Stanford..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                  />
                  <p className="text-xs text-gray-500 mt-1">Find partners from the same school</p>
                </div>

                {/* Languages Filter */}
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Languages
                  </label>
                  <textarea
                    value={languagesFilter}
                    onChange={(e) => setLanguagesFilter(e.target.value)}
                    placeholder="e.g., English, Spanish, Mandarin..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                  />
                  <p className="text-xs text-gray-500 mt-1">Find partners who speak these languages</p>
                </div>

                <button
                  onClick={handleFindPartner}
                  disabled={isSearching}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearching ? 'Searching...' : 'Find Partners'}
                </button>
              </div>
            </div>
            )}

            {/* Results */}
            <div className={showFilters ? 'lg:col-span-2' : 'lg:col-span-1'}>
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Available Study Partners {partners.length > 0 && `(${partners.length})`}
                  </h2>
                  <button
                    onClick={loadRandomPartners}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Load new random partners"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  Connect with learners who share your interests and goals
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
              <div className="space-y-4">
                {partners.length > 0 ? (
                  partners.map((partner) => (
                    <div key={partner.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          {partner.user.avatarUrl ? (
                            <img
                              src={partner.user.avatarUrl}
                              alt={partner.user.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                              {partner.user.name?.[0]?.toUpperCase() || 'U'}
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{partner.user.name}</h3>
                              {partner.matchScore && partner.matchScore > 0 && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                  {partner.matchScore}% Match
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {partner.skillLevel.charAt(0) + partner.skillLevel.slice(1).toLowerCase()} • {partner.studyStyle.charAt(0) + partner.studyStyle.slice(1).toLowerCase().replace('_', ' ')}
                            </p>
                            {partner.subjects.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {partner.subjects.slice(0, 3).map((subject, idx) => (
                                  <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
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
                            onClick={() => setViewingProfile(partner)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition whitespace-nowrap"
                          >
                            View Profile
                          </button>
                          {partner.isAlreadyPartner ? (
                            <div className="px-4 py-2 bg-green-100 text-green-700 text-sm rounded-lg font-medium whitespace-nowrap flex items-center gap-2">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Already Partners
                            </div>
                          ) : (
                            <button
                              onClick={() => handleConnect(partner.user.id)}
                              disabled={sendingRequest === partner.user.id}
                              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {sendingRequest === partner.user.id ? 'Sending...' : 'Connect'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-gray-50 rounded-xl p-12 text-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No partners found
                    </h3>
                    <p className="text-gray-600 mb-6">
                      {searchQuery || selectedSubjects.length > 0 || selectedInterests.length > 0
                        ? 'Try adjusting your search criteria or filters to find more matches'
                        : 'No study partners available at the moment. Try searching with different criteria or check back later.'}
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
            </div>
          </div>
        </div>
      </main>

      {/* Profile View Modal */}
      {viewingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
              <button
                onClick={() => setViewingProfile(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {/* Profile Header */}
              <div className="flex items-start gap-6 mb-6">
                {viewingProfile.user.avatarUrl ? (
                  <img
                    src={viewingProfile.user.avatarUrl}
                    alt={viewingProfile.user.name}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-3xl">
                    {viewingProfile.user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{viewingProfile.user.name}</h3>
                  {viewingProfile.matchScore && viewingProfile.matchScore > 0 && (
                    <div className="mb-2">
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full font-medium">
                        {viewingProfile.matchScore}% Match
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2 text-sm text-gray-600">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {viewingProfile.skillLevel.charAt(0) + viewingProfile.skillLevel.slice(1).toLowerCase()}
                    </span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                      {viewingProfile.studyStyle.charAt(0) + viewingProfile.studyStyle.slice(1).toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bio */}
              {viewingProfile.bio && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">About</h4>
                  <p className="text-gray-700">{viewingProfile.bio}</p>
                </div>
              )}

              {/* About Yourself */}
              {(viewingProfile.aboutYourself || (viewingProfile.aboutYourselfItems && viewingProfile.aboutYourselfItems.length > 0)) && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">More About Me</h4>
                  {viewingProfile.aboutYourself && (
                    <p className="text-gray-700 mb-3">{viewingProfile.aboutYourself}</p>
                  )}
                  {viewingProfile.aboutYourselfItems && viewingProfile.aboutYourselfItems.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {viewingProfile.aboutYourselfItems.map((item, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-purple-50 text-purple-700 text-sm rounded-lg">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Subjects */}
              {viewingProfile.subjects.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Subjects</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingProfile.subjects.map((subject, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-lg">
                        {subject}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Interests */}
              {viewingProfile.interests.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingProfile.interests.map((interest, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-lg">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Goals */}
              {viewingProfile.goals.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Goals</h4>
                  <ul className="space-y-2">
                    {viewingProfile.goals.map((goal, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700">
                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {goal}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Availability */}
              {viewingProfile.availableDays.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Availability</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingProfile.availableDays.map((day, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm rounded-lg">
                        {day}
                      </span>
                    ))}
                  </div>
                  {viewingProfile.availableHours.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {viewingProfile.availableHours.map((hour, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg">
                          {hour}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Match Reasons */}
              {viewingProfile.matchReasons && viewingProfile.matchReasons.length > 0 && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                  <h4 className="text-sm font-semibold text-green-900 mb-2">Why you match</h4>
                  <ul className="space-y-1">
                    {viewingProfile.matchReasons.map((reason, idx) => (
                      <li key={idx} className="text-sm text-green-700 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setViewingProfile(null)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                >
                  Close
                </button>
                {viewingProfile.isAlreadyPartner ? (
                  <div className="flex-1 px-4 py-3 bg-green-100 text-green-700 rounded-lg font-medium flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Already Partners
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const partnerId = viewingProfile.user.id
                      setViewingProfile(null)
                      handleConnect(partnerId)
                    }}
                    disabled={sendingRequest === viewingProfile.user.id}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingRequest === viewingProfile.user.id ? 'Sending...' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
