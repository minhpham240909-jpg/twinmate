/**
 * Document Upload Component
 * Allows users to upload files for RAG indexing
 */

'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface DocumentUploadProps {
  onUploadComplete?: (docId: string) => void
}

export default function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/ai-agent/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setSuccess(true)
      onUploadComplete?.(data.docId)

      // Reset after 3 seconds
      setTimeout(() => {
        setSuccess(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        accept=".txt,.md,.pdf,.json,.docx"
        className="hidden"
        disabled={uploading}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          ) : success ? (
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          ) : (
            <Upload className="w-8 h-8 text-slate-400" />
          )}

          <div className="text-center">
            <p className="font-semibold text-slate-900">
              {uploading ? 'Uploading...' : success ? 'Upload Complete!' : 'Upload Document'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {uploading
                ? 'Processing your document...'
                : success
                ? 'Document indexed and ready for search'
                : 'TXT, MD, PDF, JSON, or DOCX (max 10MB)'}
            </p>
          </div>
        </div>
      </button>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </motion.div>
      )}
    </div>
  )
}
