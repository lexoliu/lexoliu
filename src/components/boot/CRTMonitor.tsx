import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

interface CRTMonitorProps {
  children: React.ReactNode
  screenOn: boolean
}

export function CRTMonitor({ children, screenOn }: CRTMonitorProps) {
  const groupRef = useRef<THREE.Group>(null)

  // Subtle floating animation
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.02
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05
    }
  })

  return (
    <group ref={groupRef}>
      {/* Monitor body - the "big back" CRT */}
      <group position={[0, 0, 0]}>
        {/* Front bezel */}
        <RoundedBox args={[4.2, 3.4, 0.3]} radius={0.1} position={[0, 0, 0.85]}>
          <meshStandardMaterial color="#c8c0b8" roughness={0.8} />
        </RoundedBox>

        {/* Screen inset (dark frame around screen) */}
        <RoundedBox args={[3.6, 2.8, 0.1]} radius={0.05} position={[0, 0.1, 1.01]}>
          <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
        </RoundedBox>

        {/* The actual screen */}
        <mesh position={[0, 0.1, 1.02]}>
          <planeGeometry args={[3.4, 2.6]} />
          <meshBasicMaterial color={screenOn ? "#0a0a0a" : "#050505"} />
        </mesh>

        {/* Screen content via HTML */}
        <Html
          transform
          occlude
          position={[0, 0.1, 1.03]}
          style={{
            width: '680px',
            height: '520px',
            background: screenOn ? '#0a0a0a' : '#020202',
            overflow: 'hidden',
            borderRadius: '4px',
          }}
          distanceFactor={0.5}
        >
          <div style={{
            width: '100%',
            height: '100%',
            position: 'relative',
          }}>
            {children}

            {/* CRT screen effects */}
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
            }} />
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
            }} />
          </div>
        </Html>

        {/* Main body (the big back part) */}
        <mesh position={[0, -0.1, -0.3]}>
          <boxGeometry args={[4, 3.2, 2]} />
          <meshStandardMaterial color="#d4d0c8" roughness={0.9} />
        </mesh>

        {/* Back ventilation area */}
        <mesh position={[0, 0, -1.35]}>
          <boxGeometry args={[3.5, 2.8, 0.1]} />
          <meshStandardMaterial color="#b8b0a8" roughness={0.95} />
        </mesh>

        {/* Ventilation slots on back */}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[0, 0.8 - i * 0.25, -1.36]}>
            <boxGeometry args={[2.5, 0.08, 0.05]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>
        ))}

        {/* Bottom stand/base */}
        <mesh position={[0, -1.85, 0.2]}>
          <boxGeometry args={[3.8, 0.3, 1.8]} />
          <meshStandardMaterial color="#c0b8b0" roughness={0.85} />
        </mesh>

        {/* Front bottom panel with buttons */}
        <mesh position={[0, -1.5, 0.95]}>
          <boxGeometry args={[4, 0.4, 0.15]} />
          <meshStandardMaterial color="#b8b0a8" roughness={0.8} />
        </mesh>

        {/* Power button */}
        <mesh position={[1.5, -1.5, 1.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.05, 16]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.5} />
        </mesh>

        {/* Power LED */}
        <mesh position={[1.2, -1.5, 1.03]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color={screenOn ? "#33ff33" : "#333333"} />
        </mesh>

        {/* Brand label */}
        <mesh position={[0, -1.5, 1.03]}>
          <planeGeometry args={[0.8, 0.15]} />
          <meshBasicMaterial color="#a0a0a0" />
        </mesh>

        {/* Side panels - showing the depth */}
        <mesh position={[2.05, -0.1, -0.3]}>
          <boxGeometry args={[0.1, 3.2, 2]} />
          <meshStandardMaterial color="#c0b8b0" roughness={0.9} />
        </mesh>
        <mesh position={[-2.05, -0.1, -0.3]}>
          <boxGeometry args={[0.1, 3.2, 2]} />
          <meshStandardMaterial color="#c0b8b0" roughness={0.9} />
        </mesh>

        {/* Top panel */}
        <mesh position={[0, 1.5, -0.3]}>
          <boxGeometry args={[4, 0.1, 2]} />
          <meshStandardMaterial color="#d0c8c0" roughness={0.85} />
        </mesh>
      </group>
    </group>
  )
}
