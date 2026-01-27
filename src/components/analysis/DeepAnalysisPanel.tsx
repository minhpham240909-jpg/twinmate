/**
 * DEEP ANALYSIS PANEL
 *
 * UI component for uploading and analyzing files, URLs, and text.
 * Shows progress, results, and integrates with roadmap creation.
 */

'use client'

import React, { useState, useCallback, useRef } from 'react'
import { useDeepAnalysis, DeepAnalysisResult, AnalysisFile, RoadmapFromAnalysis } from '@/hooks/useDeepAnalysis'

// ============================================
// TYPES
// ============================================

interface DeepAnalysisPanelProps {
  onAnalysisComplete?: (result: DeepAnalysisResult) => void
  onRoadmapCreated?: (roadmap: RoadmapFromAnalysis) => void
  userGoal?: string
  userLevel?: 'beginner' | 'intermediate' | 'advanced'
  className?: string
}

// ============================================
// COMPONENT
// ============================================

export function DeepAnalysisPanel({
  onAnalysisComplete,
  onRoadmapCreated,
  userGoal,
  userLevel,
  className = '',
}: DeepAnalysisPanelProps) {
  // Hook
  const {
    files,
    result,
    isAnalyzing,
    progress,
    error,
    isCreatingRoadmap,
    addFiles,
    removeFile,
    clearFiles,
    analyze,
    analyzeUrls,
    analyzeText,
    createRoadmapFromAnalysis,
    reset,
  } = useDeepAnalysis()

  // Local state
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [activeTab, setActiveTab] = useState<'files' | 'url' | 'text'>('files')
  const [showFullExplanation, setShowFullExplanation] = useState(false)

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // ============================================
  // FILE HANDLING
  // ============================================

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [addFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles)
    }
  }, [addFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // ============================================
  // ANALYSIS HANDLERS
  // ============================================

  const handleAnalyzeFiles = useCallback(async () => {
    const analysisResult = await analyze({
      userGoal,
      userLevel,
      analyzeVisuals: true,
      extractOCR: true,
      organizeMultiple: true,
    })

    if (analysisResult) {
      onAnalysisComplete?.(analysisResult)
    }
  }, [analyze, userGoal, userLevel, onAnalysisComplete])

  const handleAnalyzeUrl = useCallback(async () => {
    if (!urlInput.trim()) return

    const urls = urlInput
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0)

    if (urls.length === 0) return

    const analysisResult = await analyzeUrls(urls, {
      userGoal,
      userLevel,
    })

    if (analysisResult) {
      onAnalysisComplete?.(analysisResult)
    }
  }, [urlInput, analyzeUrls, userGoal, userLevel, onAnalysisComplete])

  const handleAnalyzeText = useCallback(async () => {
    if (!textInput.trim()) return

    const analysisResult = await analyzeText(textInput, {
      userGoal,
      userLevel,
    })

    if (analysisResult) {
      onAnalysisComplete?.(analysisResult)
    }
  }, [textInput, analyzeText, userGoal, userLevel, onAnalysisComplete])

  const handleCreateRoadmap = useCallback(async () => {
    if (!result) return

    const roadmap = await createRoadmapFromAnalysis({
      userGoal,
      userLevel,
    })

    if (roadmap) {
      onRoadmapCreated?.(roadmap)
    }
  }, [result, createRoadmapFromAnalysis, userGoal, userLevel, onRoadmapCreated])

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderFilePreview = (file: AnalysisFile) => {
    const statusColors = {
      pending: 'bg-gray-100 dark:bg-gray-800',
      uploading: 'bg-blue-100 dark:bg-blue-900/30',
      processing: 'bg-yellow-100 dark:bg-yellow-900/30',
      done: 'bg-green-100 dark:bg-green-900/30',
      error: 'bg-red-100 dark:bg-red-900/30',
    }

    const statusText = {
      pending: 'Ready',
      uploading: 'Uploading...',
      processing: 'Processing...',
      done: 'Done',
      error: file.error || 'Error',
    }

    return (
      <div
        key={file.id}
        className={`relative flex items-center gap-3 p-3 rounded-lg ${statusColors[file.status]}`}
      >
        {/* Preview thumbnail or icon */}
        {file.preview ? (
          <img
            src={file.preview}
            alt={file.file.name}
            className="w-12 h-12 object-cover rounded"
          />
        ) : (
          <div className="w-12 h-12 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">
            {file.file.type.includes('pdf') ? (
              <span className="text-xs font-bold">PDF</span>
            ) : file.file.type.includes('word') ? (
              <span className="text-xs font-bold">DOC</span>
            ) : (
              <span className="text-xs font-bold">TXT</span>
            )}
          </div>
        )}

        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.file.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {(file.file.size / 1024 / 1024).toFixed(1)} MB
          </p>
          <p className={`text-xs ${file.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {statusText[file.status]}
          </p>
        </div>

        {/* Remove button */}
        {!isAnalyzing && (
          <button
            onClick={() => removeFile(file.id)}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
            aria-label={`Remove file ${file.file.name}`}
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
    )
  }

  const renderProgress = () => {
    if (!isAnalyzing) return null

    return (
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg" role="progressbar" aria-valuenow={Math.round(progress.percent)} aria-valuemin={0} aria-valuemax={100}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">{progress.message}</span>
          <span className="text-sm text-blue-600 dark:text-blue-400">{Math.round(progress.percent)}%</span>
        </div>
        <div className="w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        {progress.totalFiles > 0 && (
          <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
            {progress.filesProcessed} / {progress.totalFiles} items processed
          </p>
        )}
      </div>
    )
  }

  const renderResult = () => {
    if (!result) return null

    return (
      <div className="space-y-4">
        {/* Overview */}
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">{result.overview.title}</h3>
          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
            {result.overview.subject} - {result.overview.complexity}
          </p>
          {result.overview.subtopics.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {result.overview.subtopics.map((topic, i) => (
                <span key={i} className="px-2 py-1 bg-green-100 dark:bg-green-800/50 rounded text-xs text-green-700 dark:text-green-300">
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <h4 className="font-medium mb-2 dark:text-white">Summary</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">{result.explanations.summary}</p>

          <button
            onClick={() => setShowFullExplanation(!showFullExplanation)}
            className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            aria-expanded={showFullExplanation}
            aria-controls="full-explanation"
          >
            {showFullExplanation ? 'Show less' : 'Show full explanation'}
          </button>

          {showFullExplanation && (
            <div id="full-explanation" className="mt-3 pt-3 border-t dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {result.explanations.detailed}
              </p>
            </div>
          )}
        </div>

        {/* Key Takeaways */}
        {result.explanations.keyTakeaways.length > 0 && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h4 className="font-medium mb-2 dark:text-white">Key Takeaways</h4>
            <ul className="space-y-1">
              {result.explanations.keyTakeaways.map((takeaway, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400">•</span>
                  {takeaway}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Learning Context */}
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <h4 className="font-medium mb-2 dark:text-white">Learning Context</h4>
          <div className="space-y-2 text-sm dark:text-gray-300">
            <p>
              <span className="font-medium">Study time:</span>{' '}
              {result.learningContext.estimatedStudyMinutes} minutes
            </p>
            <p>
              <span className="font-medium">Approach:</span>{' '}
              {result.learningContext.suggestedApproach}
            </p>
            {result.learningContext.prerequisites.length > 0 && (
              <p>
                <span className="font-medium">Prerequisites:</span>{' '}
                {result.learningContext.prerequisites.join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Sections */}
        {result.sections.length > 0 && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <h4 className="font-medium mb-3 dark:text-white">Content Sections</h4>
            <div className="space-y-3">
              {result.sections.map((section, i) => (
                <div key={i} className="p-3 bg-white dark:bg-gray-900 rounded border dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="font-medium dark:text-white">{section.title}</h5>
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      section.importance === 'critical' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' :
                      section.importance === 'important' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}>
                      {section.importance}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{section.content}</p>
                  {section.concepts.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {section.concepts.map((concept, j) => (
                        <span key={j} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                          {concept}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Common Mistakes */}
        {result.explanations.commonMistakes.length > 0 && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <h4 className="font-medium mb-2 dark:text-white">Common Mistakes to Avoid</h4>
            <ul className="space-y-1">
              {result.explanations.commonMistakes.map((mistake, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                  <span className="text-red-600 dark:text-red-400" aria-hidden="true">!</span>
                  {mistake}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleCreateRoadmap}
            disabled={isCreatingRoadmap}
            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={isCreatingRoadmap ? 'Creating roadmap, please wait' : 'Create learning roadmap from analysis'}
          >
            {isCreatingRoadmap ? 'Creating Roadmap...' : 'Create Learning Roadmap'}
          </button>
          <button
            onClick={reset}
            disabled={isCreatingRoadmap}
            className="py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Clear analysis and analyze new content"
          >
            Analyze New Content
          </button>
        </div>
      </div>
    )
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-xl shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 border-b dark:border-gray-700">
        <h2 className="text-lg font-semibold dark:text-white">Deep Content Analysis</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Upload PDFs, images, or paste URLs for thorough analysis
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Show result if available */}
      {result ? (
        <div className="p-4">{renderResult()}</div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b dark:border-gray-700" role="tablist" aria-label="Content input type">
            {(['files', 'url', 'text'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`${tab}-panel`}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'files' ? 'Files' : tab === 'url' ? 'URL' : 'Text'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Progress */}
            {isAnalyzing && <div className="mb-4">{renderProgress()}</div>}

            {/* Files Tab */}
            {activeTab === 'files' && !isAnalyzing && (
              <div className="space-y-4">
                {/* Drop zone */}
                <div
                  ref={dropZoneRef}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  tabIndex={0}
                  role="button"
                  aria-label="Upload files. Drop files here or click to browse"
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                    aria-hidden="true"
                  />
                  <div className="text-4xl mb-2" aria-hidden="true">📄</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Drop files here or click to upload
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Images, PDFs, Word docs (max 20MB each, 10 files)
                  </p>
                </div>

                {/* File list */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium dark:text-white">{files.length} file(s)</span>
                      <button
                        onClick={clearFiles}
                        className="text-sm text-red-600 dark:text-red-400 hover:underline"
                        aria-label="Clear all files"
                      >
                        Clear all
                      </button>
                    </div>
                    {files.map(renderFilePreview)}
                  </div>
                )}

                {/* Analyze button */}
                {files.length > 0 && (
                  <button
                    onClick={handleAnalyzeFiles}
                    disabled={isAnalyzing}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    aria-label={`Analyze ${files.length} file${files.length > 1 ? 's' : ''}`}
                  >
                    Analyze {files.length} File{files.length > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            )}

            {/* URL Tab */}
            {activeTab === 'url' && !isAnalyzing && (
              <div className="space-y-4">
                <textarea
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="Enter URLs (one per line)&#10;https://example.com/article&#10;https://docs.example.com/guide"
                  className="w-full h-32 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleAnalyzeUrl}
                  disabled={!urlInput.trim() || isAnalyzing}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  Analyze URL{urlInput.includes('\n') ? 's' : ''}
                </button>
              </div>
            )}

            {/* Text Tab */}
            {activeTab === 'text' && !isAnalyzing && (
              <div className="space-y-4">
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder="Paste your content here... (notes, articles, code, etc.)"
                  className="w-full h-48 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{textInput.length.toLocaleString()} characters</span>
                  <span>Max 50,000</span>
                </div>
                <button
                  onClick={handleAnalyzeText}
                  disabled={!textInput.trim() || isAnalyzing}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  Analyze Text
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default DeepAnalysisPanel
