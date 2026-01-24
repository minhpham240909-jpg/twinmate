'use client'

/**
 * Confirm Modal
 *
 * A professional replacement for browser alert() and confirm() dialogs.
 * Supports different variants: info, warning, danger, success
 *
 * Usage:
 * - For alerts (info only): Pass only onConfirm, no onCancel
 * - For confirmations: Pass both onConfirm and onCancel
 */

import { useEffect, useRef, useCallback } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
} from 'lucide-react'

export type ModalVariant = 'info' | 'warning' | 'danger' | 'success'

export interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  variant?: ModalVariant
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel?: () => void
  /** If true, modal cannot be closed by clicking backdrop or pressing Escape */
  requireAction?: boolean
}

const variantConfig = {
  info: {
    icon: Info,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    confirmColor: 'bg-blue-600 hover:bg-blue-700',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-yellow-500',
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
    confirmColor: 'bg-yellow-600 hover:bg-yellow-700',
  },
  danger: {
    icon: AlertCircle,
    iconColor: 'text-red-500',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    confirmColor: 'bg-red-600 hover:bg-red-700',
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    confirmColor: 'bg-green-600 hover:bg-green-700',
  },
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  variant = 'info',
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  requireAction = false,
}: ConfirmModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const config = variantConfig[variant]
  const Icon = config.icon
  const isAlert = !onCancel

  // Focus trap and keyboard handling
  useEffect(() => {
    if (isOpen) {
      // Focus the confirm button when modal opens
      confirmButtonRef.current?.focus()

      // Handle Escape key
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !requireAction) {
          if (onCancel) {
            onCancel()
          } else {
            onConfirm()
          }
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'

      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
      }
    }
  }, [isOpen, onCancel, onConfirm, requireAction])

  const handleBackdropClick = useCallback(() => {
    if (!requireAction) {
      if (onCancel) {
        onCancel()
      } else {
        onConfirm()
      }
    }
  }, [requireAction, onCancel, onConfirm])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Close button - only show if not requiring action and has cancel handler */}
        {!requireAction && (
          <button
            onClick={onCancel || onConfirm}
            className="absolute top-3 right-3 p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Content */}
        <div className="p-6 pt-8 text-center">
          {/* Icon */}
          <div
            className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${config.iconBg}`}
          >
            <Icon className={`w-7 h-7 ${config.iconColor}`} />
          </div>

          {/* Title */}
          <h2
            id="modal-title"
            className="text-lg font-bold text-neutral-900 dark:text-white mb-2"
          >
            {title}
          </h2>

          {/* Message */}
          <p
            id="modal-description"
            className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed"
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className={`px-6 pb-6 ${isAlert ? '' : 'flex gap-3'}`}>
          {!isAlert && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={`${isAlert ? 'w-full' : 'flex-1'} py-3 ${config.confirmColor} text-white rounded-xl font-semibold transition-colors shadow-lg`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
