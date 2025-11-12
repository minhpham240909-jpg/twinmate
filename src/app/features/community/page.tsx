'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function CommunityPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-br from-purple-50 to-pink-50 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-block mb-4 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  Connect & Learn Together
                </div>
                <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                  A Vibrant Learning <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Community</span>
                </h1>
                <p className="text-xl text-gray-600 mb-8">
                  Share <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">insights</span>, ask questions, and learn from thousands of students worldwide. Build your <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">network</span> and discover new <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">perspectives</span>.
                </p>
                <div className="flex gap-4">
                  <Link
                    href="/auth/signup"
                    className="px-8 py-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all shadow-lg"
                  >
                    Join the Community
                  </Link>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
              >
                <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-200">
                  <div className="aspect-square bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center relative overflow-hidden">
                    {/* Community Network Illustration */}
                    <svg className="w-full h-full p-8" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Connection Web */}
                      <motion.path
                        d="M100,50 L150,80 L140,130 L60,130 L50,80 Z"
                        stroke="#A855F7" strokeWidth="2" fill="#A855F7" opacity="0.1"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />

                      {/* Member Nodes */}
                      <motion.circle cx="100" cy="50" r="12" fill="#A855F7" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}/>
                      <motion.circle cx="150" cy="80" r="12" fill="#EC4899" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, delay: 0.4, repeat: Infinity }}/>
                      <motion.circle cx="140" cy="130" r="12" fill="#A855F7" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, delay: 0.8, repeat: Infinity }}/>
                      <motion.circle cx="60" cy="130" r="12" fill="#EC4899" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, delay: 1.2, repeat: Infinity }}/>
                      <motion.circle cx="50" cy="80" r="12" fill="#A855F7" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, delay: 1.6, repeat: Infinity }}/>

                      {/* Activity Indicators */}
                      <motion.circle cx="100" cy="100" r="4" fill="#10B981" animate={{ scale: [0, 1.5, 0] }} transition={{ duration: 3, repeat: Infinity }}/>
                      <motion.circle cx="120" cy="90" r="4" fill="#F59E0B" animate={{ scale: [0, 1.5, 0] }} transition={{ duration: 3, delay: 1, repeat: Infinity }}/>
                      <motion.circle cx="80" cy="110" r="4" fill="#3B82F6" animate={{ scale: [0, 1.5, 0] }} transition={{ duration: 3, delay: 2, repeat: Infinity }}/>

                      {/* Center Community Icon */}
                      <circle cx="100" cy="100" r="20" fill="white" stroke="#A855F7" strokeWidth="2"/>
                      <path d="M95 95 L95 105 M105 95 L105 105 M90 100 L110 100" stroke="#A855F7" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
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
                What Makes Our Community Special
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                A supportive space where students help each other succeed
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8 mb-16">
              {[
                {
                  title: 'Share Knowledge & Insights',
                  description: 'Post questions, share study tips, and discuss topics with peers. Get multiple perspectives on challenging concepts.',
                  gradient: 'from-purple-500 to-pink-600',
                  image: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/lightbulb.svg'
                },
                {
                  title: 'Build Your Network',
                  description: 'Connect with like-minded learners, find study partners, and build lasting friendships with people who share your goals.',
                  gradient: 'from-pink-500 to-rose-600',
                  image: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/network.svg'
                },
                {
                  title: 'Resource Library',
                  description: 'Access shared study materials, notes, practice problems, and resources curated by the community.',
                  gradient: 'from-purple-600 to-indigo-600',
                  image: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/library.svg'
                },
                {
                  title: 'Celebrate Success',
                  description: 'Share achievements, milestones, and wins with the community. Get encouragement and motivation from peers.',
                  gradient: 'from-rose-500 to-pink-600',
                  image: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/trophy.svg'
                }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -5 }}
                  className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden"
                >
                  {/* Gradient background blob */}
                  <div className={`absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br ${feature.gradient} opacity-10 rounded-full blur-3xl`}></div>

                  {/* 3D Floating Icon with Image */}
                  <div className="relative mb-6">
                    <motion.div
                      animate={{
                        y: [0, -12, 0],
                        rotateY: [0, 10, 0, -10, 0],
                        scale: [1, 1.05, 1]
                      }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: index * 0.3 }}
                      className="w-32 h-32 rounded-3xl shadow-2xl overflow-hidden"
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      <div className={`w-full h-full bg-gradient-to-br ${feature.gradient} rounded-3xl p-6 flex items-center justify-center`}>
                        <img src={feature.image} alt={feature.title} className="w-full h-full object-contain opacity-90 invert" />
                      </div>
                    </motion.div>
                  </div>

                  <h3 className="text-2xl font-semibold mb-3 text-gray-900 relative">
                    {feature.title.split(' ').map((word, idx) => {
                      const keyWords = ['Share', 'Knowledge', 'Insights', 'Build', 'Network', 'Resource', 'Library', 'Celebrate', 'Success'];
                      return keyWords.includes(word) ? (
                        <span key={idx} className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{word} </span>
                      ) : (
                        <span key={idx}>{word} </span>
                      );
                    })}
                  </h3>
                  <p className="text-gray-600 leading-relaxed relative">
                    {feature.description.split(' ').map((word, idx, arr) => {
                      const keyWords = ['Share', 'questions', 'study', 'tips', 'discuss', 'topics', 'peers', 'perspectives', 'Connect', 'learners', 'partners', 'friendships', 'goals', 'Access', 'shared', 'materials', 'notes', 'practice', 'problems', 'resources', 'curated', 'Share', 'achievements', 'milestones', 'wins', 'encouragement', 'motivation'];
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

      {/* Community Features */}
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
                Powerful Community Features
              </h2>
              <p className="text-xl text-gray-600">
                Everything you need for meaningful engagement
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: 'Discussion Forums',
                  description: 'Topic-based forums for in-depth discussions and Q&A',
                  features: ['Upvote best answers', 'Follow topics', 'Expert badges']
                },
                {
                  title: 'Live Feed',
                  description: 'Real-time updates from your network and groups',
                  features: ['Personalized feed', 'Like & comment', 'Share posts']
                },
                {
                  title: 'Events & Meetups',
                  description: 'Join virtual or local study events and workshops',
                  features: ['Event calendar', 'RSVP system', 'Host events']
                },
                {
                  title: 'Hashtags & Topics',
                  description: 'Discover content by subject, exam, or interest',
                  features: ['Trending topics', 'Follow hashtags', 'Smart search']
                },
                {
                  title: 'Direct Messaging',
                  description: 'Private conversations with community members',
                  features: ['1-on-1 chat', 'File sharing', 'Voice messages']
                },
                {
                  title: 'Moderation Tools',
                  description: 'Safe, respectful community environment',
                  features: ['Report system', 'Community guidelines', 'Verified users']
                }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white p-6 rounded-xl shadow-lg border border-gray-200"
                >
                  <h3 className="text-xl font-semibold mb-3 text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600 mb-4 text-sm">{feature.description}</p>
                  <ul className="space-y-2">
                    {feature.features.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Community Stats */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 text-center">
              {[
                { number: '50K+', label: 'Active Members' },
                { number: '200+', label: 'Study Groups' },
                { number: '10K+', label: 'Questions Answered' },
                { number: '100+', label: 'Countries' }
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="p-6"
                >
                  <div className="text-5xl font-bold text-purple-600 mb-2">{stat.number}</div>
                  <div className="text-gray-600 text-lg">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
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
                Everything you need to know about our community
              </p>
            </motion.div>

            <div className="space-y-4">
              {[
                {
                  q: 'Is the community free to join?',
                  a: 'Yes! The Clerva community is completely free for all students. You get full access to forums, discussions, resources, and networking features at no cost.'
                },
                {
                  q: 'How do I keep my community experience relevant?',
                  a: 'Follow topics and hashtags related to your subjects and interests. Our algorithm learns your preferences and shows you the most relevant posts, discussions, and connections in your feed.'
                },
                {
                  q: 'Can I report inappropriate content?',
                  a: 'Absolutely. We have a robust moderation system. You can report any post, comment, or user that violates our community guidelines. Our team reviews all reports promptly and takes appropriate action.'
                },
                {
                  q: 'How do I increase my visibility in the community?',
                  a: 'Be active and helpful! Post quality content, answer questions thoughtfully, participate in discussions, and share useful resources. Consistent engagement and valuable contributions earn you reputation points and badges.'
                },
                {
                  q: 'Can I control my privacy settings?',
                  a: 'Yes! You have full control over your privacy. Choose who can see your posts (public, connections only, or private), manage your profile visibility, and control notifications. Your privacy is important to us.'
                },
                {
                  q: 'Are there moderators monitoring the community?',
                  a: 'Yes, we have a dedicated team of moderators ensuring the community stays safe, respectful, and helpful. We also have automated systems detecting spam and inappropriate content in real-time.'
                }
              ].map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
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
      <section className="py-20 bg-gradient-to-br from-purple-600 to-pink-600">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Join the Clerva Community Today
            </h2>
            <p className="text-xl text-purple-100 mb-8">
              Connect with thousands of motivated students, share knowledge, and grow together. Your learning community awaits.
            </p>
            <Link
              href="/auth/signup"
              className="inline-block px-10 py-4 bg-white text-purple-600 rounded-lg font-semibold text-lg hover:bg-gray-50 shadow-xl hover:shadow-2xl transition-all duration-200"
            >
              Join the Community Now
            </Link>
            <p className="text-purple-100 mt-4 text-sm">
              Free to join · 50,000+ active members
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
