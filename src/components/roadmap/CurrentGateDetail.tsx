'use client'

/**
 * CURRENT GATE DETAIL
 *
 * Full detail view of the current training gate.
 * Redesigned with warm mentor voice and clear action focus.
 *
 * Design principles:
 * - Today's Focus is FIRST and prominent
 * - Exit conditions are checkboxes
 * - Warm, encouraging tone
 * - Resources are visible, not hidden
 * - Less overwhelming, more actionable
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, CheckCircle2, Circle, Sparkles, AlertCircle } from 'lucide-react'
import type { GateStep } from './GatedPhaseStack'

// ============================================
// TYPES
// ============================================

interface StepResource {
  type: string
  title: string
  description?: string
  searchQuery?: string
  platformId?: string
  platformName?: string
  directUrl?: string
}

interface CurrentGateDetailProps {
  gate: GateStep
  roadmapId: string
  isExpanded: boolean
  onToggle: () => void
  onComplete?: () => void
  onResourceClick?: (resource: StepResource) => void
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CurrentGateDetail({
  gate,
  roadmapId,
  isExpanded,
  onToggle,
  onComplete,
  onResourceClick,
}: CurrentGateDetailProps) {
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  const [checkedConditions, setCheckedConditions] = useState<Set<number>>(new Set())

  // Get exit conditions from various sources
  const exitConditions: string[] = (gate as { exitConditions?: string[] }).exitConditions ||
    (gate.selfTest?.passCriteria ? [gate.selfTest.passCriteria] : []) ||
    (gate.passCondition ? [gate.passCondition] : [])

  // Check if all conditions are met
  const allConditionsMet = exitConditions.length > 0 && checkedConditions.size === exitConditions.length

  const toggleCondition = (index: number) => {
    const newChecked = new Set(checkedConditions)
    if (newChecked.has(index)) {
      newChecked.delete(index)
    } else {
      newChecked.add(index)
    }
    setCheckedConditions(newChecked)
  }

  // Get today's focus from new structure or build from legacy
  const todaysFocus = (gate as { todaysFocus?: { action: string; where: string; duration: string; output: string } }).todaysFocus
  const whyThisMattersForYou = (gate as { whyThisMattersForYou?: string }).whyThisMattersForYou
  const commonTrap = (gate as { commonTrap?: { temptation: string; whyItFeelsRight: string; whyItFails: string; betterApproach: string } }).commonTrap
  const encouragement = (gate as { encouragement?: string }).encouragement

  return (
    <div className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-neutral-950 rounded-lg overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full p-6 text-left flex items-start justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
      >
        <div className="flex-1">
          <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-2">
            Gate {gate.order}
          </div>
          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            {gate.title}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {gate.description}
          </p>
        </div>

        <div className="flex-shrink-0 ml-4">
          {isExpanded ? (
            <ChevronUp className="w-6 h-6 text-neutral-400" />
          ) : (
            <ChevronDown className="w-6 h-6 text-neutral-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-800">

          {/* TODAY'S FOCUS - Primary action (MOST IMPORTANT) */}
          <div className="p-6 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div className="text-xs font-medium tracking-widest text-blue-600 dark:text-blue-400 uppercase">
                Today&apos;s Focus
              </div>
            </div>

            {todaysFocus ? (
              <div className="space-y-3">
                <p className="text-base font-medium text-blue-900 dark:text-blue-100">
                  {todaysFocus.action}
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-blue-700 dark:text-blue-300">
                    📍 {todaysFocus.where}
                  </span>
                  <span className="text-blue-700 dark:text-blue-300">
                    ⏱️ {todaysFocus.duration}
                  </span>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  → When done: {todaysFocus.output}
                </p>
              </div>
            ) : (
              <p className="text-base font-medium text-blue-900 dark:text-blue-100">
                {gate.method?.split('\n')[0] || gate.description}
              </p>
            )}
          </div>

          {/* Resources - Visible early, not hidden */}
          {gate.resources && gate.resources.length > 0 && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-3">
                Start Here
              </div>
              <div className="space-y-2">
                {gate.resources.slice(0, 3).map((resource, i) => (
                  <a
                    key={i}
                    href={resource.directUrl || `https://www.google.com/search?q=${encodeURIComponent(resource.searchQuery || resource.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onResourceClick?.(resource)}
                    className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors group"
                  >
                    <div>
                      <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {resource.title}
                      </div>
                      {resource.description && (
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {resource.description}
                        </div>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Why This Matters For You - Personalized */}
          {(whyThisMattersForYou || gate.whyFirst) && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-3">
                Why This Matters For You
              </div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                {whyThisMattersForYou || gate.whyFirst}
              </p>
            </div>
          )}

          {/* EXIT CONDITIONS - Checkboxes */}
          {exitConditions.length > 0 && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
              <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-4">
                ✅ You&apos;re Ready to Move On When
              </div>
              <div className="space-y-3">
                {exitConditions.map((condition, i) => (
                  <button
                    key={i}
                    onClick={() => toggleCondition(i)}
                    className="flex items-start gap-3 w-full text-left group"
                  >
                    {checkedConditions.has(i) ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-600 flex-shrink-0 mt-0.5 group-hover:text-neutral-400" />
                    )}
                    <span className={`text-sm ${checkedConditions.has(i) ? 'text-green-700 dark:text-green-300 line-through opacity-70' : 'text-neutral-700 dark:text-neutral-300'}`}>
                      {condition}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Common Trap - Warm mentor voice */}
          {(commonTrap || (gate.commonMistakes && gate.commonMistakes.length > 0)) && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-amber-50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <div className="text-xs font-medium tracking-widest text-amber-600 dark:text-amber-400 uppercase">
                  Watch Out For This
                </div>
              </div>

              {commonTrap ? (
                <div className="space-y-2 text-sm">
                  <p className="text-amber-800 dark:text-amber-200">
                    <span className="font-medium">You&apos;ll be tempted to:</span> {commonTrap.temptation}
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 opacity-80">
                    It feels right because {commonTrap.whyItFeelsRight.toLowerCase()}
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 opacity-80">
                    But actually: {commonTrap.whyItFails}
                  </p>
                  <p className="text-amber-800 dark:text-amber-200 font-medium mt-2">
                    💡 Instead: {commonTrap.betterApproach}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {gate.commonMistakes?.slice(0, 2).map((mistake, i) => {
                    const trap = typeof mistake === 'string' ? mistake : mistake.trap
                    return (
                      <p key={i} className="text-sm text-amber-800 dark:text-amber-200">
                        • {trap}
                      </p>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Show More Details Toggle */}
          <div className="px-6 py-3 border-b border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => setShowMoreDetails(!showMoreDetails)}
              className="flex items-center gap-2 text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              {showMoreDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span>{showMoreDetails ? 'Hide details' : 'Show more details'}</span>
            </button>
          </div>

          {/* Additional Details (collapsed by default) */}
          {showMoreDetails && (
            <>
              {/* Training Method */}
              {gate.method && (
                <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-3">
                    Day-by-Day Guide
                  </div>
                  <div className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                    {gate.method}
                  </div>
                </div>
              )}

              {/* Success Signals */}
              {gate.successSignals && (
                <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-emerald-50 dark:bg-emerald-950/20">
                  <div className="text-xs font-medium tracking-widest text-emerald-600 dark:text-emerald-400 uppercase mb-3">
                    What Success Feels Like
                  </div>
                  <div className="space-y-2 text-sm text-emerald-800 dark:text-emerald-200">
                    {gate.successSignals.feelsLike && (
                      <p>{gate.successSignals.feelsLike}</p>
                    )}
                    {(gate.successSignals as { youllKnow?: string }).youllKnow && (
                      <p className="font-medium">
                        You&apos;ll know you&apos;re ready when: {(gate.successSignals as { youllKnow?: string }).youllKnow}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Abilities You Unlock */}
              {gate.abilities && gate.abilities.length > 0 && (
                <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-3">
                    After This, You&apos;ll Be Able To
                  </div>
                  <ul className="space-y-2">
                    {gate.abilities.map((ability: string, i: number) => (
                      <li key={i} className="text-sm text-neutral-700 dark:text-neutral-300 flex items-start gap-2">
                        <span className="text-green-500">✓</span>
                        {ability}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Time estimate */}
              {gate.duration && (
                <div className="px-6 py-3 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-500">
                  ⏱️ About {gate.duration} minutes per session
                </div>
              )}
            </>
          )}

          {/* Encouragement */}
          {encouragement && (
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-b border-neutral-200 dark:border-neutral-800">
              <p className="text-sm text-neutral-700 dark:text-neutral-300 italic">
                💪 {encouragement}
              </p>
            </div>
          )}

          {/* Complete Button */}
          <div className="p-6">
            <button
              onClick={onComplete}
              disabled={exitConditions.length > 0 && !allConditionsMet}
              className={`w-full py-3 font-medium text-sm rounded-lg transition-all ${
                allConditionsMet || exitConditions.length === 0
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed'
              }`}
            >
              {allConditionsMet || exitConditions.length === 0 ? (
                <>✓ I&apos;ve completed this gate</>
              ) : (
                <>Check all conditions above to continue</>
              )}
            </button>
            {exitConditions.length > 0 && !allConditionsMet && (
              <p className="text-xs text-neutral-400 text-center mt-2">
                {checkedConditions.size} of {exitConditions.length} conditions met
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CurrentGateDetail
