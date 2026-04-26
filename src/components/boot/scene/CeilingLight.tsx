import { useState } from 'react'
import { useCursor } from '@react-three/drei'

interface CeilingLightProps {
  on: boolean
  onToggle: () => void
}

/** Industrial Edison-bulb pendant. Hangs from the ceiling above the desk. */
export function CeilingLight({ on, onToggle }: CeilingLightProps) {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  return (
    <group
      position={[0, 2.2, -0.5]}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Canopy */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.04, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Cord */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.42, 8]} />
        <meshStandardMaterial color="#2a2520" roughness={0.9} />
      </mesh>

      {/* Brass socket */}
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.1, 12]} />
        <meshStandardMaterial color="#8b7355" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Bulb */}
      <group position={[0, -0.26, 0]}>
        <mesh>
          <capsuleGeometry args={[0.05, 0.1, 8, 16]} />
          <meshStandardMaterial
            color={on ? '#fff8e0' : '#e8e4dc'}
            roughness={0.1}
            metalness={0}
            transparent
            opacity={0.9}
            emissive={on ? '#ffb15c' : '#1d1d1d'}
            emissiveIntensity={on ? 0.85 : 0.12}
          />
        </mesh>
        {on && (
          <mesh>
            <cylinderGeometry args={[0.006, 0.006, 0.06, 6]} />
            <meshBasicMaterial color="#ffaa44" toneMapped={false} />
          </mesh>
        )}
      </group>

      {/* Generous hit-box so the bulb is easy to click */}
      <mesh position={[0, -0.26, 0]} visible={false}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}

interface WallSwitchProps {
  on: boolean
  onToggle: () => void
}

/** Light switch on the back wall — clicking it toggles the same lamp state. */
export function WallSwitch({ on, onToggle }: WallSwitchProps) {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)
  return (
    // Mounted on the back wall just left of the bookshelf so it's visible
    // past the monitor's silhouette in the room view.
    <group
      position={[-2.5, -0.4, -3.95]}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh>
        <boxGeometry args={[0.32, 0.48, 0.04]} />
        <meshStandardMaterial color={hovered ? '#ece5d6' : '#ddd6c8'} roughness={0.35} metalness={0.05} />
      </mesh>
      <mesh position={[0, on ? 0.06 : -0.06, 0.03]}>
        <boxGeometry args={[0.12, 0.18, 0.03]} />
        <meshStandardMaterial color={on ? '#f3efe6' : '#b8b2a8'} roughness={0.4} />
      </mesh>
      <mesh position={[0.11, -0.18, 0.04]}>
        <sphereGeometry args={[0.015, 12, 12]} />
        <meshBasicMaterial color={on ? '#66ff88' : '#445'} toneMapped={false} />
      </mesh>
    </group>
  )
}
