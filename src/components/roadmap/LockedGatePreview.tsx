'use client'

/**
 * LOCKED GATE PREVIEW
 *
 * Shows a locked gate with minimal information.
 * Communicates that access must be earned, not scrolled to.
 *
 * Shows:
 * - Gate number and title
 * - What failure mode it eliminates
 * - What capability you'll gain (preview)
 * - Why it requires the previous gate
 *
 * Does NOT show:
 * - Duration estimates
 * - Full training content
 * - Resources
 * - Detailed instructions
 */

import { Lock } from 'lucide-react'
import type { GateStep } from './GatedPhaseStack'

// ============================================
// TYPES
// ============================================

interface LockedGatePreviewProps {
  gate: GateStep
  gateNumber: number
  previousGateTitle?: string
}

// ============================================
// MAIN COMPONENT
// ============================================

export function LockedGatePreview({
  gate,
  gateNumber,
  previousGateTitle,
}: LockedGatePreviewProps) {
  return (
    <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 opacity-70">
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Lock icon */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
            <Lock className="w-4 h-4 text-neutral-400" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Gate number */}
            <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-1">
              Gate {gateNumber}
            </div>

            {/* Title */}
            <h4 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
              {gate.title}
            </h4>

            {/* What it eliminates */}
            {gate.failureToEliminate && (
              <div className="text-xs text-neutral-400 mb-2">
                <span className="font-medium">Eliminates:</span> {gate.failureToEliminate}
              </div>
            )}

            {/* Preview ability */}
            {(gate.capability || (gate.previewAbilities && gate.previewAbilities.length > 0)) && (
              <div className="text-xs text-neutral-400">
                <span className="font-medium">You will be able to:</span>{' '}
                {gate.capability || gate.previewAbilities?.[0]}
              </div>
            )}

            {/* Why after previous */}
            {gate.whyAfterPrevious && previousGateTitle && (
              <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <div className="text-xs text-neutral-400">
                  <span className="font-medium">Requires:</span> Passing "{previousGateTitle}"
                </div>
                <div className="text-xs text-neutral-400 mt-1 italic">
                  {gate.whyAfterPrevious}
                </div>
              </div>
            )}

            {/* Identity shift preview */}
            {gate.identityAfter && (
              <div className="mt-3 text-xs text-neutral-400">
                <span className="font-medium">You become:</span> {gate.identityAfter}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LockedGatePreview
