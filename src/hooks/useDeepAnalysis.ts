/**
 * DEEP CONTENT ANALYSIS HOOK
 *
 * React hook for performing deep analysis on files, URLs, and text.
 * Handles file upload, progress tracking, and result management.
 *
 * Usage:
 * ```tsx
 * const {
 *   analyze,
 *   analyzeFiles,
 *   analyzeUrls,
 *   analyzeText,
 *   result,
 *   isAnalyzing,
 *   progress,
 *   error,
 *   reset,
 * } = useDeepAnalysis()
 * ```
 */

import { useState, useCallback, useRef } from 'react'

// ============================================
// TYPES
// ============================================

export interface AnalysisFile {
  id: string
  file: File
  preview?: string
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error'
  error?: string
}

export interface AnalysisSection {
  title: string
  content: string
  importance: 'critical' | 'important' | 'supplementary'
  concepts: string[]
}

export interface DiagramAnalysis {
  type: 'flowchart' | 'diagram' | 'graph' | 'table' | 'equation' | 'illustration' | 'other'
  description: string
  components: string[]
  relationships: string[]
  keyInsights: string[]
}

export interface DeepAnalysisResult {
  id: string
  overview: {
    title: string
    subject: string
    mainTopic: string
    subtopics: string[]
    complexity: 'beginner' | 'intermediate' | 'advanced'
    contentTypes: string[]
  }
  sections: AnalysisSection[]
  diagrams?: DiagramAnalysis[]
  extractedText: {
    structured: string
    wordCount: number
  }
  learningContext: {
    prerequisites: string[]
    keyConcepts: string[]
    learningObjectives: string[]
    estimatedStudyMinutes: number
    suggestedApproach: string
  }
  organization?: {
    fileOrder: string[]
    connections: Array<{
      fromFile: string
      toFile: string
      relationship: string
    }>
    groupings: Array<{
      name: string
      fileIds: string[]
      reason: string
    }>
  }
  explanations: {
    summary: string
    detailed: string
    keyTakeaways: string[]
    commonMistakes: string[]
  }
  processingTimeMs: number
  errors?: string[]
}

export interface AnalysisProgress {
  stage: 'idle' | 'preparing' | 'uploading' | 'analyzing' | 'complete' | 'error'
  message: string
  percent: number
  filesProcessed: number
  totalFiles: number
}

export interface AnalysisOptions {
  userGoal?: string
  userLevel?: 'beginner' | 'intermediate' | 'advanced'
  focusAreas?: string[]
  analyzeVisuals?: boolean
  extractOCR?: boolean
  organizeMultiple?: boolean
}

export interface RoadmapFromAnalysis {
  id: string
  title: string
  goal: string
  subject: string
  overview: string
  status: string
  totalSteps: number
  estimatedMinutes: number
  steps: Array<{
    id: string
    order: number
    title: string
    description: string
    status: string
    duration: number
  }>
}

interface UseDeepAnalysisReturn {
  // State
  files: AnalysisFile[]
  result: DeepAnalysisResult | null
  isAnalyzing: boolean
  progress: AnalysisProgress
  error: string | null
  isCreatingRoadmap: boolean

  // File management
  addFiles: (files: File[]) => void
  removeFile: (id: string) => void
  clearFiles: () => void

  // Analysis
  analyze: (options?: AnalysisOptions) => Promise<DeepAnalysisResult | null>
  analyzeFiles: (files: File[], options?: AnalysisOptions) => Promise<DeepAnalysisResult | null>
  analyzeUrls: (urls: string[], options?: AnalysisOptions) => Promise<DeepAnalysisResult | null>
  analyzeText: (text: string, options?: AnalysisOptions) => Promise<DeepAnalysisResult | null>
  analyzeMixed: (params: {
    files?: File[]
    urls?: string[]
    text?: string
    options?: AnalysisOptions
  }) => Promise<DeepAnalysisResult | null>

  // Roadmap creation
  createRoadmapFromAnalysis: (options?: {
    userGoal?: string
    userLevel?: 'beginner' | 'intermediate' | 'advanced'
    focusAreas?: string[]
    targetMinutes?: number
  }) => Promise<RoadmapFromAnalysis | null>

  // Reset
  reset: () => void
}

// ============================================
// CONSTANTS
// ============================================

const MAX_FILE_SIZE_MB = 20
const MAX_TOTAL_SIZE_MB = 50
const MAX_FILES = 10

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

// ============================================
// HOOK
// ============================================

