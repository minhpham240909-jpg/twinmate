'use client'

import { motion } from 'framer-motion'
import { Heart, Calendar, Clock, AlertCircle, Lightbulb, ArrowRight } from 'lucide-react'

interface MatchInsightPanelProps {
  candidateName: string
  compatibilityScore: number
  complementarySkills: string[]
  risks: string[]
  jointStudyPlan: string[]
  canStudyNow: boolean
  nextBestTimes: Array<{ whenISO: string; confidence: number }>
  onStartNow?: () => void
  onScheduleLater?: (time: string) => void
}

export default function MatchInsightPanel({
  candidateName,
  compatibilityScore,
  complementarySkills,
  risks,
  jointStudyPlan,
  canStudyNow,
  nextBestTimes,
  onStartNow,
  onScheduleLater,
}: MatchInsightPanelProps) {
  const getCompatibilityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.6) return 'text-blue-600'
    if (score >= 0.4) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getCompatibilityBg = (score: number) => {
    if (score >= 0.8) return 'from-green-500 to-emerald-500'
    if (score >= 0.6) return 'from-blue-500 to-indigo-500'
    if (score >= 0.4) return 'from-yellow-500 to-orange-500'
    return 'from-red-500 to-pink-500'
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-3xl mx-auto"
    >
      {/* Header with Compatibility Score */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">
          Match Insight: {candidateName}
        </h2>

        <div className="relative inline-block">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className={`w-32 h-32 mx-auto rounded-full bg-gradient-to-br ${getCompatibilityBg(compatibilityScore)} flex items-center justify-center shadow-2xl`}
          >
            <div className="text-center">
              <p className="text-4xl font-bold text-white">
                {Math.round(compatibilityScore * 100)}%
              </p>
              <p className="text-sm text-white/90">Match</p>
            </div>
          </motion.div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm"
          />
        </div>
      </div>

      {/* Complementary Skills */}
      {complementarySkills.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-5 h-5 text-pink-600" />
            <h3 className="font-semibold text-slate-900">Complementary Skills</h3>
          </div>
          <div className="space-y-2">
            {complementarySkills.map((skill, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start gap-2 p-3 bg-pink-50 border border-pink-200 rounded-lg"
              >
                <div className="w-2 h-2 rounded-full bg-pink-600 mt-1.5" />
                <p className="text-sm text-slate-700">{skill}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Joint Study Plan */}
      {jointStudyPlan.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-slate-900">Suggested Study Plan</h3>
          </div>
          <div className="space-y-2">
            {jointStudyPlan.map((suggestion, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
              >
                <div className="w-2 h-2 rounded-full bg-yellow-600 mt-1.5" />
                <p className="text-sm text-slate-700">{suggestion}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Risks/Challenges */}
      {risks.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <h3 className="font-semibold text-slate-900">Things to Consider</h3>
          </div>
          <div className="space-y-2">
            {risks.map((risk, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg"
              >
                <div className="w-2 h-2 rounded-full bg-orange-600 mt-1.5" />
                <p className="text-sm text-slate-700">{risk}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="border-t border-slate-200 pt-6">
        {canStudyNow ? (
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onStartNow}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <Clock className="w-5 h-5" />
              Start Studying Now
              <ArrowRight className="w-5 h-5" />
            </motion.button>

            <p className="text-center text-sm text-slate-500">
              {candidateName} is online and available!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-sm text-slate-600 mb-3">
              {candidateName} is not available right now. Schedule for later:
            </p>

            {nextBestTimes.length > 0 ? (
              <div className="space-y-2">
                {nextBestTimes.map((slot, idx) => {
                  const formatted = formatTime(slot.whenISO)
                  return (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onScheduleLater?.(slot.whenISO)}
                      className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <div className="text-left">
                          <p className="font-semibold text-slate-900">{formatted.day}</p>
                          <p className="text-sm text-slate-600">{formatted.time}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-blue-600" />
                    </motion.button>
                  )
                })}
              </div>
            ) : (
              <p className="text-center text-sm text-slate-500">
                No overlapping availability found. Try sending a message!
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
