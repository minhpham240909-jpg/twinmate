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
  
  // UI State
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#000000')
  const [lineWidth, setLineWidth] = useState(2)
  const [mounted, setMounted] = useState(false)
  const [showTextInput, setShowTextInput] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [textPos, setTextPos] = useState({ x: 0, y: 0 })

  // Refs for drawing state (mutable, no re-renders needed while drawing)
  const isDrawingRef = useRef(false)
  const currentActionRef = useRef<DrawAction | null>(null)
  const actionsRef = useRef<DrawAction[]>([]) // Keep track of all actions
  const [actions, setActions] = useState<DrawAction[]>([]) // Sync for re-renders if needed (e.g. undo/redo UI)

  const supabase = createClient()

  // Fix hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync refs with state
  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

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
          ctx.lineWidth = action.lineWidth * 5 // Eraser is bigger
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

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw history
    actionsRef.current.forEach(action => drawAction(ctx, action))

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
      
      // Set actual canvas size to match display size for 1:1 mapping
      // Use devicePixelRatio for sharpness on high-DPI screens
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      
      // Scale context to match
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

    // Initial setup
    const saved = localStorage.getItem(`whiteboard-${sessionId}`)
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

  // Real-time Sync
  useEffect(() => {
    if (!mounted || !user) return

    const channel = supabase
      .channel(`whiteboard:${sessionId}`)
      .on('broadcast', { event: 'draw' }, (payload) => {
        if (payload.payload.userId !== user.id) {
          setActions(prev => {
            const updated = [...prev, payload.payload]
            localStorage.setItem(`whiteboard-${sessionId}`, JSON.stringify(updated))
            return updated
          })
        }
      })
      .on('broadcast', { event: 'clear' }, () => {
        setActions([])
        localStorage.removeItem(`whiteboard-${sessionId}`)
        redrawCanvas()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mounted, sessionId, user, redrawCanvas, supabase])

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
    e.preventDefault() // Prevent scrolling on touch
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
      points: [pos], // For pen/eraser
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
      // Shapes
      action.endX = pos.x
      action.endY = pos.y
    }

    // Use requestAnimationFrame for smoother drawing
    requestAnimationFrame(redrawCanvas)
  }

  const stopDrawing = () => {
    if (!isDrawingRef.current || !currentActionRef.current) return
    
    isDrawingRef.current = false
    
    // Save action
    const finalAction = currentActionRef.current
    currentActionRef.current = null
    
    setActions(prev => {
      const updated = [...prev, finalAction]
      localStorage.setItem(`whiteboard-${sessionId}`, JSON.stringify(updated))
      return updated
    })

    // Broadcast
    supabase.channel(`whiteboard:${sessionId}`).send({
      type: 'broadcast',
      event: 'draw',
      payload: finalAction
    })
    
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
      userId: user?.id || 'anonymous',
      timestamp: Date.now()
    }

    setActions(prev => {
      const updated = [...prev, newAction]
      localStorage.setItem(`whiteboard-${sessionId}`, JSON.stringify(updated))
      return updated
    })

    supabase.channel(`whiteboard:${sessionId}`).send({
      type: 'broadcast',
      event: 'draw',
      payload: newAction
    })

    setTextInput('')
    setShowTextInput(false)
  }

  const handleClear = () => {
    if (!confirm('Clear whiteboard?')) return
    setActions([])
    localStorage.removeItem(`whiteboard-${sessionId}`)
    
    supabase.channel(`whiteboard:${sessionId}`).send({
      type: 'broadcast',
      event: 'clear',
      payload: {}
    })
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

  if (!mounted) return null

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {(['pen', 'eraser', 'line', 'circle', 'rectangle', 'text'] as Tool[]).map((t) => (
              <button
                key={t}
                onClick={() => setTool(t)}
                className={`p-2 rounded-md transition-all ${
                  tool === t 
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
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

          <div className="w-px h-8 bg-gray-200 mx-2" />

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
            onClick={handleClear}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Save Image
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div 
        ref={containerRef} 
        className="flex-1 relative bg-white rounded-xl border border-gray-200 shadow-inner overflow-hidden min-h-[500px]"
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
            className="absolute bg-white p-4 rounded-lg shadow-xl border border-gray-200 z-50 animate-in fade-in zoom-in-95 duration-200"
            style={{ left: textPos.x, top: textPos.y }}
          >
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
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-w-[200px]"
                autoFocus
              />
              <button
                onClick={handleAddText}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}