'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import {
  Pencil,
  Eraser,
  Minus,
  Circle,
  Square,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Palette,
  Sparkles,
  Loader2,
  MessageSquare,
  X,
  Lightbulb,
  BookOpen,
  ChevronUp,
  PenTool,
  ListChecks,
  Timer,
} from 'lucide-react'

import { useConfirmModal } from '@/hooks/useConfirmModal'

type Tool = 'pen' | 'eraser' | 'line' | 'circle' | 'rectangle' | 'text'

interface DrawAction {
  tool: Tool
  color: string
  lineWidth: number
  points?: { x: number; y: number }[]
  startX?: number
  startY?: number
  endX?: number
  endY?: number
  text?: string
  timestamp: number
}

interface AIAnalysisResult {
  id?: string // Database ID for deletion
  analysis: string
  suggestions: string[]
  relatedConcepts: string[]
  timestamp: number
}

interface AISuggestionResult {
  id?: string // Database ID for deletion
  suggestions: string[]
  drawingIdeas: { title: string; description: string; steps: string[] }[]
  visualizationTips: string[]
  timestamp: number
}

interface AIPartnerWhiteboardProps {
  sessionId: string
  subject?: string | null
  skillLevel?: string | null
  onAIResponse?: (response: string) => void
  isTimerActive?: boolean // Whether the Pomodoro timer is running (required for AI features)
}

