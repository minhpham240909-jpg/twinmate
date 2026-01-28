'use client'

/**
 * useConfirmModal Hook
 *
 * A global modal system to replace browser alert() and confirm() dialogs.
 * Provides a clean API for showing confirmation modals from anywhere in the app.
 *
 * Usage:
 * ```tsx
 * const { showAlert, showConfirm, showDanger, ModalComponent } = useConfirmModal()
 *
 * // Show an info alert (like alert())
 * await showAlert('Title', 'Message')
 *
 * // Show a confirmation dialog (like confirm())
 * const confirmed = await showConfirm('Title', 'Are you sure?')
 * if (confirmed) { ... }
 *
 * // Show a danger confirmation (for destructive actions)
 * const confirmed = await showDanger('Delete Item', 'This cannot be undone.')
 * if (confirmed) { ... }
 * ```
 */

import { useState, useCallback, createContext, useContext, ReactNode } from 'react'
import ConfirmModal, { type ModalVariant } from '@/components/ConfirmModal'

interface ModalState {
  isOpen: boolean
  title: string
  message: string
  variant: ModalVariant
  confirmText: string
  cancelText: string
  requireAction: boolean
  resolve: ((value: boolean) => void) | null
}

interface ConfirmModalContextValue {
  showAlert: (title: string, message: string, confirmText?: string) => Promise<void>
  showConfirm: (title: string, message: string, confirmText?: string, cancelText?: string) => Promise<boolean>
  showDanger: (title: string, message: string, confirmText?: string, cancelText?: string) => Promise<boolean>
  showWarning: (title: string, message: string, confirmText?: string, cancelText?: string) => Promise<boolean>
  showSuccess: (title: string, message: string, confirmText?: string) => Promise<void>
}

const ConfirmModalContext = createContext<ConfirmModalContextValue | null>(null)

const initialState: ModalState = {
  isOpen: false,
  title: '',
  message: '',
  variant: 'info',
  confirmText: 'OK',
  cancelText: 'Cancel',
  requireAction: false,
  resolve: null,
}

export function ConfirmModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<ModalState>(initialState)

  const showModal = useCallback(
    (
      title: string,
      message: string,
      variant: ModalVariant,
      isConfirm: boolean,
      confirmText = 'OK',
      cancelText = 'Cancel',
      requireAction = false
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        // For non-confirm modals (alerts), we store the resolve function directly
        // and always resolve with true when closed
        // This fixes the stale closure issue where resolve was captured incorrectly
        const resolveHandler = isConfirm
          ? resolve
          : (_: boolean) => resolve(true) // Always resolve true for alerts

        setModalState({
          isOpen: true,
          title,
          message,
          variant,
          confirmText,
          cancelText,
          requireAction,
          resolve: resolveHandler,
        })
      })
    },
    []
  )

  const closeModal = useCallback((result: boolean) => {
    setModalState((prev) => {
      prev.resolve?.(result)
      return { ...initialState }
    })
  }, [])

  const showAlert = useCallback(
    async (title: string, message: string, confirmText = 'OK'): Promise<void> => {
      await showModal(title, message, 'info', false, confirmText)
    },
    [showModal]
  )

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      confirmText = 'Confirm',
      cancelText = 'Cancel'
    ): Promise<boolean> => {
      return showModal(title, message, 'info', true, confirmText, cancelText)
    },
    [showModal]
  )

  const showDanger = useCallback(
    (
      title: string,
      message: string,
      confirmText = 'Delete',
      cancelText = 'Cancel'
    ): Promise<boolean> => {
      return showModal(title, message, 'danger', true, confirmText, cancelText)
    },
    [showModal]
  )

  const showWarning = useCallback(
    (
      title: string,
      message: string,
      confirmText = 'Continue',
      cancelText = 'Cancel'
    ): Promise<boolean> => {
      return showModal(title, message, 'warning', true, confirmText, cancelText)
    },
    [showModal]
  )

  const showSuccess = useCallback(
    async (title: string, message: string, confirmText = 'OK'): Promise<void> => {
      await showModal(title, message, 'success', false, confirmText)
    },
    [showModal]
  )

  const contextValue: ConfirmModalContextValue = {
    showAlert,
    showConfirm,
    showDanger,
    showWarning,
    showSuccess,
  }

  return (
    <ConfirmModalContext.Provider value={contextValue}>
      {children}
      <ConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        variant={modalState.variant}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        requireAction={modalState.requireAction}
        onConfirm={() => closeModal(true)}
        onCancel={
          modalState.variant === 'info' && modalState.cancelText === 'Cancel'
            ? undefined
            : () => closeModal(false)
        }
      />
    </ConfirmModalContext.Provider>
  )
}

export function useConfirmModal(): ConfirmModalContextValue {
  const context = useContext(ConfirmModalContext)
  if (!context) {
    throw new Error('useConfirmModal must be used within a ConfirmModalProvider')
  }
  return context
}

/**
 * Standalone hook for components that need local modal state
 * (useful when you can't use the context provider)
 */
export function useLocalConfirmModal() {
  const [modalState, setModalState] = useState<ModalState>(initialState)

  const showModal = useCallback(
    (
      title: string,
      message: string,
      variant: ModalVariant,
      isConfirm: boolean,
      confirmText = 'OK',
      cancelText = 'Cancel'
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        // Fix stale closure: properly handle resolve for confirm vs alert modals
        const resolveHandler = isConfirm
          ? resolve
          : (_: boolean) => resolve(true) // Always resolve true for alerts

        setModalState({
          isOpen: true,
          title,
          message,
          variant,
          confirmText,
          cancelText,
          requireAction: false,
          resolve: resolveHandler,
        })
      })
    },
    []
  )

  const closeModal = useCallback((result: boolean) => {
    setModalState((prev) => {
      prev.resolve?.(result)
      return { ...initialState }
    })
  }, [])

  const showAlert = useCallback(
    async (title: string, message: string, confirmText = 'OK'): Promise<void> => {
      await showModal(title, message, 'info', false, confirmText)
    },
    [showModal]
  )

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      confirmText = 'Confirm',
      cancelText = 'Cancel'
    ): Promise<boolean> => {
      return showModal(title, message, 'info', true, confirmText, cancelText)
    },
    [showModal]
  )

  const showDanger = useCallback(
    (
      title: string,
      message: string,
      confirmText = 'Delete',
      cancelText = 'Cancel'
    ): Promise<boolean> => {
      return showModal(title, message, 'danger', true, confirmText, cancelText)
    },
    [showModal]
  )

  const showWarning = useCallback(
    (
      title: string,
      message: string,
      confirmText = 'Continue',
      cancelText = 'Cancel'
    ): Promise<boolean> => {
      return showModal(title, message, 'warning', true, confirmText, cancelText)
    },
    [showModal]
  )

  const showSuccess = useCallback(
    async (title: string, message: string, confirmText = 'OK'): Promise<void> => {
      await showModal(title, message, 'success', false, confirmText)
    },
    [showModal]
  )

  const ModalComponent = useCallback(
    () => (
      <ConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        variant={modalState.variant}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={() => closeModal(true)}
        onCancel={() => closeModal(false)}
      />
    ),
    [modalState, closeModal]
  )

  return {
    showAlert,
    showConfirm,
    showDanger,
    showWarning,
    showSuccess,
    ModalComponent,
  }
}
