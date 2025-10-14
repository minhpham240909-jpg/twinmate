'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AICoachPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI Study Coach. I can help you with:\n\n• Creating personalized study plans\n• Generating practice quizzes\n• Explaining difficult concepts\n• Tracking your progress\n• Motivating you to reach your goals\n\nHow can I assist you today?'
    }
  ])

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

  const handleSendMessage = () => {
    if (!message.trim()) return

    // Add user message
    const newMessages = [...messages, { role: 'user' as const, content: message }]
    setMessages(newMessages)
    setMessage('')

    // Simulate AI response
    setTimeout(() => {
      setMessages([
        ...newMessages,
        {
          role: 'assistant' as const,
          content: 'I understand you need help with that! However, the AI Study Coach is still in development. Once connected to OpenAI/Anthropic API, I\'ll be able to provide personalized study assistance, generate quizzes, and help you achieve your learning goals.'
        }
      ])
    }, 1000)
  }

  const quickActions = [
    { icon: '📝', title: 'Create Study Plan', desc: 'Get a personalized learning roadmap' },
    { icon: '❓', title: 'Generate Quiz', desc: 'Test your knowledge' },
    { icon: '💡', title: 'Explain Concept', desc: 'Break down difficult topics' },
    { icon: '📊', title: 'Track Progress', desc: 'See your learning journey' },
  ]

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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xl">
                🤖
              </div>
              <div>
                <h1 className="text-2xl font-bold text-blue-600">AI Study Coach</h1>
                <p className="text-xs text-gray-600">Powered by AI</p>
              </div>
            </div>
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
        <div className="max-w-4xl mx-auto">
          {/* Quick Actions */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => setMessage(action.title)}
                className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition text-left"
              >
                <div className="text-3xl mb-2">{action.icon}</div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{action.title}</h3>
                <p className="text-xs text-gray-600">{action.desc}</p>
              </button>
            ))}
          </div>

          {/* Chat Container */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 350px)' }}>
            {/* Messages */}
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white text-sm mr-3 flex-shrink-0 mt-1">
                        🤖
                      </div>
                    )}
                    <div
                      className={`max-w-2xl rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm ml-3 flex-shrink-0 mt-1">
                        {user.email?.[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask me anything about your studies..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 AI integration coming soon. This is a preview of the interface.
                </p>
              </div>
            </div>
          </div>

          {/* Features Info */}
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
              <h3 className="font-semibold text-blue-900 mb-2 text-sm">📚 Smart Study Plans</h3>
              <p className="text-xs text-blue-700">AI-generated roadmaps tailored to your goals and learning style</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl">
              <h3 className="font-semibold text-purple-900 mb-2 text-sm">🎯 Practice Quizzes</h3>
              <p className="text-xs text-purple-700">Auto-generated questions to reinforce your learning</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl">
              <h3 className="font-semibold text-green-900 mb-2 text-sm">📈 Progress Tracking</h3>
              <p className="text-xs text-green-700">Insights and analytics on your learning journey</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
