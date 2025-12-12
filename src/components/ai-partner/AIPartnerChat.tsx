'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  User,
  AlertTriangle,
  Loader2,
  Sparkles,
  BookOpen,
  Brain,
  X,
  ImageIcon,
  Wand2,
  Upload,
  ZoomIn,
} from 'lucide-react'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  messageType: string
  wasFlagged: boolean
  createdAt: Date | string
  imageUrl?: string | null
  imageBase64?: string | null
  imageMimeType?: string | null
  imageType?: string | null
}

interface AIPartnerChatProps {
  sessionId: string
  messages: Message[]
  onSendMessage: (content: string) => Promise<void>
  onSendMessageWithImage: (content: string, imageBase64: string, imageMimeType: string) => Promise<void>
  onGenerateImage: (prompt: string, style: string) => Promise<void>
  onGenerateQuiz: () => Promise<void>
  onGenerateFlashcards: (topic: string) => Promise<void>
  isLoading?: boolean
  subject?: string | null
}

export default function AIPartnerChat({
  // sessionId is available for future features like image suggestion checks
  sessionId: _sessionId,
  messages,
  onSendMessage,
  onSendMessageWithImage,
  onGenerateImage,
  onGenerateQuiz,
  onGenerateFlashcards,
  isLoading = false,
  subject,
}: AIPartnerChatProps) {
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showFlashcardModal, setShowFlashcardModal] = useState(false)
  const [showImageGenModal, setShowImageGenModal] = useState(false)
  const [flashcardTopic, setFlashcardTopic] = useState('')
  const [imageGenPrompt, setImageGenPrompt] = useState('')
  const [imageGenStyle, setImageGenStyle] = useState<string>('diagram')
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (isSending) return

    // If there's an image selected
    if (selectedImage) {
      setIsSending(true)
      try {
        await onSendMessageWithImage(input.trim(), selectedImage.base64, selectedImage.mimeType)
        setInput('')
        setSelectedImage(null)
      } catch (error) {
        console.error('Failed to send image message:', error)
      } finally {
        setIsSending(false)
      }
      return
    }

    // Regular text message
    if (!input.trim()) return

    const content = input.trim()
    setInput('')
    setIsSending(true)

    try {
      await onSendMessage(content)
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFlashcardGeneration = async () => {
    if (!flashcardTopic.trim()) return
    setShowFlashcardModal(false)
    await onGenerateFlashcards(flashcardTopic.trim())
    setFlashcardTopic('')
  }

  const handleImageGeneration = async () => {
    if (!imageGenPrompt.trim()) return
    setIsGeneratingImage(true)
    setShowImageGenModal(false)

    try {
      await onGenerateImage(imageGenPrompt.trim(), imageGenStyle)
    } catch (error) {
      console.error('Failed to generate image:', error)
    } finally {
      setIsGeneratingImage(false)
      setImageGenPrompt('')
      setImageGenStyle('diagram')
    }
  }

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      alert('Please select a valid image file (JPEG, PNG, GIF, or WebP)')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image too large. Maximum size is 10MB.')
      return
    }

    // Read file as base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      // Extract base64 data (remove data:image/...;base64, prefix)
      const base64 = result.split(',')[1]
      setSelectedImage({
        base64,
        mimeType: file.type,
        preview: result,
      })
    }
    reader.readAsDataURL(file)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const removeSelectedImage = () => {
    setSelectedImage(null)
  }

  // Render message with image support
  const renderMessageContent = (message: Message) => {
    const hasImage = message.imageUrl || message.imageBase64

    return (
      <>
        {message.wasFlagged && (
          <div className="flex items-center gap-1 text-amber-400 text-xs mb-2">
            <AlertTriangle className="w-3 h-3" />
            Content redirected
          </div>
        )}

        {/* Display image if present */}
        {hasImage && (
          <div className="mb-3">
            <div
              className="relative rounded-lg overflow-hidden cursor-pointer group"
              onClick={() => setEnlargedImage(message.imageUrl || `data:${message.imageMimeType};base64,${message.imageBase64}`)}
            >
              <img
                src={message.imageUrl || `data:${message.imageMimeType};base64,${message.imageBase64}`}
                alt="Shared image"
                className="max-w-full max-h-64 rounded-lg object-contain"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            {message.imageType === 'generated' && (
              <span className="text-xs text-purple-400 mt-1 flex items-center gap-1">
                <Wand2 className="w-3 h-3" />
                AI Generated
              </span>
            )}
          </div>
        )}

        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
          {/* Show blinking cursor for streaming AI messages */}
          {message.role === 'ASSISTANT' && message.id.startsWith('temp-') && (
            <span className="inline-block w-2 h-4 bg-blue-400 ml-0.5 animate-pulse" />
          )}
        </div>

        <div className="text-xs opacity-50 mt-2">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* AI Disclosure Banner */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-slate-700/50 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Image src="/logo.png" alt="AI" width={16} height={16} className="object-contain" />
          <span>
            <strong className="text-blue-400">AI Study Partner</strong> - This is an automated assistant, not a real person.
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50 bg-slate-800/50 overflow-x-auto">
        <button
          onClick={onGenerateQuiz}
          disabled={isLoading || isSending}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 text-purple-300 rounded-lg hover:bg-purple-600/30 transition-colors text-sm disabled:opacity-50 whitespace-nowrap"
        >
          <Brain className="w-4 h-4" />
          Quiz Me
        </button>
        <button
          onClick={() => setShowFlashcardModal(true)}
          disabled={isLoading || isSending}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 text-green-300 rounded-lg hover:bg-green-600/30 transition-colors text-sm disabled:opacity-50 whitespace-nowrap"
        >
          <BookOpen className="w-4 h-4" />
          Flashcards
        </button>
        <button
          onClick={() => setShowImageGenModal(true)}
          disabled={isLoading || isSending || isGeneratingImage}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-600/20 text-amber-300 rounded-lg hover:bg-amber-600/30 transition-colors text-sm disabled:opacity-50 whitespace-nowrap"
        >
          <Wand2 className="w-4 h-4" />
          Generate Image
        </button>
        <div className="flex-1" />
        {subject && (
          <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded whitespace-nowrap">
            {subject}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex gap-3 ${
                message.role === 'USER' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'ASSISTANT' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'USER'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-100 border border-slate-700/50'
                }`}
              >
                {renderMessageContent(message)}
              </div>

              {message.role === 'USER' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {(isLoading || isSending || isGeneratingImage) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">
                  {isGeneratingImage ? 'Creating image...' : 'Thinking...'}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Selected Image Preview */}
      {selectedImage && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <img
              src={selectedImage.preview}
              alt="Selected"
              className="h-20 rounded-lg object-cover border border-slate-600"
            />
            <button
              onClick={removeSelectedImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-slate-700/50 bg-slate-800/50">
        <div className="flex gap-3 items-end">
          {/* Image Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isSending || isGeneratingImage}
            className="p-3 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload image"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={selectedImage ? "Add a message about your image..." : "Ask your AI study partner..."}
            rows={1}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            disabled={isLoading || isSending || isGeneratingImage}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !selectedImage) || isLoading || isSending || isGeneratingImage}
            className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : selectedImage ? (
              <Upload className="w-5 h-5" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Safety reminder */}
        <p className="text-xs text-slate-500 mt-2 text-center">
          Upload images or ask questions. Messages are moderated for safety.
        </p>
      </div>

      {/* Flashcard Topic Modal */}
      <AnimatePresence>
        {showFlashcardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowFlashcardModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-green-400" />
                  Generate Flashcards
                </h3>
                <button
                  onClick={() => setShowFlashcardModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-slate-400 text-sm mb-4">
                Enter a topic and we&apos;ll create flashcards to help you study.
              </p>

              <input
                type="text"
                value={flashcardTopic}
                onChange={(e) => setFlashcardTopic(e.target.value)}
                placeholder="e.g., Photosynthesis, World War II, Calculus derivatives"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500 mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFlashcardGeneration()
                }}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowFlashcardModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFlashcardGeneration}
                  disabled={!flashcardTopic.trim()}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-500 transition-colors disabled:opacity-50"
                >
                  Generate
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Generation Modal */}
      <AnimatePresence>
        {showImageGenModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowImageGenModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-amber-400" />
                  Generate Educational Image
                </h3>
                <button
                  onClick={() => setShowImageGenModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-slate-400 text-sm mb-4">
                Describe what you want to visualize and AI will create an educational image.
              </p>

              <textarea
                value={imageGenPrompt}
                onChange={(e) => setImageGenPrompt(e.target.value)}
                placeholder="e.g., The process of photosynthesis showing sunlight, water, and CO2 being converted to glucose..."
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 mb-4 resize-none"
              />

              <div className="mb-4">
                <label className="text-sm text-slate-400 mb-2 block">Style</label>

                {/* Educational Styles */}
                <div className="mb-3">
                  <span className="text-xs text-slate-500 mb-1.5 block">Educational</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'diagram', label: 'Diagram' },
                      { value: 'illustration', label: 'Illustration' },
                      { value: 'chart', label: 'Chart' },
                      { value: 'infographic', label: 'Infographic' },
                      { value: 'concept-map', label: 'Concept Map' },
                      { value: 'flowchart', label: 'Flowchart' },
                      { value: 'mindmap', label: 'Mind Map' },
                      { value: 'timeline', label: 'Timeline' },
                    ].map((style) => (
                      <button
                        key={style.value}
                        onClick={() => setImageGenStyle(style.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          imageGenStyle === style.value
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Creative/Design Styles */}
                <div>
                  <span className="text-xs text-slate-500 mb-1.5 block">Creative & Design</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'logo', label: 'Logo' },
                      { value: 'picture', label: 'Picture' },
                      { value: 'sketch', label: 'Sketch' },
                      { value: 'poster', label: 'Poster' },
                      { value: 'icon', label: 'Icon' },
                      { value: 'cartoon', label: 'Cartoon' },
                      { value: 'technical', label: 'Technical' },
                    ].map((style) => (
                      <button
                        key={style.value}
                        onClick={() => setImageGenStyle(style.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          imageGenStyle === style.value
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowImageGenModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImageGeneration}
                  disabled={!imageGenPrompt.trim() || imageGenPrompt.length < 10}
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Wand2 className="w-4 h-4" />
                  Generate
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enlarged Image Modal */}
      <AnimatePresence>
        {enlargedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
            onClick={() => setEnlargedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh]"
            >
              <button
                onClick={() => setEnlargedImage(null)}
                className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors"
              >
                <X className="w-8 h-8" />
              </button>
              <img
                src={enlargedImage}
                alt="Enlarged view"
                className="max-w-full max-h-[85vh] rounded-lg object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
