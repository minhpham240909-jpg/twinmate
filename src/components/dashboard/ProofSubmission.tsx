'use client'

/**
 * Proof Submission Component
 * For completing missions with different proof types
 * Supports: text, images, PDFs, URLs
 */

import { memo, useState, useRef, useCallback, useEffect } from 'react'
import {
  Loader2,
  ChevronLeft,
  Send,
  CheckCircle2,
  AlertTriangle,
  ImageIcon,
  FileText,
  Link as LinkIcon,
  X,
  Upload,
  File,
} from 'lucide-react'
import Image from 'next/image'
import type { Mission } from '@/lib/mission-engine'
import { uploadFile, formatFileSize } from '@/lib/supabase/storage'
import { toast } from 'sonner'

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  url?: string
  preview?: string
  uploading?: boolean
  error?: string
}

interface ProofSubmissionProps {
  mission: Mission
  onSubmit: (proof: {
    type: string
    content: string
    score?: number
    attachments?: { url: string; name: string; type: string }[]
  }) => void
  onBack: () => void
  isLoading: boolean
}

export const ProofSubmission = memo(function ProofSubmission({
  mission,
  onSubmit,
  onBack,
  isLoading,
}: ProofSubmissionProps) {
  const [content, setContent] = useState('')
  const [selfScore, setSelfScore] = useState<number | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [urls, setUrls] = useState<string[]>([])
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [activeTab, setActiveTab] = useState<'text' | 'files' | 'url'>('text')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Process files (shared by file input, paste, and drag-drop)
  const processFiles = useCallback(async (fileList: File[]) => {
    const maxFiles = 5
    const maxSize = 10 * 1024 * 1024 // 10MB
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ]

    for (const file of fileList) {
      // Check max files limit
      if (files.length >= maxFiles) {
        toast.error(`Maximum ${maxFiles} files allowed`)
        break
      }

      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Invalid file type. Only images and PDFs allowed.`)
        continue
      }

      // Validate file size
      if (file.size > maxSize) {
        toast.error(`${file.name}: File too large. Maximum 10MB.`)
        continue
      }

      // Create preview for images
      const preview = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined

      const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`

      // Add file to state with uploading status
      setFiles(prev => [...prev, {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        preview,
        uploading: true,
      }])

      // Upload to Supabase
      try {
        const result = await uploadFile(file, 'message-attachments')

        if (result.success && result.url) {
          setFiles(prev => prev.map(f =>
            f.id === fileId
              ? { ...f, url: result.url, uploading: false }
              : f
          ))
          toast.success(`${file.name} uploaded`)
        } else {
          setFiles(prev => prev.map(f =>
            f.id === fileId
              ? { ...f, uploading: false, error: result.error || 'Upload failed' }
              : f
          ))
          toast.error(`Failed to upload ${file.name}`)
        }
      } catch {
        setFiles(prev => prev.map(f =>
          f.id === fileId
            ? { ...f, uploading: false, error: 'Upload failed' }
            : f
        ))
        toast.error(`Failed to upload ${file.name}`)
      }
    }
  }, [files.length])

  // Handle file selection from input
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles?.length) return

    await processFiles(Array.from(selectedFiles))

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [processFiles])

  // Handle paste event (Ctrl+V / Cmd+V)
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          // Use the file directly but we'll rename it in display
          // The File constructor requires the browser's File API
          const extension = file.type.split('/')[1] || 'png'
          // Create a proper File object with a timestamp name
          const newName = `pasted-image-${Date.now()}.${extension}`
          Object.defineProperty(file, 'name', {
            writable: true,
            value: newName
          })
          imageFiles.push(file)
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault()
      // Switch to files tab when pasting images
      setActiveTab('files')
      await processFiles(imageFiles)
      toast.success('Image pasted')
    }
  }, [processFiles])

  // Handle drag and drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set dragging to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      await processFiles(Array.from(droppedFiles))
    }
  }, [processFiles])

  // Add global paste listener when component mounts
  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [handlePaste])

  // Remove file
  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === fileId)
      if (file?.preview) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter(f => f.id !== fileId)
    })
  }, [])

  // Add URL
  const addUrl = useCallback(() => {
    const trimmed = urlInput.trim()
    if (!trimmed) return

    // Basic URL validation
    try {
      new URL(trimmed)
      if (urls.includes(trimmed)) {
        toast.error('URL already added')
        return
      }
      setUrls(prev => [...prev, trimmed])
      setUrlInput('')
    } catch {
      toast.error('Please enter a valid URL')
    }
  }, [urlInput, urls])

  // Remove URL
  const removeUrl = useCallback((url: string) => {
    setUrls(prev => prev.filter(u => u !== url))
  }, [])

  const handleSubmit = () => {
    // Build attachments array from uploaded files
    const attachments = files
      .filter(f => f.url && !f.error)
      .map(f => ({
        url: f.url!,
        name: f.name,
        type: f.type,
      }))

    // Add URLs as link attachments
    urls.forEach((url, i) => {
      attachments.push({
        url,
        name: `Link ${i + 1}`,
        type: 'link',
      })
    })

    onSubmit({
      type: mission.proofRequired,
      content: content.trim(),
      score: selfScore || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    })
  }

  // Validation: text OR files OR URLs
  const hasContent = content.trim().length >= 20
  const hasFiles = files.some(f => f.url && !f.error)
  const hasUrls = urls.length > 0
  const isUploading = files.some(f => f.uploading)

  const isValid = mission.proofRequired === 'self_report'
    ? content === 'completed' || content === 'struggled'
    : mission.proofRequired === 'quiz'
    ? selfScore !== null && selfScore >= 0 && selfScore <= 100
    : hasContent || hasFiles || hasUrls

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm">Back to mission</span>
      </button>

      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
          Submit Your Proof
        </h3>
        <p className="text-neutral-500 dark:text-neutral-400 mb-4">
          {mission.criteria.description}
        </p>

        {/* Different proof types */}
        {mission.proofRequired === 'explanation' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Explain in your own words
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Without looking at notes, explain the concept..."
              rows={5}
              disabled={isLoading}
              className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-blue-500 resize-none"
            />
            <p className="text-xs text-neutral-400">
              {content.length}/20 characters minimum
            </p>
          </div>
        )}

        {mission.proofRequired === 'self_report' && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Did you complete the mission requirements?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setContent('completed')}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  content === 'completed'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-500'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-2 border-transparent'
                }`}
              >
                <CheckCircle2 className="w-5 h-5 mx-auto mb-1" />
                Yes, completed
              </button>
              <button
                onClick={() => setContent('struggled')}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  content === 'struggled'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-2 border-amber-500'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-2 border-transparent'
                }`}
              >
                <AlertTriangle className="w-5 h-5 mx-auto mb-1" />
                I struggled
              </button>
            </div>
          </div>
        )}

        {mission.proofRequired === 'quiz' && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              What was your quiz score?
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={selfScore || ''}
                onChange={(e) => {
                  setSelfScore(Number(e.target.value))
                  setContent(`Score: ${e.target.value}%`)
                }}
                placeholder="0"
                className="w-20 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-center text-lg font-semibold"
              />
              <span className="text-lg font-semibold text-neutral-600 dark:text-neutral-400">%</span>
            </div>
            {mission.criteria.threshold && (
              <p className="text-xs text-neutral-500">
                Required: {mission.criteria.threshold}% or higher
              </p>
            )}
          </div>
        )}

        {mission.proofRequired === 'submission' && (
          <div className="space-y-4">
            {/* Tabs for different input types */}
            <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setActiveTab('text')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'text'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                Text
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'files'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                Files
                {files.length > 0 && (
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs px-1.5 py-0.5 rounded-full">
                    {files.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('url')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'url'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                URL
                {urls.length > 0 && (
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs px-1.5 py-0.5 rounded-full">
                    {urls.length}
                  </span>
                )}
              </button>
            </div>

            {/* Text Tab */}
            {activeTab === 'text' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Describe your work
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Describe what you completed or paste your work..."
                  rows={5}
                  disabled={isLoading}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-blue-500 resize-none"
                />
                <p className="text-xs text-neutral-400">
                  {content.length} characters {!hasFiles && !hasUrls && '(20 minimum unless adding files/URLs)'}
                </p>
              </div>
            )}

            {/* Files Tab */}
            {activeTab === 'files' && (
              <div className="space-y-4">
                {/* Upload Area with drag-drop support */}
                <div
                  ref={dropZoneRef}
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-neutral-300 dark:border-neutral-600 hover:border-blue-400 dark:hover:border-blue-500'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf"
                    multiple
                    className="hidden"
                  />
                  <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-blue-500' : 'text-neutral-400'}`} />
                  <p className={`font-medium ${isDragging ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
                    {isDragging ? 'Drop files here' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Images (JPEG, PNG, GIF, WebP) or PDFs up to 10MB
                  </p>
                  <p className="text-xs text-blue-500 mt-2">
                    Tip: You can also paste images (Ctrl+V / Cmd+V) anywhere on this page
                  </p>
                </div>

                {/* Uploaded Files */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Uploaded Files ({files.length}/5)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className={`relative rounded-lg overflow-hidden border ${
                            file.error
                              ? 'border-red-300 dark:border-red-700'
                              : 'border-neutral-200 dark:border-neutral-700'
                          }`}
                        >
                          {/* Preview */}
                          {file.preview ? (
                            <div className="aspect-square relative">
                              <Image
                                src={file.preview}
                                alt={file.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="aspect-square bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                              <File className="w-10 h-10 text-neutral-400" />
                            </div>
                          )}

                          {/* Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-2">
                            <p className="text-white text-xs truncate">{file.name}</p>
                            <p className="text-white/70 text-xs">{formatFileSize(file.size)}</p>
                          </div>

                          {/* Loading/Status */}
                          {file.uploading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Loader2 className="w-6 h-6 text-white animate-spin" />
                            </div>
                          )}

                          {file.error && (
                            <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                              <p className="text-white text-xs text-center px-2">{file.error}</p>
                            </div>
                          )}

                          {/* Remove Button */}
                          <button
                            onClick={() => removeFile(file.id)}
                            className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* URL Tab */}
            {activeTab === 'url' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addUrl()}
                    placeholder="https://example.com/my-work"
                    className="flex-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-4 py-2 text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={addUrl}
                    disabled={!urlInput.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                <p className="text-xs text-neutral-400">
                  Add links to your work (Google Docs, GitHub, portfolio, etc.)
                </p>

                {/* Added URLs */}
                {urls.length > 0 && (
                  <div className="space-y-2">
                    {urls.map((url, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg px-3 py-2"
                      >
                        <LinkIcon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                        >
                          {url}
                        </a>
                        <button
                          onClick={() => removeUrl(url)}
                          className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Summary of attachments */}
            {(files.length > 0 || urls.length > 0) && activeTab === 'text' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-3">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {files.filter(f => f.url && !f.error).length > 0 && (
                    <span>{files.filter(f => f.url && !f.error).length} file(s) attached. </span>
                  )}
                  {urls.length > 0 && (
                    <span>{urls.length} URL(s) attached.</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading || isUploading}
          className="w-full mt-6 flex items-center justify-center gap-2 py-3.5 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
        >
          {isLoading || isUploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {isUploading ? 'Uploading...' : 'Submitting...'}
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit Proof</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
})
