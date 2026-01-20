'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Volume2, VolumeX, Volume1, Lock, Star, ShoppingBag } from 'lucide-react'
import { AMBIENT_SOUNDS, STORAGE_KEYS } from '@/lib/focus/constants'
import { useCustomizations, type CustomizationItem } from '@/hooks/useCustomizations'
import { usePurchaseItem } from '@/hooks/useShopData'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

// Map sound IDs to itemIds for the shop system
const SOUND_ITEM_MAP: Record<string, string> = {
  'none': 'sound_none', // Always free
  'rain': 'sound_rain',
  'cafe': 'sound_cafe',
  'white_noise': 'sound_white_noise', // Free default
  'piano': 'sound_piano',
  'forest': 'sound_forest',
}

interface AmbientSoundPlayerProps {
  isPlaying: boolean
}

// Generate ambient sounds using Web Audio API
function createAmbientSound(
  audioContext: AudioContext,
  type: string
): { start: () => void; stop: () => void; setVolume: (v: number) => void }  {
  const gainNode = audioContext.createGain()
  gainNode.connect(audioContext.destination)
  gainNode.gain.value = 0.3

  let oscillators: OscillatorNode[] = []
  let noiseNode: AudioBufferSourceNode | null = null
  let intervalId: NodeJS.Timeout | null = null

  const createNoise = (color: 'white' | 'pink' | 'brown'): AudioBufferSourceNode => {
    const bufferSize = audioContext.sampleRate * 2
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate)
    const data = buffer.getChannelData(0)

    if (color === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
    } else if (color === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
      }
    } else {
      let lastOut = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        data[i] = (lastOut + (0.02 * white)) / 1.02
        lastOut = data[i]
        data[i] *= 3.5
      }
    }

    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true
    return source
  }

  const start = () => {
    try {
      if (type === 'rain') {
        // Pink noise + occasional rumbles
        noiseNode = createNoise('pink')
        noiseNode.connect(gainNode)
        noiseNode.start()
      } else if (type === 'white_noise') {
        noiseNode = createNoise('white')
        noiseNode.connect(gainNode)
        noiseNode.start()
      } else if (type === 'cafe') {
        // Brown noise (muffled background chatter)
        noiseNode = createNoise('brown')
        noiseNode.connect(gainNode)
        noiseNode.start()
      } else if (type === 'forest') {
        // Layered pink + occasional bird-like chirps
        noiseNode = createNoise('pink')
        const filter = audioContext.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 500
        noiseNode.connect(filter)
        filter.connect(gainNode)
        noiseNode.start()

        // Random chirps
        intervalId = setInterval(() => {
          if (Math.random() > 0.7) {
            const chirp = audioContext.createOscillator()
            const chirpGain = audioContext.createGain()
            chirp.type = 'sine'
            chirp.frequency.value = 2000 + Math.random() * 1000
            chirpGain.gain.setValueAtTime(0, audioContext.currentTime)
            chirpGain.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.05)
            chirpGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15)
            chirp.connect(chirpGain)
            chirpGain.connect(audioContext.destination)
            chirp.start(audioContext.currentTime)
            chirp.stop(audioContext.currentTime + 0.15)
          }
        }, 3000)
      } else if (type === 'piano') {
        // Soft sine waves that fade in and out like piano notes
        const playNote = () => {
          const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]
          const freq = notes[Math.floor(Math.random() * notes.length)]
          
          const osc = audioContext.createOscillator()
          const noteGain = audioContext.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          
          noteGain.gain.setValueAtTime(0, audioContext.currentTime)
          noteGain.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.1)
          noteGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 3)
          
          osc.connect(noteGain)
          noteGain.connect(gainNode)
          osc.start(audioContext.currentTime)
          osc.stop(audioContext.currentTime + 3)
        }

        playNote()
        intervalId = setInterval(playNote, 4000 + Math.random() * 2000)
      }
    } catch (e) {
      console.error('Error starting ambient sound:', e)
    }
  }

  const stop = () => {
    try {
      if (noiseNode) {
        noiseNode.stop()
        noiseNode.disconnect()
        noiseNode = null
      }
      oscillators.forEach(osc => {
        try {
          osc.stop()
          osc.disconnect()
        } catch {}
      })
      oscillators = []
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    } catch (e) {
      console.error('Error stopping ambient sound:', e)
    }
  }

  const setVolume = (volume: number) => {
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime)
  }

  return { start, stop, setVolume }
}

