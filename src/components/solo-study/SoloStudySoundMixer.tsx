'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Volume2, VolumeX, Volume1, Lock, Star, ShoppingBag } from 'lucide-react'
import { useCustomizations, type CustomizationItem } from '@/hooks/useCustomizations'
import { usePurchaseItem } from '@/hooks/useShopData'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

/**
 * Ambient Sound Configuration
 *
 * Download high-quality ambient sounds and place them in /public/sounds/ambient/
 * Recommended sources (CC0/royalty-free):
 * - https://freesound.org
 * - https://mixkit.co/free-sound-effects/
 * - https://pixabay.com/sound-effects/
 *
 * File naming: rain.mp3, cafe.mp3, forest.mp3, ocean.mp3, fireplace.mp3, lofi.mp3
 * Format: MP3 or OGG, looped, 1-5 minutes duration
 */
const SOUND_LAYERS = [
  {
    id: 'rain',
    itemId: 'sound_rain',
    name: 'Rain',
    icon: '🌧️',
    noiseType: 'pink' as const,
    // Local file in /public/sounds/ambient/ - falls back to procedural noise
    audioUrl: '/sounds/ambient/rain.mp3',
  },
  {
    id: 'cafe',
    itemId: 'sound_cafe',
    name: 'Cafe',
    icon: '☕',
    noiseType: 'brown' as const,
    audioUrl: '/sounds/ambient/cafe.mp3',
  },
  {
    id: 'forest',
    itemId: 'sound_forest',
    name: 'Forest',
    icon: '🌲',
    noiseType: 'pink' as const,
    hasChirps: true,
    audioUrl: '/sounds/ambient/forest.mp3',
  },
  {
    id: 'ocean',
    itemId: 'sound_ocean',
    name: 'Ocean',
    icon: '🌊',
    noiseType: 'brown' as const,
    audioUrl: '/sounds/ambient/ocean.mp3',
  },
  {
    id: 'white_noise',
    itemId: 'sound_white_noise',
    name: 'White Noise',
    icon: '📻',
    noiseType: 'white' as const,
    // Procedural white noise is perfect for this - no audio file needed (FREE default)
  },
  {
    id: 'fireplace',
    itemId: 'sound_fireplace',
    name: 'Fireplace',
    icon: '🔥',
    noiseType: 'brown' as const,
    audioUrl: '/sounds/ambient/fireplace.mp3',
  },
  {
    id: 'lofi',
    itemId: 'sound_lofi',
    name: 'Lo-Fi',
    icon: '🎵',
    noiseType: 'pink' as const,
    audioUrl: '/sounds/ambient/lofi.mp3',
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

  // Fetch customizations to check owned sounds
  const { data: customizations, isLoading } = useCustomizations()
  const purchaseMutation = usePurchaseItem()
  const queryClient = useQueryClient()

  const audioContextRef = useRef<AudioContext | null>(null)
  const soundNodesRef = useRef<Map<string, {
    source: AudioBufferSourceNode | null
    audioElement?: HTMLAudioElement
    gain: GainNode
    interval?: NodeJS.Timeout
  }>>(new Map())

  // Check if a sound is owned
  const isSoundOwned = (soundItemId: string): boolean => {
    // White noise is always free (procedural)
    if (soundItemId === 'sound_white_noise') return true
    if (!customizations?.ownedSoundIds) return false
    return customizations.ownedSoundIds.includes(soundItemId)
  }

  // Get sound info from customizations
  const getSoundInfo = (soundItemId: string): CustomizationItem | undefined => {
    return customizations?.sounds.find(s => s.itemId === soundItemId)
  }

  // Handle purchase
  const handlePurchase = async (itemId: string) => {
    try {
      const result = await purchaseMutation.mutateAsync(itemId)
      toast.success(result.message || 'Sound purchased!')
      // Invalidate customizations cache
      queryClient.invalidateQueries({ queryKey: ['userCustomizations'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Purchase failed')
    }
  }

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

  // Toggle layer (with ownership check)
  const toggleLayer = (layerId: string, soundItemId: string) => {
    // Check if owned
    if (!isSoundOwned(soundItemId)) {
      const soundInfo = getSoundInfo(soundItemId)
      if (soundInfo && soundInfo.canAfford) {
        // Show purchase option
        toast((t) => (
          <div className="flex flex-col gap-2">
            <span>Purchase this sound for {soundInfo.pointsCost} points?</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  handlePurchase(soundItemId)
                  toast.dismiss(t.id)
                }}
                className="px-3 py-1 bg-amber-500 text-white rounded-lg text-sm font-medium"
              >
                Buy Now
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1 bg-neutral-600 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ), { duration: 5000 })
      } else {
        toast.error(`You need ${soundInfo?.pointsCost || 'more'} Focus Points to unlock this sound`)
      }
      return
    }

    // Sound is owned - toggle it
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
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-white">Sound Mixer</h4>
              {customizations && (
                <div className="flex items-center gap-1 text-xs text-amber-400">
                  <Star className="w-3 h-3" />
                  <span>{customizations.userPoints}</span>
                </div>
              )}
            </div>
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
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {SOUND_LAYERS.map((sound) => {
                const layer = soundLayers.find((l) => l.id === sound.id)
                if (!layer) return null

                const owned = isSoundOwned(sound.itemId)
                const soundInfo = getSoundInfo(sound.itemId)
                const canAfford = soundInfo?.canAfford ?? false
                const isPurchasing = purchaseMutation.isPending && purchaseMutation.variables === sound.itemId

                return (
                  <div key={sound.id} className="flex items-center gap-3">
                    <button
                      onClick={() => toggleLayer(sound.id, sound.itemId)}
                      disabled={isPurchasing}
                      className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                        !owned
                          ? 'bg-neutral-800/50 opacity-70'
                          : layer.enabled
                          ? 'bg-green-500/30 ring-2 ring-green-500'
                          : 'bg-neutral-800 hover:bg-neutral-700'
                      }`}
                    >
                      {isPurchasing ? (
                        <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      ) : !owned ? (
                        <div className="flex flex-col items-center">
                          <Lock className="w-3 h-3 text-white/40 mb-0.5" />
                          <div className="flex items-center text-amber-400">
                            <Star className="w-2 h-2" />
                            <span className="text-[8px]">{soundInfo?.pointsCost || '?'}</span>
                          </div>
                        </div>
                      ) : (
                        sound.icon
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm ${owned ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          {sound.name}
                          {!owned && (
                            <span className="ml-1 text-xs text-amber-400/60">
                              ({soundInfo?.pointsCost || '?'} pts)
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {owned ? (layer.enabled ? `${Math.round(layer.volume * 100)}%` : 'Off') : ''}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={layer.volume}
                        onChange={(e) => updateLayerVolume(sound.id, parseFloat(e.target.value))}
                        disabled={!layer.enabled || !owned}
                        className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-green-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-800">
            <p className="text-xs text-neutral-500">
              <Lock className="w-3 h-3 inline mr-1" />
              Unlock with Focus Points
            </p>
            <button
              onClick={() => {
                setShowPanel(false)
                // Navigate to shop or open shop modal
                window.dispatchEvent(new CustomEvent('openShop'))
              }}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <ShoppingBag className="w-3 h-3" />
              Shop
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
