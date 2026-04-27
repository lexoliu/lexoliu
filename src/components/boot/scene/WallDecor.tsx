import * as THREE from 'three'
import { useMemo } from 'react'
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
 * Reusable framed wall art primitive. The frame is a real 3D border (4
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
  const outerW = w + borderThickness * 2
  const outerH = h + borderThickness * 2
  // Z layout (relative to art z = 0):
  //   back panel    z = -frameDepth
  //   side borders  centred so they protrude frameDepth in front of the back
  //   art surface   z =  0.0001  (just in front of the borders' back face)
  //   art content   z >  0.001   (clearly in front)
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -frameDepth]}>
        <boxGeometry args={[outerW, outerH, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.85} />
      </mesh>
      <mesh position={[0, h / 2 + borderThickness / 2, 0]}>
        <boxGeometry args={[outerW, borderThickness, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.55} metalness={0.08} />
      </mesh>
      <mesh position={[0, -h / 2 - borderThickness / 2, 0]}>
        <boxGeometry args={[outerW, borderThickness, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.55} metalness={0.08} />
      </mesh>
      <mesh position={[-w / 2 - borderThickness / 2, 0, 0]}>
        <boxGeometry args={[borderThickness, h, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.55} metalness={0.08} />
      </mesh>
      <mesh position={[w / 2 + borderThickness / 2, 0, 0]}>
        <boxGeometry args={[borderThickness, h, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.55} metalness={0.08} />
      </mesh>
      <group position={[0, 0, 0.0001]}>
        {children}
      </group>
    </group>
  )
}

/**
 * Stylised continent silhouettes. Each entry is a centre + size — the artwork
 * is intentionally abstract: a paper world map with hand-cut tan landmasses.
 */
const CONTINENTS: ReadonlyArray<{ pos: [number, number, number]; size: [number, number] }> = [
  { pos: [-0.58, 0.22, 0.005], size: [0.38, 0.34] },   // North America
  { pos: [-0.42, -0.18, 0.005], size: [0.18, 0.34] },  // South America
  { pos: [-0.05, 0.20, 0.005], size: [0.22, 0.18] },   // Europe
  { pos: [0.04, -0.10, 0.005], size: [0.30, 0.36] },   // Africa
  { pos: [0.36, 0.22, 0.005], size: [0.46, 0.32] },    // Asia
  { pos: [0.52, -0.30, 0.005], size: [0.20, 0.16] },   // Australia
]

const LATITUDE_LINES = [-0.45, -0.22, 0, 0.22, 0.45] as const
const LONGITUDE_LINES = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75] as const

/**
 * Framed world map on the back wall. Hangzhou (the user's home city) is
 * marked with an accent pin and a soft halo so it reads even from the
 * pulled-back camera.
 */
export function WorldMap() {
  return (
    <FramedArt
      position={[-4.2, 1.05, -3.92]}
      rotation={[0, 0.18, 0]}
      size={[2.0, 1.3]}
      frameColor="#1f130c"
      frameDepth={0.08}
    >
      <mesh>
        <planeGeometry args={[2.0, 1.3]} />
        <meshStandardMaterial color="#ede2cc" roughness={0.78} />
      </mesh>
      {/* Latitude grid */}
      {LATITUDE_LINES.map((y) => (
        <mesh key={`lat-${y}`} position={[0, y, 0.002]}>
          <planeGeometry args={[1.92, 0.004]} />
          <meshBasicMaterial color="#b6a883" toneMapped={false} transparent opacity={0.55} />
        </mesh>
      ))}
      {/* Longitude grid */}
      {LONGITUDE_LINES.map((x) => (
        <mesh key={`lon-${x}`} position={[x, 0, 0.002]}>
          <planeGeometry args={[0.004, 1.22]} />
          <meshBasicMaterial color="#b6a883" toneMapped={false} transparent opacity={0.55} />
        </mesh>
      ))}
      {/* Continents — sit above the grid so they read as land */}
      {CONTINENTS.map((c, i) => (
        <mesh key={i} position={c.pos}>
          <planeGeometry args={c.size} />
          <meshStandardMaterial color="#a8a07e" roughness={0.85} />
        </mesh>
      ))}
      {/* Travel pin on Hangzhou (eastern Asia) */}
      <mesh position={[0.46, 0.22, 0.018]}>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.4} roughness={0.45} />
      </mesh>
      {/* Pin halo */}
      <mesh position={[0.46, 0.22, 0.013]}>
        <ringGeometry args={[0.04, 0.07, 24]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.35} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Title bar across the top of the paper */}
      <mesh position={[0, 0.55, 0.004]}>
        <planeGeometry args={[1.92, 0.06]} />
        <meshBasicMaterial color="#3d2a1c" toneMapped={false} />
      </mesh>
      {/* Compass dot in lower-left corner */}
      <mesh position={[-0.78, -0.5, 0.006]}>
        <ringGeometry args={[0.03, 0.045, 16]} />
        <meshBasicMaterial color="#3d2a1c" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </FramedArt>
  )
}

/**
 * A dense, mixed-height skyline. We lean into variety — a few tall towers
 * with antennas and many lower buildings so the silhouette has rhythm.
 */
