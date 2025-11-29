'use client'

import { useState } from 'react'
import { X, AlertTriangle, Flag, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  contentType: 'user' | 'post' | 'message' | 'group' | 'comment'
  contentId: string
  contentPreview?: string // Optional preview of content being reported
}

const REPORT_TYPES = [
  { value: 'HARASSMENT', label: 'Harassment or Bullying', description: 'Threatening, intimidating, or targeting someone' },
  { value: 'SPAM', label: 'Spam', description: 'Unwanted promotional content or repetitive messages' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate Content', description: 'Content that violates community guidelines' },
  { value: 'FAKE_ACCOUNT', label: 'Fake Account', description: 'Impersonating someone or using a fake identity' },
  { value: 'HATE_SPEECH', label: 'Hate Speech', description: 'Content promoting hatred against groups or individuals' },
  { value: 'VIOLENCE', label: 'Violence or Threats', description: 'Content promoting violence or making threats' },
  { value: 'SCAM', label: 'Scam or Fraud', description: 'Attempting to deceive or defraud users' },
  { value: 'OTHER', label: 'Other', description: 'Something else not listed above' },
]

export default function ReportModal({
  isOpen,
  onClose,
  contentType,
  contentId,
  contentPreview,
}: ReportModalProps) {
  const t = useTranslations('report')
  const tCommon = useTranslations('common')

  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleTypeToggle = (value: string) => {
    setSelectedTypes(prev =>
      prev.includes(value)
        ? prev.filter(t => t !== value)
        : [...prev, value]
    )
  }

  const handleSubmit = async () => {
    if (selectedTypes.length === 0) {
      toast.error(t('selectReasonError') || 'Please select at least one reason for reporting')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType,
          contentId,
          type: selectedTypes.join(','), // Send multiple types as comma-separated
          types: selectedTypes, // Also send as array for backend flexibility
          description: description.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(t('reportSubmitted') || 'Report submitted successfully. Our team will review it.')
        onClose()
        setSelectedTypes([])
        setDescription('')
      } else {
        toast.error(data.error || t('reportFailed') || 'Failed to submit report')
      }
    } catch (error) {
      console.error('Error submitting report:', error)
      toast.error(t('reportFailed') || 'Failed to submit report')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const contentTypeLabels: Record<string, string> = {
    user: t('contentTypes.user') || 'User',
    post: t('contentTypes.post') || 'Post',
    message: t('contentTypes.message') || 'Message',
    group: t('contentTypes.group') || 'Group',
    comment: t('contentTypes.comment') || 'Comment',
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 bg-red-50 dark:bg-red-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500 rounded-lg">
              <Flag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('title') || 'Report'} {contentTypeLabels[contentType]}
              </h2>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                {t('subtitle') || 'Help us keep the community safe'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content Preview */}
        {contentPreview && (
          <div className="px-4 pt-4">
            <div className="p-3 bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
              <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2">
                {contentPreview}
              </p>
            </div>
          </div>
        )}

        {/* Report Types */}
        <div className="p-4 space-y-2 max-h-[40vh] overflow-y-auto">
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
            {t('selectReason') || 'Why are you reporting this?'}
          </p>
          {REPORT_TYPES.map((type) => {
            const isSelected = selectedTypes.includes(type.value)
            return (
              <label
                key={type.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-red-500 bg-red-50 dark:bg-red-500/10'
                    : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  value={type.value}
                  checked={isSelected}
                  onChange={() => handleTypeToggle(type.value)}
                  className="mt-1 w-4 h-4 text-red-500 focus:ring-red-500 rounded"
                />
                <div>
                  <p className={`font-medium ${
                    isSelected
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {t(`types.${type.value}.label`) || type.label}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {t(`types.${type.value}.description`) || type.description}
                  </p>
                </div>
              </label>
            )
          })}
        </div>

        {/* Additional Description */}
        <div className="px-4 pb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            {t('additionalDetails') || 'Additional details (optional)'}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('additionalDetailsPlaceholder') || 'Provide any additional context that might help us understand the issue...'}
            rows={3}
            maxLength={1000}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-1 text-right">
            {description.length}/1000
          </p>
        </div>

        {/* Warning */}
        <div className="px-4 pb-4">
          <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {t('warning') || 'False reports may result in action against your account. Please only report genuine violations.'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {tCommon('cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedTypes.length === 0 || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('submitting') || 'Submitting...'}
              </>
            ) : (
              <>
                <Flag className="w-4 h-4" />
                {t('submitReport') || 'Submit Report'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
