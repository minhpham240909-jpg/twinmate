'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function AIAgentFeaturePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <div className="inline-block mb-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                AI-Powered Matching
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">AI Agent</span>: Your Personal Study Partner Finder
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Stop wasting time searching for the perfect <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">study partner</span>. Our intelligent <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">AI Agent</span> analyzes your profile and automatically <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">matches</span> you with <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">compatible partners</span> who share your goals and learning style.
              </p>
            </motion.div>

            {/* Hero Illustration */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
                <div className="aspect-video bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center relative overflow-hidden">
                  {/* AI Brain Illustration */}
                  <svg className="w-64 h-64" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Brain */}
                    <circle cx="100" cy="100" r="60" fill="#3B82F6" opacity="0.1"/>
                    <circle cx="100" cy="100" r="45" fill="#3B82F6" opacity="0.2"/>
                    <circle cx="100" cy="100" r="30" fill="#3B82F6" opacity="0.3"/>

                    {/* AI Connections */}
                    <motion.line
                      x1="100" y1="100" x2="40" y2="60"
                      stroke="#3B82F6" strokeWidth="2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <motion.line
                      x1="100" y1="100" x2="160" y2="60"
                      stroke="#6366F1" strokeWidth="2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, delay: 0.3, repeat: Infinity }}
                    />
                    <motion.line
                      x1="100" y1="100" x2="40" y2="140"
                      stroke="#8B5CF6" strokeWidth="2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, delay: 0.6, repeat: Infinity }}
                    />
                    <motion.line
                      x1="100" y1="100" x2="160" y2="140"
                      stroke="#3B82F6" strokeWidth="2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, delay: 0.9, repeat: Infinity }}
                    />

                    {/* User Nodes */}
                    <motion.circle
                      cx="40" cy="60" r="12"
                      fill="#3B82F6"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <motion.circle
                      cx="160" cy="60" r="12"
                      fill="#6366F1"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, delay: 0.5, repeat: Infinity }}
                    />
                    <motion.circle
                      cx="40" cy="140" r="12"
                      fill="#8B5CF6"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, delay: 1, repeat: Infinity }}
                    />
                    <motion.circle
                      cx="160" cy="140" r="12"
                      fill="#3B82F6"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, delay: 1.5, repeat: Infinity }}
                    />

                    {/* Center AI Icon */}
                    <circle cx="100" cy="100" r="20" fill="white" stroke="#3B82F6" strokeWidth="2"/>
                    <path d="M100 90 L100 110 M90 100 L110 100" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
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
                How AI Agent Works
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Our sophisticated AI analyzes multiple data points to find your perfect match
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: '1',
                  title: 'Describe Your Ideal Partner',
                  description: 'Tell our AI about your subjects, learning style, goals, and availability. The more specific you are, the better the matches.',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  )
                },
                {
                  step: '2',
                  title: 'AI Analyzes & Matches',
                  description: 'Our AI processes your preferences and finds partners who complement your needs, considering compatibility across multiple dimensions.',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  )
                },
                {
                  step: '3',
                  title: 'Connect & Study',
                  description: 'Review your matches, connect with partners you like, and start collaborating immediately. Update your preferences anytime.',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )
                }
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-100"
                >
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-6">
                    {item.step}
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900">
                    {item.title.split(' ').map((word, idx) => {
                      const keyWords = ['Describe', 'Ideal', 'Partner', 'Analyzes', 'Matches', 'Connect', 'Study'];
                      return keyWords.includes(word) ? (
                        <span key={idx} className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{word} </span>
                      ) : (
                        <span key={idx}>{word} </span>
                      );
                    })}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {item.description.split(' ').map((word, idx) => {
                      const keyWords = ['Tell', 'subjects', 'learning', 'style', 'goals', 'availability', 'specific', 'matches', 'processes', 'preferences', 'finds', 'partners', 'complement', 'needs', 'compatibility', 'dimensions', 'Review', 'matches', 'connect', 'partners', 'collaborating', 'immediately', 'Update', 'preferences'];
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

      {/* Key Features */}
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
                What Makes Our AI Special
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Advanced algorithms that go beyond simple keyword matching
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  title: 'Multi-Dimensional Matching',
                  description: 'Our AI considers subjects, learning styles, schedules, goals, personality traits, and communication preferences to find compatible partners.',
                  gradient: 'from-blue-500 to-indigo-600',
                  image: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/bar-chart-3.svg'
                },
                {
                  title: 'Continuous Learning',
                  description: 'The AI learns from your interactions and feedback, improving match quality over time to better understand your preferences.',
                  gradient: 'from-indigo-500 to-purple-600',
                  image: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/brain.svg'
                },
                {
                  title: 'Real-Time Availability',
                  description: 'Matches are based on current availability, ensuring you connect with partners who are ready to study when you are.',
                  gradient: 'from-purple-500 to-pink-600',
                  image: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/clock.svg'
                },
                {
                  title: 'Compatibility Scores',
                  description: 'See detailed compatibility breakdowns showing why each match was recommended and what you have in common.',
                  gradient: 'from-pink-500 to-rose-600',
                  image: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/award.svg'
                }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -5 }}
                  className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden"
                >
                  {/* Gradient accent */}
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${feature.gradient} opacity-10 rounded-full blur-2xl`}></div>

                  {/* 3D Icon Card with Image */}
                  <div className="relative mb-6">
                    <motion.div
                      animate={{
                        rotateY: [0, 5, 0, -5, 0],
                        rotateX: [0, 5, 0, -5, 0]
                      }}
                      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                      className="w-32 h-32 rounded-2xl shadow-lg overflow-hidden"
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      <div className={`w-full h-full bg-gradient-to-br ${feature.gradient} rounded-2xl p-6 flex items-center justify-center`}>
                        <img src={feature.image} alt={feature.title} className="w-full h-full object-contain opacity-90 invert" />
                      </div>
                    </motion.div>
                  </div>

                  <h3 className="text-2xl font-semibold mb-3 text-gray-900 relative">
                    {feature.title.split(' ').map((word, idx) => {
                      const keyWords = ['Multi-Dimensional', 'Matching', 'Continuous', 'Learning', 'Real-Time', 'Availability', 'Compatibility', 'Scores'];
                      return keyWords.includes(word) ? (
                        <span key={idx} className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{word} </span>
                      ) : (
                        <span key={idx}>{word} </span>
                      );
                    })}
                  </h3>
                  <p className="text-gray-600 leading-relaxed relative">
                    {feature.description.split(' ').map((word, idx) => {
                      const keyWords = ['considers', 'subjects', 'learning', 'styles', 'schedules', 'goals', 'personality', 'traits', 'communication', 'preferences', 'compatible', 'partners', 'learns', 'interactions', 'feedback', 'improving', 'match', 'quality', 'understand', 'preferences', 'Matches', 'based', 'current', 'availability', 'ensuring', 'connect', 'partners', 'ready', 'study', 'See', 'detailed', 'compatibility', 'breakdowns', 'showing', 'match', 'recommended', 'common'];
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
                Everything you need to know about AI Agent
              </p>
            </motion.div>

            <div className="space-y-4">
              {[
                {
                  q: 'How accurate is the AI matching?',
                  a: 'Our AI uses advanced machine learning algorithms trained on thousands of successful study partnerships. On average, users report 85% satisfaction with their matches, and the accuracy improves as the AI learns your preferences through your interactions.'
                },
                {
                  q: 'Can I specify exactly what I want in a partner?',
                  a: 'Absolutely! You can set specific criteria for subjects, study times, learning pace, communication style, and more. The AI will prioritize these preferences while also suggesting potentially compatible partners you might not have considered.'
                },
                {
                  q: 'What if I don\'t like my matches?',
                  a: 'You can provide feedback on any match, which helps the AI learn your preferences. You can also update your profile settings anytime, and the AI will immediately start finding new matches based on your updated criteria.'
                },
                {
                  q: 'How does the AI protect my privacy?',
                  a: 'The AI only uses information you explicitly provide in your profile. Your personal data is encrypted and never shared with third parties. Match suggestions are generated securely, and you always control what information potential partners can see.'
                },
                {
                  q: 'Does the AI match based on skill level?',
                  a: 'Yes! The AI can match you with partners at the same level for peer learning, or with more experienced students if you\'re looking for mentorship. You specify your preference in your profile settings.'
                },
                {
                  q: 'How often does the AI find new matches?',
                  a: 'The AI continuously searches for new matches as students join the platform and update their profiles. You\'ll receive notifications when highly compatible partners become available, and you can manually search anytime.'
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
      <section className="py-20 bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Find Your Perfect Study Match?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Let our AI Agent do the work for you. Describe your ideal partner and start collaborating in minutes.
            </p>
            <Link
              href="/auth/signup"
              className="inline-block px-10 py-4 bg-white text-blue-600 rounded-lg font-semibold text-lg hover:bg-gray-50 shadow-xl hover:shadow-2xl transition-all duration-200"
            >
              Start Finding Your Perfect Match
            </Link>
            <p className="text-blue-100 mt-4 text-sm">
              Join free · No credit card required
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
