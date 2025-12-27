'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'
import GlowBorderOptimized from '@/components/ui/GlowBorderOptimized'
import PulseOptimized from '@/components/ui/PulseOptimized'
import FadeInOptimized from '@/components/ui/FadeInOptimized'
import BounceOptimized from '@/components/ui/BounceOptimized'
import { AIPartnerSuggestionModal } from '@/components/ai-partner'

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
  skillLevel: string | null
  studyStyle: string | null
  availableDays: string[]
  availableHours: string[]
  aboutYourself?: string | null
  aboutYourselfItems?: string[]
  matchScore?: number | null  // null means insufficient data
  matchReasons?: string[]
  matchDataInsufficient?: boolean  // Flag indicating insufficient profile data
  partnerProfileComplete?: boolean  // Whether partner has enough profile data
  isAlreadyPartner?: boolean // Flag from backend if ACCEPTED connection exists
}

// Helper function to format skill level for display
function formatSkillLevel(skillLevel: string | null | undefined): string {
  if (!skillLevel || skillLevel.trim() === '') return ''
  return skillLevel.charAt(0).toUpperCase() + skillLevel.slice(1).toLowerCase()
}

// Helper function to format study style for display
function formatStudyStyle(studyStyle: string | null | undefined): string {
  if (!studyStyle || studyStyle.trim() === '') return ''
  return studyStyle.charAt(0).toUpperCase() + studyStyle.slice(1).toLowerCase().replace('_', ' ')
}

