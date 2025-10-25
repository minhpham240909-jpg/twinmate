'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-20 pb-40 bg-gradient-to-b from-white to-blue-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-5xl mx-auto mb-20"
          >
            <h1 className="text-7xl md:text-8xl font-bold text-gray-900 mb-8 tracking-tight leading-none">
              Find your perfect<br />study partner.
            </h1>
            <p className="text-2xl md:text-3xl text-gray-600 mb-12 font-light max-w-3xl mx-auto leading-relaxed">
              AI-powered matching connects you with compatible study partners. Collaborate in real-time and achieve more together.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link
                href="/auth/signup"
                className="px-10 py-5 bg-blue-600 text-white text-xl font-medium rounded-full hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
              >
                Get Started
              </Link>
              <Link
                href="#how-it-works"
                className="px-10 py-5 text-blue-600 text-xl font-medium rounded-full border-2 border-blue-600 hover:bg-blue-50 transition-all"
              >
                Learn More
              </Link>
            </div>
          </motion.div>

          {/* Beautiful Animated Hero Visual */}
          <div className="max-w-6xl mx-auto relative h-[500px]">
            {/* Animated Background Gradient Blobs */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                x: [0, 50, 0],
                y: [0, -30, 0],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-400/30 to-indigo-500/30 rounded-full blur-3xl"
            />
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                x: [0, -40, 0],
                y: [0, 40, 0],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-400/30 to-pink-500/30 rounded-full blur-3xl"
            />
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                x: [0, 30, 0],
                y: [0, -20, 0],
              }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              className="absolute top-1/2 left-1/2 w-72 h-72 bg-gradient-to-br from-indigo-400/20 to-blue-500/20 rounded-full blur-3xl"
            />

            {/* Floating Orbs */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [0.4, 0.8, 0.4],
                  y: [0, -100, 0],
                  x: [0, Math.sin(i) * 50, 0],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 5 + i,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.4,
                }}
                className={`absolute w-16 h-16 rounded-full bg-gradient-to-br ${
                  i % 3 === 0
                    ? 'from-blue-400 to-indigo-500'
                    : i % 3 === 1
                    ? 'from-purple-400 to-pink-500'
                    : 'from-indigo-400 to-blue-500'
                } blur-sm`}
                style={{
                  left: `${10 + (i * 12)}%`,
                  top: `${20 + (i * 8)}%`,
                }}
              />
            ))}

            {/* Center Animated Shapes */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{
                  rotate: [0, 360],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="relative w-80 h-80"
              >
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.1, 1],
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.8,
                    }}
                    className={`absolute inset-0 rounded-full border-4 ${
                      i === 0
                        ? 'border-blue-400/40'
                        : i === 1
                        ? 'border-purple-400/40'
                        : 'border-indigo-400/40'
                    }`}
                    style={{
                      transform: `scale(${0.6 + i * 0.2}) rotate(${i * 45}deg)`,
                    }}
                  />
                ))}

                {/* Center Glow */}
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full blur-2xl opacity-60" />
                </motion.div>
              </motion.div>
            </div>

            {/* Floating Particles */}
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={`particle-${i}`}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [0, 0.6, 0],
                  y: [0, -200],
                  x: [0, (i % 2 === 0 ? 1 : -1) * Math.random() * 50],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: i * 0.2,
                }}
                className="absolute w-1 h-1 bg-blue-400 rounded-full"
                style={{
                  left: `${5 + (i * 4.5)}%`,
                  bottom: '0',
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-40 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-6xl font-bold text-gray-900 mb-6">
              Get started in minutes.
            </h2>
            <p className="text-xl text-gray-600 font-light max-w-2xl mx-auto">
              Three simple steps to find your perfect study partner.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: '1',
                title: 'Create Your Profile',
                description: 'Sign up and tell us about your subjects, learning style, and study goals.',
                color: 'from-blue-500 to-indigo-600'
              },
              {
                step: '2',
                title: 'Get Matched',
                description: 'Our AI analyzes thousands of profiles to find your perfect study partners.',
                color: 'from-indigo-500 to-purple-600'
              },
              {
                step: '3',
                title: 'Start Studying',
                description: 'Connect instantly and collaborate with video calls, chat, and whiteboards.',
                color: 'from-purple-500 to-pink-600'
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="relative"
              >
                <motion.div
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100 relative overflow-hidden"
                >
                  {/* Animated Background Gradient */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.1, 0.15, 0.1],
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: index * 0.5 }}
                    className={`absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br ${item.color} rounded-full blur-3xl`}
                  />

                  {/* Floating Particles */}
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        y: [0, -20, 0],
                        opacity: [0.2, 0.5, 0.2],
                      }}
                      transition={{
                        duration: 2 + i,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.3,
                      }}
                      className={`absolute w-2 h-2 bg-gradient-to-br ${item.color} rounded-full blur-sm`}
                      style={{
                        left: `${20 + i * 30}%`,
                        bottom: `${10 + i * 20}%`,
                      }}
                    />
                  ))}

                  <motion.div
                    animate={{
                      rotate: [0, 360],
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className={`w-20 h-20 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center text-white text-4xl font-bold mb-6 shadow-lg relative z-10`}
                  >
                    <motion.span
                      animate={{
                        scale: [1, 1.1, 1],
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {item.step}
                    </motion.span>
                  </motion.div>
                  <h3 className="text-3xl font-semibold text-gray-900 mb-4 relative z-10">{item.title}</h3>
                  <p className="text-lg text-gray-600 font-light leading-relaxed relative z-10">{item.description}</p>
                </motion.div>

                {index < 2 && (
                  <motion.div
                    animate={{
                      x: [0, 10, 0],
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="hidden md:block absolute top-1/2 -right-6 w-12 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400"
                  />
                )}
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-16"
          >
            <Link
              href="/auth/signup"
              className="inline-block px-10 py-5 bg-blue-600 text-white text-xl font-medium rounded-full hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
            >
              Get Started Free
            </Link>
          </motion.div>
        </div>
      </section>

      {/* AI Matching Section */}
      <section className="py-40 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-6xl font-bold text-gray-900 mb-6 leading-tight">
                AI finds your perfect match.
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed font-light">
                Describe your ideal study partner and our intelligent AI analyzes thousands of profiles to find the best matches for you.
              </p>
              <Link href="/features/ai-agent" className="text-blue-600 text-lg font-medium hover:underline">
                Learn more about AI matching →
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              {/* Stunning AI Visualization */}
              <div className="relative bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 rounded-3xl p-12 shadow-2xl overflow-hidden">
                {/* Animated Background */}
                <motion.div
                  animate={{
                    scale: [1, 1.5, 1],
                    rotate: [0, 180, 360],
                  }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl"
                />

                <div className="relative h-96">
                  {/* Center AI Core */}
                  <motion.div
                    animate={{
                      scale: [1, 1.15, 1],
                      boxShadow: ['0 0 20px rgba(255,255,255,0.3)', '0 0 60px rgba(255,255,255,0.6)', '0 0 20px rgba(255,255,255,0.3)'],
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white rounded-full shadow-2xl flex items-center justify-center"
                  >
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="w-24 h-24 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full"
                    />
                  </motion.div>

                  {/* Connection Lines */}
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={`line-${i}`}
                      initial={{ pathLength: 0 }}
                      animate={{
                        pathLength: [0, 1, 0],
                        opacity: [0.3, 0.8, 0.3],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        delay: i * 0.3,
                        ease: "easeInOut"
                      }}
                      className="absolute top-1/2 left-1/2 w-1 bg-white/40"
                      style={{
                        height: '150px',
                        transformOrigin: 'top center',
                        transform: `rotate(${i * 45}deg)`,
                      }}
                    />
                  ))}

                  {/* Profile Nodes */}
                  {[...Array(8)].map((_, i) => {
                    const angle = (i * 45) * (Math.PI / 180)
                    const radius = 150
                    return (
                      <motion.div
                        key={`node-${i}`}
                        initial={{ scale: 0 }}
                        animate={{
                          scale: [1, 1.3, 1],
                          y: [0, -10, 0],
                        }}
                        transition={{
                          duration: 2 + i * 0.2,
                          repeat: Infinity,
                          delay: i * 0.2,
                          ease: "easeInOut"
                        }}
                        className="absolute top-1/2 left-1/2 w-16 h-16 bg-white rounded-full shadow-xl border-4 border-purple-300/50"
                        style={{
                          transform: `translate(${Math.cos(angle) * radius - 32}px, ${Math.sin(angle) * radius - 32}px)`,
                        }}
                      >
                        <div className="w-full h-full bg-gradient-to-br from-blue-300 to-purple-400 rounded-full" />
                      </motion.div>
                    )
                  })}

                  {/* Floating Particles */}
                  {[...Array(15)].map((_, i) => (
                    <motion.div
                      key={`ai-particle-${i}`}
                      animate={{
                        y: [0, -100, 0],
                        x: [0, Math.sin(i) * 30, 0],
                        opacity: [0, 0.6, 0],
                      }}
                      transition={{
                        duration: 4 + Math.random() * 2,
                        repeat: Infinity,
                        delay: i * 0.3,
                        ease: "easeInOut"
                      }}
                      className="absolute w-1 h-1 bg-white rounded-full"
                      style={{
                        left: `${Math.random() * 100}%`,
                        bottom: '0',
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Collaboration Section */}
      <section className="py-40 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-2 md:order-1"
            >
              {/* Stunning Video Call Visual */}
              <div className="bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                {/* Animated Background Waves */}
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={`wave-${i}`}
                    animate={{
                      x: [-100, 100, -100],
                      opacity: [0.1, 0.2, 0.1],
                    }}
                    transition={{
                      duration: 8 + i * 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.5,
                    }}
                    className="absolute w-96 h-96 bg-white rounded-full blur-3xl"
                    style={{
                      top: `${i * 30}%`,
                      left: `${i * 20}%`,
                    }}
                  />
                ))}

                <div className="relative grid grid-cols-2 gap-4 mb-8">
                  {[1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{
                        scale: [1, 1.05, 1],
                        opacity: [0.8, 1, 0.8],
                      }}
                      transition={{
                        duration: 3,
                        delay: i * 0.3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="aspect-square bg-white/15 backdrop-blur-md rounded-2xl border-2 border-white/30 flex items-center justify-center relative overflow-hidden"
                    >
                      {/* Animated Avatar */}
                      <motion.div
                        animate={{
                          scale: [1, 1.1, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                        className="w-20 h-20 bg-gradient-to-br from-white/30 to-white/10 rounded-full"
                      />

                      {/* Speaking Indicator */}
                      <motion.div
                        animate={{
                          scale: [0, 1.2, 0],
                          opacity: [0, 0.6, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.5,
                        }}
                        className="absolute inset-0 border-4 border-green-400 rounded-2xl"
                      />

                      {/* Floating Particles */}
                      {[...Array(3)].map((_, j) => (
                        <motion.div
                          key={j}
                          animate={{
                            y: [0, -20, 0],
                            opacity: [0, 0.5, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: j * 0.3 + i * 0.1,
                          }}
                          className="absolute w-1 h-1 bg-white rounded-full"
                          style={{
                            left: `${20 + j * 30}%`,
                            bottom: '10%',
                          }}
                        />
                      ))}
                    </motion.div>
                  ))}
                </div>

                <div className="relative flex justify-center gap-4 bg-black/30 backdrop-blur-md rounded-2xl p-6">
                  {/* Mic Button */}
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center cursor-pointer relative"
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.2, 1],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-6 h-8 bg-white/50 rounded"
                    />
                  </motion.div>

                  {/* Camera Button */}
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center cursor-pointer"
                  >
                    <div className="w-8 h-6 bg-white/50 rounded-md" />
                  </motion.div>

                  {/* End Call Button */}
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    animate={{
                      boxShadow: ['0 0 0 0 rgba(239, 68, 68, 0.4)', '0 0 0 20px rgba(239, 68, 68, 0)', '0 0 0 0 rgba(239, 68, 68, 0)'],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-14 h-14 bg-red-500 rounded-full shadow-lg cursor-pointer flex items-center justify-center"
                  >
                    <div className="w-6 h-1 bg-white rounded-full transform rotate-45" />
                  </motion.div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-1 md:order-2"
            >
              <h2 className="text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Study together, anywhere.
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed font-light">
                Connect through HD video calls, real-time chat, and shared whiteboards. Everything you need for productive study sessions.
              </p>
              <Link href="/features/real-time-collaboration" className="text-blue-600 text-lg font-medium hover:underline">
                Explore collaboration tools →
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-40 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-6xl font-bold text-gray-900 mb-6">
              Everything you need.
            </h2>
            <p className="text-xl text-gray-600 font-light max-w-2xl mx-auto">
              Powerful features designed for collaborative learning.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: 'AI Agent',
                description: 'Intelligent matching finds your perfect study partners automatically.',
                href: '/features/ai-agent',
                gradient: 'from-blue-500 to-indigo-600'
              },
              {
                title: 'Real-time Collaboration',
                description: 'Video calls, chat, and whiteboards for seamless studying together.',
                href: '/features/real-time-collaboration',
                gradient: 'from-indigo-500 to-purple-600'
              },
              {
                title: 'Study Groups',
                description: 'Create and join groups tailored to your subjects and goals.',
                href: '/features/study-groups',
                gradient: 'from-purple-500 to-pink-600'
              },
              {
                title: 'Community',
                description: 'Connect with thousands of learners and share knowledge.',
                href: '/features/community',
                gradient: 'from-pink-500 to-rose-600'
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={feature.href} className="block group">
                  <motion.div
                    whileHover={{ y: -10, scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 h-full relative overflow-hidden"
                  >
                    {/* Animated Gradient Background */}
                    <motion.div
                      animate={{
                        scale: [1, 1.3, 1],
                        rotate: [0, 90, 0],
                        opacity: [0.1, 0.2, 0.1],
                      }}
                      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: index * 0.5 }}
                      className={`absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br ${feature.gradient} rounded-full blur-3xl`}
                    />

                    {/* Floating Particles */}
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          y: [0, -30, 0],
                          x: [0, Math.sin(i) * 10, 0],
                          opacity: [0.2, 0.6, 0.2],
                        }}
                        transition={{
                          duration: 3 + i * 0.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.2,
                        }}
                        className={`absolute w-2 h-2 bg-gradient-to-br ${feature.gradient} rounded-full blur-sm`}
                        style={{
                          left: `${10 + i * 20}%`,
                          bottom: `${5 + i * 10}%`,
                        }}
                      />
                    ))}

                    {/* Animated Icon */}
                    <motion.div
                      animate={{
                        rotate: [0, 360],
                      }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="relative mb-6"
                    >
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        className={`w-20 h-20 bg-gradient-to-br ${feature.gradient} rounded-2xl shadow-lg flex items-center justify-center relative z-10`}
                      >
                        <motion.div
                          animate={{
                            scale: [1, 1.2, 1],
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="w-10 h-10 bg-white/30 rounded-xl backdrop-blur"
                        />
                      </motion.div>
                    </motion.div>

                    <h3 className="text-3xl font-semibold text-gray-900 mb-4 relative z-10">{feature.title}</h3>
                    <p className="text-lg text-gray-600 font-light leading-relaxed mb-6 relative z-10">{feature.description}</p>
                    <motion.span
                      className="text-blue-600 font-medium group-hover:underline relative z-10 inline-flex items-center gap-2"
                    >
                      Learn more
                      <motion.span
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        →
                      </motion.span>
                    </motion.span>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-40 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-6xl font-bold text-gray-900 mb-6">
              Questions?
            </h2>
            <p className="text-xl text-gray-600 font-light">
              Everything you need to know about Clerva.
            </p>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                q: 'How does the AI matching work?',
                a: 'Our AI analyzes your profile including subjects, learning style, goals, and availability. It then finds partners who complement your needs and preferences, creating optimal study matches.'
              },
              {
                q: 'Is Clerva free to use?',
                a: 'Yes! Clerva is completely free for all students. We believe everyone deserves access to quality study resources and connections.'
              },
              {
                q: 'How do study sessions work?',
                a: 'Once matched with a partner, you can schedule sessions, chat in real-time, join video calls, use shared whiteboards, and collaborate on notes - all within the platform.'
              },
              {
                q: 'Can I create private study groups?',
                a: 'Absolutely! You can create both public and private study groups, invite specific members, and manage group settings to fit your needs.'
              },
              {
                q: 'What subjects are supported?',
                a: 'All subjects! From mathematics and sciences to languages, arts, and professional development - if you\'re learning it, Clerva supports it.'
              },
              {
                q: 'Is my data private and secure?',
                a: 'Yes. We use enterprise-grade encryption and never share your personal information. Your privacy and security are our top priorities.'
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="border-b border-gray-200 last:border-0"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-8 text-left flex items-start justify-between hover:bg-gray-50 transition-colors rounded-lg"
                >
                  <span className="text-xl font-semibold text-gray-900 pr-8">{faq.q}</span>
                  <motion.svg
                    animate={{ rotate: openFaq === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-6 h-6 text-gray-400 flex-shrink-0 mt-1"
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
                  <div className="px-6 pb-8 text-lg text-gray-600 leading-relaxed font-light">
                    {faq.a}
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-6xl md:text-7xl font-bold text-white mb-8 leading-tight">
              Start learning<br />together today.
            </h2>
            <p className="text-2xl text-blue-100 mb-12 font-light">
              Join thousands of students achieving their goals with Clerva.
            </p>
            <Link
              href="/auth/signup"
              className="inline-block px-12 py-5 bg-white text-blue-600 rounded-full text-xl font-semibold hover:bg-gray-50 transition-all shadow-xl"
            >
              Get Started
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-center items-center gap-12 mb-8">
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-gray-600 hover:text-gray-900 transition font-medium"
            >
              Features
            </button>
            <button
              onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-gray-600 hover:text-gray-900 transition font-medium"
            >
              FAQ
            </button>
          </div>
          <div className="text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} Clerva. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
