import { useState } from 'react'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

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

      {/* Industrial enamel shade — outer black metal */}
      <mesh position={[0, -0.16, 0]} castShadow>
        <coneGeometry args={[0.18, 0.22, 32, 1, true]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.45} metalness={0.7} side={THREE.DoubleSide} />
      </mesh>
      {/* Shade inner liner — warm white reflective so the bulb glow scatters back down */}
      <mesh position={[0, -0.16, 0]}>
        <coneGeometry args={[0.172, 0.215, 32, 1, true]} />
        <meshStandardMaterial
          color={on ? '#fff1d6' : '#d8cfb8'}
          roughness={0.55}
          metalness={0.05}
          emissive={on ? '#ffb060' : '#000'}
          emissiveIntensity={on ? 0.7 : 0}
          side={THREE.BackSide}
        />
      </mesh>
      {/* Rim ring */}
      <mesh position={[0, -0.27, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.18, 0.006, 8, 36]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.4} metalness={0.85} />
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
  // Z layout (origin sits 0.04 in front of the wall):
  //   plate front  z = 0.04
  //   toggle front z = 0.10
  //   LED          z = 0.12
  return (
    <group
      position={[-2.5, -0.4, -3.96]}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Wall plate */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.34, 0.5, 0.035]} />
        <meshStandardMaterial color={hovered ? '#f1ebde' : '#e6dfd1'} roughness={0.45} metalness={0.04} />
      </mesh>
      {/* Toggle (protruding rocker) */}
      <mesh position={[0, on ? 0.05 : -0.05, 0.052]}>
        <boxGeometry args={[0.12, 0.18, 0.04]} />
        <meshStandardMaterial color={on ? '#fbf6e8' : '#aaa39a'} roughness={0.5} />
      </mesh>
      {/* Status LED */}
      <mesh position={[0.115, -0.21, 0.04]}>
        <sphereGeometry args={[0.012, 16, 16]} />
        <meshStandardMaterial
          color={on ? '#9bff9b' : '#3a4651'}
          emissive={on ? '#46ff62' : '#000'}
          emissiveIntensity={on ? 1.6 : 0}
          roughness={0.3}
        />
      </mesh>
    </group>
  )
}
