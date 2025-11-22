'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/context'
import toast from 'react-hot-toast'

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

interface SessionWhiteboardProps {
  sessionId: string
}

export default function SessionWhiteboard({ sessionId }: SessionWhiteboardProps) {
  const { user } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#000000')
  const [lineWidth, setLineWidth] = useState(2)
  const [actions, setActions] = useState<DrawAction[]>([])
  const [mounted, setMounted] = useState(false)
  const [currentAction, setCurrentAction] = useState<DrawAction | null>(null)
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [textPos, setTextPos] = useState({ x: 0, y: 0 })
  const supabase = createClient()

  // Fix hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize canvas with proper dimensions
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) {
      console.error('[Whiteboard] Canvas or container not found!')
      return
    }

    // Set canvas to match container size
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = 600

    console.log('[Whiteboard] Canvas size set to:', canvas.width, 'x', canvas.height)
    console.log('[Whiteboard] Container size:', rect.width, 'x', rect.height)

    // Set white background
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw a TEST diagonal line to prove canvas is working
      ctx.strokeStyle = '#ff0000'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(200, 200)
      ctx.stroke()

      console.log('[Whiteboard] ✅ Canvas initialized and TEST line drawn')
    } else {
      console.error('[Whiteboard] Failed to get 2D context!')
    }
  }, [])

  // Initialize canvas on mount
  useEffect(() => {
    if (!mounted) return

    // Wait for next tick to ensure DOM is ready
    setTimeout(() => {
      initCanvas()

      // Load saved state
      const saved = localStorage.getItem(`whiteboard-${sessionId}`)
      if (saved) {
        try {
          const savedActions = JSON.parse(saved) as DrawAction[]
          setActions(savedActions)
          console.log('[Whiteboard] Loaded', savedActions.length, 'actions from localStorage')
        } catch (e) {
          console.error('[Whiteboard] Failed to load saved state:', e)
        }
      }
    }, 100)
  }, [mounted, sessionId, initCanvas])

  // Redraw all actions whenever actions array changes
  useEffect(() => {
    if (!mounted || !canvasRef.current || actions.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear and redraw all
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    actions.forEach(action => {
      drawActionToCanvas(action, ctx)
    })

    console.log('[Whiteboard] Redrawn', actions.length, 'actions')
  }, [actions, mounted])

  // Set up real-time sync
  useEffect(() => {
    if (!mounted || !user) return

    const channel = supabase
      .channel(`whiteboard:${sessionId}`)
      .on('broadcast', { event: 'draw' }, (payload) => {
        if (payload.payload.userId !== user.id) {
          const newAction = payload.payload as DrawAction
          setActions(prev => {
            const updated = [...prev, newAction]
            localStorage.setItem(`whiteboard-${sessionId}`, JSON.stringify(updated))
            return updated
          })
        }
      })
      .on('broadcast', { event: 'clear' }, () => {
        setActions([])
        localStorage.removeItem(`whiteboard-${sessionId}`)
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }
        }
      })
      .subscribe()

    console.log('[Whiteboard] Real-time channel subscribed')

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mounted, sessionId, user])

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const drawActionToCanvas = (action: DrawAction, ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = action.color
    ctx.lineWidth = action.lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    switch (action.tool) {
      case 'pen':
        if (action.points && action.points.length > 1) {
          ctx.beginPath()
          ctx.moveTo(action.points[0].x, action.points[0].y)
          for (let i = 1; i < action.points.length; i++) {
            ctx.lineTo(action.points[i].x, action.points[i].y)
          }
          ctx.stroke()
        }
        break

      case 'eraser':
        if (action.points && action.points.length > 1) {
          ctx.globalCompositeOperation = 'destination-out'
          ctx.lineWidth = action.lineWidth * 3
          ctx.beginPath()
          ctx.moveTo(action.points[0].x, action.points[0].y)
          for (let i = 1; i < action.points.length; i++) {
            ctx.lineTo(action.points[i].x, action.points[i].y)
          }
          ctx.stroke()
          ctx.globalCompositeOperation = 'source-over'
        }
        break

      case 'line':
        if (action.startX !== undefined && action.startY !== undefined &&
            action.endX !== undefined && action.endY !== undefined) {
          ctx.beginPath()
          ctx.moveTo(action.startX, action.startY)
          ctx.lineTo(action.endX, action.endY)
          ctx.stroke()
        }
        break

      case 'circle':
        if (action.startX !== undefined && action.startY !== undefined &&
            action.endX !== undefined && action.endY !== undefined) {
          const radius = Math.sqrt(
            Math.pow(action.endX - action.startX, 2) +
            Math.pow(action.endY - action.startY, 2)
          )
          ctx.beginPath()
          ctx.arc(action.startX, action.startY, radius, 0, 2 * Math.PI)
          ctx.stroke()
        }
        break

      case 'rectangle':
        if (action.startX !== undefined && action.startY !== undefined &&
            action.endX !== undefined && action.endY !== undefined) {
          ctx.strokeRect(
            action.startX,
            action.startY,
            action.endX - action.startX,
            action.endY - action.startY
          )
        }
        break

      case 'text':
        if (action.text && action.startX !== undefined && action.startY !== undefined) {
          ctx.font = `${action.lineWidth * 8}px Arial`
          ctx.fillStyle = action.color
          ctx.fillText(action.text, action.startX, action.startY)
        }
        break
    }
  }

  const broadcastAction = (action: DrawAction) => {
    supabase.channel(`whiteboard:${sessionId}`).send({
      type: 'broadcast',
      event: 'draw',
      payload: action
    })
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e)
    console.log('[Whiteboard] 🖱️ Mouse DOWN at', pos, 'with tool', tool)
    console.log('[Whiteboard] Canvas ref exists?', !!canvasRef.current)
    console.log('[Whiteboard] Current action:', currentAction)

    if (tool === 'text') {
      setTextPos(pos)
      setShowTextInput(true)
      return
    }

    setIsDrawing(true)

    // Start new action
    if (tool === 'pen' || tool === 'eraser') {
      const newAction: DrawAction = {
        tool,
        color,
        lineWidth,
        points: [pos],
        userId: user?.id || 'anonymous',
        timestamp: Date.now()
      }
      setCurrentAction(newAction)
    } else {
      const newAction: DrawAction = {
        tool,
        color,
        lineWidth,
        startX: pos.x,
        startY: pos.y,
        endX: pos.x,
        endY: pos.y,
        userId: user?.id || 'anonymous',
        timestamp: Date.now()
      }
      setCurrentAction(newAction)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentAction) {
      // Silently return if not drawing
      return
    }

    const canvas = canvasRef.current
    if (!canvas) {
      console.error('[Whiteboard] No canvas in handleMouseMove!')
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('[Whiteboard] No context in handleMouseMove!')
      return
    }

    const pos = getMousePos(e)
    console.log('[Whiteboard] 🖱️ Mouse MOVE to', pos)

    if (tool === 'pen' || tool === 'eraser') {
      // Add point to current action
      currentAction.points?.push(pos)

      // Draw the new segment immediately for visual feedback
      const points = currentAction.points
      if (points && points.length >= 2) {
        const lastPoint = points[points.length - 2]
        const currentPoint = points[points.length - 1]

        ctx.strokeStyle = currentAction.color
        ctx.lineWidth = currentAction.lineWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        if (tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out'
          ctx.lineWidth = currentAction.lineWidth * 3
        }

        ctx.beginPath()
        ctx.moveTo(lastPoint.x, lastPoint.y)
        ctx.lineTo(currentPoint.x, currentPoint.y)
        ctx.stroke()

        if (tool === 'eraser') {
          ctx.globalCompositeOperation = 'source-over'
        }
      }
    } else {
      // For shapes, update end position and redraw preview
      currentAction.endX = pos.x
      currentAction.endY = pos.y

      // Redraw everything + preview
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      actions.forEach(action => drawActionToCanvas(action, ctx))
      drawActionToCanvas(currentAction, ctx)
    }
  }

  const handleMouseUp = () => {
    if (!isDrawing || !currentAction) return

    console.log('[Whiteboard] Mouse up, finalizing action')
    setIsDrawing(false)

    // Add to actions and save
    setActions(prev => {
      const updated = [...prev, currentAction]
      localStorage.setItem(`whiteboard-${sessionId}`, JSON.stringify(updated))
      return updated
    })

    // Broadcast to other users
    broadcastAction(currentAction)

    setCurrentAction(null)
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
      localStorage.setItem(`whiteboard-${sessionId}`, JSON.stringify(updated))
      return updated
    })
    broadcastAction(newAction)

    setTextInput('')
    setShowTextInput(false)
  }

  const handleClear = () => {
    if (!confirm('Clear entire whiteboard? This action cannot be undone.')) return

    setActions([])
    localStorage.removeItem(`whiteboard-${sessionId}`)

    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }

    supabase.channel(`whiteboard:${sessionId}`).send({
      type: 'broadcast',
      event: 'clear',
      payload: {}
    })

    toast.success('Whiteboard cleared')
  }

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = `whiteboard-${sessionId}-${Date.now()}.png`
    link.href = canvas.toDataURL()
    link.click()

    toast.success('Whiteboard downloaded')
  }

  if (!mounted) return null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Collaborative Whiteboard</h3>
          <p className="text-sm text-gray-500 mt-1">
            Draw and collaborate in real-time
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
        {/* Tools */}
        <div className="flex gap-1">
          <button
            onClick={() => setTool('pen')}
            className={`px-3 py-2 rounded transition ${
              tool === 'pen' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'
            }`}
            title="Pen"
          >
            ✏️
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`px-3 py-2 rounded transition ${
              tool === 'eraser' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'
            }`}
            title="Eraser"
          >
            🧹
          </button>
          <button
            onClick={() => setTool('line')}
            className={`px-3 py-2 rounded transition ${
              tool === 'line' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'
            }`}
            title="Line"
          >
            ─
          </button>
          <button
            onClick={() => setTool('circle')}
            className={`px-3 py-2 rounded transition ${
              tool === 'circle' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'
            }`}
            title="Circle"
          >
            ⭕
          </button>
          <button
            onClick={() => setTool('rectangle')}
            className={`px-3 py-2 rounded transition ${
              tool === 'rectangle' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'
            }`}
            title="Rectangle"
          >
            ▭
          </button>
          <button
            onClick={() => setTool('text')}
            className={`px-3 py-2 rounded transition ${
              tool === 'text' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'
            }`}
            title="Text"
          >
            T
          </button>
        </div>

        <div className="w-px h-8 bg-gray-300"></div>

        {/* Color picker */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Color:</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer"
          />
        </div>

        {/* Line width */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Size:</label>
          <input
            type="range"
            min="1"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-sm text-gray-600 w-8">{lineWidth}</span>
        </div>

        <div className="w-px h-8 bg-gray-300"></div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition text-sm"
          >
            Clear
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition text-sm"
          >
            Download
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative border-2 border-gray-200 rounded-lg bg-white"
        style={{ height: '600px' }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (isDrawing && currentAction) {
              handleMouseUp()
            }
          }}
          className="w-full h-full cursor-crosshair"
        />

        {/* Text Input Modal */}
        {showTextInput && (
          <div
            className="absolute bg-white p-3 rounded-lg shadow-lg border border-gray-300 z-10"
            style={{ left: textPos.x, top: textPos.y }}
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddText()
                if (e.key === 'Escape') setShowTextInput(false)
              }}
              placeholder="Enter text..."
              className="px-2 py-1 border border-gray-300 rounded mr-2"
              autoFocus
            />
            <button
              onClick={handleAddText}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Help */}
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <p className="font-medium mb-1">Tips:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Click a tool to select it, then draw on the canvas</li>
          <li>Use the eraser to remove parts of your drawing</li>
          <li>For text, click where you want to add it and type</li>
          <li>Changes sync in real-time with other participants</li>
        </ul>
      </div>
    </div>
  )
}
