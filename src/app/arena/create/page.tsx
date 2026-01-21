'use client'

/**
 * Create Game Page (Arcade)
 *
 * Allows users to create a new game with:
 * - Content source selection (Upload, AI Topic, Deck, Study History, Custom)
 * - Title and settings configuration
 * - Question preview (for custom mode)
 *
 * Performance optimizations:
 * - Background pre-generation: Starts generating when user types topic
 * - Streaming UI: Shows questions appearing one by one
 * - Topic caching: Common topics load instantly from cache
 */

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft,
  Upload,
  BookOpen,
  Library,
  PenTool,
  Loader2,
  ChevronRight,
  Users,
  Clock,
  HelpCircle,
  Gamepad2,
  Check,
  ImageIcon,
  FileText,
  X,
  Sparkles,
  Zap,
} from 'lucide-react'
import type { ArenaContentSource, CustomQuestion } from '@/lib/arena/types'
import { CustomQuestionEditor } from '@/components/arena/CustomQuestionEditor'
import { useArenaPregenerate } from '@/hooks/useArenaPregenerate'

const CONTENT_SOURCES = [
  {
    id: 'AI_GENERATED' as ArenaContentSource,
    label: 'AI Topic',
    icon: Sparkles,
    description: 'Type a topic, AI creates questions instantly',
    recommended: true,
  },
  {
    id: 'UPLOAD' as ArenaContentSource,
    label: 'Upload Notes',
    icon: Upload,
    description: 'Upload images or paste text, AI creates questions',
  },
  {
    id: 'DECK' as ArenaContentSource,
    label: 'From Flashcards',
    icon: Library,
    description: 'Use your existing flashcard decks (fastest)',
  },
  {
    id: 'STUDY_HISTORY' as ArenaContentSource,
    label: 'Study History',
    icon: BookOpen,
    description: 'Generate from past study sessions',
  },
  {
    id: 'CUSTOM' as ArenaContentSource,
    label: 'Create Questions',
    icon: PenTool,
    description: 'Write your own (spectator mode)',
  },
]