const BUILDINGS: ReadonlyArray<{ x: number; h: number; w: number; antenna?: number }> = [
  { x: -0.95, h: 0.30, w: 0.10 },
  { x: -0.82, h: 0.46, w: 0.14 },
  { x: -0.66, h: 0.38, w: 0.12 },
  { x: -0.50, h: 0.66, w: 0.18, antenna: 0.18 },
  { x: -0.32, h: 0.32, w: 0.12 },
  { x: -0.16, h: 0.50, w: 0.14 },
  { x: 0.00, h: 0.86, w: 0.20, antenna: 0.24 },
  { x: 0.18, h: 0.42, w: 0.14 },
  { x: 0.34, h: 0.58, w: 0.16 },
  { x: 0.50, h: 0.34, w: 0.12 },
  { x: 0.62, h: 0.72, w: 0.18, antenna: 0.16 },
  { x: 0.78, h: 0.40, w: 0.14 },
  { x: 0.92, h: 0.30, w: 0.10 },
]

/** Window ranges the rng picks from per building face — one entry per column. */
const WINDOW_GRID: ReadonlyArray<[number, number]> = [
  [-0.5, -0.32], [-0.5, -0.12], [-0.5, 0.08], [-0.5, 0.22],
  [-0.16, -0.18], [-0.16, 0.02], [-0.16, 0.20],
  [0.00, -0.35], [0.00, -0.15], [0.00, 0.05], [0.00, 0.25], [0.00, 0.45], [0.00, 0.6],
  [0.18, -0.18], [0.18, 0.05], [0.18, 0.18],
  [0.34, -0.05], [0.34, 0.15], [0.34, 0.32],
  [0.62, -0.22], [0.62, 0.0], [0.62, 0.22], [0.62, 0.40],
  [-0.82, -0.18], [-0.82, 0.02], [-0.82, 0.18],
  [0.78, -0.05], [0.78, 0.10],
]

const STAR_COUNT = 38

/**
 * Window with night-city silhouette. The pane is a clear glass-ish
 * material; building silhouettes, stars, moon and warm window-lights are
 * rendered as stacked planes well in front of the pane to avoid any
 * z-fighting.
 */
export function NightWindow() {
  // Scatter stars deterministically so hot-reload doesn't shimmer them
  const stars = useMemo(() => {
    const rng = mulberry32(0x5a17)
    return Array.from({ length: STAR_COUNT }, () => ({
      x: (rng() - 0.5) * 2.0,
      y: 0.2 + rng() * 0.7,           // upper half of the sky only
      r: 0.004 + rng() * 0.008,
      i: 0.55 + rng() * 0.45,
    }))
  }, [])

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

      {/* Sky base — dark blue, slightly emissive so it reads in dim ambience */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[2.2, 1.78]} />
        <meshStandardMaterial color="#10182e" emissive="#1c2a4a" emissiveIntensity={0.55} roughness={0.4} />
      </mesh>

      {/* Horizon glow — warm orange-purple band where the city meets the sky */}
      <mesh position={[0, -0.45, 0.004]}>
        <planeGeometry args={[2.2, 0.42]} />
        <meshBasicMaterial color="#3a2244" toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, -0.58, 0.005]}>
        <planeGeometry args={[2.2, 0.18]} />
        <meshBasicMaterial color="#5a3a3a" toneMapped={false} transparent opacity={0.7} />
      </mesh>

      {/* Stars */}
      {stars.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, 0.006]}>
          <circleGeometry args={[s.r, 8]} />
          <meshBasicMaterial color="#fffaea" transparent opacity={s.i} toneMapped={false} />
        </mesh>
      ))}

      {/* Distant moon halo (soft) */}
      <mesh position={[0.6, 0.42, 0.008]}>
        <circleGeometry args={[0.22, 32]} />
        <meshBasicMaterial color="#fff5d6" transparent opacity={0.18} toneMapped={false} />
      </mesh>
      {/* Moon */}
      <mesh position={[0.6, 0.42, 0.012]}>
        <circleGeometry args={[0.1, 32]} />
        <meshBasicMaterial color="#fff5d6" toneMapped={false} />
      </mesh>

      {/* Distant hill silhouette behind buildings */}
      <mesh position={[0, -0.42, 0.014]}>
        <planeGeometry args={[2.2, 0.32]} />
        <meshBasicMaterial color="#0c1024" toneMapped={false} transparent opacity={0.85} />
      </mesh>

      {/* Building silhouettes */}
      {BUILDINGS.map((b, i) => (
        <group key={i} position={[b.x, -0.55 + b.h / 2, 0.018]}>
          <mesh>
            <planeGeometry args={[b.w, b.h]} />
            <meshBasicMaterial color="#070b1a" toneMapped={false} />
          </mesh>
          {b.antenna !== undefined && (
            <>
              <mesh position={[0, b.h / 2 + b.antenna / 2, 0.001]}>
                <planeGeometry args={[0.005, b.antenna]} />
                <meshBasicMaterial color="#070b1a" toneMapped={false} />
              </mesh>
              {/* Aviation warning light at top of antenna */}
              <mesh position={[0, b.h / 2 + b.antenna, 0.002]}>
                <circleGeometry args={[0.008, 8]} />
                <meshBasicMaterial color="#ff4040" toneMapped={false} />
              </mesh>
            </>
          )}
        </group>
      ))}

      {/* Lit windows (warm) — drawn in front of building faces */}
      {WINDOW_GRID.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.025]}>
          <planeGeometry args={[0.028, 0.022]} />
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

/** Tiny deterministic RNG so star positions stay stable across hot reloads. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
