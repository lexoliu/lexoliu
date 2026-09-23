import { Instances, Instance } from '@react-three/drei'
import * as THREE from 'three'

const KEY_ROWS = 5
const KEY_COLS = 14
const KEY_PITCH = 0.105
const KEY_DEPTH_PITCH = 0.085

const TEXTBOOKS: ReadonlyArray<{ y: number; w: number; d: number; h: number; color: string; spineColor: string; rot: number }> = [
  { y: 0.04, w: 0.9, d: 0.6, h: 0.08, color: '#c44d3e', spineColor: '#ffd23a', rot: 0.04 },
  { y: 0.13, w: 0.85, d: 0.58, h: 0.08, color: '#2e6cb0', spineColor: '#ffd23a', rot: -0.06 },
  { y: 0.21, w: 0.78, d: 0.55, h: 0.06, color: '#3a8c4a', spineColor: '#f0e9d6', rot: 0.02 },
]

const STICKY_NOTES: ReadonlyArray<{ x: number; y: number; rot: number; color: string }> = [
  { x: -0.14, y: 0.06, rot: 0.05, color: '#ffe66a' },
  { x: -0.04, y: -0.02, rot: -0.08, color: '#ff9eb5' },
  { x: 0.07, y: 0.04, rot: 0.03, color: '#9be8a8' },
]

/**
 * Keyboard + mouse on the desk. The keyboard's keycaps are rendered with
 * drei's `<Instances>` so all 70 keys share a single draw call, instead of
 * spawning 70 separate meshes.
 */
export function DeskAccessories() {
  return (
    <group position={[0, -1.985, 0.65]}>
      {/* Keyboard chassis */}
      <mesh position={[0, 0.025, -0.3]} castShadow receiveShadow>
        <boxGeometry args={[1.65, 0.05, 0.55]} />
        <meshStandardMaterial color="#2a2520" roughness={0.55} metalness={0.1} />
      </mesh>
      {/* Keys */}
      <Instances range={KEY_ROWS * KEY_COLS} position={[0, 0.058, -0.3]} castShadow>
        <boxGeometry args={[0.085, 0.018, 0.06]} />
        <meshStandardMaterial color="#e0dcd3" roughness={0.55} />
        {Array.from({ length: KEY_ROWS }).flatMap((_, r) =>
          Array.from({ length: KEY_COLS }).map((__, c) => (
            <Instance
              key={`${r}-${c}`}
              position={[
                (c - (KEY_COLS - 1) / 2) * KEY_PITCH,
                0,
                (r - (KEY_ROWS - 1) / 2) * KEY_DEPTH_PITCH,
              ]}
            />
          )),
        )}
      </Instances>

      {/* Mouse: rounded body + tail. Z chosen so the body's hemisphere stays
          on the desk: local z=-0.1 + group z=0.65 → world z=0.55, with the
          0.16-radius dome reaching z∈[0.39, 0.71], inside desk front (0.73). */}
      <group position={[1.42, 0.04, -0.1]}>
        <mesh castShadow>
          <sphereGeometry args={[0.16, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#2a2520" roughness={0.45} metalness={0.12} />
        </mesh>
        <mesh position={[0, 0.005, 0.04]}>
          <boxGeometry args={[0.012, 0.014, 0.05]} />
          <meshStandardMaterial color="#454035" roughness={0.6} />
        </mesh>
        {/* Cable */}
        <mesh position={[0, 0.04, -0.18]} rotation={[Math.PI / 2.2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.18, 8]} />
          <meshStandardMaterial color="#2a2520" roughness={0.85} />
        </mesh>
      </group>

      {/* Textbook stack — dorm staple. Sits left of monitor stand. */}
      <TextbookStack />

      {/* Energy drink can on the desk to the right of the books */}
      <EnergyCan />

      {/* Sticky notes plastered on the side of the monitor body */}
      <StickyNotes />
    </group>
  )
}

function TextbookStack() {
  // Local frame: parent group is at world (0,-1.985,0.65). Want stack
  // sitting on desk (top y=-2.05) at world x=-2.4, z=-0.55.
  // Local = (-2.4, -2.025-(-1.985), -0.55-0.65) = (-2.4, -0.04, -1.2).
  return (
    <group position={[-2.4, -0.04, -1.2]}>
      {TEXTBOOKS.map((b, i) => (
        <group key={i} position={[0, b.y, 0]} rotation={[0, b.rot, 0]}>
          <mesh castShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.color} roughness={0.8} />
          </mesh>
          {/* Spine accent — a strip along the front face */}
          <mesh position={[0, 0, b.d / 2 + 0.001]}>
            <planeGeometry args={[b.w * 0.8, b.h * 0.45]} />
            <meshBasicMaterial color={b.spineColor} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function EnergyCan() {
  // World target (-1.3, -1.89, 0.4). Monitor stand's x range is [-1.188,
  // 1.188] and z range [-0.895, 0.293] — earlier placements landed INSIDE
  // the stand box, occluding the can. With x=-1.3, z=0.4 the can sits
  // outside the stand's footprint (just past its left front corner).
  // Parent group offset (0,-1.985,0.65) → local = (-1.3, 0.095, -0.25).
  return (
    <group position={[-1.3, 0.095, -0.25]}>
      {/* Can body — bright red. Low metalness so it doesn't crush to black
          under the dim room ambience; modest emissive boosts it like printed
          ink under display light. */}
      <mesh castShadow>
        <cylinderGeometry args={[0.075, 0.075, 0.32, 24]} />
        <meshStandardMaterial color="#e63a44" roughness={0.6} metalness={0.05} emissive="#3a0c0e" emissiveIntensity={0.5} />
      </mesh>
      {/* Cream label band across the middle */}
      <mesh position={[0, 0.0, 0]}>
        <cylinderGeometry args={[0.0755, 0.0755, 0.10, 24, 1, true]} />
        <meshBasicMaterial color="#f3eada" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Top lid (silver, recessed) */}
      <mesh position={[0, 0.165, 0]}>
        <cylinderGeometry args={[0.07, 0.075, 0.014, 24]} />
        <meshStandardMaterial color="#bcb4a8" roughness={0.4} metalness={0.75} />
      </mesh>
      {/* Pull tab */}
      <mesh position={[0.022, 0.176, 0]}>
        <boxGeometry args={[0.045, 0.006, 0.022]} />
        <meshStandardMaterial color="#9a9388" roughness={0.4} metalness={0.8} />
      </mesh>
    </group>
  )
}

function StickyNotes() {
  // World target: stuck on the bezel front (world z ≈ 0.27, y = -0.45).
  // Parent group offset (0,-1.985,0.65) → local = (1.18, 1.535, -0.38).
  return (
    <group position={[1.18, 1.535, -0.38]}>
      {STICKY_NOTES.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, i * 0.001]} rotation={[0, 0, s.rot]}>
          <planeGeometry args={[0.13, 0.13]} />
          <meshStandardMaterial color={s.color} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}
