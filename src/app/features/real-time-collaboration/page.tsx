'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function RealTimeCollaborationPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-br from-indigo-50 to-purple-50 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-block mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                  Collaborate in Real-Time
                </div>
                <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Study Together</span>, Anywhere
                </h1>
                <p className="text-xl text-gray-600 mb-8">
                  Connect with your <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">study partners</span> through <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">video calls</span>, <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">chat</span>, shared <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">whiteboards</span>, and <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">collaborative tools</span>—all in one seamless platform.
                </p>
                <Link
                  href="/auth/signup"
                  className="inline-block px-8 py-4 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-all shadow-lg"
                >
                  Get Started Free
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
              >
                <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-200">
                  <div className="aspect-square bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center">
                    {/* Video Call Illustration */}
                    <svg className="w-full h-full p-8" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Screen/Window */}
                      <rect x="20" y="30" width="160" height="140" rx="8" fill="white" stroke="#6366F1" strokeWidth="2"/>

                      {/* Video Grid (4 participants) */}
                      <rect x="30" y="40" width="65" height="55" rx="4" fill="#6366F1" opacity="0.2"/>
                      <rect x="105" y="40" width="65" height="55" rx="4" fill="#8B5CF6" opacity="0.2"/>
                      <rect x="30" y="105" width="65" height="55" rx="4" fill="#6366F1" opacity="0.15"/>
                      <rect x="105" y="105" width="65" height="55" rx="4" fill="#8B5CF6" opacity="0.15"/>

                      {/* User Icons */}
                      <circle cx="62" cy="67" r="12" fill="#6366F1"/>
                      <circle cx="137" cy="67" r="12" fill="#8B5CF6"/>
                      <circle cx="62" cy="132" r="12" fill="#6366F1"/>
                      <circle cx="137" cy="132" r="12" fill="#8B5CF6"/>

                      {/* Control Bar */}
                      <rect x="40" y="175" width="120" height="8" rx="4" fill="#6366F1" opacity="0.3"/>

                      {/* Animated Activity Indicators */}
                      <motion.circle
                        cx="70" cy="178"
                        r="3"
                        fill="#10B981"
                        animate={{ scale: [1, 1.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <motion.circle
                        cx="100" cy="178"
                        r="3"
                        fill="#10B981"
                        animate={{ scale: [1, 1.5, 1] }}
                        transition={{ duration: 2, delay: 0.3, repeat: Infinity }}
                      />
                      <motion.circle
                        cx="130" cy="178"
                        r="3"
                        fill="#10B981"
                        animate={{ scale: [1, 1.5, 1] }}
                        transition={{ duration: 2, delay: 0.6, repeat: Infinity }}
                      />
                    </svg>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                All the Tools You Need
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Powerful collaboration features designed for effective studying
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  title: 'HD Video Calls',
                  description: 'Crystal-clear video and audio quality with up to 10 participants per session. Screen sharing included.',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  ),
                  color: 'indigo'
                },
                {
                  title: 'Real-Time Chat',
                  description: 'Instant messaging with file sharing, code snippets, and LaTeX math equation support.',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  ),
                  color: 'purple'
                },
                {
                  title: 'Shared Whiteboard',
                  description: 'Collaborate visually with an infinite canvas. Draw, write equations, and brainstorm together.',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  ),
                  color: 'indigo'
                },
                {
                  title: 'Document Collaboration',
                  description: 'Work on notes and documents together in real-time with version history and auto-save.',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ),
                  color: 'purple'
                },
                {
                  title: 'Screen Sharing',
                  description: 'Share your screen to explain concepts, review code, or demonstrate problem-solving techniques.',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ),
                  color: 'indigo'
                },
                {
                  title: 'Session Recording',
                  description: 'Record sessions for later review. Automatic transcription and searchable content included.',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  ),
                  color: 'purple'
                }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-6 rounded-xl border-2 ${
                    feature.color === 'indigo'
                      ? 'border-indigo-200 hover:border-indigo-300 bg-indigo-50/50'
                      : 'border-purple-200 hover:border-purple-300 bg-purple-50/50'
                  } transition-all duration-300`}
                >
                  <div className={`w-14 h-14 rounded-lg flex items-center justify-center mb-4 ${
                    feature.color === 'indigo' ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600'
                  }`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900">
                    {feature.title.split(' ').map((word, idx) => {
                      const keyWords = ['HD', 'Video', 'Calls', 'Real-Time', 'Chat', 'Shared', 'Whiteboard', 'Document', 'Collaboration', 'Screen', 'Sharing', 'Session', 'Recording'];
                      return keyWords.includes(word) ? (
                        <span key={idx} className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{word} </span>
                      ) : (
                        <span key={idx}>{word} </span>
                      );
                    })}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {feature.description.split(' ').map((word, idx) => {
                      const keyWords = ['Crystal-clear', 'video', 'audio', 'quality', 'participants', 'session', 'Screen', 'sharing', 'included', 'Instant', 'messaging', 'file', 'sharing', 'code', 'snippets', 'LaTeX', 'math', 'equation', 'support', 'Collaborate', 'visually', 'infinite', 'canvas', 'Draw', 'write', 'equations', 'brainstorm', 'together', 'Work', 'notes', 'documents', 'together', 'real-time', 'version', 'history', 'auto-save', 'Share', 'screen', 'explain', 'concepts', 'review', 'code', 'demonstrate', 'problem-solving', 'techniques', 'Record', 'sessions', 'later', 'review', 'Automatic', 'transcription', 'searchable', 'content', 'included'];
                      const cleanWord = word.replace(/[.,!?]/g, '');
                      return keyWords.includes(cleanWord) ? (
                        <span key={idx}><span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">{cleanWord}</span>{word.replace(cleanWord, '')} </span>
                      ) : (
                        <span key={idx}>{word} </span>
                      );
                    })}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Perfect For Every Study Scenario
              </h2>
              <p className="text-xl text-gray-600">
                From quick Q&A to intensive study marathons
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  title: 'Quick Study Sessions',
                  description: 'Need help with a specific problem? Jump on a quick video call, share your screen, and get instant help from your study partner.',
                  gradient: 'from-indigo-500 to-purple-600',
                  image: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/video.svg'
                },
                {
                  title: 'Exam Preparation',
                  description: 'Prepare for exams together with extended sessions. Use the whiteboard for problem-solving and screen sharing for reviewing materials.',
                  gradient: 'from-purple-500 to-pink-600',
                  image: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/book-open.svg'
                },
                {
                  title: 'Project Collaboration',
                  description: 'Work on group projects with document collaboration, file sharing, and video conferencing all in one place.',
                  gradient: 'from-pink-500 to-rose-600',
                  image: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/folder-open.svg'
                },
                {
                  title: 'Language Practice',
                  description: 'Practice speaking with language partners via video calls. Record sessions to review pronunciation and conversation skills.',
                  gradient: 'from-indigo-600 to-blue-600',
                  image: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/mic.svg'
                }
              ].map((useCase, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -5 }}
                  className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden"
                >
                  {/* Gradient background blob */}
                  <div className={`absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br ${useCase.gradient} opacity-10 rounded-full blur-3xl`}></div>

                  {/* 3D Floating Card with Image */}
                  <div className="relative mb-6">
                    <motion.div
                      animate={{
                        y: [0, -10, 0],
                        rotateZ: [0, 2, 0, -2, 0]
                      }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                      className="w-32 h-32 rounded-2xl shadow-2xl overflow-hidden"
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      <div className={`w-full h-full bg-gradient-to-br ${useCase.gradient} rounded-2xl p-6 flex items-center justify-center`}>
                        <img src={useCase.image} alt={useCase.title} className="w-full h-full object-contain opacity-90 invert" />
                      </div>
                    </motion.div>
                  </div>

                  <h3 className="text-2xl font-semibold mb-3 text-gray-900 relative">
                    {useCase.title.split(' ').map((word, idx) => {
                      const keyWords = ['Quick', 'Study', 'Sessions', 'Exam', 'Preparation', 'Project', 'Collaboration', 'Language', 'Practice'];
                      return keyWords.includes(word) ? (
                        <span key={idx} className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{word} </span>
                      ) : (
                        <span key={idx}>{word} </span>
                      );
                    })}
                  </h3>
                  <p className="text-gray-600 leading-relaxed relative">
                    {useCase.description.split(' ').map((word, idx) => {
                      const keyWords = ['Need', 'help', 'specific', 'problem', 'Jump', 'quick', 'video', 'call', 'share', 'screen', 'instant', 'help', 'study', 'partner', 'Prepare', 'exams', 'together', 'extended', 'sessions', 'Use', 'whiteboard', 'problem-solving', 'screen', 'sharing', 'reviewing', 'materials', 'Work', 'group', 'projects', 'document', 'collaboration', 'file', 'sharing', 'video', 'conferencing', 'place', 'Practice', 'speaking', 'language', 'partners', 'video', 'calls', 'Record', 'sessions', 'review', 'pronunciation', 'conversation', 'skills'];
                      const cleanWord = word.replace(/[.,!?]/g, '');
                      return keyWords.includes(cleanWord) ? (
                        <span key={idx}><span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">{cleanWord}</span>{word.replace(cleanWord, '')} </span>
                      ) : (
                        <span key={idx}>{word} </span>
                      );
                    })}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-xl text-gray-600">
                Everything you need to know about real-time collaboration
              </p>
            </motion.div>

            <div className="space-y-4">
              {[
                {
                  q: 'What devices and platforms are supported?',
                  a: 'Clerva works on all modern web browsers (Chrome, Firefox, Safari, Edge) on desktop, laptop, tablet, and mobile devices. No downloads or installations required—just log in and start collaborating.'
                },
                {
                  q: 'How many people can join a video call?',
                  a: 'You can have up to 10 participants in a single video call session. For larger groups, consider breaking into smaller study groups or using our webinar-style sessions for presentations.'
                },
                {
                  q: 'Is my video call data secure and private?',
                  a: 'Yes! All video calls are encrypted end-to-end. We don\'t store call recordings unless you explicitly choose to save them. Your privacy and security are our top priorities.'
                },
                {
                  q: 'Can I use the whiteboard without video?',
                  a: 'Absolutely! All collaboration tools (whiteboard, chat, document collaboration) can be used independently. You can collaborate via text and whiteboard without turning on your camera.'
                },
                {
                  q: 'What happens if my internet connection is poor?',
                  a: 'Our platform automatically adjusts video quality based on your connection speed. You can also disable video and use audio-only mode or switch to chat-only collaboration if needed.'
                },
                {
                  q: 'Can I save and export my whiteboard work?',
                  a: 'Yes! You can save whiteboard sessions, export them as images or PDFs, and access them later from your session history. All collaborative documents are auto-saved in real-time.'
                }
              ].map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <span className="font-semibold text-gray-900 pr-4">{faq.q}</span>
                    <motion.svg
                      animate={{ rotate: openFaq === index ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="w-5 h-5 text-gray-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </motion.svg>
                  </button>
                  <motion.div
                    initial={false}
                    animate={{
                      height: openFaq === index ? 'auto' : 0,
                      opacity: openFaq === index ? 1 : 0
                    }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-gray-600 leading-relaxed">
                      {faq.a}
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-indigo-600 to-purple-700">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Start Collaborating Today
            </h2>
            <p className="text-xl text-indigo-100 mb-8">
              Experience seamless real-time collaboration with study partners around the world. No credit card required.
            </p>
            <Link
              href="/auth/signup"
              className="inline-block px-10 py-4 bg-white text-indigo-600 rounded-lg font-semibold text-lg hover:bg-gray-50 shadow-xl hover:shadow-2xl transition-all duration-200"
            >
              Start Collaborating Now
            </Link>
            <p className="text-indigo-100 mt-4 text-sm">
              Free forever · No downloads needed
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
