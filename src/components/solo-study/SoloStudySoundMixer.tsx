'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Volume2, VolumeX, Volume1 } from 'lucide-react'

// Sound types for mixing
// Hybrid approach: Procedural noise as fallback + optional audio URLs for real sounds
// Audio URLs from free sound libraries (Freesound, etc.) - replace with your own hosted files for production
const SOUND_LAYERS = [
  {
    id: 'rain',
    name: 'Rain',
    icon: '🌧️',
    noiseType: 'pink' as const,
    // Free rain ambient from freesound.org (CC0) - example URL
    audioUrl: 'https://cdn.freesound.org/previews/531/531947_5766779-lq.mp3',
  },
  {
    id: 'cafe',
    name: 'Cafe',
    icon: '☕',
    noiseType: 'brown' as const,
    audioUrl: 'https://cdn.freesound.org/previews/462/462361_9159316-lq.mp3',
  },
  {
    id: 'forest',
    name: 'Forest',
    icon: '🌲',
    noiseType: 'pink' as const,
    hasChirps: true,
    audioUrl: 'https://cdn.freesound.org/previews/509/509026_10799555-lq.mp3',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    icon: '🌊',
    noiseType: 'brown' as const,
    audioUrl: 'https://cdn.freesound.org/previews/573/573577_7869667-lq.mp3',
  },
  {
    id: 'white_noise',
    name: 'White Noise',
    icon: '📻',
    noiseType: 'white' as const,
    // No audio URL - procedural white noise is perfect for this
  },
  {
    id: 'fireplace',
    name: 'Fireplace',
    icon: '🔥',
    noiseType: 'brown' as const,
    audioUrl: 'https://cdn.freesound.org/previews/499/499071_10656503-lq.mp3',
  },
]

interface SoundLayer {
  id: string
  volume: number
  enabled: boolean
}

interface SoloStudySoundMixerProps {
  isPlaying: boolean
}

// Storage key
const STORAGE_KEY = 'solo_study_sounds'

