import * as THREE from 'three'
import { palette } from '../shared'

interface FramedArtProps {
  position: [number, number, number]
  rotation?: [number, number, number]
  size: [number, number]
  frameColor?: string
  frameDepth?: number
  children: React.ReactNode
}

/**
 * A reusable framed wall art primitive. The frame is a real 3D border (4
 * boxes), the artwork sits inside the frame at a clearly distinct depth so
 * GPU z-fighting can never happen, and the back panel grounds the frame in
 * the wall.
 */
export function FramedArt({
  position,
  rotation = [0, 0, 0],
  size,
  frameColor = '#2a1c12',
  frameDepth = 0.06,
  children,
}: FramedArtProps) {
  const [w, h] = size
  const borderThickness = 0.06
  // Outer dimensions
  const outerW = w + borderThickness * 2
  const outerH = h + borderThickness * 2
  // Z layout (relative to art z = 0):
  //   back panel      z = -frameDepth
  //   side borders    z = -frameDepth/2  (stick out frameDepth in front)
  //   art surface     z =  0.0001        (just in front of borders' back face)
  //   art content     z >  0.001         (clearly in front)
  return (
    <group position={position} rotation={rotation}>
      {/* Back panel — flat against the wall */}
      <mesh position={[0, 0, -frameDepth]}>
        <boxGeometry args={[outerW, outerH, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.85} />
      </mesh>
      {/* Top border */}
      <mesh position={[0, h / 2 + borderThickness / 2, -frameDepth / 2 + frameDepth / 2]}>
        <boxGeometry args={[outerW, borderThickness, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.65} metalness={0.06} />
      </mesh>
      {/* Bottom border */}
      <mesh position={[0, -h / 2 - borderThickness / 2, frameDepth / 2 - frameDepth / 2]}>
        <boxGeometry args={[outerW, borderThickness, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.65} metalness={0.06} />
      </mesh>
      {/* Left border */}
      <mesh position={[-w / 2 - borderThickness / 2, 0, 0]}>
        <boxGeometry args={[borderThickness, h, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.65} metalness={0.06} />
      </mesh>
      {/* Right border */}
      <mesh position={[w / 2 + borderThickness / 2, 0, 0]}>
        <boxGeometry args={[borderThickness, h, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.65} metalness={0.06} />
      </mesh>
      {/* Art surface (background) */}
      <group position={[0, 0, 0.0001]}>
        {children}
      </group>
    </group>
  )
}

const CONTINENTS: ReadonlyArray<{ pos: [number, number, number]; size: [number, number] }> = [
  { pos: [-0.55, 0.22, 0.005], size: [0.65, 0.42] },
  { pos: [0.28, 0.16, 0.005], size: [0.55, 0.5] },
  { pos: [0.62, -0.32, 0.005], size: [0.32, 0.26] },
  { pos: [-0.15, -0.32, 0.005], size: [0.42, 0.16] },
]

/** Framed world map on the back wall, with Hangzhou marked in accent red. */
export function WorldMap() {
  return (
    <FramedArt
      position={[-4.2, 1.05, -3.92]}
      rotation={[0, 0.18, 0]}
      size={[2.0, 1.3]}
      frameColor="#1f130c"
      frameDepth={0.08}
    >
      {/* Map paper */}
      <mesh>
        <planeGeometry args={[2.0, 1.3]} />
        <meshStandardMaterial color="#ede2cc" roughness={0.78} />
      </mesh>
      {/* Continents */}
      {CONTINENTS.map((c, i) => (
        <mesh key={i} position={c.pos}>
          <planeGeometry args={c.size} />
          <meshStandardMaterial color="#a8a288" roughness={0.85} />
        </mesh>
      ))}
      {/* Travel pin */}
      <mesh position={[0.42, 0.18, 0.012]}>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.3} roughness={0.45} />
      </mesh>
    </FramedArt>
  )
}

const BUILDINGS: ReadonlyArray<{ x: number; h: number; w: number }> = [
  { x: -0.78, h: 0.4, w: 0.16 },
  { x: -0.5, h: 0.62, w: 0.2 },
  { x: -0.22, h: 0.34, w: 0.14 },
  { x: 0.05, h: 0.74, w: 0.22 },
  { x: 0.32, h: 0.46, w: 0.16 },
  { x: 0.6, h: 0.58, w: 0.18 },
  { x: 0.84, h: 0.4, w: 0.14 },
]

const CITY_LIGHTS: ReadonlyArray<[number, number]> = [
  [-0.5, -0.32], [-0.5, -0.12], [-0.5, 0.08],
  [0.05, -0.35], [0.05, -0.15], [0.05, 0.05], [0.05, 0.25],
  [0.6, -0.22], [0.6, 0.0], [0.6, 0.18],
  [-0.22, -0.18],
  [0.32, -0.05], [0.32, 0.15],
]

/**
 * Window with night-city silhouette. The pane is a clear glass-ish
 * material; building silhouettes and warm window-lights are rendered as
 * stacked planes well in front of the pane to avoid any z-fighting.
 */
export function NightWindow() {
  return (
    <group position={[4.5, 1.4, -2]} rotation={[0, -0.32, 0]}>
      {/* Outer frame */}
      <mesh position={[0, 0, -0.08]}>
        <boxGeometry args={[2.55, 2.1, 0.18]} />
        <meshStandardMaterial color="#1f130c" roughness={0.85} />
      </mesh>

      {/* Sill */}
      <mesh position={[0, -1.08, 0.05]}>
        <boxGeometry args={[2.7, 0.12, 0.32]} />
        <meshStandardMaterial color="#2a1d14" roughness={0.7} />
      </mesh>

      {/* Sky beyond — slightly emissive so it reads in dim ambience */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[2.2, 1.78]} />
        <meshStandardMaterial
          color="#1c2640"
          emissive="#243652"
          emissiveIntensity={0.55}
          roughness={0.4}
        />
      </mesh>

      {/* Distant moon halo */}
      <mesh position={[0.6, 0.42, 0.01]}>
        <circleGeometry args={[0.1, 32]} />
        <meshBasicMaterial color="#fff5d6" toneMapped={false} />
      </mesh>

      {/* Buildings silhouette */}
      {BUILDINGS.map((b, i) => (
        <mesh key={i} position={[b.x, -0.55 + b.h / 2, 0.02]}>
          <planeGeometry args={[b.w, b.h]} />
          <meshBasicMaterial color="#0c1320" toneMapped={false} />
        </mesh>
      ))}

      {/* Lit windows */}
      {CITY_LIGHTS.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.03]}>
          <planeGeometry args={[0.04, 0.03]} />
          <meshBasicMaterial color="#ffd28a" toneMapped={false} />
        </mesh>
      ))}

      {/* Cross dividers (in front of glass) */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.07, 1.78, 0.06]} />
        <meshStandardMaterial color={'#1f130c'} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[2.2, 0.07, 0.06]} />
        <meshStandardMaterial color={'#1f130c'} roughness={0.7} />
      </mesh>

      {/* Glass pane (almost clear, in front of city) */}
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[2.18, 1.76]} />
        <meshPhysicalMaterial
          color="#a4c0e8"
          transparent
          opacity={0.08}
          roughness={0}
          metalness={0}
          transmission={0.8}
          thickness={0.15}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  )
}
