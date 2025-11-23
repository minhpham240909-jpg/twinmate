'use client'

import React, { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface ParticleNetworkProps {
  count?: number
  connectionDistance?: number
  color1?: string
  color2?: string
  particleSize?: number
  interactive?: boolean
}

function ParticleNetwork({
  count = 100,
  connectionDistance = 1.5,
  color1 = '#3b82f6', // Blue
  color2 = '#8b5cf6', // Purple
  particleSize = 0.15,
  interactive = true
}: ParticleNetworkProps) {
  const particlesRef = useRef<THREE.Points>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const { mouse, viewport } = useThree()
  
  // Initialize particles with random positions and velocities
  const [particles, positions, colors] = useMemo(() => {
    const particles = []
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const c1 = new THREE.Color(color1)
    const c2 = new THREE.Color(color2)

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 15
      const y = (Math.random() - 0.5) * 15
      const z = (Math.random() - 0.5) * 10
      
      particles.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 0.02,
        vy: (Math.random() - 0.5) * 0.02,
        vz: (Math.random() - 0.5) * 0.02,
        originalX: x,
        originalY: y,
        originalZ: z
      })

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      // Gradient color mix
      const mixedColor = c1.clone().lerp(c2, Math.random())
      colors[i * 3] = mixedColor.r
      colors[i * 3 + 1] = mixedColor.g
      colors[i * 3 + 2] = mixedColor.b
    }
    return [particles, positions, colors]
  }, [count, color1, color2])

  // Geometry for lines (dynamic)
  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const maxConnections = count * count // Safe upper bound
    const positions = new Float32Array(maxConnections * 3)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geometry
  }, [count])

  useFrame((state) => {
    if (!particlesRef.current || !linesRef.current) return

    const positionsArray = particlesRef.current.geometry.attributes.position.array as Float32Array
    const time = state.clock.getElapsedTime()
    
    // Mouse interaction target
    const targetX = (mouse.x * viewport.width) / 2
    const targetY = (mouse.y * viewport.height) / 2

    // Update particle positions
    for (let i = 0; i < count; i++) {
      const p = particles[i]
      
      // Basic movement
      p.x += p.vx
      p.y += p.vy
      p.z += p.vz

      // Gentle floating sine wave movement
      p.y += Math.sin(time * 0.5 + p.x) * 0.002
      
      // Mouse interaction (repulsion/attraction)
      if (interactive) {
        const dx = targetX - p.x
        const dy = targetY - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 4) {
          const force = (4 - dist) * 0.01
          p.vx -= dx * force * 0.1
          p.vy -= dy * force * 0.1
        }
      }

      // Keep within bounds (soft reset)
      if (Math.abs(p.x) > 10) p.vx *= -1
      if (Math.abs(p.y) > 10) p.vy *= -1
      if (Math.abs(p.z) > 5) p.vz *= -1

      // Damping to prevent explosion
      p.vx *= 0.99
      p.vy *= 0.99
      p.vz *= 0.99

      // Maintain minimum movement
      if (Math.abs(p.vx) < 0.001) p.vx += (Math.random() - 0.5) * 0.001
      if (Math.abs(p.vy) < 0.001) p.vy += (Math.random() - 0.5) * 0.001

      positionsArray[i * 3] = p.x
      positionsArray[i * 3 + 1] = p.y
      positionsArray[i * 3 + 2] = p.z
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true

    // Update connections
    const linePositions = linesRef.current.geometry.attributes.position.array as Float32Array
    let lineIndex = 0
    
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const dz = particles[i].z - particles[j].z
        const distSq = dx * dx + dy * dy + dz * dz

        if (distSq < connectionDistance * connectionDistance) {
            // Add line
            linePositions[lineIndex++] = particles[i].x
            linePositions[lineIndex++] = particles[i].y
            linePositions[lineIndex++] = particles[i].z
            
            linePositions[lineIndex++] = particles[j].x
            linePositions[lineIndex++] = particles[j].y
            linePositions[lineIndex++] = particles[j].z
        }
      }
    }
    
    linesRef.current.geometry.setDrawRange(0, lineIndex / 3)
    linesRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <group>
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={particleSize}
          vertexColors
          transparent
          opacity={0.8}
          sizeAttenuation
          map={null}
          depthWrite={false}
        />
      </points>
      <lineSegments ref={linesRef} geometry={lineGeometry}>
        <lineBasicMaterial
            color={color1}
            transparent
            opacity={0.12}
            linewidth={1}
            depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

export default function ThreeScene(props: ParticleNetworkProps) {
  return (
    <div className="absolute inset-0 h-full w-full pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent', pointerEvents: 'none' }}
      >
        <color attach="background" args={['transparent']} />
        <ambientLight intensity={0.5} />
        <ParticleNetwork {...props} />
      </Canvas>
    </div>
  )
}