export default function SoloStudySoundMixer({ isPlaying }: SoloStudySoundMixerProps) {
  const [showPanel, setShowPanel] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [masterVolume, setMasterVolume] = useState(0.5)
  const [soundLayers, setSoundLayers] = useState<SoundLayer[]>(() =>
    SOUND_LAYERS.map((s) => ({ id: s.id, volume: 0.5, enabled: false }))
  )

  const audioContextRef = useRef<AudioContext | null>(null)
  const soundNodesRef = useRef<Map<string, {
    source: AudioBufferSourceNode | null
    audioElement?: HTMLAudioElement
    gain: GainNode
    interval?: NodeJS.Timeout
  }>>(new Map())

  // Load saved settings
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.layers) setSoundLayers(parsed.layers)
        if (parsed.masterVolume !== undefined) setMasterVolume(parsed.masterVolume)
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  // Save settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      layers: soundLayers,
      masterVolume,
    }))
  }, [soundLayers, masterVolume])

  // Create noise buffer
  const createNoiseBuffer = useCallback((
    audioContext: AudioContext,
    type: 'white' | 'pink' | 'brown'
  ): AudioBuffer => {
    const bufferSize = audioContext.sampleRate * 2
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate)
    const data = buffer.getChannelData(0)

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
    } else if (type === 'pink') {
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
        data[i] = (lastOut + 0.02 * white) / 1.02
        lastOut = data[i]
        data[i] *= 3.5
      }
    }

    return buffer
  }, [])

  // Start a sound layer
  const startSoundLayer = useCallback((layerId: string, volume: number) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }

    const audioContext = audioContextRef.current
    const soundDef = SOUND_LAYERS.find((s) => s.id === layerId)
    if (!soundDef) return

    // Stop existing
    const existing = soundNodesRef.current.get(layerId)
    if (existing) {
      try {
        existing.source?.stop()
        existing.source?.disconnect()
        existing.audioElement?.pause()
        if (existing.interval) clearInterval(existing.interval)
      } catch {}
    }

    // Create gain node
    const gainNode = audioContext.createGain()
    gainNode.connect(audioContext.destination)
    gainNode.gain.value = volume * masterVolume * (isMuted ? 0 : 1)

    // Try to use audio URL first (better quality), fall back to procedural noise
    if (soundDef.audioUrl) {
      // Use real audio file
      const audio = new Audio(soundDef.audioUrl)
      audio.loop = true
      audio.volume = volume * masterVolume * (isMuted ? 0 : 1)
      audio.crossOrigin = 'anonymous'

      audio.play().catch(() => {
        // If audio fails to load, fall back to procedural noise
        console.log(`Audio failed for ${layerId}, using procedural noise`)
        startProceduralSound(layerId, volume, soundDef, audioContext, gainNode)
      })

      soundNodesRef.current.set(layerId, { source: null, audioElement: audio, gain: gainNode })
    } else {
      // Use procedural noise
      startProceduralSound(layerId, volume, soundDef, audioContext, gainNode)
    }
  }, [masterVolume, isMuted])

  // Start procedural sound (fallback)
  const startProceduralSound = useCallback((
    layerId: string,
    volume: number,
    soundDef: typeof SOUND_LAYERS[0],
    audioContext: AudioContext,
    gainNode: GainNode
  ) => {
    // Create noise source
    const buffer = createNoiseBuffer(audioContext, soundDef.noiseType)
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true

    // Apply filter based on sound type
    if (soundDef.id === 'ocean') {
      const filter = audioContext.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 300
      source.connect(filter)
      filter.connect(gainNode)
    } else if (soundDef.id === 'forest') {
      const filter = audioContext.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 500
      source.connect(filter)
      filter.connect(gainNode)
    } else {
      source.connect(gainNode)
    }

    source.start()

    // Add chirps for forest
    let interval: NodeJS.Timeout | undefined
    if (soundDef.hasChirps) {
      interval = setInterval(() => {
        if (Math.random() > 0.7) {
          const chirp = audioContext.createOscillator()
          const chirpGain = audioContext.createGain()
          chirp.type = 'sine'
          chirp.frequency.value = 2000 + Math.random() * 1000
          chirpGain.gain.setValueAtTime(0, audioContext.currentTime)
          chirpGain.gain.linearRampToValueAtTime(volume * masterVolume * 0.1, audioContext.currentTime + 0.05)
          chirpGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15)
          chirp.connect(chirpGain)
          chirpGain.connect(audioContext.destination)
          chirp.start(audioContext.currentTime)
          chirp.stop(audioContext.currentTime + 0.15)
        }
      }, 3000)
    }

    soundNodesRef.current.set(layerId, { source, gain: gainNode, interval })
  }, [createNoiseBuffer, masterVolume])

  // Stop a sound layer
  const stopSoundLayer = useCallback((layerId: string) => {
    const node = soundNodesRef.current.get(layerId)
    if (node) {
      try {
        node.source?.stop()
        node.source?.disconnect()
        node.audioElement?.pause()
        node.gain.disconnect()
        if (node.interval) clearInterval(node.interval)
      } catch {}
      soundNodesRef.current.delete(layerId)
    }
  }, [])

  // Handle playing state changes
  useEffect(() => {
    if (isPlaying && !isMuted) {
      soundLayers.forEach((layer) => {
        if (layer.enabled) {
          startSoundLayer(layer.id, layer.volume)
        }
      })
    } else {
      // Stop all sounds
      soundLayers.forEach((layer) => {
        stopSoundLayer(layer.id)
      })
    }

    return () => {
      soundLayers.forEach((layer) => {
        stopSoundLayer(layer.id)
      })
    }
  }, [isPlaying, isMuted])

  // Toggle layer
  const toggleLayer = (layerId: string) => {
    setSoundLayers((prev) =>
      prev.map((layer) => {
        if (layer.id === layerId) {
          const newEnabled = !layer.enabled
          if (newEnabled && isPlaying && !isMuted) {
            startSoundLayer(layerId, layer.volume)
          } else {
            stopSoundLayer(layerId)
          }
          return { ...layer, enabled: newEnabled }
        }
        return layer
      })
    )
  }

  // Update layer volume
  const updateLayerVolume = (layerId: string, volume: number) => {
    setSoundLayers((prev) =>
      prev.map((layer) => {
        if (layer.id === layerId) {
          // Update gain node or audio element if exists
          const node = soundNodesRef.current.get(layerId)
          if (node) {
            if (node.audioElement) {
              node.audioElement.volume = volume * masterVolume * (isMuted ? 0 : 1)
            } else if (audioContextRef.current) {
              node.gain.gain.setValueAtTime(volume * masterVolume * (isMuted ? 0 : 1), audioContextRef.current.currentTime)
            }
          }
          return { ...layer, volume }
        }
        return layer
      })
    )
  }

  // Update master volume
  const updateMasterVolume = (volume: number) => {
    setMasterVolume(volume)
    soundNodesRef.current.forEach((node, layerId) => {
      const layer = soundLayers.find((l) => l.id === layerId)
      if (layer) {
        if (node.audioElement) {
          node.audioElement.volume = layer.volume * volume * (isMuted ? 0 : 1)
        } else if (audioContextRef.current) {
          node.gain.gain.setValueAtTime(layer.volume * volume * (isMuted ? 0 : 1), audioContextRef.current.currentTime)
        }
      }
    })
  }

  // Toggle mute
  const toggleMute = () => {
    setIsMuted((prev) => {
      const newMuted = !prev
      soundNodesRef.current.forEach((node, layerId) => {
        const layer = soundLayers.find((l) => l.id === layerId)
        if (layer) {
          if (node.audioElement) {
            node.audioElement.volume = newMuted ? 0 : layer.volume * masterVolume
          } else if (audioContextRef.current) {
            node.gain.gain.setValueAtTime(newMuted ? 0 : layer.volume * masterVolume, audioContextRef.current.currentTime)
          }
        }
      })
      return newMuted
    })
  }

  const activeLayers = soundLayers.filter((l) => l.enabled).length
  const VolumeIcon = isMuted ? VolumeX : activeLayers > 0 ? Volume2 : Volume1

  return (
    <div className="relative">
      {/* Sound Toggle Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`p-2.5 rounded-xl transition-all ${
          showPanel
            ? 'bg-white/20 text-white'
            : activeLayers > 0
            ? 'bg-green-500/20 text-green-400'
            : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white'
        }`}
        title="Sound Mixer"
      >
        <VolumeIcon className="w-5 h-5" />
      </button>

      {/* Sound Mixer Panel */}
      {showPanel && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-neutral-900/95 backdrop-blur-sm border border-neutral-800 rounded-2xl shadow-2xl p-4 z-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-white">Sound Mixer</h4>
            <button
              onClick={toggleMute}
              className={`p-1.5 rounded-lg transition-colors ${
                isMuted ? 'bg-red-500/20 text-red-400' : 'hover:bg-neutral-800'
              }`}
            >
              <VolumeIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Master Volume */}
          <div className="mb-4 pb-4 border-b border-neutral-800">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
              <span>Master Volume</span>
              <span>{Math.round(masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => updateMasterVolume(parseFloat(e.target.value))}
              className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Sound Layers */}
          <div className="space-y-3">
            {SOUND_LAYERS.map((sound) => {
              const layer = soundLayers.find((l) => l.id === sound.id)
              if (!layer) return null

              return (
                <div key={sound.id} className="flex items-center gap-3">
                  <button
                    onClick={() => toggleLayer(sound.id)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                      layer.enabled
                        ? 'bg-green-500/30 ring-2 ring-green-500'
                        : 'bg-neutral-800 hover:bg-neutral-700'
                    }`}
                  >
                    {sound.icon}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-neutral-300">{sound.name}</span>
                      <span className="text-xs text-neutral-500">
                        {layer.enabled ? `${Math.round(layer.volume * 100)}%` : 'Off'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={layer.volume}
                      onChange={(e) => updateLayerVolume(sound.id, parseFloat(e.target.value))}
                      disabled={!layer.enabled}
                      className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-green-500 disabled:opacity-50"
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-neutral-500 mt-4">
            Mix multiple sounds to create your perfect study environment
          </p>
        </div>
      )}
    </div>
  )
}