export default function SearchPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('search')
  const tCommon = useTranslations('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([])
  const [availableHoursFilter, setAvailableHoursFilter] = useState('')
  const [showSubjectDescription, setShowSubjectDescription] = useState(false)
  const [showSkillLevelDescription, setShowSkillLevelDescription] = useState(false)
  const [showStudyStyleDescription, setShowStudyStyleDescription] = useState(false)
  const [showInterestsDescription, setShowInterestsDescription] = useState(false)
  const [showAvailabilityDescription, setShowAvailabilityDescription] = useState(false)
  const [skillLevelCustomDescription, setSkillLevelCustomDescription] = useState('')
  const [studyStyleCustomDescription, setStudyStyleCustomDescription] = useState('')
  const [interestsCustomDescription, setInterestsCustomDescription] = useState('')
  // NEW: School and Languages filters
  const [schoolFilter, setSchoolFilter] = useState('')
  const [languagesFilter, setLanguagesFilter] = useState('')
  // NEW: Age Range, Role, and Goals filters
  const [selectedAgeRange, setSelectedAgeRange] = useState<string>('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [showGoalsDescription, setShowGoalsDescription] = useState(false)
  const [showRoleDescription, setShowRoleDescription] = useState(false)
  const [showAgeDescription, setShowAgeDescription] = useState(false)
  // NEW: Location filters
  const [locationCity, setLocationCity] = useState('')
  const [locationState, setLocationState] = useState('')
  const [locationCountry, setLocationCountry] = useState('')
  const [showLocationDescription, setShowLocationDescription] = useState(false)
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
  const [isLoadingRandom, setIsLoadingRandom] = useState(true)
  const [randomError, setRandomError] = useState('')
  const [currentUserProfileComplete, setCurrentUserProfileComplete] = useState(true)
  const [currentUserMissingFields, setCurrentUserMissingFields] = useState<string[]>([])

  // AI Partner suggestion modal state
  const [showAIPartnerModal, setShowAIPartnerModal] = useState(false)
  const [aiPartnerNoResultsReason, setAiPartnerNoResultsReason] = useState<'no_match' | 'name_not_found' | 'no_partners'>('no_match')
  const [lastSearchWasFiltered, setLastSearchWasFiltered] = useState(false)
  const [shouldAutoSearch, setShouldAutoSearch] = useState(false) // Trigger auto-search after pre-filling from AI Partner

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
          searchType: 'full', // Search all fields including location
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

  // Function to load random partners with error handling
  const loadRandomPartners = useCallback(async () => {
    setIsLoadingRandom(true)
    setRandomError('')
    setSearchError('') // Clear search errors when loading random

    try {
      const response = await fetch('/api/partners/random')

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load random partners')
      }

      const data = await response.json()
      setPartners(data.partners || [])
      
      // Update profile completeness info from API response
      if (data.currentUserProfileComplete !== undefined) {
        setCurrentUserProfileComplete(data.currentUserProfileComplete)
      }
      if (data.currentUserMissingFields) {
        setCurrentUserMissingFields(data.currentUserMissingFields)
      }

      // Set error only if no partners found
      if (!data.partners || data.partners.length === 0) {
        setRandomError('No partners available at the moment. Try again later.')
      }
    } catch (error) {
      console.error('Error loading random partners:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to load random partners. Please try again.'
      setRandomError(errorMessage)
      setPartners([]) // Clear partners on error
    } finally {
      setIsLoadingRandom(false)
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

  // Refresh data when user returns to the page (e.g., after editing profile)
  // This ensures the "Complete Profile" banner disappears after user completes their profile
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user && !loading) {
        loadRandomPartners()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user, loading, loadRandomPartners])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  // Read URL params to pre-fill filters (e.g., coming from AI Partner notification "View All")
  useEffect(() => {
    if (!searchParams) return

    const fromAIPartner = searchParams.get('fromAIPartner')
    if (!fromAIPartner) return // Only pre-fill if coming from AI Partner

    // Pre-fill subjects
    const subjects = searchParams.get('subjects')
    if (subjects) {
      setSelectedSubjects(subjects.split(',').filter(Boolean))
    }

    // Pre-fill skill level
    const skillLevel = searchParams.get('skillLevel')
    if (skillLevel) {
      setSkillLevelCustomDescription(skillLevel)
    }

    // Pre-fill study style
    const studyStyle = searchParams.get('studyStyle')
    if (studyStyle) {
      setStudyStyleCustomDescription(studyStyle)
    }

    // Pre-fill location
    const city = searchParams.get('locationCity')
    if (city) {
      setLocationCity(city)
    }
    const country = searchParams.get('locationCountry')
    if (country) {
      setLocationCountry(country)
    }

    // Pre-fill school
    const school = searchParams.get('school')
    if (school) {
      setSchoolFilter(school)
    }

    // Pre-fill interests
    const interests = searchParams.get('interests')
    if (interests) {
      setSelectedInterests(interests.split(',').filter(Boolean))
    }

    // Pre-fill goals
    const goals = searchParams.get('goals')
    if (goals) {
      setSelectedGoals(goals.split(',').filter(Boolean))
    }

    // Pre-fill role
    const role = searchParams.get('role')
    if (role) {
      setSelectedRoles(role.split(',').filter(Boolean))
    }

    // Show filters panel and show a toast
    setShowFilters(true)
    toast.success('Search filters pre-filled from your AI session', {
      icon: '🔍',
      duration: 3000,
    })

    // Trigger auto-search after state updates
    setShouldAutoSearch(true)

    // Clear the URL params after reading (prevents re-triggering on refresh)
    router.replace('/search', { scroll: false })
  }, [searchParams, router])

  // Auto-search when coming from AI Partner notification (after filters are pre-filled)
  useEffect(() => {
    if (shouldAutoSearch && !isSearching) {
      setShouldAutoSearch(false)
      // Small delay to ensure state updates have propagated
      const timer = setTimeout(() => {
        // Trigger the Find Partner search with pre-filled filters
        const searchButton = document.querySelector('[data-search-button]') as HTMLButtonElement
        if (searchButton) {
          searchButton.click()
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [shouldAutoSearch, isSearching])

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
      <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-slate-300">{tCommon('loading')}</p>
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
      skillLevelCustomDescription.trim() !== '' ||
      studyStyleCustomDescription.trim() !== '' ||
      selectedInterests.length > 0 ||
      selectedAvailability.length > 0 ||
      availableHoursFilter.trim() !== '' ||
      interestsCustomDescription.trim() !== '' ||
      schoolFilter.trim() !== '' ||
      languagesFilter.trim() !== '' ||
      selectedAgeRange !== '' ||
      selectedRoles.length > 0 ||
      selectedGoals.length > 0 ||
      locationCity.trim() !== '' ||
      locationState.trim() !== '' ||
      locationCountry.trim() !== ''

    if (!hasFilters) {
      setSearchError("Let's add some information to find your partner!")
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
          skillLevelCustomDescription,
          studyStyleCustomDescription,
          interests: selectedInterests,
          availability: selectedAvailability,
          availableHours: availableHoursFilter,
          interestsCustomDescription,
          school: schoolFilter,
          languages: languagesFilter,
          ageRange: selectedAgeRange,
          role: selectedRoles,
          goals: selectedGoals,
          locationCity,
          locationState,
          locationCountry,
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
  const interests = ['Group Study', 'One-on-One', 'Video Calls', 'Text Chat', 'Problem Solving', 'Project-Based', 'Exam Prep', 'Research']
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const ageRanges = [
    { value: 'under-18', label: 'Under 18' },
    { value: '18-24', label: '18-24 (College)' },
    { value: '25-34', label: '25-34 (Young Professional)' },
    { value: '35-44', label: '35-44 (Mid-Career)' },
    { value: '45+', label: '45+ (Mature Learner)' }
  ]
  const roles = ['Student', 'Teacher', 'Professional', 'Self-Learner', 'Other']
  const allGoals = ['Pass Exam', 'Learn New Skill', 'Career Change', 'Academic Research', 'Personal Growth', 'Certification']

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

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  const toggleGoal = (goal: string) => {
    setSelectedGoals(prev =>
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="bg-gray-50 dark:bg-slate-800/50 backdrop-blur-xl shadow-lg border-b border-gray-200 dark:border-slate-700/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{t('title')}</h1>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-700/50 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600/50 rounded-lg transition flex items-center gap-2 backdrop-blur-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {showFilters ? t('hideFilters') : t('showFilters')}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Independent Search Bar - Above Filters */}
          <div className="mb-6">
            <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg dark:shadow-none p-6 border border-gray-200 dark:border-slate-700/50">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Search</h2>
                <p className="text-sm text-gray-700 dark:text-slate-300">Search by name, location, interests, subjects, or any profile field</p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full px-4 py-3 pl-12 bg-gray-50 dark:bg-slate-900/50 border border-gray-300 dark:border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400 backdrop-blur-sm"
                />
                <svg
                  className="w-5 h-5 text-gray-500 dark:text-slate-400 absolute left-4 top-1/2 transform -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {isSearching && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center mb-6">
            <div className="flex-1 border-t border-gray-200 dark:border-slate-700/50"></div>
            <span className="px-4 text-sm text-gray-600 dark:text-slate-400 font-medium">OR</span>
            <div className="flex-1 border-t border-gray-200 dark:border-slate-700/50"></div>
          </div>

          <div className={`grid gap-6 ${showFilters ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
            {/* Filters Sidebar */}
            {showFilters && (
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg dark:shadow-none p-6 sticky top-4 border border-gray-200 dark:border-slate-700/50">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Advanced Filters</h2>

                {/* Subjects */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                      Subjects
                    </label>
                    <button
                      onClick={() => setShowSubjectDescription(!showSubjectDescription)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      {showSubjectDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showSubjectDescription && (
                    <p className="text-xs text-gray-700 dark:text-slate-300 mb-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
                      Filter partners by the subjects they&apos;re studying. Select multiple subjects to find partners interested in similar topics.
                    </p>
                  )}
                  <div className="space-y-2">
                    {subjects.map((subject) => (
                      <label key={subject} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedSubjects.includes(subject)}
                          onChange={() => toggleSubject(subject)}
                          className="w-4 h-4 text-blue-500 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500 focus:ring-offset-white dark:focus:ring-offset-slate-800"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-slate-300">{subject}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Skill Level */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                      Skill Level
                    </label>
                    <button
                      onClick={() => setShowSkillLevelDescription(!showSkillLevelDescription)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      {showSkillLevelDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showSkillLevelDescription && (
                    <p className="text-xs text-gray-700 dark:text-slate-300 mb-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
                      Describe the skill level you&apos;re looking for in a study partner. For example: &quot;beginner in calculus&quot;, &quot;intermediate Python&quot;, or &quot;advanced physics student&quot;.
                    </p>
                  )}
                  <textarea
                    value={skillLevelCustomDescription}
                    onChange={(e) => setSkillLevelCustomDescription(e.target.value)}
                    placeholder="e.g., Beginner in calculus, Intermediate Python programmer..."
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900/50 border border-gray-300 dark:border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400 backdrop-blur-sm"
                  />
                </div>

                {/* Study Style */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                      Study Style
                    </label>
                    <button
                      onClick={() => setShowStudyStyleDescription(!showStudyStyleDescription)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      {showStudyStyleDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showStudyStyleDescription && (
                    <p className="text-xs text-gray-700 dark:text-slate-300 mb-2 p-2 bg-purple-500/10 rounded border border-purple-500/20">
                      Describe your preferred study approach. For example: &quot;group discussions&quot;, &quot;quiet independent study&quot;, &quot;hands-on practice&quot;, or &quot;visual learning with diagrams&quot;.
                    </p>
                  )}
                  <textarea
                    value={studyStyleCustomDescription}
                    onChange={(e) => setStudyStyleCustomDescription(e.target.value)}
                    placeholder="e.g., Prefer group discussions, Visual learner, Hands-on practice..."
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900/50 border border-gray-300 dark:border-slate-600/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400 backdrop-blur-sm"
                  />
                </div>

                {/* Learning Interests */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                      Learning Interests
                    </label>
                    <button
                      onClick={() => setShowInterestsDescription(!showInterestsDescription)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      {showInterestsDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showInterestsDescription && (
                    <p className="text-xs text-gray-700 dark:text-slate-300 mb-2 p-2 bg-green-500/10 rounded border border-green-500/20">
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
                          className="w-4 h-4 text-green-500 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 rounded focus:ring-green-500 focus:ring-offset-white dark:focus:ring-offset-slate-800"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-slate-300">{interest}</span>
                      </label>
                    ))}
                  </div>
                  <textarea
                    value={interestsCustomDescription}
                    onChange={(e) => setInterestsCustomDescription(e.target.value)}
                    placeholder={t('interestsCustomDescPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900/50 border border-gray-300 dark:border-slate-600/50 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-xs text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400 backdrop-blur-sm"
                  />
                </div>

                {/* Availability */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                      Availability
                    </label>
                    <button
                      onClick={() => setShowAvailabilityDescription(!showAvailabilityDescription)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      {showAvailabilityDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showAvailabilityDescription && (
                    <p className="text-xs text-gray-700 dark:text-slate-300 mb-2 p-2 bg-indigo-500/10 rounded border border-indigo-500/20">
                      Filter partners by the days they&apos;re available to study. Select the days that work best for you to find partners with matching schedules.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {daysOfWeek.map((day) => (
                      <label key={day} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedAvailability.includes(day)}
                          onChange={() => toggleAvailability(day)}
                          className="w-4 h-4 text-indigo-500 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 rounded focus:ring-indigo-500 focus:ring-offset-white dark:focus:ring-offset-slate-800"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-slate-300">{day.slice(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={availableHoursFilter}
                    onChange={(e) => setAvailableHoursFilter(e.target.value)}
                    placeholder="e.g., Morning, Evening, 9am-5pm"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900/50 border border-gray-300 dark:border-slate-600/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400 backdrop-blur-sm"
                  />
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">Filter by preferred study hours</p>
                </div>

                {/* School Filter */}
                <div className="mb-4 pb-4 border-b border-gray-200 dark:border-slate-700/50">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                    School/University
                  </label>
                  <textarea
                    value={schoolFilter}
                    onChange={(e) => setSchoolFilter(e.target.value)}
                    placeholder={t('schoolPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900/50 border border-gray-300 dark:border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400 backdrop-blur-sm"
                  />
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">Find partners from the same school</p>
                </div>

                {/* Languages Filter */}
                <div className="mb-4 pb-4 border-b border-gray-200 dark:border-slate-700/50">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                    {t('languages')}
                  </label>
                  <textarea
                    value={languagesFilter}
                    onChange={(e) => setLanguagesFilter(e.target.value)}
                    placeholder={t('languagesPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900/50 border border-gray-300 dark:border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400 backdrop-blur-sm"
                  />
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">Find partners who speak these languages</p>
                </div>

                {/* Goals Filter - NEW */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                      Learning Goals
                    </label>
                    <button
                      onClick={() => setShowGoalsDescription(!showGoalsDescription)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      {showGoalsDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showGoalsDescription && (
                    <p className="text-xs text-gray-700 dark:text-slate-300 mb-2 p-2 bg-orange-500/10 rounded border border-orange-500/20">
                      Find partners with aligned learning goals. Select goals that match your objectives to find motivated study partners.
                    </p>
                  )}
                  <div className="space-y-2">
                    {allGoals.map((goal) => (
                      <label key={goal} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedGoals.includes(goal)}
                          onChange={() => toggleGoal(goal)}
                          className="w-4 h-4 text-orange-500 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 rounded focus:ring-orange-500 focus:ring-offset-white dark:focus:ring-offset-slate-800"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-slate-300">{goal}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Age Range Filter - NEW */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                      Age Range
                    </label>
                    <button
                      onClick={() => setShowAgeDescription(!showAgeDescription)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      {showAgeDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showAgeDescription && (
                    <p className="text-xs text-gray-700 dark:text-slate-300 mb-2 p-2 bg-teal-500/10 rounded border border-teal-500/20">
                      Filter by age group to find partners in similar life stages. Choose an age range that fits your preference.
                    </p>
                  )}
                  <select
                    value={selectedAgeRange}
                    onChange={(e) => setSelectedAgeRange(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-900/50 border border-gray-300 dark:border-slate-600/50 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white backdrop-blur-sm"
                  >
                    <option value="">All Ages</option>
                    {ageRanges.map((range) => (
                      <option key={range.value} value={range.value}>
                        {range.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role Filter - NEW */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                      Role
                    </label>
                    <button
                      onClick={() => setShowRoleDescription(!showRoleDescription)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      {showRoleDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showRoleDescription && (
                    <p className="text-xs text-gray-700 dark:text-slate-300 mb-2 p-2 bg-pink-500/10 rounded border border-pink-500/20">
                      Find partners with similar roles. Students can connect with other students, teachers with educators, etc.
                    </p>
                  )}
                  <div className="space-y-2">
                    {roles.map((role) => (
                      <label key={role} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(role)}
                          onChange={() => toggleRole(role)}
                          className="w-4 h-4 text-pink-500 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 rounded focus:ring-pink-500 focus:ring-offset-white dark:focus:ring-offset-slate-800"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-slate-300">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Location Filter - NEW */}
                <div className="mb-6 pb-6 border-b border-gray-200 dark:border-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                      Location
                    </label>
                    <button
                      onClick={() => setShowLocationDescription(!showLocationDescription)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      {showLocationDescription ? t('hideInfo') : t('showInfo')}
                    </button>
                  </div>
                  {showLocationDescription && (
                    <p className="text-xs text-gray-700 dark:text-slate-300 mb-3 p-2 bg-cyan-500/10 rounded border border-cyan-500/20">
                      Find study partners in your city, state, or country. Great for finding local partners or those in similar time zones.
                    </p>
                  )}
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={locationCity}
                      onChange={(e) => setLocationCity(e.target.value)}
                      placeholder="City (e.g., Boston, London, Tokyo)"
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-900/50 border border-gray-300 dark:border-slate-600/50 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400 backdrop-blur-sm"
                    />
                    <input
                      type="text"
                      value={locationState}
                      onChange={(e) => setLocationState(e.target.value)}
                      placeholder="State/Province (e.g., California, Ontario)"
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-900/50 border border-gray-300 dark:border-slate-600/50 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400 backdrop-blur-sm"
                    />
                    <input
                      type="text"
                      value={locationCountry}
                      onChange={(e) => setLocationCountry(e.target.value)}
                      placeholder="Country (e.g., USA, Canada, UK)"
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-900/50 border border-gray-300 dark:border-slate-600/50 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400 backdrop-blur-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-2">Filter by city, state, or country to find nearby study partners</p>
                </div>

                <button
                  onClick={handleFindPartner}
                  disabled={isSearching}
                  data-search-button
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isSearching ? t('searching') : t('searchPartners')}
                </button>
              </div>
            </div>
            )}

            {/* Results */}
            <div className={showFilters ? 'lg:col-span-2' : 'lg:col-span-1'}>
              <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg dark:shadow-none p-6 mb-6 border border-gray-200 dark:border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('availableStudyPartners')} {partners.length > 0 && `(${partners.length})`}
                  </h2>
                  <button
                    onClick={loadRandomPartners}
                    disabled={isLoadingRandom}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                    title={t('loadNewRandomPartners')}
                  >
                    <svg className={`w-4 h-4 ${isLoadingRandom ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isLoadingRandom ? 'Loading...' : t('refresh')}
                  </button>
                </div>
                <p className="text-sm text-gray-700 dark:text-slate-300">
                  {t('connectWithLearners')}
                </p>
              </div>

              {/* Profile Incomplete Banner - Simple version */}
              {!currentUserProfileComplete && (
                <BounceOptimized delay={0.1}>
                  <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">🎯</div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-1">{t('readyToStartJourney')}</h4>
                        <p className="text-sm text-gray-700 dark:text-slate-300">{t('connectWithPartners')}</p>
                      </div>
                      <button
                        onClick={() => router.push('/profile/edit')}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition whitespace-nowrap"
                      >
                        {t('completeProfile')}
                      </button>
                    </div>
                  </div>
                </BounceOptimized>
              )}

              {/* Error Messages */}
              {searchError && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 mb-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-700 dark:text-red-300">{searchError}</p>
                  </div>
                </div>
              )}

              {randomError && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 mb-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-700 dark:text-red-300">{randomError}</p>
                    </div>
                    <button
                      onClick={loadRandomPartners}
                      disabled={isLoadingRandom}
                      className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {isLoadingRandom ? 'Retrying...' : 'Retry'}
                    </button>
                  </div>
                </div>
              )}

              {/* Partner Cards */}
              {(
              <FadeInOptimized delay={0.1}>
                <div className="space-y-4">
                  {/* Show loading state when initially loading */}
                  {isLoadingRandom && partners.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-xl p-12 text-center border border-gray-200 dark:border-slate-700/50">
                      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Loading Partners...
                      </h3>
                      <p className="text-gray-700 dark:text-slate-300">
                        Finding study partners for you
                      </p>
                    </div>
                  ) : partners.length > 0 ? (
                    partners.map((partner, index) => {
                      // Check if partner has real profile data
                      // Profile is considered "real" only if they have filled in core fields (subjects or interests)
                      const hasRealProfileData = !partner.matchDataInsufficient && partner.partnerProfileComplete !== false
                      const hasRealMatchScore = partner.matchScore !== null && partner.matchScore !== undefined && !partner.matchDataInsufficient
                      const hasMatchReasons = partner.matchReasons && partner.matchReasons.length > 0 && !partner.matchDataInsufficient

                      // Format skill level and study style only if they exist AND profile has real data
                      // Don't show these labels for users who haven't actually filled their profile
                      const skillLevelDisplay = hasRealProfileData ? formatSkillLevel(partner.skillLevel) : ''
                      const studyStyleDisplay = hasRealProfileData ? formatStudyStyle(partner.studyStyle) : ''

                      // Build the info line (only show what's actually filled in)
                      const infoItems: string[] = []
                      if (skillLevelDisplay) infoItems.push(skillLevelDisplay)
                      if (studyStyleDisplay) infoItems.push(studyStyleDisplay)
                      
                      const cardContent = (
                        <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg dark:shadow-none p-6 hover:shadow-xl transition-all border border-gray-200 dark:border-slate-700/50">
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
                              <h3 className="font-semibold text-gray-900 dark:text-white">{partner.user.name}</h3>
                              {/* Only show match score if we have real data */}
                              {hasRealMatchScore && partner.matchScore! > 0 ? (
                                <PulseOptimized onlyWhenVisible={true}>
                                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium border border-green-500/30">
                                    {partner.matchScore}% Match
                                  </span>
                                </PulseOptimized>
                              ) : partner.matchDataInsufficient ? (
                                <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 text-xs rounded-full border border-gray-200 dark:border-slate-600/50">
                                  Profile incomplete
                                </span>
                              ) : null}
                            </div>
                            {/* Only show info line if we have real data */}
                            {infoItems.length > 0 && (
                              <p className="text-sm text-gray-700 dark:text-slate-300 mb-2">
                                {infoItems.join(' • ')}
                              </p>
                            )}
                            {partner.subjects && partner.subjects.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {partner.subjects.slice(0, 3).map((subject, idx) => (
                                  <span key={idx} className="px-3 py-1 bg-blue-500/20 text-blue-600 dark:text-blue-300 text-xs rounded-full hover:scale-105 transition-transform cursor-default border border-blue-500/30">
                                    {subject}
                                  </span>
                                ))}
                                {partner.subjects.length > 3 && (
                                  <span className="px-3 py-1 bg-gray-100 dark:bg-slate-700/50 text-gray-700 dark:text-slate-300 text-xs rounded-full border border-gray-200 dark:border-slate-600/50">
                                    +{partner.subjects.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Only show match reasons if we have real matching data */}
                            {hasMatchReasons && (
                              <p className="text-xs text-green-600 dark:text-green-400 mb-2">
                                ✓ {partner.matchReasons!.join(', ')}
                              </p>
                            )}
                            {partner.bio && (
                              <p className="text-sm text-gray-700 dark:text-slate-300 line-clamp-2">
                                {partner.bio}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push(`/profile/${partner.user.id}`)}
                            className="px-4 py-2 bg-gray-100 dark:bg-slate-700/50 text-gray-700 dark:text-slate-200 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600/50 hover:scale-105 transition-all whitespace-nowrap shadow-lg backdrop-blur-sm"
                          >
                            {t('viewProfile')}
                          </button>
                          {partner.isAlreadyPartner ? (
                            <PulseOptimized onlyWhenVisible={true}>
                              <div className="px-4 py-2 bg-green-500/20 text-green-400 text-sm rounded-lg font-medium whitespace-nowrap flex items-center gap-2 shadow-lg border border-green-500/30">
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
                              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 hover:scale-105 transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-lg font-medium"
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
                          {/* Only use GlowBorder on high match scores (>80) with real data */}
                          {hasRealMatchScore && partner.matchScore! > 80 ? (
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
                  <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-xl p-12 text-center border border-gray-200 dark:border-slate-700/50">
                    {/* AI Partner Suggestion - Dynamic personalized message */}
                    <div className="mb-8 p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>

                      {/* Dynamic personalized message based on ALL search criteria including custom descriptions */}
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {searchQuery
                          ? `${searchQuery} isn't available right now`
                          : selectedSubjects.length > 0
                          ? `${selectedSubjects.slice(0, 2).join(', ')}${selectedSubjects.length > 2 ? ' & more' : ''} partners aren't available right now`
                          : skillLevelCustomDescription.trim()
                          ? `Partners matching "${skillLevelCustomDescription.trim().slice(0, 30)}${skillLevelCustomDescription.trim().length > 30 ? '...' : ''}" aren't available`
                          : studyStyleCustomDescription.trim()
                          ? `Partners with "${studyStyleCustomDescription.trim().slice(0, 30)}${studyStyleCustomDescription.trim().length > 30 ? '...' : ''}" style aren't available`
                          : selectedInterests.length > 0
                          ? `Partners interested in ${selectedInterests.slice(0, 2).join(' & ')} aren't available`
                          : interestsCustomDescription.trim()
                          ? `Partners interested in ${interestsCustomDescription.trim().slice(0, 30)}${interestsCustomDescription.trim().length > 30 ? '...' : ''} aren't available`
                          : selectedGoals.length > 0
                          ? `Partners with ${selectedGoals.slice(0, 2).join(' & ')} goals aren't available`
                          : selectedRoles.length > 0
                          ? `${selectedRoles.join(' / ')} partners aren't available right now`
                          : selectedAgeRange
                          ? `Partners in the ${ageRanges.find(r => r.value === selectedAgeRange)?.label || selectedAgeRange} range aren't available`
                          : selectedAvailability.length > 0 || availableHoursFilter.trim()
                          ? `Partners available ${selectedAvailability.length > 0 ? 'on ' + selectedAvailability.slice(0, 2).join(' & ') : ''}${availableHoursFilter.trim() ? ' (' + availableHoursFilter.trim() + ')' : ''} aren't available`
                          : locationCity || locationState || locationCountry
                          ? `Partners in ${locationCity || locationState || locationCountry} aren't available right now`
                          : schoolFilter
                          ? `Partners from ${schoolFilter} aren't available right now`
                          : languagesFilter
                          ? `Partners who speak ${languagesFilter} aren't available right now`
                          : 'No matching partners found'}
                      </h3>

                      <p className="text-base text-gray-600 dark:text-slate-300 mb-4">
                        {searchQuery
                          ? `But I can be your study partner! I'll adapt to help you with what you're looking for.`
                          : selectedSubjects.length > 0
                          ? `But I can be your ${selectedSubjects[0]} study partner! Let's learn together.`
                          : skillLevelCustomDescription.trim()
                          ? `But I can match your skill needs! Let's study together.`
                          : studyStyleCustomDescription.trim()
                          ? `But I can adapt to your study style! Let's learn together.`
                          : selectedInterests.length > 0
                          ? `But I can help you with ${selectedInterests[0].toLowerCase()}! Let's study together.`
                          : interestsCustomDescription.trim()
                          ? `But I share your interests! Let's study together.`
                          : selectedGoals.length > 0
                          ? `But I can help you achieve your ${selectedGoals[0].toLowerCase()} goal! Let's work together.`
                          : selectedRoles.length > 0
                          ? `But I can be your AI study buddy for ${selectedRoles[0].toLowerCase()}s! Let's learn together.`
                          : selectedAgeRange
                          ? `But I can relate to your learning journey! Let's study together.`
                          : selectedAvailability.length > 0 || availableHoursFilter.trim()
                          ? `But I'm always available whenever you need! Let's study together.`
                          : locationCity || locationState || locationCountry
                          ? `But I can be your virtual study partner from anywhere! Let's connect.`
                          : schoolFilter
                          ? `But I can help you study as if we were classmates! Let's learn together.`
                          : languagesFilter
                          ? `But I can communicate in multiple languages! Let's study together.`
                          : "But I can be your AI study partner! I'm always available to help you learn."}
                      </p>

                      {/* Show ALL active filter tags including custom descriptions */}
                      {(selectedSubjects.length > 0 || skillLevelCustomDescription.trim() ||
                        studyStyleCustomDescription.trim() || selectedInterests.length > 0 || interestsCustomDescription.trim() ||
                        selectedGoals.length > 0 || selectedRoles.length > 0 || selectedAgeRange || selectedAvailability.length > 0 || availableHoursFilter.trim() ||
                        locationCity || locationState || locationCountry || schoolFilter || languagesFilter || searchQuery) && (
                        <div className="flex flex-wrap justify-center gap-2 mb-4">
                          {/* Search Query */}
                          {searchQuery && (
                            <span className="px-3 py-1 bg-slate-500/20 text-slate-400 text-xs rounded-full border border-slate-500/30">
                              Search: {searchQuery.length > 20 ? searchQuery.slice(0, 20) + '...' : searchQuery}
                            </span>
                          )}
                          {/* Subjects */}
                          {selectedSubjects.slice(0, 3).map((subject, idx) => (
                            <span key={`subj-${idx}`} className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
                              {subject}
                            </span>
                          ))}
                          {selectedSubjects.length > 3 && (
                            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
                              +{selectedSubjects.length - 3} more
                            </span>
                          )}
                          {/* Skill Level */}
                          {skillLevelCustomDescription.trim() && (
                            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full border border-purple-500/30">
                              {skillLevelCustomDescription.trim().length > 25 ? skillLevelCustomDescription.trim().slice(0, 25) + '...' : skillLevelCustomDescription.trim()}
                            </span>
                          )}
                          {/* Study Style */}
                          {studyStyleCustomDescription.trim() && (
                            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                              {studyStyleCustomDescription.trim().length > 25 ? studyStyleCustomDescription.trim().slice(0, 25) + '...' : studyStyleCustomDescription.trim()}
                            </span>
                          )}
                          {/* Interests */}
                          {selectedInterests.slice(0, 2).map((interest, idx) => (
                            <span key={`int-${idx}`} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full border border-emerald-500/30">
                              {interest}
                            </span>
                          ))}
                          {/* Interests Custom Description */}
                          {interestsCustomDescription.trim() && (
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full border border-emerald-500/30">
                              {interestsCustomDescription.trim().length > 25 ? interestsCustomDescription.trim().slice(0, 25) + '...' : interestsCustomDescription.trim()}
                            </span>
                          )}
                          {/* Goals */}
                          {selectedGoals.slice(0, 2).map((goal, idx) => (
                            <span key={`goal-${idx}`} className="px-3 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full border border-orange-500/30">
                              {goal}
                            </span>
                          ))}
                          {/* Roles */}
                          {selectedRoles.slice(0, 2).map((role, idx) => (
                            <span key={`role-${idx}`} className="px-3 py-1 bg-pink-500/20 text-pink-400 text-xs rounded-full border border-pink-500/30">
                              {role}
                            </span>
                          ))}
                          {/* Age Range */}
                          {selectedAgeRange && (
                            <span className="px-3 py-1 bg-teal-500/20 text-teal-400 text-xs rounded-full border border-teal-500/30">
                              {ageRanges.find(r => r.value === selectedAgeRange)?.label || selectedAgeRange}
                            </span>
                          )}
                          {/* Availability */}
                          {selectedAvailability.length > 0 && (
                            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 text-xs rounded-full border border-indigo-500/30">
                              {selectedAvailability.slice(0, 2).map(d => d.slice(0, 3)).join(', ')}{selectedAvailability.length > 2 ? '...' : ''}
                            </span>
                          )}
                          {/* Available Hours */}
                          {availableHoursFilter.trim() && (
                            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 text-xs rounded-full border border-indigo-500/30">
                              {availableHoursFilter.trim().length > 20 ? availableHoursFilter.trim().slice(0, 20) + '...' : availableHoursFilter.trim()}
                            </span>
                          )}
                          {/* Location */}
                          {(locationCity || locationState || locationCountry) && (
                            <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full border border-cyan-500/30">
                              {locationCity || locationState || locationCountry}
                            </span>
                          )}
                          {/* School */}
                          {schoolFilter && (
                            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full border border-amber-500/30">
                              {schoolFilter.length > 20 ? schoolFilter.slice(0, 20) + '...' : schoolFilter}
                            </span>
                          )}
                          {/* Languages */}
                          {languagesFilter && (
                            <span className="px-3 py-1 bg-rose-500/20 text-rose-400 text-xs rounded-full border border-rose-500/30">
                              {languagesFilter.length > 15 ? languagesFilter.slice(0, 15) + '...' : languagesFilter}
                            </span>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setLastSearchWasFiltered(true)
                          setAiPartnerNoResultsReason(searchQuery ? 'name_not_found' : 'no_partners')
                          setShowAIPartnerModal(true)
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg flex items-center gap-2 mx-auto"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Start Studying with AI Partner
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center mb-6">
                      <div className="flex-1 border-t border-gray-200 dark:border-slate-700/50"></div>
                      <span className="px-4 text-sm text-gray-500 dark:text-slate-400">or</span>
                      <div className="flex-1 border-t border-gray-200 dark:border-slate-700/50"></div>
                    </div>

                    <button
                      onClick={loadRandomPartners}
                      className="px-6 py-3 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition shadow-lg"
                    >
                      Load Random Partners
                    </button>
                  </div>
                )}
                </div>
              </FadeInOptimized>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* AI Partner Suggestion Modal */}
      <AIPartnerSuggestionModal
        isOpen={showAIPartnerModal}
        onClose={() => setShowAIPartnerModal(false)}
        searchCriteria={{
          subjects: selectedSubjects,
          school: schoolFilter || undefined,
          locationCity: locationCity || undefined,
          locationState: locationState || undefined,
          locationCountry: locationCountry || undefined,
          skillLevelDescription: skillLevelCustomDescription || undefined,
          studyStyleDescription: studyStyleCustomDescription || undefined,
          interests: selectedInterests,
          interestsDescription: interestsCustomDescription || undefined,
          goals: selectedGoals,
          availableDays: selectedAvailability,
          availableHours: availableHoursFilter || undefined,
          ageRange: selectedAgeRange || undefined,
          role: selectedRoles,
          languages: languagesFilter || undefined,
        }}
        searchQuery={searchQuery}
        noResultsReason={aiPartnerNoResultsReason}
      />
    </div>
  )
}