export default function AmbientSoundPlayer({ isPlaying }: AmbientSoundPlayerProps) {
  const [selectedSound, setSelectedSound] = useState('none')
  const [volume, setVolume] = useState(0.3)
  const [isMuted, setIsMuted] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const soundRef = useRef<{ start: () => void; stop: () => void; setVolume: (v: number) => void } | null>(null)

  // Load saved preferences
  useEffect(() => {
    const savedSound = localStorage.getItem(STORAGE_KEYS.SOUND) || 'none'
    const savedVolume = localStorage.getItem(STORAGE_KEYS.SOUND_VOLUME)
    setSelectedSound(savedSound)
    if (savedVolume) setVolume(parseFloat(savedVolume))
  }, [])

  // Handle sound changes
  useEffect(() => {
    // Cleanup previous sound
    if (soundRef.current) {
      soundRef.current.stop()
      soundRef.current = null
    }

    if (selectedSound === 'none' || !isPlaying || isMuted) return

    // Create new audio context if needed
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }

    // Create and start new sound
    soundRef.current = createAmbientSound(audioContextRef.current, selectedSound)
    soundRef.current.setVolume(volume)
    soundRef.current.start()

    // Save preference
    localStorage.setItem(STORAGE_KEYS.SOUND, selectedSound)

    return () => {
      if (soundRef.current) {
        soundRef.current.stop()
      }
    }
  }, [selectedSound, isPlaying, isMuted])

  // Handle volume changes
  useEffect(() => {
    if (soundRef.current && !isMuted) {
      soundRef.current.setVolume(volume)
    }
    localStorage.setItem(STORAGE_KEYS.SOUND_VOLUME, volume.toString())
  }, [volume, isMuted])

  const handleSoundChange = useCallback((soundId: string) => {
    setSelectedSound(soundId)
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev)
    if (soundRef.current) {
      soundRef.current.setVolume(isMuted ? volume : 0)
    }
  }, [isMuted, volume])

  const VolumeIcon = isMuted ? VolumeX : volume > 0.5 ? Volume2 : Volume1

  return (
    <div className="relative">
      {/* Sound Toggle Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`p-2.5 rounded-xl transition-all ${
          showPanel
            ? 'bg-white/20 text-white'
            : selectedSound !== 'none'
            ? 'bg-blue-500/20 text-blue-400'
            : 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300'
        }`}
        title="Ambient Sounds"
      >
        <VolumeIcon className="w-5 h-5" />
      </button>

      {/* Sound Panel */}
      {showPanel && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-neutral-900/95 backdrop-blur-sm border border-neutral-800 rounded-2xl shadow-2xl p-4 z-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-white">Ambient Sounds</h4>
            <button
              onClick={toggleMute}
              className={`p-1.5 rounded-lg transition-colors ${isMuted ? 'bg-red-500/20 text-red-400' : 'hover:bg-neutral-800'}`}
            >
              <VolumeIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Sound Options */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {AMBIENT_SOUNDS.map((sound) => (
              <button
                key={sound.id}
                onClick={() => handleSoundChange(sound.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                  selectedSound === sound.id
                    ? 'bg-blue-500/30 ring-2 ring-blue-500'
                    : 'bg-neutral-800/50 hover:bg-neutral-800'
                }`}
              >
                <span className="text-xl">{sound.icon}</span>
                <span className="text-xs text-neutral-300">{sound.name}</span>
              </button>
            ))}
          </div>

          {/* Volume Slider */}
          {selectedSound !== 'none' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Volume</span>
                <span>{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
