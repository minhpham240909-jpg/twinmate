'use client'

/**
 * SessionWhiteboard Component
 *
 * Private whiteboard for study sessions.
 * - Each user has their own private whiteboard canvas
 * - Drawings are only visible to the owner
 * - Users can share their whiteboard to screen for others to view
 * - Supports various drawing tools: pen, eraser, shapes, text
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import toast from 'react-hot-toast'
import { Lock, Share2, Eye, Palette, Download, Trash2, Undo2, Redo2 } from 'lucide-react'

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
  userId: string
  timestamp: number
}

interface SharedWhiteboardData {
  imageData: string
  sharedBy: {
    id: string
    name: string
    avatarUrl?: string | null
  }
}

interface SessionWhiteboardProps {
  sessionId: string
  onShareWhiteboard?: (data: SharedWhiteboardData) => void
  onStopSharing?: () => void
  onUpdateWhiteboard?: (data: SharedWhiteboardData) => void // Real-time updates while sharing
  isSharing?: boolean
  sharedWhiteboard?: SharedWhiteboardData | null
}

export default function SessionWhiteboard({
  sessionId,
  onShareWhiteboard,
  onStopSharing,
  onUpdateWhiteboard,
  isSharing = false,
  sharedWhiteboard = null
}: SessionWhiteboardProps) {
  const { user, profile } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // UI State
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#000000')
  const [lineWidth, setLineWidth] = useState(2)
  const [mounted, setMounted] = useState(false)
  const [showTextInput, setShowTextInput] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [textPos, setTextPos] = useState({ x: 0, y: 0 })
  const [isDraggingInput, setIsDraggingInput] = useState(false)
  const [showShareConfirm, setShowShareConfirm] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Refs for drawing state
  const isDrawingRef = useRef(false)
  const currentActionRef = useRef<DrawAction | null>(null)
  const actionsRef = useRef<DrawAction[]>([])
  const [actions, setActions] = useState<DrawAction[]>([])
  const [redoStack, setRedoStack] = useState<DrawAction[]>([])

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

          for (let i = 1; i < action.points.length - 1; i++) {
            const p1 = action.points[i]
            const p2 = action.points[i + 1]
            const midX = (p1.x + p2.x) / 2
            const midY = (p1.y + p2.y) / 2
            ctx.quadraticCurveTo(p1.x, p1.y, midX, midY)
          }

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

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    actionsRef.current.forEach(action => drawAction(ctx, action))

    if (currentActionRef.current) {
      drawAction(ctx, currentActionRef.current)
    }
  }, [])

  // Save actions to localStorage (private per user)
  const saveToLocalStorage = useCallback((newActions: DrawAction[]) => {
    const storageKey = `whiteboard-${sessionId}-${user?.id}`
    localStorage.setItem(storageKey, JSON.stringify(newActions))
  }, [sessionId, user?.id])

  // Broadcast whiteboard update when sharing (debounced to prevent excessive broadcasts)
  const broadcastWhiteboardUpdate = useCallback(() => {
    if (!isSharing || !onUpdateWhiteboard || !canvasRef.current) return

    const imageData = canvasRef.current.toDataURL('image/png')
    onUpdateWhiteboard({
      imageData,
      sharedBy: {
        id: user?.id || '',
        name: profile?.name || 'Anonymous',
        avatarUrl: profile?.avatarUrl
      }
    })
  }, [isSharing, onUpdateWhiteboard, user?.id, profile?.name, profile?.avatarUrl])

  // Initialize and Handle Resize
  useEffect(() => {
    if (!mounted || !containerRef.current || !canvasRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      const container = containerRef.current
      const canvas = canvasRef.current
      if (!container || !canvas) return

      const rect = container.getBoundingClientRect()

      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }

      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      redrawCanvas()
    })

    resizeObserver.observe(containerRef.current)

    // Load saved state (private to this user)
    const storageKey = `whiteboard-${sessionId}-${user?.id}`
    const saved = localStorage.getItem(storageKey)
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
  }, [mounted, sessionId, user?.id, redrawCanvas])

  // FIX: Force canvas resize when returning from shared view to own whiteboard
  // This fixes the quarter-screen bug after stop sharing
  useEffect(() => {
    if (!mounted || !containerRef.current || !canvasRef.current) return
    // Only run when we're NOT viewing someone else's shared whiteboard
    if (sharedWhiteboard && sharedWhiteboard.sharedBy.id !== user?.id) return

    const container = containerRef.current
    const canvas = canvasRef.current
    const rect = container.getBoundingClientRect()

    // Force resize with a small delay to ensure DOM is updated
    const resizeTimer = setTimeout(() => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }

      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      redrawCanvas()
    }, 100)

    return () => clearTimeout(resizeTimer)
  }, [sharedWhiteboard, user?.id, mounted, redrawCanvas])

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
      y: clientY - rect.top
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
      userId: user?.id || 'anonymous',
      timestamp: Date.now()
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

    setActions(prev => {
      const updated = [...prev, finalAction]
      saveToLocalStorage(updated)
      return updated
    })

    setRedoStack([])
    redrawCanvas()

    // Broadcast update to participants if sharing
    // Use setTimeout to ensure canvas is redrawn first
    setTimeout(broadcastWhiteboardUpdate, 50)
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
      userId: user?.id || 'anonymous',
      timestamp: Date.now()
    }

    setActions(prev => {
      const updated = [...prev, newAction]
      saveToLocalStorage(updated)
      return updated
    })

    setRedoStack([])
    setTextInput('')
    setShowTextInput(false)

    // Broadcast update to participants if sharing
    setTimeout(broadcastWhiteboardUpdate, 50)
  }

  const handleClear = () => {
    if (!confirm('Clear your whiteboard? This cannot be undone.')) return
    setActions([])
    setRedoStack([])
    const storageKey = `whiteboard-${sessionId}-${user?.id}`
    localStorage.removeItem(storageKey)
    // Broadcast cleared whiteboard if sharing
    setTimeout(broadcastWhiteboardUpdate, 50)
  }

  const handleUndo = () => {
    const myActions = actions.filter(a => a.userId === (user?.id || 'anonymous'))
    if (myActions.length === 0) return

    const lastAction = myActions[myActions.length - 1]

    setActions(prev => {
      const index = prev.lastIndexOf(lastAction)
      if (index === -1) return prev
      const newActions = [...prev]
      newActions.splice(index, 1)
      saveToLocalStorage(newActions)
      return newActions
    })

    setRedoStack(prev => [...prev, lastAction])
    // Broadcast undo if sharing
    setTimeout(broadcastWhiteboardUpdate, 50)
  }

  const handleRedo = () => {
    if (redoStack.length === 0) return

    const actionToRedo = redoStack[redoStack.length - 1]

    setRedoStack(prev => prev.slice(0, -1))

    setActions(prev => {
      const newActions = [...prev, actionToRedo]
      saveToLocalStorage(newActions)
      return newActions
    })
    // Broadcast redo if sharing
    setTimeout(broadcastWhiteboardUpdate, 50)
  }

  const handleTextDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingInput(true)

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()

    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
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

  // Share whiteboard to screen
  const handleShareWhiteboard = () => {
    if (onShareWhiteboard && canvasRef.current) {
      const imageData = canvasRef.current.toDataURL('image/png')
      onShareWhiteboard({
        imageData,
        sharedBy: {
          id: user?.id || '',
          name: profile?.name || 'Anonymous',
          avatarUrl: profile?.avatarUrl
        }
      })
      setShowShareConfirm(false)
      toast.success('Whiteboard shared with all participants')
    }
  }

  if (!mounted) return null

  // If viewing shared whiteboard from another user
  if (sharedWhiteboard && sharedWhiteboard.sharedBy.id !== user?.id) {
    return (
      <SharedWhiteboardViewer data={sharedWhiteboard} />
    )
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">My Whiteboard</h3>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700/50 rounded-full">
            <Lock className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-green-400 font-medium">Private</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Share button */}
          {onShareWhiteboard && (
            isSharing ? (
              <button
                onClick={onStopSharing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-green-600/80 hover:bg-red-600 text-white"
              >
                <Eye className="w-4 h-4" />
                Stop Sharing
              </button>
            ) : (
              <button
                onClick={() => setShowShareConfirm(true)}
                disabled={actions.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-blue-600/80 hover:bg-blue-600 text-white disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <Share2 className="w-4 h-4" />
                Share to Screen
              </button>
            )
          )}
        </div>
      </div>

      {/* Privacy notice */}
      <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          Your whiteboard is private and only visible to you. Use "Share to Screen" to show it to your study partners.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-800/40 backdrop-blur-xl rounded-xl border border-slate-700/50 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900/50 backdrop-blur-sm p-1 rounded-lg border border-slate-700/50">
            {(['pen', 'eraser', 'line', 'circle', 'rectangle', 'text'] as Tool[]).map((t) => (
              <button
                key={t}
                onClick={() => setTool(t)}
                className={`p-2 rounded-md transition-all ${
                  tool === t
                    ? 'bg-blue-600/80 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
                title={t.charAt(0).toUpperCase() + t.slice(1)}
              >
                {t === 'pen' && '✏️'}
                {t === 'eraser' && '🧹'}
                {t === 'line' && '📏'}
                {t === 'circle' && '⭕'}
                {t === 'rectangle' && '⬜'}
                {t === 'text' && 'T'}
              </button>
            ))}
          </div>

          <div className="w-px h-8 bg-slate-700/50 mx-2" />

          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-none"
              title="Color"
            />
            <input
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="w-24"
              title="Size"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleUndo}
            disabled={!actions.some(a => a.userId === (user?.id || 'anonymous'))}
            className="px-3 py-2 text-slate-300 hover:bg-slate-700/50 rounded-lg font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm flex items-center gap-1"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="px-3 py-2 text-slate-300 hover:bg-slate-700/50 rounded-lg font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm flex items-center gap-1"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <div className="w-px h-8 bg-slate-700/50 mx-1" />
          <button
            onClick={handleClear}
            className="px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg font-medium transition-colors backdrop-blur-sm flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-blue-600/80 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors backdrop-blur-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Save Image
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 relative bg-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-inner overflow-hidden min-h-[500px]"
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
            className="absolute bg-slate-800/90 backdrop-blur-xl p-3 rounded-lg shadow-xl border border-slate-700/50 z-50 animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-2"
            style={{ left: textPos.x, top: textPos.y }}
          >
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
                className="px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 outline-none min-w-[200px] backdrop-blur-sm"
                autoFocus
              />
              <button
                onClick={handleAddText}
                className="px-4 py-2 bg-blue-600/80 text-white rounded-lg hover:bg-blue-600 font-medium backdrop-blur-sm"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Share confirmation modal */}
      {showShareConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-blue-500/20">
                <Share2 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Share Whiteboard to Screen</h3>
                <p className="text-sm text-slate-400">Your partners will see your drawing</p>
              </div>
            </div>

            <p className="text-slate-300 text-sm mb-6">
              This will share a snapshot of your whiteboard to the session screen. All participants will be able to see your drawing. You can stop sharing at any time.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowShareConfirm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShareWhiteboard}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share Whiteboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Shared Whiteboard Viewer Component
function SharedWhiteboardViewer({ data }: { data: SharedWhiteboardData }) {
  return (
    <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <Palette className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Shared Whiteboard</h3>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>Shared by</span>
              <span className="font-medium text-slate-300">{data.sharedBy.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Image */}
      <div className="p-4">
        <div className="bg-white rounded-lg overflow-hidden">
          <img
            src={data.imageData}
            alt="Shared Whiteboard"
            className="w-full h-auto"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
        <p className="text-xs text-slate-500 text-center">
          This is a shared view from {data.sharedBy.name}'s whiteboard. You cannot edit it.
        </p>
      </div>
    </div>
  )
}
