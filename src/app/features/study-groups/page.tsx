'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function StudyGroupsPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-br from-green-50 to-emerald-50 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-block mb-4 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Collaborative Learning
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                Study Groups That Actually Work
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12">
                Create or join study groups tailored to your needs. Organize sessions, share resources, and achieve your academic goals together with motivated learners.
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
                <div className="aspect-video bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center relative overflow-hidden">
                  {/* Study Group Illustration */}
                  <svg className="w-full h-full p-8" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Central Circle (Group) */}
                    <motion.circle
                      cx="100" cy="100" r="40"
                      fill="#10B981" opacity="0.2"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />

                    {/* Member Nodes */}
                    <motion.circle
                      cx="100" cy="40" r="15"
                      fill="#10B981"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <motion.circle
                      cx="145" cy="70" r="15"
                      fill="#059669"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, delay: 0.3, repeat: Infinity }}
                    />
                    <motion.circle
                      cx="145" cy="130" r="15"
                      fill="#10B981"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, delay: 0.6, repeat: Infinity }}
                    />
                    <motion.circle
                      cx="100" cy="160" r="15"
                      fill="#059669"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, delay: 0.9, repeat: Infinity }}
                    />
                    <motion.circle
                      cx="55" cy="130" r="15"
                      fill="#10B981"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, delay: 1.2, repeat: Infinity }}
                    />
                    <motion.circle
                      cx="55" cy="70" r="15"
                      fill="#059669"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, delay: 1.5, repeat: Infinity }}
                    />

                    {/* Connection Lines */}
                    <line x1="100" y1="100" x2="100" y2="40" stroke="#10B981" strokeWidth="2" opacity="0.3"/>
                    <line x1="100" y1="100" x2="145" y2="70" stroke="#10B981" strokeWidth="2" opacity="0.3"/>
                    <line x1="100" y1="100" x2="145" y2="130" stroke="#10B981" strokeWidth="2" opacity="0.3"/>
                    <line x1="100" y1="100" x2="100" y2="160" stroke="#10B981" strokeWidth="2" opacity="0.3"/>
                    <line x1="100" y1="100" x2="55" y2="130" stroke="#10B981" strokeWidth="2" opacity="0.3"/>
                    <line x1="100" y1="100" x2="55" y2="70" stroke="#10B981" strokeWidth="2" opacity="0.3"/>

                    {/* Center Icon */}
                    <circle cx="100" cy="100" r="20" fill="white" stroke="#10B981" strokeWidth="3"/>
                    <text x="100" y="107" textAnchor="middle" fill="#10B981" fontSize="20" fontWeight="bold">6</text>
                  </svg>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                  Create Groups in Minutes
                </h2>
                <p className="text-lg text-gray-600 mb-6">
                  Set up your study group with just a few clicks. Customize privacy settings, add members, and start collaborating immediately.
                </p>
                <ul className="space-y-4">
                  {[
                    'Public or private group options',
                    'Invite members via email or link',
                    'Set group goals and schedules',
                    'Assign roles and permissions'
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
                className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-3xl border-2 border-green-200 relative overflow-hidden"
              >
                {/* 3D Target Icon */}
                <div className="relative mb-6">
                  <motion.div
                    animate={{
                      scale: [1, 1.05, 1],
                      rotateY: [0, 10, 0, -10, 0]
                    }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="w-24 h-24 rounded-3xl shadow-2xl"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <div className="w-full h-full bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center">
                      <div className="w-16 h-16 bg-white/30 rounded-2xl backdrop-blur border-2 border-white/50"></div>
                    </div>
                  </motion.div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Goal-Oriented Learning</h3>
                <p className="text-gray-600">
                  Set shared goals, track progress together, and celebrate milestones as a group. Stay motivated and accountable.
                </p>
              </motion.div>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
                className="bg-gradient-to-br from-emerald-50 to-green-50 p-8 rounded-3xl border-2 border-emerald-200 md:order-2 relative overflow-hidden"
              >
                {/* 3D Calendar Icon */}
                <div className="relative mb-6">
                  <motion.div
                    animate={{
                      scale: [1, 1.05, 1],
                      rotateX: [0, 10, 0, -10, 0]
                    }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="w-24 h-24 rounded-3xl shadow-2xl"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl p-4">
                      <div className="w-full h-full bg-white/30 rounded-2xl backdrop-blur grid grid-cols-3 gap-1 p-2">
                        {[...Array(9)].map((_, i) => (
                          <div key={i} className="bg-white/40 rounded"></div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Smart Scheduling</h3>
                <p className="text-gray-600">
                  Find the best time for everyone with built-in scheduling tools. Set recurring sessions and get automatic reminders.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="md:order-1"
              >
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                  Organize Sessions Effortlessly
                </h2>
                <p className="text-lg text-gray-600 mb-6">
                  Keep your study group organized with integrated scheduling, automatic reminders, and session planning tools.
                </p>
                <ul className="space-y-4">
                  {[
                    'Calendar integration for easy scheduling',
                    'Automated session reminders',
                    'Time zone support for global groups',
                    'Session templates for recurring meetings'
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Group Types */}
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
                Groups For Every Need
              </h2>
              <p className="text-xl text-gray-600">
                From exam prep to long-term learning communities
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: 'Exam Prep Groups',
                  description: 'Intensive study groups focused on upcoming exams. Share practice questions, review materials, and test each other.',
                  gradient: 'from-green-500 to-emerald-600',
                  features: ['Time-limited', 'Goal-focused', 'Practice tests']
                },
                {
                  title: 'Subject Study Groups',
                  description: 'Long-term groups for mastering specific subjects. Build knowledge progressively with consistent peers.',
                  gradient: 'from-emerald-500 to-teal-600',
                  features: ['Ongoing', 'Topic-based', 'Resource library']
                },
                {
                  title: 'Project Teams',
                  description: 'Collaborate on group projects with shared workspaces, file storage, and task management tools.',
                  gradient: 'from-teal-500 to-cyan-600',
                  features: ['Task tracking', 'File sharing', 'Deadlines']
                }
              ].map((type, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -5 }}
                  className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden"
                >
                  {/* Gradient accent */}
                  <div className={`absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br ${type.gradient} opacity-10 rounded-full blur-3xl`}></div>

                  {/* 3D Icon */}
                  <div className="relative mb-6">
                    <motion.div
                      animate={{
                        y: [0, -8, 0],
                        rotateZ: [-2, 2, -2]
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: index * 0.5 }}
                      className="w-20 h-20 rounded-2xl shadow-2xl"
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      <div className={`w-full h-full bg-gradient-to-br ${type.gradient} rounded-2xl flex items-center justify-center`}>
                        <div className="w-12 h-12 bg-white/30 backdrop-blur rounded-xl border border-white/50"></div>
                      </div>
                    </motion.div>
                  </div>

                  <h3 className="text-2xl font-semibold mb-3 text-gray-900 relative">{type.title}</h3>
                  <p className="text-gray-600 mb-4 relative">{type.description}</p>
                  <div className="space-y-2 relative">
                    {type.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </div>
                    ))}
                  </div>
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
                Everything you need to know about study groups
              </p>
            </motion.div>

            <div className="space-y-4">
              {[
                {
                  q: 'How many people can join a study group?',
                  a: 'Study groups can have between 2 and 50 members. We recommend 4-8 members for optimal collaboration and engagement. Larger groups work well for lecture-style sessions or community learning.'
                },
                {
                  q: 'Can I join multiple study groups?',
                  a: 'Yes! You can join as many study groups as you want. Many students participate in different groups for different subjects or goals. You can manage all your groups from your dashboard.'
                },
                {
                  q: 'How do I find study groups to join?',
                  a: 'Browse public study groups by subject, topic, or schedule. You can also get invited to private groups by members or receive AI recommendations based on your profile and interests.'
                },
                {
                  q: 'Can I make my study group private?',
                  a: 'Absolutely! When creating a group, you can choose to make it private (invite-only) or public (discoverable by others). You can change this setting anytime as the group owner.'
                },
                {
                  q: 'What tools are available for group admins?',
                  a: 'Group admins can manage members, set schedules, create shared resources, moderate discussions, assign roles, track attendance, and customize group settings including privacy and notifications.'
                },
                {
                  q: 'Can I leave a study group?',
                  a: 'Yes, you can leave any study group at any time from your group settings. If you\'re the group owner and want to leave, you\'ll need to transfer ownership to another member or delete the group first.'
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
      <section className="py-20 bg-gradient-to-br from-green-600 to-emerald-700">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Create Your First Study Group
            </h2>
            <p className="text-xl text-green-100 mb-8">
              Join thousands of students achieving better results through collaborative learning. Start your group today.
            </p>
            <Link
              href="/auth/signup"
              className="inline-block px-10 py-4 bg-white text-green-600 rounded-lg font-semibold text-lg hover:bg-gray-50 shadow-xl hover:shadow-2xl transition-all duration-200"
            >
              Create Your Study Group
            </Link>
            <p className="text-green-100 mt-4 text-sm">
              Free to create · Unlimited members
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
