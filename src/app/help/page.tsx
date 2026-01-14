'use client'

import { useState } from 'react'
import { Mail, Search, BookOpen, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const faqs = [
    {
      category: 'Getting Started',
      questions: [
        {
          q: 'How do I create an account?',
          a: 'Click the "Sign Up" button in the top right corner. Enter your email, create a password, and verify your email address to get started.',
        },
        {
          q: 'How do I find study partners?',
          a: 'Go to the "Find Partners" page and use filters to search for partners by subject, skill level, and availability. You can send connection requests to users you want to study with.',
        },
        {
          q: 'What is email verification and why do I need it?',
          a: 'Email verification confirms your account is legitimate. Some features like creating posts, sending messages, and joining sessions require a verified email. Check your inbox for the verification link after signing up.',
        },
      ],
    },
    {
      category: 'Study Sessions',
      questions: [
        {
          q: 'How do I start a study session?',
          a: 'Navigate to your partner\'s profile or group page and click "Start Session". You can enable video, audio, screen sharing, and whiteboard features during the session.',
        },
        {
          q: 'Can I join a session on mobile?',
          a: 'Yes! Clerva works on mobile browsers. However, for the best experience with video calls and screen sharing, we recommend using a desktop or laptop.',
        },
        {
          q: 'What happens if my connection drops during a session?',
          a: 'Don\'t worry! Your session data is automatically saved. If you reconnect within a few minutes, you\'ll be able to rejoin where you left off.',
        },
      ],
    },
    {
      category: 'Groups',
      questions: [
        {
          q: 'How do I create a study group?',
          a: 'Click "Create Group" from the Groups page. Fill in the group details including subject, description, and maximum members. You can invite specific users or make it public for anyone to join.',
        },
        {
          q: 'Can I join multiple groups?',
          a: 'Yes! You can join as many groups as you like. Manage your groups from your dashboard.',
        },
        {
          q: 'How do I leave a group?',
          a: 'Go to the group page and click the settings icon, then select "Leave Group". If you\'re the owner, you\'ll need to transfer ownership or delete the group first.',
        },
      ],
    },
    {
      category: 'Features',
      questions: [
        {
          q: 'How does the whiteboard work?',
          a: 'During a study session, click the whiteboard icon to enable it. You can draw, add text, shapes, and sticky notes. All participants can see and collaborate on the whiteboard in real-time.',
        },
        {
          q: 'Can I share my screen?',
          a: 'Yes! Click the screen share button during a video call. Your browser will ask for permission. Once granted, your study partners will see your screen.',
        },
        {
          q: 'How do I post in the community?',
          a: 'Go to the Community page and click "Create Post". You can share study tips, ask questions, or post updates. You can also upload up to 4 images per post.',
        },
      ],
    },
    {
      category: 'Privacy & Safety',
      questions: [
        {
          q: 'How do I control who sees my profile?',
          a: 'Go to Settings > Privacy to control your profile visibility, who can send you messages, and who can see your posts. You can choose between Public, Partners Only, or Private.',
        },
        {
          q: 'How do I block someone?',
          a: 'Go to their profile, click the three dots menu, and select "Block User". Blocked users cannot see your profile, send you messages, or join your study sessions.',
        },
        {
          q: 'How do I report inappropriate content?',
          a: 'Click the three dots menu on any post, comment, or profile and select "Report". Our team will review it as soon as possible.',
        },
      ],
    },
    {
      category: 'Account & Billing',
      questions: [
        {
          q: 'Is Clerva free to use?',
          a: 'Yes! Clerva offers a free tier with core features. We may introduce premium features in the future, but basic study collaboration will always be free.',
        },
        {
          q: 'How do I delete my account?',
          a: 'Go to Settings > Account > Delete Account. This action is permanent and will delete all your data including posts, messages, and study history.',
        },
        {
          q: 'How do I change my email or password?',
          a: 'Go to Settings > Account Security. You can update your email (requires verification) or change your password there.',
        },
      ],
    },
  ]

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(
      q =>
        q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.a.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(category => category.questions.length > 0)

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Too many requests. Please try again later.')
        } else {
          toast.error(data.error || 'Failed to send message')
        }
        return
      }

      toast.success('Message sent! We\'ll get back to you soon.')
      setContactForm({ name: '', email: '', subject: '', message: '' })
    } catch {
      toast.error('Failed to send message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gradient-to-r dark:from-slate-800/80 dark:via-slate-700/80 dark:to-slate-800/80 backdrop-blur-xl text-gray-900 dark:text-white py-16 border-b border-gray-200 dark:border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-slate-100">Help & Support</h1>
          <p className="text-xl text-gray-700 dark:text-slate-300 mb-8">
            Find answers to common questions or get in touch with our support team
          </p>

          {/* Search */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-slate-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-lg bg-white dark:bg-slate-800/60 backdrop-blur-sm text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400 border border-gray-300 dark:border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - FAQs */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">Frequently Asked Questions</h2>

            {filteredFaqs.length === 0 ? (
              <div className="bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-gray-200 dark:border-slate-700/50 rounded-lg p-8 text-center shadow-lg dark:shadow-none">
                <HelpCircle className="h-12 w-12 text-gray-500 dark:text-slate-400 mx-auto mb-4" />
                <p className="text-gray-900 dark:text-slate-300">No results found for "{searchQuery}"</p>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">Try different keywords or contact support below</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredFaqs.map((category, catIndex) => (
                  <div key={catIndex} className="bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-gray-200 dark:border-slate-700/50 rounded-lg shadow-xl dark:shadow-none overflow-hidden">
                    <div className="bg-gray-100 dark:bg-slate-700/30 px-6 py-3 border-b border-gray-200 dark:border-slate-600/50">
                      <h3 className="font-semibold text-gray-900 dark:text-slate-200">{category.category}</h3>
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-slate-700/50">
                      {category.questions.map((faq, qIndex) => {
                        const faqId = catIndex * 100 + qIndex
                        const isExpanded = expandedFaq === faqId

                        return (
                          <div key={qIndex}>
                            <button
                              onClick={() => setExpandedFaq(isExpanded ? null : faqId)}
                              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors"
                            >
                              <span className="font-medium text-gray-900 dark:text-slate-200">{faq.q}</span>
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-gray-600 dark:text-slate-400 flex-shrink-0" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-gray-600 dark:text-slate-400 flex-shrink-0" />
                              )}
                            </button>
                            {isExpanded && (
                              <div className="px-6 pb-4 text-gray-700 dark:text-slate-300">
                                {faq.a}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Links */}
            <div className="bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-gray-200 dark:border-slate-700/50 rounded-lg shadow-xl dark:shadow-none p-6">
              <h3 className="font-semibold text-gray-900 dark:text-slate-200 mb-4">Quick Links</h3>
              <div className="space-y-3">
                <a
                  href="/privacy"
                  className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  <BookOpen className="h-5 w-5" />
                  Privacy Policy
                </a>
              </div>
            </div>

            {/* Contact Support */}
            <div className="bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-gray-200 dark:border-slate-700/50 rounded-lg shadow-xl dark:shadow-none p-6">
              <h3 className="font-semibold text-gray-900 dark:text-slate-200 mb-4">Contact Support</h3>
              <form onSubmit={handleSubmitContact} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700/50 border border-gray-300 dark:border-slate-600/50 rounded-lg text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700/50 border border-gray-300 dark:border-slate-600/50 rounded-lg text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    required
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700/50 border border-gray-300 dark:border-slate-600/50 rounded-lg text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={4}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700/50 border border-gray-300 dark:border-slate-600/50 rounded-lg text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Mail className="h-5 w-5" />
                  {submitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700/50">
                <p className="text-sm text-gray-700 dark:text-slate-300">
                  Or email us directly at{' '}
                  <a href="mailto:privacy@clerva.app" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                    privacy@clerva.app
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