export function useDeepAnalysis(): UseDeepAnalysisReturn {
  // State
  const [files, setFiles] = useState<AnalysisFile[]>([])
  const [result, setResult] = useState<DeepAnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<AnalysisProgress>({
    stage: 'idle',
    message: '',
    percent: 0,
    filesProcessed: 0,
    totalFiles: 0,
  })

  // Abort controller for cancellation
  const abortControllerRef = useRef<AbortController | null>(null)

  // ============================================
  // FILE MANAGEMENT
  // ============================================

  const addFiles = useCallback((newFiles: File[]) => {
    setFiles(prev => {
      const currentCount = prev.length
      const remaining = MAX_FILES - currentCount

      if (remaining <= 0) {
        setError(`Maximum ${MAX_FILES} files allowed`)
        return prev
      }

      const filesToAdd = newFiles.slice(0, remaining)
      const analysisFiles: AnalysisFile[] = filesToAdd
        .filter(file => {
          // Validate type
          if (!ALLOWED_TYPES.includes(file.type)) {
            console.warn(`Unsupported file type: ${file.type}`)
            return false
          }
          // Validate size
          if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            console.warn(`File too large: ${file.name}`)
            return false
          }
          return true
        })
        .map(file => ({
          id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          file,
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
          status: 'pending' as const,
        }))

      return [...prev, ...analysisFiles]
    })

    setError(null)
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id)
      if (file?.preview) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter(f => f.id !== id)
    })
  }, [])

  const clearFiles = useCallback(() => {
    setFiles(prev => {
      prev.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview)
      })
      return []
    })
    setResult(null)
    setError(null)
  }, [])

  // ============================================
  // FILE TO BASE64 CONVERSION
  // ============================================

  const fileToBase64 = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result)
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }, [])

  // ============================================
  // CORE ANALYSIS
  // ============================================

  const performAnalysis = useCallback(async (
    params: {
      files?: Array<{ name: string; data: string; mimeType: string; size: number }>
      urls?: string[]
      text?: string
    },
    options: AnalysisOptions = {}
  ): Promise<DeepAnalysisResult | null> => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setIsAnalyzing(true)
    setError(null)
    setResult(null)

    try {
      setProgress({
        stage: 'analyzing',
        message: 'Analyzing content...',
        percent: 50,
        filesProcessed: 0,
        totalFiles: (params.files?.length || 0) + (params.urls?.length || 0) + (params.text ? 1 : 0),
      })

      const response = await fetch('/api/analyze/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: params.files,
          urls: params.urls,
          text: params.text,
          userGoal: options.userGoal,
          userLevel: options.userLevel,
          focusAreas: options.focusAreas,
          options: {
            analyzeVisuals: options.analyzeVisuals,
            extractOCR: options.extractOCR,
            organizeMultiple: options.organizeMultiple,
          },
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Analysis failed (${response.status})`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed')
      }

      // Use functional update to get current totalFiles value (avoid stale closure)
      setProgress(prev => ({
        stage: 'complete',
        message: 'Analysis complete!',
        percent: 100,
        filesProcessed: prev.totalFiles,
        totalFiles: prev.totalFiles,
      }))

      setResult(data.analysis)
      return data.analysis

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Analysis cancelled')
        return null
      }

      const errorMessage = err instanceof Error ? err.message : 'Analysis failed'
      setError(errorMessage)
      setProgress({
        stage: 'error',
        message: errorMessage,
        percent: 0,
        filesProcessed: 0,
        totalFiles: 0,
      })
      return null

    } finally {
      setIsAnalyzing(false)
    }
  }, []) // Removed progress.totalFiles dependency - using functional update instead

  // ============================================
  // PUBLIC ANALYSIS METHODS
  // ============================================

  /**
   * Analyze files already added to the hook
   */
  const analyze = useCallback(async (options: AnalysisOptions = {}): Promise<DeepAnalysisResult | null> => {
    if (files.length === 0) {
      setError('No files to analyze')
      return null
    }

    setProgress({
      stage: 'preparing',
      message: 'Preparing files...',
      percent: 10,
      filesProcessed: 0,
      totalFiles: files.length,
    })

    // Convert files to base64
    const fileData: Array<{ name: string; data: string; mimeType: string; size: number }> = []
    let totalSize = 0

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      setFiles(prev => prev.map(pf =>
        pf.id === f.id ? { ...pf, status: 'uploading' as const } : pf
      ))

      try {
        const base64 = await fileToBase64(f.file)
        totalSize += f.file.size

        if (totalSize > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
          throw new Error(`Total size exceeds ${MAX_TOTAL_SIZE_MB}MB limit`)
        }

        fileData.push({
          name: f.file.name,
          data: base64,
          mimeType: f.file.type,
          size: f.file.size,
        })

        setFiles(prev => prev.map(pf =>
          pf.id === f.id ? { ...pf, status: 'processing' as const } : pf
        ))

        setProgress(prev => ({
          ...prev,
          percent: 10 + (30 * (i + 1) / files.length),
          filesProcessed: i + 1,
        }))
      } catch (err) {
        setFiles(prev => prev.map(pf =>
          pf.id === f.id ? { ...pf, status: 'error' as const, error: err instanceof Error ? err.message : 'Failed' } : pf
        ))
      }
    }

    if (fileData.length === 0) {
      setError('No files could be processed')
      return null
    }

    const result = await performAnalysis({ files: fileData }, options)

    // Update file statuses
    setFiles(prev => prev.map(f => ({
      ...f,
      status: result ? 'done' as const : 'error' as const,
    })))

    return result
  }, [files, fileToBase64, performAnalysis])

  /**
   * Analyze files directly (without adding to state first)
   */
  const analyzeFiles = useCallback(async (
    inputFiles: File[],
    options: AnalysisOptions = {}
  ): Promise<DeepAnalysisResult | null> => {
    setProgress({
      stage: 'preparing',
      message: 'Preparing files...',
      percent: 10,
      filesProcessed: 0,
      totalFiles: inputFiles.length,
    })

    const fileData: Array<{ name: string; data: string; mimeType: string; size: number }> = []

    for (const file of inputFiles) {
      try {
        const base64 = await fileToBase64(file)
        fileData.push({
          name: file.name,
          data: base64,
          mimeType: file.type,
          size: file.size,
        })
      } catch (err) {
        console.warn(`Failed to process file: ${file.name}`, err)
      }
    }

    return performAnalysis({ files: fileData }, options)
  }, [fileToBase64, performAnalysis])

  /**
   * Analyze URLs
   */
  const analyzeUrls = useCallback(async (
    urls: string[],
    options: AnalysisOptions = {}
  ): Promise<DeepAnalysisResult | null> => {
    setProgress({
      stage: 'preparing',
      message: 'Preparing URLs...',
      percent: 20,
      filesProcessed: 0,
      totalFiles: urls.length,
    })

    return performAnalysis({ urls }, options)
  }, [performAnalysis])

  /**
   * Analyze text
   */
  const analyzeText = useCallback(async (
    text: string,
    options: AnalysisOptions = {}
  ): Promise<DeepAnalysisResult | null> => {
    setProgress({
      stage: 'preparing',
      message: 'Preparing text...',
      percent: 20,
      filesProcessed: 0,
      totalFiles: 1,
    })

    return performAnalysis({ text }, options)
  }, [performAnalysis])

  /**
   * Analyze mixed content (files + URLs + text)
   */
  const analyzeMixed = useCallback(async (params: {
    files?: File[]
    urls?: string[]
    text?: string
    options?: AnalysisOptions
  }): Promise<DeepAnalysisResult | null> => {
    const totalItems = (params.files?.length || 0) + (params.urls?.length || 0) + (params.text ? 1 : 0)

    setProgress({
      stage: 'preparing',
      message: 'Preparing content...',
      percent: 10,
      filesProcessed: 0,
      totalFiles: totalItems,
    })

    // Convert files to base64
    let fileData: Array<{ name: string; data: string; mimeType: string; size: number }> | undefined

    if (params.files && params.files.length > 0) {
      fileData = []
      for (const file of params.files) {
        try {
          const base64 = await fileToBase64(file)
          fileData.push({
            name: file.name,
            data: base64,
            mimeType: file.type,
            size: file.size,
          })
        } catch (err) {
          console.warn(`Failed to process file: ${file.name}`, err)
        }
      }
    }

    return performAnalysis(
      {
        files: fileData,
        urls: params.urls,
        text: params.text,
      },
      params.options || {}
    )
  }, [fileToBase64, performAnalysis])

  // State for roadmap creation
  const [isCreatingRoadmap, setIsCreatingRoadmap] = useState(false)

  /**
   * Create a roadmap from the current analysis result
   */
  const createRoadmapFromAnalysis = useCallback(async (options: {
    userGoal?: string
    userLevel?: 'beginner' | 'intermediate' | 'advanced'
    focusAreas?: string[]
    targetMinutes?: number
  } = {}): Promise<RoadmapFromAnalysis | null> => {
    if (!result) {
      setError('No analysis result to create roadmap from')
      return null
    }

    setIsCreatingRoadmap(true)
    setError(null)

    try {
      const response = await fetch('/api/analyze/to-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: result,
          userGoal: options.userGoal,
          userLevel: options.userLevel,
          focusAreas: options.focusAreas,
          targetMinutes: options.targetMinutes,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Failed to create roadmap (${response.status})`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to create roadmap')
      }

      return data.roadmap as RoadmapFromAnalysis
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create roadmap'
      setError(errorMessage)
      return null
    } finally {
      setIsCreatingRoadmap(false)
    }
  }, [result])

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Clear files (and revoke object URLs)
    files.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview)
    })

    setFiles([])
    setResult(null)
    setError(null)
    setIsAnalyzing(false)
    setIsCreatingRoadmap(false)
    setProgress({
      stage: 'idle',
      message: '',
      percent: 0,
      filesProcessed: 0,
      totalFiles: 0,
    })
  }, [files])

  return {
    // State
    files,
    result,
    isAnalyzing,
    progress,
    error,
    isCreatingRoadmap,

    // File management
    addFiles,
    removeFile,
    clearFiles,

    // Analysis
    analyze,
    analyzeFiles,
    analyzeUrls,
    analyzeText,
    analyzeMixed,

    // Roadmap creation
    createRoadmapFromAnalysis,

    // Reset
    reset,
  }
}

export default useDeepAnalysis
