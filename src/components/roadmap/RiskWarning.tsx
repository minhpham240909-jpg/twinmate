'use client'

/**
 * RISK WARNING COMPONENT
 *
 * Displays critical warnings and common mistakes for a roadmap step.
 * Two variants:
 * - Critical: Major warning that can derail the entire roadmap
 * - Step: Warnings specific to a step
 *
 * Design: Clear, impactful, but not alarming
 */

import { memo, useState } from 'react'
import {
  AlertTriangle,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface CriticalWarning {
  warning: string
  consequence: string
  severity: 'CRITICAL'
}

interface StepRisk {
  warning: string
  consequence: string
  severity: 'RISK' | 'WARNING'
}

interface RiskWarningProps {
  // For roadmap-level critical warning
  criticalWarning?: CriticalWarning
  // For step-level risk
  stepRisk?: StepRisk
  // Common mistakes (optional)
  commonMistakes?: string[]
  // Display options
  variant?: 'critical' | 'step' | 'inline'
  className?: string
  defaultExpanded?: boolean
}

// ============================================
// COMPONENT
// ============================================

export const RiskWarning = memo(function RiskWarning({
  criticalWarning,
  stepRisk,
  commonMistakes,
  variant = 'step',
  className = '',
  defaultExpanded = false,
}: RiskWarningProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const warning = criticalWarning || stepRisk
  const isCritical = variant === 'critical' || criticalWarning?.severity === 'CRITICAL'

  // Don't render if no warning content
  if (!warning && !commonMistakes?.length) {
    return null
  }

  // Inline variant - simple, compact display
  if (variant === 'inline') {
    return (
      <div
        className={`
          flex items-start gap-2 p-3 rounded-lg
          ${isCritical
            ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50'
            : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50'
          }
          ${className}
        `}
      >
        <AlertTriangle
          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
            isCritical
              ? 'text-red-500 dark:text-red-400'
              : 'text-amber-500 dark:text-amber-400'
          }`}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              isCritical
                ? 'text-red-700 dark:text-red-300'
                : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {warning?.warning}
          </p>
          {warning?.consequence && (
            <p
              className={`text-xs mt-0.5 ${
                isCritical
                  ? 'text-red-600/80 dark:text-red-400/80'
                  : 'text-amber-600/80 dark:text-amber-400/80'
              }`}
            >
              {warning.consequence}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Full variant - expandable with common mistakes
  return (
    <div
      className={`
        rounded-xl overflow-hidden
        ${isCritical
          ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50'
          : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50'
        }
        ${className}
      `}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          w-full p-4 flex items-start gap-3 text-left transition-colors
          ${isCritical
            ? 'hover:bg-red-100/50 dark:hover:bg-red-900/20'
            : 'hover:bg-amber-100/50 dark:hover:bg-amber-900/20'
          }
        `}
      >
        {/* Icon */}
        <div
          className={`p-2 rounded-lg ${
            isCritical
              ? 'bg-red-100 dark:bg-red-900/50'
              : 'bg-amber-100 dark:bg-amber-900/50'
          }`}
        >
          {isCritical ? (
            <AlertOctagon
              className={`w-5 h-5 ${
                isCritical
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            />
          ) : (
            <AlertTriangle
              className={`w-5 h-5 ${
                isCritical
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4
            className={`font-semibold text-sm uppercase tracking-wide mb-1 ${
              isCritical
                ? 'text-red-700 dark:text-red-300'
                : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {isCritical ? 'Critical Warning' : 'Watch Out'}
          </h4>
          <p
            className={`text-sm ${
              isCritical
                ? 'text-red-800 dark:text-red-200'
                : 'text-amber-800 dark:text-amber-200'
            }`}
          >
            {warning?.warning}
          </p>
        </div>

        {/* Expand icon */}
        {(warning?.consequence || commonMistakes?.length) && (
          <div
            className={`p-1 ${
              isCritical
                ? 'text-red-500 dark:text-red-400'
                : 'text-amber-500 dark:text-amber-400'
            }`}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (warning?.consequence || commonMistakes?.length) && (
        <div className="px-4 pb-4 space-y-4">
          {/* Consequence */}
          {warning?.consequence && (
            <div
              className={`p-3 rounded-lg ${
                isCritical
                  ? 'bg-red-100/50 dark:bg-red-900/30'
                  : 'bg-amber-100/50 dark:bg-amber-900/30'
              }`}
            >
              <p
                className={`text-xs font-medium uppercase tracking-wide mb-1 ${
                  isCritical
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                If You Ignore This
              </p>
              <p
                className={`text-sm ${
                  isCritical
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {warning.consequence}
              </p>
            </div>
          )}

          {/* Common mistakes */}
          {commonMistakes && commonMistakes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield
                  className={`w-4 h-4 ${
                    isCritical
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-amber-500 dark:text-amber-400'
                  }`}
                />
                <p
                  className={`text-xs font-medium uppercase tracking-wide ${
                    isCritical
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  Common Mistakes
                </p>
              </div>
              <ul className="space-y-2">
                {commonMistakes.map((mistake, index) => (
                  <li
                    key={index}
                    className={`flex items-start gap-2 text-sm ${
                      isCritical
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    <span className="text-xs mt-1">•</span>
                    <span>{mistake}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default RiskWarning
