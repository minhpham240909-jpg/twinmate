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
} from 'lucide-react'

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

interface AIPartnerWhiteboardProps {
  sessionId: string
  subject?: string | null
  skillLevel?: string | null
  onAIResponse?: (response: string) => void
}

export default function AIPartnerWhiteboard({ sessionId, subject, skillLevel, onAIResponse }: AIPartnerWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const handleClear = () => {
    if (!confirm('Clear the whiteboard?')) return
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

  // Ask AI to analyze the whiteboard
  const handleAskAI = async (question?: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (actions.length === 0) {
      toast.error('Draw something first!')
      return
    }

    setIsAnalyzing(true)
    setShowQuestionInput(false)

    try {
      // Get canvas as base64 (remove the data:image/png;base64, prefix)
      const dataUrl = canvas.toDataURL('image/png')
      const base64 = dataUrl.split(',')[1]

      const res = await fetch('/api/ai-partner/whiteboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          imageBase64: base64,
          userQuestion: question || undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success('AI analyzed your whiteboard!')

        // If callback provided, send the analysis to the chat
        if (onAIResponse) {
          onAIResponse(data.analysis)
        }
      } else {
        toast.error(data.error || 'Failed to analyze whiteboard')
      }
    } catch (error) {
      console.error('Failed to analyze whiteboard:', error)
      toast.error('Failed to analyze whiteboard')
    } finally {
      setIsAnalyzing(false)
      setAiQuestion('')
    }
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

          {/* AI Analysis Button */}
          <button
            onClick={() => setShowQuestionInput(!showQuestionInput)}
            disabled={isAnalyzing || actions.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50"
            title="Ask AI to analyze your whiteboard"
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Ask AI
          </button>
        </div>
      </div>

      {/* AI Question Input */}
      {showQuestionInput && (
        <div className="flex gap-2 p-4 bg-slate-800/40 backdrop-blur-xl rounded-xl border border-slate-700/50">
          <div className="flex-1 flex gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400 mt-2.5" />
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAskAI(aiQuestion)
                if (e.key === 'Escape') setShowQuestionInput(false)
              }}
              placeholder={subject ? `Ask about your ${subject} diagram... (optional)` : "Ask a specific question about your drawing... (optional)"}
              className="flex-1 px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500/50 outline-none"
              autoFocus
            />
          </div>
          <button
            onClick={() => handleAskAI(aiQuestion)}
            disabled={isAnalyzing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 transition-colors disabled:opacity-50"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </button>
          <button
            onClick={() => setShowQuestionInput(false)}
            className="px-3 py-2 text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 relative bg-slate-800 rounded-xl border border-slate-700/50 shadow-inner overflow-hidden min-h-[400px]"
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

      {/* Instructions */}
      <p className="text-center text-slate-500 text-sm">
        {subject
          ? `Draw ${subject} diagrams, formulas, or notes. AI will analyze with ${skillLevel ? skillLevel.toLowerCase() + '-level' : 'subject-specific'} feedback.`
          : 'Use the whiteboard to draw diagrams, take notes, or visualize concepts'}
      </p>
    </div>
  )
}
