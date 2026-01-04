'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

// Dynamically import Apollo components to defer loading Apollo Client
// This reduces initial bundle size by ~100KB
const ApolloProviderWrapper = dynamic(
  () => import('@/lib/apollo-provider').then(mod => ({ default: mod.ApolloProviderWrapper })),
  { ssr: false }
)

const GraphQLExample = dynamic(
  () => import('@/components/examples/GraphQLExample'),
  {
    loading: () => (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
          <p className="text-gray-600">Loading GraphQL client...</p>
        </div>
      </div>
    ),
    ssr: false
  }
)

export default function GraphQLDemoPage() {
  const [sessionId, setSessionId] = useState('')
  const [showDemo, setShowDemo] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (sessionId.trim()) {
      setShowDemo(true)
    }
  }

  return (
    <ApolloProviderWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-blue-50 dark:to-blue-50 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-900 mb-4">
              GraphQL Demo 🚀
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-600 mb-2">
              Your app now supports GraphQL alongside REST API
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              This is a proof of concept - both REST and GraphQL work side by side
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white dark:bg-white/5 p-6 rounded-lg shadow-lg dark:shadow-none border border-gray-200 dark:border-white/10">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Efficient Queries</h3>
              <p className="text-gray-600 dark:text-slate-300 text-sm">
                Fetch only the data you need. Perfect for mobile apps with limited bandwidth.
              </p>
            </div>
            <div className="bg-white dark:bg-white/5 p-6 rounded-lg shadow-lg dark:shadow-none border border-gray-200 dark:border-white/10">
              <div className="text-3xl mb-3">📱</div>
              <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Mobile Ready</h3>
              <p className="text-gray-600 dark:text-slate-300 text-sm">
                One API endpoint for web, iOS, and Android. Same backend, different data shapes.
              </p>
            </div>
            <div className="bg-white dark:bg-white/5 p-6 rounded-lg shadow-lg dark:shadow-none border border-gray-200 dark:border-white/10">
              <div className="text-3xl mb-3">🔄</div>
              <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Hybrid Approach</h3>
              <p className="text-gray-600 dark:text-slate-300 text-sm">
                REST API still works. Migrate endpoints gradually at your own pace.
              </p>
            </div>
          </div>

          {/* Demo Section */}
          {!showDemo ? (
            <div className="bg-white dark:bg-white/5 p-8 rounded-lg shadow-lg dark:shadow-none border border-gray-200 dark:border-white/10 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Try GraphQL Query</h2>
              <p className="text-gray-600 dark:text-slate-300 mb-6">
                Enter a study session ID to see GraphQL in action. The component will fetch
                session data using GraphQL queries and mutations.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                    Study Session ID
                  </label>
                  <input
                    type="text"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="Enter session ID (e.g., from /study-sessions page)"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-white/5 text-gray-900 dark:text-white"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                    💡 Tip: Go to <Link href="/study-sessions" className="text-blue-600 hover:underline">Study Sessions</Link>,
                    join a session, and copy the ID from the URL
                  </p>
                </div>
                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
                >
                  Load Session with GraphQL
                </button>
              </form>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setShowDemo(false)}
                className="mb-4 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                ← Back to input
              </button>
              <GraphQLExample sessionId={sessionId} />
            </div>
          )}

          {/* API Endpoint Info */}
          <div className="mt-12 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-8 rounded-lg border border-gray-200 dark:border-white/10 shadow-lg dark:shadow-none">
            <h3 className="text-xl font-bold mb-4">GraphQL Endpoint</h3>
            <div className="space-y-4">
              <div>
                <span className="text-blue-600 dark:text-blue-400 font-mono">POST</span>
                <span className="ml-3 font-mono">/api/graphql</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto border border-gray-200 dark:border-white/10">
                <pre className="text-sm text-green-600 dark:text-green-400">{`# Example Query
query GetStudySession($sessionId: String!) {
  getStudySession(sessionId: $sessionId) {
    id
    title
    participants {
      user {
        name
      }
    }
  }
}`}</pre>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto border border-gray-200 dark:border-white/10">
                <pre className="text-sm text-blue-600 dark:text-blue-400">{`# Example Mutation
mutation SendMessage($sessionId: String!, $content: String!) {
  sendMessage(sessionId: $sessionId, content: $content) {
    id
    content
    sender {
      name
    }
  }
}`}</pre>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="mt-12 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 p-6 rounded-lg">
            <h3 className="font-bold text-lg mb-3 text-blue-900 dark:text-blue-300">✅ What's Been Set Up:</h3>
            <ul className="space-y-2 text-blue-800 dark:text-blue-200">
              <li>✓ GraphQL server running at <code className="bg-blue-100 dark:bg-blue-800/50 px-2 py-1 rounded">/api/graphql</code></li>
              <li>✓ Apollo Client configured for frontend</li>
              <li>✓ Schema with Study Sessions, Messages, Users</li>
              <li>✓ Queries: getStudySession, getMyStudySessions</li>
              <li>✓ Mutations: sendMessage, createStudySession</li>
              <li>✓ All REST APIs still working normally</li>
            </ul>

            <h3 className="font-bold text-lg mt-6 mb-3 text-blue-900 dark:text-blue-300">🚀 Next Steps:</h3>
            <ul className="space-y-2 text-blue-800 dark:text-blue-200">
              <li>1. Try this demo with a real session ID</li>
              <li>2. Gradually migrate REST endpoints to GraphQL (1-2 per week)</li>
              <li>3. When building mobile app, use GraphQL from day 1</li>
              <li>4. Eventually deprecate REST once everything is migrated</li>
            </ul>
          </div>
        </div>
      </div>
    </ApolloProviderWrapper>
  )
}
