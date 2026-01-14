'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Eraser, Trash2, Download, Pencil, Circle } from 'lucide-react'

interface SoloStudyWhiteboardProps {
  onClose: () => void
}

const COLORS = [
  '#ffffff', // White
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
]

const BRUSH_SIZES = [2, 4, 8, 12]

export default function SoloStudyWhiteboard({ onClose }: SoloStudyWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#ffffff')
  const [brushSize, setBrushSize] = useState(4)
  const [isEraser, setIsEraser] = useState(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    // Set canvas size
    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height

      // Fill with dark background
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      // Load saved drawing
      const savedDrawing = localStorage.getItem('solo_study_whiteboard')
      if (savedDrawing) {
        const img = new Image()
        img.onload = () => {
          ctx?.drawImage(img, 0, 0)
        }
        img.src = savedDrawing
      }
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)

    return () => {
      window.removeEventListener('resize', updateCanvasSize)
    }
  }, [])

  // Auto-save
  const saveDrawing = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas) {
      localStorage.setItem('solo_study_whiteboard', canvas.toDataURL())
    }
  }, [])

  // Get position from event
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  // Start drawing
  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true)
    const pos = getPos(e)
    lastPosRef.current = pos

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2)
    ctx.fillStyle = isEraser ? '#1a1a1a' : color
    ctx.fill()
  }

  // Drawing
  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !lastPosRef.current) return

    const pos = getPos(e)

    ctx.beginPath()
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = isEraser ? '#1a1a1a' : color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    lastPosRef.current = pos
  }

  // Stop drawing
  const handleEnd = () => {
    setIsDrawing(false)
    lastPosRef.current = null
    saveDrawing()
  }

  // Clear canvas
  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    saveDrawing()
  }

  // Download as image
  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-neutral-800">
        <h3 className="text-lg font-semibold text-white">Whiteboard</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={handleClear}
            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-neutral-400 hover:text-red-400"
            title="Clear"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="cursor-crosshair touch-none"
        />
      </div>

      {/* Toolbar */}
      <footer className="flex items-center justify-center gap-4 p-4 border-t border-neutral-800 bg-neutral-900">
        {/* Tool Toggle */}
        <div className="flex items-center gap-1 bg-neutral-800 rounded-xl p-1">
          <button
            onClick={() => setIsEraser(false)}
            className={`p-2 rounded-lg transition-colors ${
              !isEraser ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsEraser(true)}
            className={`p-2 rounded-lg transition-colors ${
              isEraser ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Eraser className="w-5 h-5" />
          </button>
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c)
                setIsEraser(false)
              }}
              className={`w-7 h-7 rounded-full transition-all ${
                color === c && !isEraser ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900' : ''
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Brush Size */}
        <div className="flex items-center gap-1 bg-neutral-800 rounded-xl p-1">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setBrushSize(size)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                brushSize === size ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Circle className="fill-current" style={{ width: size + 4, height: size + 4 }} />
            </button>
          ))}
        </div>
      </footer>
    </div>
  )
}
