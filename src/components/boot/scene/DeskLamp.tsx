import { useState } from 'react'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

interface DeskLampProps {
  on: boolean
  onToggle: () => void
}

const ARM_RADIUS = 0.022
const LOWER_LEN = 0.66
const UPPER_LEN = 0.52
const SHOULDER_TILT = -0.22
const ELBOW_BEND = 1.55
// Cumulative X-rotation of shade axis = SHOULDER + ELBOW + HEAD.
// Sum must be ≈ π + 0.18 so the mouth points down and slightly AWAY from
// the camera; previously it pointed at the camera, exposing the glowing
// inner liner as a "flame".
const HEAD_TILT = 1.99

function ArmMaterial() {
  // Lower metalness so the arms don't catch the bulb's warm reflection
  // and read like glowing rods.
  return <meshStandardMaterial color="#222" roughness={0.5} metalness={0.55} />
}

/**
 * Articulated desk lamp. Built as a kinematic chain so joints actually meet:
 * base → shoulder pivot → lower arm → elbow pivot → upper arm → head pivot → shade.
 * Click anywhere on the lamp to toggle the room lights.
 */
export function DeskLamp({ on, onToggle }: DeskLampProps) {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  return (
    <group
      position={[1.95, -1.995, 0.15]}
      scale={1.05}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Generous invisible hit-box */}
      <mesh position={[0, 0.5, -0.15]} visible={false}>
        <boxGeometry args={[0.9, 1.3, 1.0]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Base disc */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.26, 0.29, 0.05, 32]} />
        <meshStandardMaterial color={hovered ? '#444' : '#2f2f2f'} roughness={0.3} metalness={0.85} />
      </mesh>
      {/* Base bezel */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.21, 0.24, 0.035, 32]} />
        <meshStandardMaterial color="#262626" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Shoulder pivot — sits on top of base */}
      <group position={[0, 0.07, 0]} rotation={[SHOULDER_TILT, 0, 0]}>
        <Joint />
        {/* Lower arm: anchored at pivot, extends along +Y */}
        <mesh position={[0, LOWER_LEN / 2, 0]} castShadow>
          <cylinderGeometry args={[ARM_RADIUS, ARM_RADIUS, LOWER_LEN, 16]} />
          <ArmMaterial />
        </mesh>

        {/* Elbow pivot — at end of lower arm */}
        <group position={[0, LOWER_LEN, 0]} rotation={[ELBOW_BEND, 0, 0]}>
          <Joint />
          {/* Upper arm */}
          <mesh position={[0, UPPER_LEN / 2, 0]} castShadow>
            <cylinderGeometry args={[ARM_RADIUS, ARM_RADIUS, UPPER_LEN, 16]} />
            <ArmMaterial />
          </mesh>

          {/* Head pivot — +Y in this frame points out the shade mouth.
              Layout (head frame):
                y=0      : neck joint
                y=0.05   : shade apex (narrow end attaches to neck)
                y=0.33   : shade mouth (open end, light exits here) */}
          <group position={[0, UPPER_LEN, 0]} rotation={[HEAD_TILT, 0, 0]}>
            <Joint />
            {/* Neck stub bridging joint → shade apex */}
            <mesh position={[0, 0.025, 0]} castShadow>
              <cylinderGeometry args={[0.022, 0.03, 0.05, 16]} />
              <ArmMaterial />
            </mesh>

            {/* Shade group flips cone so its open base maps to +Y of head frame.
                Inside group: apex sits at group-local origin, base at (0,-0.22,0). */}
            <group position={[0, 0.05, 0]} rotation={[Math.PI, 0, 0]}>
              <mesh position={[0, -0.11, 0]} castShadow>
                <coneGeometry args={[0.155, 0.22, 36, 1, true]} />
                <meshStandardMaterial
                  color="#2c2c2c"
                  roughness={0.32}
                  metalness={0.78}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <mesh position={[0, -0.11, 0]}>
                <coneGeometry args={[0.146, 0.21, 36, 1, true]} />
                <meshStandardMaterial
                  color={on ? '#ffd9a8' : '#6b5d4a'}
                  roughness={0.55}
                  metalness={0.2}
                  emissive={on ? '#ffb060' : '#000'}
                  emissiveIntensity={on ? 1.0 : 0}
                  side={THREE.BackSide}
                />
              </mesh>
            </group>

            {/* Apex cap */}
            <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.02, 16]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.7} side={THREE.DoubleSide} />
            </mesh>

            {/* Rim torus at shade mouth (head frame y=0.27) */}
            <mesh position={[0, 0.27, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <torusGeometry args={[0.155, 0.008, 10, 48]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.85} />
            </mesh>

            {on && <Bulb />}
          </group>
        </group>
      </group>
    </group>
  )
}

function Joint() {
  return (
    <mesh castShadow>
      <sphereGeometry args={[0.038, 16, 16]} />
      <meshStandardMaterial color="#2a2a2a" roughness={0.3} metalness={0.88} />
    </mesh>
  )
}

function Bulb() {
  return (
    <>
      {/* Bulb — recessed deep inside shade, head-frame mouth y=0.27 */}
      <mesh position={[0, 0.14, 0]}>
        <sphereGeometry args={[0.035, 20, 20]} />
        <meshBasicMaterial color="#ffe2b5" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.18, 0]} intensity={1.6} color="#ffba7a" distance={3.5} decay={2.0} castShadow />
    </>
  )
}
