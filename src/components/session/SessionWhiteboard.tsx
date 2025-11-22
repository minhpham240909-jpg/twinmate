'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#000000')
  const [lineWidth, setLineWidth] = useState(2)
  const [actions, setActions] = useState<DrawAction[]>([])
  const [mounted, setMounted] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [textPos, setTextPos] = useState({ x: 0, y: 0 })
  const supabase = createClient()

  // Fix hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize canvas
  useEffect(() => {
    if (!mounted || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth
    canvas.height = 600

    // Load saved state from localStorage
    const saved = localStorage.getItem(`whiteboard-${sessionId}`)
    if (saved) {
      try {
        const savedActions = JSON.parse(saved) as DrawAction[]
        setActions(savedActions)
        redrawCanvas(savedActions)
      } catch (e) {
        console.error('Failed to load saved whiteboard:', e)
      }
    }
  }, [mounted, sessionId])

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
          drawAction(newAction)
        }
      })
      .on('broadcast', { event: 'clear' }, () => {
        clearCanvas()
        setActions([])
        localStorage.removeItem(`whiteboard-${sessionId}`)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mounted, sessionId, user])

  // Redraw canvas when actions change
  useEffect(() => {
    if (actions.length > 0) {
      redrawCanvas(actions)
    }
  }, [actions])

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const redrawCanvas = (actionsToRedraw: DrawAction[]) => {
    clearCanvas()
    actionsToRedraw.forEach(action => drawAction(action))
  }

  const drawAction = (action: DrawAction) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

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

    if (tool === 'text') {
      setTextPos(pos)
      setShowTextInput(true)
      return
    }

    setIsDrawing(true)
    setStartPos(pos)

    if (tool === 'pen' || tool === 'eraser') {
      const newAction: DrawAction = {
        tool,
        color,
        lineWidth,
        points: [pos],
        userId: user?.id || 'anonymous',
        timestamp: Date.now()
      }
      setActions(prev => [...prev, newAction])
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const pos = getMousePos(e)

    if (tool === 'pen' || tool === 'eraser') {
      setActions(prev => {
        const updated = [...prev]
        const lastAction = updated[updated.length - 1]
        if (lastAction && (lastAction.tool === 'pen' || lastAction.tool === 'eraser')) {
          lastAction.points?.push(pos)
        }
        return updated
      })
    } else {
      // For shapes, redraw with preview
      redrawCanvas(actions)
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth

      const tempAction: DrawAction = {
        tool,
        color,
        lineWidth,
        startX: startPos.x,
        startY: startPos.y,
        endX: pos.x,
        endY: pos.y,
        userId: user?.id || 'anonymous',
        timestamp: Date.now()
      }
      drawAction(tempAction)
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    setIsDrawing(false)

    const pos = getMousePos(e)

    if (tool === 'line' || tool === 'circle' || tool === 'rectangle') {
      const newAction: DrawAction = {
        tool,
        color,
        lineWidth,
        startX: startPos.x,
        startY: startPos.y,
        endX: pos.x,
        endY: pos.y,
        userId: user?.id || 'anonymous',
        timestamp: Date.now()
      }
      setActions(prev => {
        const updated = [...prev, newAction]
        localStorage.setItem(`whiteboard-${sessionId}`, JSON.stringify(updated))
        return updated
      })
      broadcastAction(newAction)
    } else if (tool === 'pen' || tool === 'eraser') {
      const lastAction = actions[actions.length - 1]
      if (lastAction) {
        localStorage.setItem(`whiteboard-${sessionId}`, JSON.stringify(actions))
        broadcastAction(lastAction)
      }
    }
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
    drawAction(newAction)
  }

  const handleClear = () => {
    if (!confirm('Clear entire whiteboard? This action cannot be undone.')) return

    clearCanvas()
    setActions([])
    localStorage.removeItem(`whiteboard-${sessionId}`)

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
      <div className="relative border-2 border-gray-200 rounded-lg bg-white">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setIsDrawing(false)}
          className="w-full cursor-crosshair"
          style={{ height: '600px' }}
        />

        {/* Text Input Modal */}
        {showTextInput && (
          <div
            className="absolute bg-white p-3 rounded-lg shadow-lg border border-gray-300"
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
