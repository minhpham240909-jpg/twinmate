'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function SearchPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<string>('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

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

  const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'History', 'Literature', 'Languages']
  const skillLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
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
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-6 sticky top-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>

                {/* Search Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Name, interest, goal..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Subjects */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subjects
                  </label>
                  <div className="space-y-2">
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
                </div>

                {/* Skill Level */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skill Level
                  </label>
                  <select
                    value={selectedSkillLevel}
                    onChange={(e) => setSelectedSkillLevel(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Levels</option>
                    {skillLevels.map((level) => (
                      <option key={level} value={level}>
                        {level.charAt(0) + level.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
                  Apply Filters
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Available Study Partners
                </h2>
                <p className="text-sm text-gray-600">
                  Connect with learners who share your interests and goals
                </p>
              </div>

              {/* Sample Partner Cards */}
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                        SP
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Sample Partner</h3>
                        <p className="text-sm text-gray-600 mb-2">INTERMEDIATE level</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            Mathematics
                          </span>
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                            Physics
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          Looking for study partners to prepare for calculus exam. Available evenings and weekends.
                        </p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
                      Connect
                    </button>
                  </div>
                </div>

                {/* Empty State */}
                <div className="bg-gray-50 rounded-xl p-12 text-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No partners found yet
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Be the first to complete your profile and start connecting with other learners!
                  </p>
                  <button
                    onClick={() => router.push('/profile')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                  >
                    Complete Your Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
