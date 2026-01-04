'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import {
  Send,
  User,
  AlertTriangle,
  Loader2,
  Sparkles,
  Brain,
  X,
  ImageIcon,
  Upload,
  ZoomIn,
} from 'lucide-react'
import QuizModal from './QuizModal'

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

export interface QuizConfig {
  count: number
  questionType: 'multiple_choice' | 'open_ended' | 'both'
  difficulty: 'easy' | 'medium' | 'hard'
}

interface AIPartnerChatProps {
  sessionId: string
  messages: Message[]
  onSendMessage: (content: string) => Promise<void>
  onSendMessageWithImage: (content: string, imageBase64: string, imageMimeType: string) => Promise<void>
  onGenerateImage?: (prompt: string, style?: string) => Promise<void>
  onGenerateQuiz: (config: QuizConfig) => Promise<void>
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
  isLoading = false,
  subject,
}: AIPartnerChatProps) {
  const t = useTranslations('aiPartner')
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  const [showQuizModal, setShowQuizModal] = useState(false)
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false)

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

    // If user typed an inline image command, generate image via chat flow
    if (onGenerateImage) {
      const parsed = parseImageCommand(input)
      if (parsed) {
        setIsSending(true)
        try {
          await onGenerateImage(parsed.prompt, parsed.style)
          setInput('')
        } catch (error) {
          console.error('Failed to generate image:', error)
        } finally {
          setIsSending(false)
        }
        return
      }
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

  const handleQuizGeneration = async (config: QuizConfig) => {
    setIsGeneratingQuiz(true)
    try {
      await onGenerateQuiz(config)
      setShowQuizModal(false)
    } catch (error) {
      console.error('Failed to generate quiz:', error)
    } finally {
      setIsGeneratingQuiz(false)
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

  // Parse inline image generation commands (e.g., "/image diagram of cell", "/img --style=diagram cell")
  const parseImageCommand = (raw: string): { prompt: string; style?: string } | null => {
    const input = raw.trim()
    if (!input) return null

    const lower = input.toLowerCase()
    const triggers = [
      '/image',
      '/img',
      'image:',
      'generate image',
      'generate an image',
      'create an image',
    ]

    const matched = triggers.find((t) => lower.startsWith(t))
    if (!matched) return null

    let rest = input.slice(matched.length).trim()
    if (!rest) return null

    // Optional style flag: --style=diagram
    let style: string | undefined
    const styleMatch = rest.match(/--style=([a-z0-9-]+)/i)
    if (styleMatch) {
      style = styleMatch[1]
      rest = rest.replace(styleMatch[0], '').trim()
    }

    if (!rest) return null
    return { prompt: rest, style }
  }

  // Render message with image support
  const renderMessageContent = (message: Message) => {
    const hasImage = message.imageUrl || message.imageBase64

    return (
      <>
        {message.wasFlagged && (
          <div className="flex items-center gap-1 text-amber-400 text-xs mb-2">
            <AlertTriangle className="w-3 h-3" />
            {t('chat.contentFlagged')}
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
              <span className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI Generated
              </span>
            )}
          </div>
        )}

        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {/* Show typing indicator when streaming but no content yet */}
          {message.role === 'ASSISTANT' && message.id.startsWith('temp-') && !message.content ? (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <>
              {message.content}
              {/* Show blinking cursor for streaming AI messages */}
              {message.role === 'ASSISTANT' && message.id.startsWith('temp-') && message.content && (
                <span className="inline-block w-2 h-4 bg-blue-400 ml-0.5 animate-pulse" />
              )}
            </>
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
      <div className="bg-gradient-to-r from-blue-600/20 to-blue-600/20 border-b border-slate-700/50 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Image src="/logo.png" alt="AI" width={16} height={16} className="object-contain" />
          <span>
            <strong className="text-blue-400">{t('aiStudyPartner')}</strong> - {t('aiDisclosure')}, {t('notRealPerson')}.
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50 bg-slate-800/50 overflow-x-auto">
        <button
          onClick={() => setShowQuizModal(true)}
          disabled={isLoading || isSending || isGeneratingQuiz}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition-colors text-sm disabled:opacity-50 whitespace-nowrap"
        >
          <Brain className="w-4 h-4" />
          {t('chat.generateQuiz')}
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
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center">
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

        {/* Loading indicator - only show if no streaming message exists */}
        {(isLoading || isSending) && !messages.some(m => m.role === 'ASSISTANT' && m.id.startsWith('temp-')) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">
                  {t('chat.aiThinking')}
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
          disabled={isLoading || isSending}
            className="p-3 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('chat.uploadImage')}
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={selectedImage ? t('chat.askAboutImage') : t('chat.typeMessage')}
            rows={1}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
          disabled={isLoading || isSending}
          />
          <button
            onClick={handleSend}
          disabled={(!input.trim() && !selectedImage) || isLoading || isSending}
            className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-xl hover:from-blue-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          {t('conversationsModerated')}
        </p>
      </div>

      {/* Quiz Modal */}
      <QuizModal
        isOpen={showQuizModal}
        onClose={() => setShowQuizModal(false)}
        onGenerate={handleQuizGeneration}
        isGenerating={isGeneratingQuiz}
      />

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
