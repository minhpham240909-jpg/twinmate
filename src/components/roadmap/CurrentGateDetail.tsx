'use client'

/**
 * CURRENT GATE DETAIL
 *
 * Full detail view of the current training gate.
 * Shows training loop, standards, fail conditions, and identity transformation.
 *
 * Design principles:
 * - Standards are prominent
 * - Fail conditions are clear
 * - Identity transformation is explicit
 * - No gamification
 * - Professional, slightly strict tone
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
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
  const [showResources, setShowResources] = useState(false)

  return (
    <div className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-neutral-950">
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

          {/* Failure being eliminated */}
          {gate.failureToEliminate && (
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              <span className="font-medium">Eliminates:</span> {gate.failureToEliminate}
            </div>
          )}
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
          {/* Why This Gate */}
          {gate.whyFirst && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-3">
                Why This Gate First
              </div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                {gate.whyFirst}
              </p>
            </div>
          )}

          {/* Capability You Gain */}
          {gate.capability && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
              <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-3">
                After passing this gate, you can
              </div>
              <p className="text-lg font-medium text-neutral-800 dark:text-neutral-200">
                {gate.capability}
              </p>
            </div>
          )}

          {/* Training Protocol */}
          {gate.method && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-3">
                Training Protocol
              </div>
              <div className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                {gate.method}
              </div>
            </div>
          )}

          {/* Training Loop */}
          {gate.trainingLoop && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-4">
                Training Loop
              </div>
              <div className="space-y-3">
                <div className="flex gap-4">
                  <div className="w-20 text-xs font-medium text-neutral-500 uppercase">Input</div>
                  <div className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">
                    {gate.trainingLoop.input}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-20 text-xs font-medium text-neutral-500 uppercase">Output</div>
                  <div className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">
                    {gate.trainingLoop.output}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-20 text-xs font-medium text-neutral-500 uppercase">Constraint</div>
                  <div className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">
                    {gate.trainingLoop.constraint}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-20 text-xs font-medium text-neutral-500 uppercase">Validation</div>
                  <div className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">
                    {gate.trainingLoop.validation}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Common Mistakes */}
          {gate.commonMistakes && gate.commonMistakes.length > 0 && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-3">
                What You Must NOT Do
              </div>
              <div className="space-y-3">
                {gate.commonMistakes.map((mistake, i) => {
                  const trap = typeof mistake === 'string' ? mistake : mistake.trap
                  const consequence = typeof mistake === 'string' ? null : mistake.consequence
                  return (
                    <div key={i} className="text-sm">
                      <div className="text-neutral-700 dark:text-neutral-300">
                        {trap}
                      </div>
                      {consequence && (
                        <div className="text-neutral-500 text-xs mt-1">
                          → {consequence}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Fake Progress Warnings - ELITE CONTENT */}
          {gate.fakeProgressWarnings && gate.fakeProgressWarnings.length > 0 && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-amber-50 dark:bg-amber-950/30">
              <div className="text-xs font-medium tracking-widest text-amber-600 dark:text-amber-400 uppercase mb-3">
                This Feels Like Progress But Isn&apos;t
              </div>
              <div className="space-y-2">
                {gate.fakeProgressWarnings.map((warning: string, i: number) => (
                  <div key={i} className="text-sm text-amber-800 dark:text-amber-200">
                    • {warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Standards Section */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
            <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-4">
              Standards
            </div>

            {/* Pass Bar (from new standards or passCondition) */}
            {(gate.standards?.passBar || gate.passCondition || gate.selfTest?.passCriteria) && (
              <div className="mb-4">
                <div className="text-xs font-medium text-neutral-500 uppercase mb-2">
                  Pass Bar
                </div>
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  {gate.standards?.passBar || gate.passCondition || gate.selfTest?.passCriteria}
                </div>
              </div>
            )}

            {/* Fail Conditions (from new standards or failConditions) */}
            {((gate.standards?.failConditions && gate.standards.failConditions.length > 0) ||
              (gate.failConditions && gate.failConditions.length > 0)) && (
              <div className="mb-4">
                <div className="text-xs font-medium text-neutral-500 uppercase mb-2">
                  You have NOT passed if
                </div>
                <ul className="space-y-1">
                  {(gate.standards?.failConditions || gate.failConditions || []).map((fail: string | { condition: string }, i: number) => {
                    const condition = typeof fail === 'string' ? fail : fail.condition
                    return (
                      <li key={i} className="text-sm text-neutral-700 dark:text-neutral-300">
                        • {condition}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Quality Check (new elite content) */}
            {gate.standards?.qualityCheck && (
              <div className="mb-4">
                <div className="text-xs font-medium text-neutral-500 uppercase mb-2">
                  Quality Check
                </div>
                <div className="text-sm text-neutral-700 dark:text-neutral-300">
                  {gate.standards.qualityCheck}
                </div>
              </div>
            )}

            {/* Self Test Fail Criteria */}
            {gate.selfTest?.failCriteria && (
              <div className="mb-4">
                <div className="text-xs font-medium text-neutral-500 uppercase mb-2">
                  Failure looks like
                </div>
                <div className="text-sm text-neutral-700 dark:text-neutral-300">
                  {gate.selfTest.failCriteria}
                </div>
              </div>
            )}

            {/* Repeat Rule (from new standards or repeatInstruction) */}
            {(gate.standards?.repeatRule || gate.repeatInstruction) && (
              <div>
                <div className="text-xs font-medium text-neutral-500 uppercase mb-2">
                  If you fail
                </div>
                <div className="text-sm text-neutral-700 dark:text-neutral-300">
                  {gate.standards?.repeatRule || gate.repeatInstruction}
                </div>
              </div>
            )}
          </div>

          {/* Self Test Challenge */}
          {gate.selfTest?.challenge && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-3">
                Readiness Check
              </div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                {gate.selfTest.challenge}
              </p>
            </div>
          )}

          {/* Identity Transformation */}
          {(gate.identityBefore || gate.identityAfter) && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
              <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-3">
                Identity Shift
              </div>
              <div className="flex items-center gap-4">
                {gate.identityBefore && (
                  <div className="text-sm text-neutral-500">
                    {gate.identityBefore}
                  </div>
                )}
                {gate.identityBefore && gate.identityAfter && (
                  <div className="text-neutral-400">→</div>
                )}
                {gate.identityAfter && (
                  <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    {gate.identityAfter}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success Signals - ELITE CONTENT: What Success Feels Like */}
          {gate.successSignals && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-emerald-50 dark:bg-emerald-950/30">
              <div className="text-xs font-medium tracking-widest text-emerald-600 dark:text-emerald-400 uppercase mb-4">
                What Success Feels Like
              </div>
              <div className="space-y-4">
                {gate.successSignals.feelsLike && (
                  <div>
                    <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 uppercase mb-1">
                      The Feeling
                    </div>
                    <div className="text-sm text-emerald-800 dark:text-emerald-200">
                      {gate.successSignals.feelsLike}
                    </div>
                  </div>
                )}
                {gate.successSignals.behaviorChange && (
                  <div>
                    <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 uppercase mb-1">
                      How You&apos;ll Act Differently
                    </div>
                    <div className="text-sm text-emerald-800 dark:text-emerald-200">
                      {gate.successSignals.behaviorChange}
                    </div>
                  </div>
                )}
                {gate.successSignals.confidenceMarker && (
                  <div>
                    <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 uppercase mb-1">
                      You&apos;ll Know You&apos;ve Made It When
                    </div>
                    <div className="text-sm text-emerald-800 dark:text-emerald-200">
                      {gate.successSignals.confidenceMarker}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Abilities You Unlock */}
          {gate.abilities && gate.abilities.length > 0 && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-3">
                Abilities You Unlock
              </div>
              <ul className="space-y-2">
                {gate.abilities.map((ability: string, i: number) => (
                  <li key={i} className="text-sm text-neutral-700 dark:text-neutral-300">
                    • {ability}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Resources (collapsed by default) */}
          {gate.resources && gate.resources.length > 0 && (
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setShowResources(!showResources)}
                className="flex items-center gap-2 text-xs font-medium tracking-widest text-neutral-400 uppercase hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              >
                {showResources ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span>Curated Resources ({gate.resources.length})</span>
              </button>

              {showResources && (
                <div className="mt-4 space-y-2">
                  {gate.resources.map((resource, i) => (
                    <a
                      key={i}
                      href={resource.directUrl || `https://www.google.com/search?q=${encodeURIComponent(resource.searchQuery || resource.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onResourceClick?.(resource)}
                      className="flex items-center justify-between p-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors group"
                    >
                      <div>
                        <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                          {resource.title}
                        </div>
                        {resource.platformName && (
                          <div className="text-xs text-neutral-500">
                            {resource.platformName}
                          </div>
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Time (secondary, small) */}
          {gate.duration && (
            <div className="px-6 py-3 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-400">
              Typical duration: {gate.duration} minutes per session
            </div>
          )}

          {/* Complete Button */}
          <div className="p-6">
            <button
              onClick={onComplete}
              className="w-full py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium text-sm hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
            >
              I have passed this gate
            </button>
            <p className="text-xs text-neutral-400 text-center mt-2">
              Only mark as passed if you meet all pass conditions above.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default CurrentGateDetail