export default function AIPartnerWhiteboard({ sessionId, subject, skillLevel, isTimerActive = true }: AIPartnerWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Modal for confirmations
  const { showDanger } = useConfirmModal()

  // UI State
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#ffffff')
  const [lineWidth, setLineWidth] = useState(3)
  const [mounted, setMounted] = useState(false)
  const [showTextInput, setShowTextInput] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [textPos, setTextPos] = useState({ x: 0, y: 0 })
  const [isDraggingInput, setIsDraggingInput] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // AI Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showQuestionInput, setShowQuestionInput] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestionResult | null>(null)
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false)
  const [showSuggestionPanel, setShowSuggestionPanel] = useState(false)
  const [analysisHistory, setAnalysisHistory] = useState<AIAnalysisResult[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // Drawing state refs
  const isDrawingRef = useRef(false)
  const currentActionRef = useRef<DrawAction | null>(null)
  const actionsRef = useRef<DrawAction[]>([])
  const [actions, setActions] = useState<DrawAction[]>([])
  const [redoStack, setRedoStack] = useState<DrawAction[]>([])

  // Preset colors
  const presetColors = [
    '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#8b5cf6', '#ec4899', '#000000'
  ]

  // Fix hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync refs with state
  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  // Load AI responses from database on mount (persists across navigation)
  useEffect(() => {
    if (!mounted) return

    const loadAIResponses = async () => {
      try {
        const res = await fetch(`/api/ai-partner/whiteboard/responses?sessionId=${sessionId}`)
        if (!res.ok) return

        const data = await res.json()
        if (!data.success || !data.responses?.length) return

        // Process responses and set state
        const analyses: AIAnalysisResult[] = []
        let latestAnalysis: AIAnalysisResult | null = null
        let latestSuggestion: AISuggestionResult | null = null

        // Responses are ordered by createdAt DESC, so first is most recent
        for (const response of data.responses) {
          if (response.type === 'analysis') {
            const analysisData: AIAnalysisResult = {
              id: response.id,
              analysis: response.data.analysis || '',
              suggestions: response.data.suggestions || [],
              relatedConcepts: response.data.relatedConcepts || [],
              timestamp: response.timestamp,
            }
            analyses.push(analysisData)

            // Set the most recent analysis as active
            if (!latestAnalysis) {
              latestAnalysis = analysisData
            }
          } else if (response.type === 'suggestion') {
            // Set the most recent suggestion as active
            if (!latestSuggestion) {
              latestSuggestion = {
                id: response.id,
                suggestions: response.data.suggestions || [],
                drawingIdeas: response.data.drawingIdeas || [],
                visualizationTips: response.data.visualizationTips || [],
                timestamp: response.timestamp,
              }
            }
          }
        }

        // Set state - show the most recent response
        if (analyses.length > 0) {
          setAnalysisHistory(analyses)
        }

        // Show the most recent panel (analysis takes priority if both exist)
        if (latestAnalysis) {
          setAiAnalysis(latestAnalysis)
          setShowAnalysisPanel(true)
        } else if (latestSuggestion) {
          setAiSuggestion(latestSuggestion)
          setShowSuggestionPanel(true)
        }
      } catch (error) {
        console.error('Failed to load AI responses:', error)
      }
    }

    loadAIResponses()
  }, [mounted, sessionId])

  // Global mouse listener for dragging text input
  useEffect(() => {
    if (!isDraggingInput) return

    const handleGlobalMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newX = e.clientX - containerRect.left - dragOffset.current.x
      const newY = e.clientY - containerRect.top - dragOffset.current.y
      setTextPos({ x: newX, y: newY })
    }

    const handleGlobalUp = () => {
      setIsDraggingInput(false)
    }

    window.addEventListener('mousemove', handleGlobalMove)
    window.addEventListener('mouseup', handleGlobalUp)

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove)
      window.removeEventListener('mouseup', handleGlobalUp)
    }
  }, [isDraggingInput])

  // Draw a single action to the canvas context
  const drawAction = (ctx: CanvasRenderingContext2D, action: DrawAction) => {
    ctx.strokeStyle = action.color
    ctx.lineWidth = action.lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    switch (action.tool) {
      case 'pen':
        if (action.points && action.points.length > 0) {
          ctx.beginPath()
          ctx.moveTo(action.points[0].x, action.points[0].y)

          // Use quadratic curves for smoother lines
          for (let i = 1; i < action.points.length - 1; i++) {
            const p1 = action.points[i]
            const p2 = action.points[i + 1]
            const midX = (p1.x + p2.x) / 2
            const midY = (p1.y + p2.y) / 2
            ctx.quadraticCurveTo(p1.x, p1.y, midX, midY)
          }

          // Connect last point
          if (action.points.length > 1) {
            const last = action.points[action.points.length - 1]
            ctx.lineTo(last.x, last.y)
          }

          ctx.stroke()
        }
        break

      case 'eraser':
        if (action.points && action.points.length > 0) {
          ctx.save()
          ctx.globalCompositeOperation = 'destination-out'
          ctx.lineWidth = action.lineWidth * 5
          ctx.beginPath()
          ctx.moveTo(action.points[0].x, action.points[0].y)
          for (let i = 1; i < action.points.length; i++) {
            ctx.lineTo(action.points[i].x, action.points[i].y)
          }
          ctx.stroke()
          ctx.restore()
        }
        break

      case 'line':
        if (action.startX !== undefined && action.endX !== undefined) {
          ctx.beginPath()
          ctx.moveTo(action.startX, action.startY!)
          ctx.lineTo(action.endX, action.endY!)
          ctx.stroke()
        }
        break

      case 'circle':
        if (action.startX !== undefined && action.endX !== undefined) {
          const radius = Math.sqrt(
            Math.pow(action.endX - action.startX, 2) +
              Math.pow(action.endY! - action.startY!, 2)
          )
          ctx.beginPath()
          ctx.arc(action.startX, action.startY!, radius, 0, 2 * Math.PI)
          ctx.stroke()
        }
        break

      case 'rectangle':
        if (action.startX !== undefined && action.endX !== undefined) {
          ctx.strokeRect(
            action.startX,
            action.startY!,
            action.endX - action.startX,
            action.endY! - action.startY!
          )
        }
        break

      case 'text':
        if (action.text && action.startX !== undefined) {
          ctx.font = `${Math.max(16, action.lineWidth * 8)}px sans-serif`
          ctx.fillStyle = action.color
          ctx.fillText(action.text, action.startX, action.startY!)
        }
        break
    }
  }

  // Redraw everything
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear with dark background
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#1e293b' // slate-800
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw history
    actionsRef.current.forEach((action) => drawAction(ctx, action))

    // Draw current action (preview)
    if (currentActionRef.current) {
      drawAction(ctx, currentActionRef.current)
    }
  }, [])

  // Initialize and Handle Resize
  useEffect(() => {
    if (!mounted || !containerRef.current || !canvasRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      const container = containerRef.current
      const canvas = canvasRef.current
      if (!container || !canvas) return

      const rect = container.getBoundingClientRect()

      // Set actual canvas size
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      // Scale context
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }

      // CSS size
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      redrawCanvas()
    })

    resizeObserver.observe(containerRef.current)

    // Load saved state
    const saved = localStorage.getItem(`ai-whiteboard-${sessionId}`)
    if (saved) {
      try {
        const savedActions = JSON.parse(saved)
        setActions(savedActions)
        actionsRef.current = savedActions
      } catch (e) {
        console.error('Failed to load whiteboard state', e)
      }
    }

    return () => resizeObserver.disconnect()
  }, [mounted, sessionId, redrawCanvas])

  // Trigger redraw when actions change
  useEffect(() => {
    redrawCanvas()
  }, [actions, redrawCanvas])

  // Mouse Event Handlers
  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    let clientX, clientY
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = (e as React.MouseEvent).clientX
      clientY = (e as React.MouseEvent).clientY
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const pos = getMousePos(e)

    if (tool === 'text') {
      setTextPos(pos)
      setShowTextInput(true)
      return
    }

    isDrawingRef.current = true

    const newAction: DrawAction = {
      tool,
      color,
      lineWidth,
      points: [pos],
      startX: pos.x,
      startY: pos.y,
      endX: pos.x,
      endY: pos.y,
      timestamp: Date.now(),
    }

    currentActionRef.current = newAction
    redrawCanvas()
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current || !currentActionRef.current) return
    e.preventDefault()

    const pos = getMousePos(e)
    const action = currentActionRef.current

    if (tool === 'pen' || tool === 'eraser') {
      action.points?.push(pos)
    } else {
      action.endX = pos.x
      action.endY = pos.y
    }

    requestAnimationFrame(redrawCanvas)
  }

  const stopDrawing = () => {
    if (!isDrawingRef.current || !currentActionRef.current) return

    isDrawingRef.current = false

    const finalAction = currentActionRef.current
    currentActionRef.current = null

    setActions((prev) => {
      const updated = [...prev, finalAction]
      localStorage.setItem(`ai-whiteboard-${sessionId}`, JSON.stringify(updated))
      return updated
    })

    setRedoStack([])
    redrawCanvas()
  }

  const handleAddText = () => {
    if (!textInput.trim()) {
      setShowTextInput(false)
      return
    }

    const newAction: DrawAction = {
      tool: 'text',
      color,
      lineWidth,
      text: textInput,
      startX: textPos.x,
      startY: textPos.y,
      timestamp: Date.now(),
    }

    setActions((prev) => {
      const updated = [...prev, newAction]
      localStorage.setItem(`ai-whiteboard-${sessionId}`, JSON.stringify(updated))
      return updated
    })

    setRedoStack([])
    setTextInput('')
    setShowTextInput(false)
  }

  const handleClear = async () => {
    const confirmed = await showDanger('Clear Whiteboard', 'Are you sure you want to clear the whiteboard?', 'Clear', 'Cancel')
    if (!confirmed) return
    setActions([])
    setRedoStack([])
    localStorage.removeItem(`ai-whiteboard-${sessionId}`)
    toast.success('Whiteboard cleared')
  }

  const handleUndo = () => {
    if (actions.length === 0) return

    const lastAction = actions[actions.length - 1]
    setActions((prev) => {
      const newActions = prev.slice(0, -1)
      localStorage.setItem(`ai-whiteboard-${sessionId}`, JSON.stringify(newActions))
      return newActions
    })
    setRedoStack((prev) => [...prev, lastAction])
  }

  const handleRedo = () => {
    if (redoStack.length === 0) return

    const actionToRedo = redoStack[redoStack.length - 1]
    setRedoStack((prev) => prev.slice(0, -1))
    setActions((prev) => {
      const newActions = [...prev, actionToRedo]
      localStorage.setItem(`ai-whiteboard-${sessionId}`, JSON.stringify(newActions))
      return newActions
    })
  }

  const handleTextDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingInput(true)

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()

    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `whiteboard-${Date.now()}.png`
    link.href = canvas.toDataURL()
    link.click()
    toast.success('Downloaded!')
  }

  // Ask AI to analyze the whiteboard OR get suggestions (for empty canvas)
  const handleAskAI = async (question?: string) => {
    // Check if timer is active before allowing AI analysis
    if (!isTimerActive) {
      toast.error('Start the Pomodoro timer first to use AI features')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    setIsAnalyzing(true)
    setShowQuestionInput(false)

    try {
      // Determine mode: 'suggest' for empty canvas, 'analyze' for drawings
      const isEmptyCanvas = actions.length === 0
      const mode = isEmptyCanvas ? 'suggest' : 'analyze'

      // Build request body based on mode
      const requestBody: {
        sessionId: string
        mode: string
        userQuestion?: string
        imageBase64?: string
      } = {
        sessionId,
        mode,
        userQuestion: question || undefined,
      }

      // Only include image for analysis mode
      if (!isEmptyCanvas) {
        const dataUrl = canvas.toDataURL('image/png')
        requestBody.imageBase64 = dataUrl.split(',')[1]
      }

      const res = await fetch('/api/ai-partner/whiteboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Request failed')
        return
      }

      if (data.success) {
        if (data.mode === 'suggest') {
          // Handle suggestion response (empty canvas)
          const newSuggestion: AISuggestionResult = {
            id: data.messageId, // Store message ID for deletion
            suggestions: data.suggestions || [],
            drawingIdeas: data.drawingIdeas || [],
            visualizationTips: data.visualizationTips || [],
            timestamp: Date.now(),
          }

          setAiSuggestion(newSuggestion)
          setShowSuggestionPanel(true)
          setShowAnalysisPanel(false)

          toast.success('AI has suggestions for you!')
        } else {
          // Handle analysis response (has drawing)
          const newAnalysis: AIAnalysisResult = {
            id: data.messageId, // Store message ID for deletion
            analysis: data.analysis,
            suggestions: data.suggestions || [],
            relatedConcepts: data.relatedConcepts || [],
            timestamp: Date.now(),
          }

          setAiAnalysis(newAnalysis)
          setShowAnalysisPanel(true)
          setShowSuggestionPanel(false)

          // Add to history (keep last 10) - stored in DB now, no localStorage needed
          setAnalysisHistory((prev) => {
            const updated = [newAnalysis, ...prev].slice(0, 10)
            return updated
          })

          toast.success('AI analyzed your whiteboard!')
        }
      } else {
        toast.error(data.error || 'Failed to process request')
      }
    } catch (error) {
      console.error('Failed to process whiteboard request:', error)
      toast.error('Failed to connect to AI')
    } finally {
      setIsAnalyzing(false)
      setAiQuestion('')
    }
  }

  // Delete a single AI response from database
  const handleDeleteResponse = async (responseId: string | undefined, type: 'analysis' | 'suggestion') => {
    if (!responseId) {
      // Just close the panel if no ID (legacy local-only response)
      if (type === 'analysis') {
        setShowAnalysisPanel(false)
        setAiAnalysis(null)
      } else {
        setShowSuggestionPanel(false)
        setAiSuggestion(null)
      }
      return
    }

    try {
      const res = await fetch(
        `/api/ai-partner/whiteboard/responses?responseId=${responseId}&sessionId=${sessionId}`,
        { method: 'DELETE' }
      )

      if (res.ok) {
        if (type === 'analysis') {
          setShowAnalysisPanel(false)
          setAiAnalysis(null)
          // Remove from history
          setAnalysisHistory((prev) => prev.filter((item) => item.id !== responseId))
        } else {
          setShowSuggestionPanel(false)
          setAiSuggestion(null)
        }
        toast.success('Response deleted')
      } else {
        toast.error('Failed to delete response')
      }
    } catch (error) {
      console.error('Failed to delete response:', error)
      toast.error('Failed to delete response')
    }
  }

  // Clear all analysis history from database
  const handleClearHistory = async () => {
    const confirmed = await showDanger('Clear History', 'Are you sure you want to clear all analysis history?', 'Clear', 'Cancel')
    if (!confirmed) return

    // Delete all responses from history
    const deletePromises = analysisHistory
      .filter((item) => item.id)
      .map((item) =>
        fetch(`/api/ai-partner/whiteboard/responses?responseId=${item.id}&sessionId=${sessionId}`, {
          method: 'DELETE',
        })
      )

    try {
      await Promise.all(deletePromises)
      setAnalysisHistory([])
      setAiAnalysis(null)
      setShowAnalysisPanel(false)
      toast.success('History cleared')
    } catch (error) {
      console.error('Failed to clear history:', error)
      toast.error('Failed to clear some responses')
    }
  }

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (!mounted) return null

  const tools: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: 'pen', icon: Pencil, label: 'Pen' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'text', icon: Type, label: 'Text' },
  ]

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-800/40 backdrop-blur-xl rounded-xl border border-slate-700/50">
        {/* Tools */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-700/50">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={`p-2 rounded-md transition-all ${
                  tool === t.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
                title={t.label}
              >
                <t.icon className="w-5 h-5" />
              </button>
            ))}
          </div>

          <div className="w-px h-8 bg-slate-700/50 mx-2" />

          {/* Color Picker */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {presetColors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-800' : ''
                  }`}
                  style={{ backgroundColor: c, border: c === '#ffffff' ? '1px solid #475569' : 'none' }}
                />
              ))}
            </div>
            <div className="relative">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer opacity-0 absolute inset-0"
              />
              <div
                className="w-8 h-8 rounded border border-slate-600 flex items-center justify-center"
                style={{ backgroundColor: color }}
              >
                <Palette className="w-4 h-4 text-slate-300" />
              </div>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-700/50 mx-2" />

          {/* Line Width */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Size:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-slate-400 w-6">{lineWidth}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={actions.length === 0}
            className="p-2 text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-2 text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Redo2 className="w-5 h-5" />
          </button>

          <div className="w-px h-8 bg-slate-700/50 mx-1" />

          <button
            onClick={handleClear}
            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Clear"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 transition-colors"
          >
            <Download className="w-4 h-4" />
            Save
          </button>

          <div className="w-px h-8 bg-slate-700/50 mx-1" />

          {/* AI Analysis/Suggestion Button */}
          <button
            onClick={() => setShowQuestionInput(!showQuestionInput)}
            disabled={isAnalyzing || !isTimerActive}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-lg font-medium hover:from-blue-500 hover:to-blue-500 transition-all disabled:opacity-50"
            title={!isTimerActive ? "Start the timer first" : (actions.length === 0 ? "Get AI suggestions for what to draw" : "Ask AI to analyze your whiteboard")}
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : !isTimerActive ? (
              <Timer className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {!isTimerActive ? 'Start Timer' : (actions.length === 0 ? 'Get Ideas' : 'Ask AI')}
          </button>

          {/* History Button */}
          {analysisHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 px-2 py-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              title="View analysis history"
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-xs">{analysisHistory.length}</span>
            </button>
          )}
        </div>
      </div>

      {/* AI Question Input */}
      {showQuestionInput && (
        <div className="flex gap-2 p-4 bg-slate-800/40 backdrop-blur-xl rounded-xl border border-slate-700/50">
          <div className="flex-1 flex gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400 mt-2.5" />
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAskAI(aiQuestion)
                if (e.key === 'Escape') setShowQuestionInput(false)
              }}
              placeholder={
                actions.length === 0
                  ? subject
                    ? `What should I draw to learn ${subject}? (optional)`
                    : "What concept would you like help visualizing? (optional)"
                  : subject
                    ? `Ask about your ${subject} diagram... (optional)`
                    : "Ask a specific question about your drawing... (optional)"
              }
              className="flex-1 px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 outline-none"
              autoFocus
            />
          </div>
          <button
            onClick={() => handleAskAI(aiQuestion)}
            disabled={isAnalyzing || !isTimerActive}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
            title={!isTimerActive ? 'Start the timer first' : undefined}
          >
            {isAnalyzing ? 'Processing...' : actions.length === 0 ? 'Get Ideas' : 'Analyze'}
          </button>
          <button
            onClick={() => setShowQuestionInput(false)}
            className="px-3 py-2 text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Content Area - Canvas + AI Response Side by Side */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Canvas Container */}
        <div
          ref={containerRef}
          className={`relative bg-slate-800 rounded-xl border border-slate-700/50 shadow-inner overflow-hidden min-h-[400px] transition-all ${
            showAnalysisPanel || showSuggestionPanel ? 'flex-1' : 'w-full'
          }`}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="absolute top-0 left-0 touch-none cursor-crosshair"
          />

          {showTextInput && (
            <div
              className="absolute bg-slate-800/90 backdrop-blur-xl p-3 rounded-lg shadow-xl border border-slate-700/50 z-50 flex flex-col gap-2"
              style={{ left: textPos.x, top: textPos.y }}
            >
              {/* Drag Handle */}
              <div
                onMouseDown={handleTextDragStart}
                className="w-full h-4 bg-slate-900/50 rounded-t-md cursor-move flex justify-center items-center hover:bg-slate-900/70 transition-colors"
                title="Drag to move"
              >
                <div className="w-8 h-1 bg-slate-600 rounded-full" />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddText()
                    if (e.key === 'Escape') setShowTextInput(false)
                  }}
                  placeholder="Type something..."
                  className="px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 outline-none min-w-[200px]"
                  autoFocus
                />
                <button
                  onClick={handleAddText}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-medium"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Analysis Panel */}
        {showAnalysisPanel && aiAnalysis && (
          <div className="w-96 flex-shrink-0 bg-slate-800/60 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-gradient-to-r from-blue-600/20 to-blue-600/20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">AI Analysis</h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDeleteResponse(aiAnalysis.id, 'analysis')}
                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                  title="Delete this analysis"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowAnalysisPanel(false)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                  title="Close panel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Analysis */}
              <div>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {aiAnalysis.analysis}
                </p>
              </div>

              {/* Suggestions */}
              {aiAnalysis.suggestions.length > 0 && (
                <div className="pt-4 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <h4 className="font-medium text-white text-sm">Suggestions</h4>
                  </div>
                  <ul className="space-y-2">
                    {aiAnalysis.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex gap-2 text-sm text-slate-400">
                        <span className="text-blue-400">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Related Concepts */}
              {aiAnalysis.relatedConcepts.length > 0 && (
                <div className="pt-4 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    <h4 className="font-medium text-white text-sm">Related Concepts</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aiAnalysis.relatedConcepts.map((concept, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-slate-700/50 text-slate-300 text-xs rounded-full"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer with timestamp */}
            <div className="p-3 border-t border-slate-700/50 bg-slate-900/30">
              <p className="text-xs text-slate-500 text-center">
                Analyzed at {formatTime(aiAnalysis.timestamp)}
              </p>
            </div>
          </div>
        )}

        {/* AI Suggestion Panel (for empty canvas) */}
        {showSuggestionPanel && aiSuggestion && (
          <div className="w-96 flex-shrink-0 bg-slate-800/60 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-gradient-to-r from-blue-600/20 to-blue-600/20">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                <h3 className="font-semibold text-white">Drawing Ideas</h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDeleteResponse(aiSuggestion.id, 'suggestion')}
                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                  title="Delete these suggestions"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowSuggestionPanel(false)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                  title="Close panel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Quick Suggestions */}
              {aiSuggestion.suggestions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <h4 className="font-medium text-white text-sm">Quick Ideas</h4>
                  </div>
                  <ul className="space-y-2">
                    {aiSuggestion.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-blue-400">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Drawing Ideas with Steps */}
              {aiSuggestion.drawingIdeas.length > 0 && (
                <div className="pt-4 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 mb-3">
                    <PenTool className="w-4 h-4 text-blue-400" />
                    <h4 className="font-medium text-white text-sm">Step-by-Step Ideas</h4>
                  </div>
                  <div className="space-y-4">
                    {aiSuggestion.drawingIdeas.map((idea, index) => (
                      <div key={index} className="bg-slate-900/40 rounded-lg p-3">
                        <h5 className="font-medium text-white text-sm mb-1">{idea.title}</h5>
                        <p className="text-xs text-slate-400 mb-2">{idea.description}</p>
                        {idea.steps.length > 0 && (
                          <div className="space-y-1">
                            {idea.steps.map((step, stepIndex) => (
                              <div key={stepIndex} className="flex gap-2 text-xs text-slate-300">
                                <span className="text-blue-400 font-medium">{stepIndex + 1}.</span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visualization Tips */}
              {aiSuggestion.visualizationTips.length > 0 && (
                <div className="pt-4 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 mb-3">
                    <ListChecks className="w-4 h-4 text-green-400" />
                    <h4 className="font-medium text-white text-sm">Pro Tips</h4>
                  </div>
                  <ul className="space-y-2">
                    {aiSuggestion.visualizationTips.map((tip, index) => (
                      <li key={index} className="flex gap-2 text-sm text-slate-400">
                        <span className="text-green-400">✓</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer with timestamp */}
            <div className="p-3 border-t border-slate-700/50 bg-slate-900/30">
              <p className="text-xs text-slate-500 text-center">
                Generated at {formatTime(aiSuggestion.timestamp)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Analysis History Dropdown */}
      {showHistory && analysisHistory.length > 0 && (
        <div className="bg-slate-800/60 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-white">Analysis History</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearHistory}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {analysisHistory.map((item, index) => (
              <button
                key={item.timestamp}
                onClick={() => {
                  setAiAnalysis(item)
                  setShowAnalysisPanel(true)
                  setShowHistory(false)
                }}
                className="w-full p-3 text-left hover:bg-slate-700/30 transition-colors border-b border-slate-700/30 last:border-0"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">{formatTime(item.timestamp)}</span>
                  <span className="text-xs text-slate-600">#{analysisHistory.length - index}</span>
                </div>
                <p className="text-sm text-slate-300 line-clamp-2">
                  {item.analysis.slice(0, 100)}...
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <p className="text-center text-slate-500 text-sm">
        {actions.length === 0
          ? `Click "Get Ideas" for AI suggestions on what to draw${subject ? ` for ${subject}` : ''}, or start drawing!`
          : subject
            ? `Draw ${subject} diagrams, formulas, or notes. AI will analyze with ${skillLevel ? skillLevel.toLowerCase() + '-level' : 'subject-specific'} feedback.`
            : 'Use the whiteboard to draw diagrams, take notes, or visualize concepts. Click "Ask AI" for feedback.'}
      </p>
    </div>
  )
}