export default function CreateArenaPage() {
  const router = useRouter()

  // Step state
  const [step, setStep] = useState<'source' | 'config' | 'questions'>('source')

  // Form state
  const [contentSource, setContentSource] = useState<ArenaContentSource | null>(null)
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [fileContent, setFileContent] = useState('')
  const [uploadedImages, setUploadedImages] = useState<Array<{ file: File; preview: string; base64: string }>>([])
  const [uploadMode, setUploadMode] = useState<'text' | 'image'>('text')
  const [deckId, setDeckId] = useState('')
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Settings state
  const [questionCount, setQuestionCount] = useState(10)
  const [timePerQuestion, setTimePerQuestion] = useState(20)
  const [maxPlayers, setMaxPlayers] = useState(20)

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Deck selection state
  const [decks, setDecks] = useState<Array<{ id: string; name: string; cardCount: number }>>([])
  const [loadingDecks, setLoadingDecks] = useState(false)

  // Pre-generation hook for AI topics (background generation)
  const pregenerate = useArenaPregenerate({ debounceMs: 600, minTopicLength: 3 })

  const selectedSource = CONTENT_SOURCES.find((s) => s.id === contentSource)

  // Start background generation when topic changes
  useEffect(() => {
    if (contentSource === 'AI_GENERATED' && topic.trim().length >= 3) {
      pregenerate.onTopicChange(topic, questionCount, difficulty)
    }
  }, [topic, questionCount, difficulty, contentSource, pregenerate])

  // Handle image upload
  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return

    const maxImages = 5
    const maxFileSize = 10 * 1024 * 1024 // 10MB

    const newImages: Array<{ file: File; preview: string; base64: string }> = []

    for (let i = 0; i < Math.min(files.length, maxImages - uploadedImages.length); i++) {
      const file = files[i]

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload only image files')
        continue
      }

      // Validate file size
      if (file.size > maxFileSize) {
        setError('Image must be less than 10MB')
        continue
      }

      // Create preview URL and convert to base64
      const preview = URL.createObjectURL(file)
      const base64 = await fileToBase64(file)

      newImages.push({ file, preview, base64 })
    }

    setUploadedImages((prev) => [...prev, ...newImages].slice(0, maxImages))
    setError(null)
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  const removeImage = (index: number) => {
    setUploadedImages((prev) => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].preview)
      newImages.splice(index, 1)
      return newImages
    })
  }

  // Fetch user's decks when DECK source is selected
  const fetchDecks = async () => {
    setLoadingDecks(true)
    try {
      const response = await fetch('/api/flashcards/decks')
      if (response.ok) {
        const data = await response.json()
        setDecks(data.decks || [])
      }
    } catch (err) {
      console.error('Failed to fetch decks:', err)
    } finally {
      setLoadingDecks(false)
    }
  }

  const handleSourceSelect = (source: ArenaContentSource) => {
    setContentSource(source)
    setError(null)

    if (source === 'DECK') {
      fetchDecks()
    }

    // For CUSTOM, go directly to question editor
    if (source === 'CUSTOM') {
      setStep('questions')
    } else {
      setStep('config')
    }
  }

  const handleCreate = async () => {
    if (!contentSource) return

    // Validate based on source
    if (!title.trim()) {
      setError('Please enter a title')
      return
    }

    if (contentSource === 'AI_GENERATED' && !topic.trim()) {
      setError('Please enter a topic')
      return
    }

    if (contentSource === 'UPLOAD') {
      if (uploadMode === 'text' && !fileContent.trim()) {
        setError('Please paste your study content')
        return
      }
      if (uploadMode === 'image' && uploadedImages.length === 0) {
        setError('Please upload at least one image')
        return
      }
    }

    if (contentSource === 'DECK' && !deckId) {
      setError('Please select a flashcard deck')
      return
    }

    if (contentSource === 'CUSTOM' && customQuestions.length < 3) {
      setError('Please add at least 3 questions')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/arena/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          contentSource,
          topic: contentSource === 'AI_GENERATED' ? topic.trim() : undefined,
          difficulty: contentSource === 'AI_GENERATED' ? difficulty : undefined,
          fileContent: uploadMode === 'text' ? fileContent.trim() || undefined : undefined,
          imageData: uploadMode === 'image' ? uploadedImages.map((img) => img.base64) : undefined,
          deckId: deckId || undefined,
          questions: contentSource === 'CUSTOM' ? customQuestions : undefined,
          questionCount,
          timePerQuestion,
          maxPlayers,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to create game')
        return
      }

      // Navigate to lobby
      router.push(`/arena/${data.arena.id}/lobby`)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (step === 'source') {
                  router.back()
                } else if (step === 'questions') {
                  setStep('source')
                } else {
                  setStep('source')
                }
              }}
              className="w-10 h-10 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-black dark:text-white">
                  Create Game
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {step === 'source' && 'Choose question source'}
                  {step === 'config' && 'Configure your game'}
                  {step === 'questions' && 'Add your questions'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Step 1: Source Selection */}
        {step === 'source' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-black dark:text-white mb-6">
              How do you want to create questions?
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CONTENT_SOURCES.map((source) => {
                const Icon = source.icon
                const isSelected = contentSource === source.id
                const isRecommended = 'recommended' in source && source.recommended
                return (
                  <button
                    key={source.id}
                    onClick={() => handleSourceSelect(source.id)}
                    className={`relative p-5 rounded-xl border-2 text-left transition-all group ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500'
                        : isRecommended
                        ? 'bg-white dark:bg-neutral-900 border-blue-300 dark:border-blue-700 hover:border-blue-500'
                        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-blue-500/50'
                    }`}
                  >
                    {/* Recommended badge */}
                    {isRecommended && !isSelected && (
                      <div className="absolute -top-2 left-4 px-2 py-0.5 bg-blue-500 text-white text-xs font-medium rounded-full">
                        Recommended
                      </div>
                    )}
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-blue-600'
                          : isRecommended
                          ? 'bg-blue-100 dark:bg-blue-900/50'
                          : 'bg-neutral-100 dark:bg-neutral-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30'
                      }`}>
                        <Icon className={`w-6 h-6 ${
                          isSelected
                            ? 'text-white'
                            : isRecommended
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-neutral-600 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold ${
                          isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-black dark:text-white'
                        }`}>
                          {source.label}
                        </h3>
                        <p className={`text-sm mt-0.5 ${
                          isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-neutral-500 dark:text-neutral-400'
                        }`}>
                          {source.description}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 'config' && selectedSource && (
          <div className="space-y-6">
            {/* Selected Source Badge */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <selectedSource.icon className="w-4 h-4 text-white" />
              </div>
              <span className="font-medium text-blue-900 dark:text-blue-100">
                {selectedSource.label}
              </span>
              <button
                onClick={() => setStep('source')}
                className="ml-auto text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Change
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                Game Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Biology Final Review"
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Source-specific input */}
            {contentSource === 'AI_GENERATED' && (
              <div className="space-y-4">
                {/* Topic Input */}
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    Topic
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., World War II, Photosynthesis, JavaScript Basics"
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Difficulty Selection */}
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    Difficulty
                  </label>
                  <div className="flex gap-2">
                    {(['easy', 'medium', 'hard'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setDifficulty(level)}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all capitalize ${
                          difficulty === level
                            ? level === 'easy'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-500'
                              : level === 'medium'
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-2 border-yellow-500'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-2 border-red-500'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-2 border-transparent hover:border-neutral-300 dark:hover:border-neutral-600'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pre-generation Status */}
                {topic.trim().length >= 3 && (
                  <div className={`p-4 rounded-xl border ${
                    pregenerate.state.status === 'complete'
                      ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                      : pregenerate.state.status === 'generating'
                      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                      : pregenerate.state.status === 'error'
                      ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                      : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      {pregenerate.state.status === 'generating' && (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                              Preparing questions...
                            </p>
                            <div className="mt-2 h-2 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${pregenerate.state.progress}%` }}
                              />
                            </div>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              {pregenerate.state.questions.length} of {questionCount} questions ready
                            </p>
                          </div>
                        </>
                      )}
                      {pregenerate.state.status === 'complete' && (
                        <>
                          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-green-700 dark:text-green-300">
                              {pregenerate.state.cached ? 'Questions ready instantly!' : 'Questions ready!'}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400">
                              {pregenerate.state.questions.length} questions generated
                              {pregenerate.state.cached && ' (from cache)'}
                            </p>
                          </div>
                          <Zap className="w-5 h-5 text-green-500 ml-auto" />
                        </>
                      )}
                      {pregenerate.state.status === 'error' && (
                        <>
                          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                            <X className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-red-700 dark:text-red-300">
                              Pre-generation failed
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-400">
                              Questions will be generated when you create the game
                            </p>
                          </div>
                        </>
                      )}
                      {pregenerate.state.status === 'idle' && (
                        <>
                          <Sparkles className="w-5 h-5 text-neutral-400" />
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Type a topic to start generating questions
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  AI will generate {questionCount} quiz questions about this topic
                </p>
              </div>
            )}

            {contentSource === 'UPLOAD' && (
              <div className="space-y-4">
                {/* Toggle between text and image mode */}
                <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setUploadMode('text')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                      uploadMode === 'text'
                        ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-sm'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Paste Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('image')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                      uploadMode === 'image'
                        ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-sm'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    Upload Images
                  </button>
                </div>

                {/* Text mode */}
                {uploadMode === 'text' && (
                  <div>
                    <label className="block text-sm font-medium text-black dark:text-white mb-2">
                      Study Content
                    </label>
                    <textarea
                      value={fileContent}
                      onChange={(e) => setFileContent(e.target.value)}
                      placeholder="Paste your notes, lecture content, or study material here..."
                      rows={8}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    />
                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      AI will generate quiz questions from this content
                    </p>
                  </div>
                )}

                {/* Image mode */}
                {uploadMode === 'image' && (
                  <div>
                    <label className="block text-sm font-medium text-black dark:text-white mb-2">
                      Upload Study Material
                    </label>

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleImageUpload(e.target.files)}
                      className="hidden"
                    />

                    {/* Upload area */}
                    {uploadedImages.length < 5 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full p-8 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 transition-colors group"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                            <ImageIcon className="w-7 h-7 text-neutral-400 group-hover:text-blue-500 transition-colors" />
                          </div>
                          <div className="text-center">
                            <p className="font-medium text-black dark:text-white">
                              Click to upload images
                            </p>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                              Photos of notes, textbook pages, slides (max 5 images, 10MB each)
                            </p>
                          </div>
                        </div>
                      </button>
                    )}

                    {/* Image previews */}
                    {uploadedImages.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {uploadedImages.map((img, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-[4/3] rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800">
                              <Image
                                src={img.preview}
                                alt={`Upload ${index + 1}`}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-black dark:bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                              <X className="w-3.5 h-3.5 text-white dark:text-black" />
                            </button>
                          </div>
                        ))}

                        {/* Add more button */}
                        {uploadedImages.length < 5 && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-[4/3] rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-500 flex items-center justify-center transition-colors"
                          >
                            <div className="text-center">
                              <ImageIcon className="w-6 h-6 mx-auto text-neutral-400" />
                              <span className="text-xs text-neutral-500 mt-1 block">Add more</span>
                            </div>
                          </button>
                        )}
                      </div>
                    )}

                    <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                      AI will read and analyze your images to generate quiz questions
                    </p>
                  </div>
                )}
              </div>
            )}

            {contentSource === 'DECK' && (
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  Select Flashcard Deck
                </label>
                {loadingDecks ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                ) : decks.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl">
                    <Library className="w-12 h-12 mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
                    <p className="text-neutral-500 dark:text-neutral-400">No flashcard decks found</p>
                    <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">Create a deck first to use this option</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {decks.map((deck) => (
                      <button
                        key={deck.id}
                        onClick={() => setDeckId(deck.id)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                          deckId === deck.id
                            ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500'
                            : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-blue-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium ${
                              deckId === deck.id ? 'text-blue-900 dark:text-blue-100' : 'text-black dark:text-white'
                            }`}>
                              {deck.name}
                            </p>
                            <p className={`text-sm ${
                              deckId === deck.id ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500 dark:text-neutral-400'
                            }`}>
                              {deck.cardCount} cards
                            </p>
                          </div>
                          {deckId === deck.id && (
                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {contentSource === 'STUDY_HISTORY' && (
              <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-black dark:text-white">
                      Questions from your study history
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                      AI will generate questions based on your past flashcard reviews and study sessions.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Settings */}
            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-6">
              <h3 className="font-semibold text-black dark:text-white mb-4">
                Game Settings
              </h3>

              <div className="grid grid-cols-3 gap-4">
                {/* Question Count */}
                <div>
                  <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                    <HelpCircle className="w-3 h-3 inline mr-1" />
                    Questions
                  </label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-black dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[5, 10, 15, 20].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Time per Question */}
                <div>
                  <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Seconds
                  </label>
                  <select
                    value={timePerQuestion}
                    onChange={(e) => setTimePerQuestion(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-black dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[10, 15, 20, 30, 45, 60].map((n) => (
                      <option key={n} value={n}>
                        {n}s
                      </option>
                    ))}
                  </select>
                </div>

                {/* Max Players */}
                <div>
                  <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                    <Users className="w-3 h-3 inline mr-1" />
                    Players
                  </label>
                  <select
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-black dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[5, 10, 20, 30, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-black dark:text-white text-sm">
                {error}
              </div>
            )}

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-400 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Game...
                </>
              ) : (
                <>
                  Create Game
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 3: Custom Questions (for CUSTOM mode) */}
        {step === 'questions' && contentSource === 'CUSTOM' && (
          <div className="space-y-6">
            {/* Spectator Mode Notice */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
              <div className="flex items-start gap-3">
                <PenTool className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-black dark:text-white">
                    Spectator Mode
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    Since you're creating the questions, you'll watch as a spectator
                    with a teacher dashboard showing real-time stats.
                  </p>
                </div>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                Game Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Class Quiz - Chapter 5"
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Question Editor */}
            <CustomQuestionEditor
              questions={customQuestions}
              onChange={setCustomQuestions}
            />

            {/* Settings */}
            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-6">
              <h3 className="font-semibold text-black dark:text-white mb-4">
                Game Settings
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Time per Question */}
                <div>
                  <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Seconds per question
                  </label>
                  <select
                    value={timePerQuestion}
                    onChange={(e) => setTimePerQuestion(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-black dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[10, 15, 20, 30, 45, 60].map((n) => (
                      <option key={n} value={n}>
                        {n}s
                      </option>
                    ))}
                  </select>
                </div>

                {/* Max Players */}
                <div>
                  <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                    <Users className="w-3 h-3 inline mr-1" />
                    Max players
                  </label>
                  <select
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-black dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[5, 10, 20, 30, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-black dark:text-white text-sm">
                {error}
              </div>
            )}

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={loading || customQuestions.length < 3}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-400 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Game...
                </>
              ) : (
                <>
                  Create Game ({customQuestions.length} questions)
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
