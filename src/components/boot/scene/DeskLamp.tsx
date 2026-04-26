import { useState } from 'react'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

interface DeskLampProps {
  on: boolean
  onToggle: () => void
}

/**
 * Articulated desk lamp on the right of the desk. Click anywhere on the lamp
 * to toggle the room lights — the wall switch, ceiling pendant and this
 * lamp are unified controls for the same `lampOn` state.
 */
export function DeskLamp({ on, onToggle }: DeskLampProps) {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  return (
    <group
      position={[2.05, -1.995, 0.38]}
      scale={1.18}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Generous hit-box so the whole assembly is easy to click */}
      <mesh position={[0, 0.42, -0.12]} visible={false}>
        <boxGeometry args={[0.85, 1.15, 0.85]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Base */}
      <mesh castShadow>
        <cylinderGeometry args={[0.24, 0.27, 0.06, 24]} />
        <meshStandardMaterial color={hovered ? '#4a4a4a' : '#353535'} roughness={0.28} metalness={0.82} />
      </mesh>

      {/* Lower arm */}
      <mesh position={[0, 0.28, -0.02]} rotation={[0.35, 0, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, 0.56, 12]} />
        <meshStandardMaterial color="#222" roughness={0.32} metalness={0.84} />
      </mesh>

      {/* Upper arm */}
      <mesh position={[0, 0.63, -0.2]} rotation={[-0.58, 0, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, 0.46, 12]} />
        <meshStandardMaterial color="#222" roughness={0.32} metalness={0.84} />
      </mesh>

      {/* Shade */}
      <mesh position={[0, 0.82, -0.38]} rotation={[0.62, 0, 0]} castShadow>
        <coneGeometry args={[0.19, 0.26, 24, 1, true]} />
        <meshStandardMaterial
          color="#2f2f2f"
          roughness={0.3}
          metalness={0.7}
          side={THREE.DoubleSide}
          emissive={on ? '#3a240f' : '#000'}
          emissiveIntensity={on ? 0.4 : 0}
        />
      </mesh>

      {on && <Bulb />}
    </group>
  )
}

function Bulb() {
  return (
    <>
      <pointLight position={[0, 0.72, -0.32]} intensity={3.6} color="#ffb978" distance={6} decay={1.7} />
      <mesh position={[0, 0.76, -0.35]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#ffd79c" toneMapped={false} />
      </mesh>
    </>
  )
}
