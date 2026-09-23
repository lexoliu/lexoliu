import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
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

const TRAVEL_PINS: ReadonlyArray<{ x: number; y: number; color: string; halo?: boolean }> = [
  { x: 0.46, y: 0.22, color: '#E85D4C', halo: true }, // Hangzhou (home)
  { x: -0.52, y: 0.30, color: '#4ca2e8' },             // NYC
  { x: -0.18, y: 0.32, color: '#4ca2e8' },             // London
  { x: 0.62, y: -0.32, color: '#4ca2e8' },             // Sydney
  { x: -0.40, y: -0.05, color: '#4ca2e8' },            // Lima
]

/**
 * Framed world map on the back wall. Hangzhou (the user's home city) gets the
 * accent halo; other dots are travel goals — fits the wanderlust dorm vibe.
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
      {/* Travel pins */}
      {TRAVEL_PINS.map((p, i) => (
        <group key={i} position={[p.x, p.y, 0.018]}>
          <mesh>
            <sphereGeometry args={[0.024, 16, 16]} />
            <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={p.halo ? 0.5 : 0.25} roughness={0.45} />
          </mesh>
          {p.halo && (
            <mesh position={[0, 0, -0.005]}>
              <ringGeometry args={[0.04, 0.07, 24]} />
              <meshBasicMaterial color={p.color} transparent opacity={0.35} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      ))}
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

const TOUR_DATES = [-0.32, -0.12, 0.08, 0.28] as const

/**
 * Taped-up dorm-style band poster — placed on the right wall as a separate
 * element from the world map.
 */
export function DormPoster() {
  // Back wall at z=-4. Place between bookshelf (x range [-1.75, 1.75]) and
  // the window's projected x range to the right. With poster width 1.0,
  // x=2.5 → [2.0, 3.0] sits in the gap before window left x=3.225.
  return (
    <group position={[2.5, 0.7, -3.93]}>
      <mesh>
        <planeGeometry args={[1.0, 1.4]} />
        <meshStandardMaterial color="#f0e6d0" roughness={0.92} emissive="#1a140c" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, 0.5, 0.003]}>
        <planeGeometry args={[1.0, 0.34]} />
        <meshBasicMaterial color="#d33672" toneMapped={false} />
      </mesh>
      <mesh position={[0.1, 0.32, 0.004]} rotation={[0, 0, -0.32]}>
        <planeGeometry args={[1.4, 0.05]} />
        <meshBasicMaterial color="#f5c84d" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.0, 0.005]}>
        <planeGeometry args={[0.6, 0.8]} />
        <meshBasicMaterial color="#1a1a1a" toneMapped={false} />
      </mesh>
      <mesh position={[-0.05, 0.1, 0.006]}>
        <circleGeometry args={[0.1, 24]} />
        <meshBasicMaterial color="#f0e6d0" toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.55, 0.003]}>
        <planeGeometry args={[0.95, 0.1]} />
        <meshBasicMaterial color="#1a1a1a" toneMapped={false} />
      </mesh>
      {TOUR_DATES.map((y) => (
        <mesh key={y} position={[y * 0.55, -0.55, 0.005]}>
          <planeGeometry args={[0.08, 0.025]} />
          <meshBasicMaterial color="#f5c84d" toneMapped={false} />
        </mesh>
      ))}
      {[[-0.45, 0.65], [0.45, 0.65], [-0.45, -0.65], [0.45, -0.65]].map(([tx, ty], i) => (
        <mesh key={i} position={[tx, ty, 0.012]} rotation={[0, 0, i % 2 ? -0.4 : 0.4]}>
          <planeGeometry args={[0.12, 0.035]} />
          <meshBasicMaterial color="#f8f3d8" toneMapped={false} transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  )
}

interface SkylineLayer {
  /** Building base y (bottom of tallest face is at base + 0). */
  baseY: number
  /** Z depth in window-local space. Deeper layers are smaller & more hazy. */
  z: number
  /** Tint color — far layers fade toward the sky. */
  color: string
  /** Window light tint — far layers cool & dim. */
  windowColor: string
  windowOpacity: number
  /** Width range and density. */
  count: number
  minH: number
  maxH: number
  spread: number
  seed: number
}

const SKYLINE_LAYERS: ReadonlyArray<SkylineLayer> = [
  // Far horizon — hazy violet, cool window mix
  { baseY: -0.42, z: 0.011, color: '#1a2244', windowColor: '#b6c8e8', windowOpacity: 0.6,
    count: 28, minH: 0.10, maxH: 0.28, spread: 2.16, seed: 0xa1f3 },
  // Mid distance — defined silhouette, predominantly warm
  { baseY: -0.50, z: 0.018, color: '#0c1430', windowColor: '#ffcc7a', windowOpacity: 1.0,
    count: 18, minH: 0.22, maxH: 0.58, spread: 2.10, seed: 0x12b7 },
  // Near foreground — sharpest, biggest windows, towers with antennas
  { baseY: -0.55, z: 0.026, color: '#05081a', windowColor: '#ffd890', windowOpacity: 1.0,
    count: 11, minH: 0.34, maxH: 0.85, spread: 2.0, seed: 0x77c1 },
]

interface Building {
  x: number
  h: number
  w: number
  antenna?: number
  /** Lit window cells [colX, rowY] in building-local coords. */
  windows: ReadonlyArray<[number, number]>
}

function generateLayer(layer: SkylineLayer): Building[] {
  const rng = mulberry32(layer.seed)
  const result: Building[] = []
  const step = layer.spread / layer.count
  for (let i = 0; i < layer.count; i++) {
    const x = -layer.spread / 2 + step * (i + 0.5) + (rng() - 0.5) * step * 0.5
    const h = layer.minH + rng() * (layer.maxH - layer.minH)
    const w = step * (0.55 + rng() * 0.4)
    const antenna = rng() > 0.78 ? 0.12 + rng() * 0.18 : undefined
    // Procedural window grid — fewer at far layers
    const cols = Math.max(1, Math.floor(w / 0.04))
    const rows = Math.max(1, Math.floor(h / 0.05))
    const windows: [number, number][] = []
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rng() < 0.42) {
          const wx = -w / 2 + (c + 0.5) * (w / cols)
          const wy = -h / 2 + (r + 0.5) * (h / rows)
          windows.push([wx, wy])
        }
      }
    }
    result.push({ x, h, w, antenna, windows })
  }
  return result
}

const STAR_COUNT = 64
const TWINKLE_COUNT = 6

/**
 * Layered night cityscape window. Three depth-stacked silhouette layers
 * create parallax & atmospheric perspective; warm/cool window lights are
 * generated procedurally per building; aviation warning lights blink; a
 * handful of bright stars twinkle. All decorative geometry sits in front of
 * the dark-blue sky plane so there is no z-fighting against the wall.
 */
export function NightWindow() {
  const layers = useMemo(
    () => SKYLINE_LAYERS.map((l) => ({ layer: l, buildings: generateLayer(l) })),
    [],
  )

  const stars = useMemo(() => {
    const rng = mulberry32(0x5a17)
    return Array.from({ length: STAR_COUNT }, () => ({
      x: (rng() - 0.5) * 2.05,
      y: -0.1 + rng() * 0.95,
      r: 0.003 + rng() * 0.007,
      i: 0.4 + rng() * 0.55,
    }))
  }, [])

  const twinkleStars = useMemo(() => {
    const rng = mulberry32(0xbeef)
    return Array.from({ length: TWINKLE_COUNT }, () => ({
      x: (rng() - 0.5) * 1.9,
      y: 0.15 + rng() * 0.7,
      r: 0.009 + rng() * 0.006,
      phase: rng() * Math.PI * 2,
      speed: 1.4 + rng() * 1.6,
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
      <mesh position={[0, -1.08, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.12, 0.32]} />
        <meshStandardMaterial color="#2a1d14" roughness={0.7} />
      </mesh>

      {/* === Sky === Stacked translucent gradient bands sell the depth. */}
      {/* Deepest indigo — basic material untoned so it stays vivid at night.
          A standard material here would crush to black under ACES tonemap. */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[2.2, 1.78]} />
        <meshBasicMaterial color="#2a4a98" toneMapped={false} fog={false} />
      </mesh>
      {/* Mid-sky violet wash near the horizon */}
      <mesh position={[0, -0.05, 0.002]}>
        <planeGeometry args={[2.2, 1.5]} />
        <meshBasicMaterial color="#352a66" toneMapped={false} transparent opacity={0.6} />
      </mesh>
      {/* Horizon haze: violet → magenta → amber */}
      <mesh position={[0, -0.30, 0.004]}>
        <planeGeometry args={[2.2, 0.6]} />
        <meshBasicMaterial color="#33214a" toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, -0.45, 0.005]}>
        <planeGeometry args={[2.2, 0.32]} />
        <meshBasicMaterial color="#5a2c4a" toneMapped={false} transparent opacity={0.78} />
      </mesh>
      <mesh position={[0, -0.55, 0.006]}>
        <planeGeometry args={[2.2, 0.18]} />
        <meshBasicMaterial color="#774032" toneMapped={false} transparent opacity={0.65} />
      </mesh>

      {/* Stars */}
      {stars.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, 0.007]}>
          <circleGeometry args={[s.r, 8]} />
          <meshBasicMaterial color="#fffaea" transparent opacity={s.i} toneMapped={false} />
        </mesh>
      ))}
      {/* Twinkling bright stars */}
      {twinkleStars.map((s, i) => (
        <TwinkleStar key={i} {...s} />
      ))}

      {/* Moon: outer halo, soft glow, disc, subtle craters.
          Z above all skyline layers so buildings never occlude it. */}
      <Moon position={[0.55, 0.5, 0.030]} />

      {/* Distant ridge/hill silhouette — anchors mid-distance */}
      <mesh position={[0, -0.5, 0.013]}>
        <planeGeometry args={[2.2, 0.18]} />
        <meshBasicMaterial color="#070b1a" toneMapped={false} transparent opacity={0.9} />
      </mesh>

      {/* === Skyline layers, far → near === */}
      {layers.map(({ layer, buildings }, li) => (
        <group key={li} position={[0, 0, layer.z]}>
          {buildings.map((b, bi) => (
            <BuildingSilhouette key={bi} building={b} layer={layer} index={li * 1000 + bi} />
          ))}
        </group>
      ))}

      {/* Cross dividers (mullions) in front of glass */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.05, 1.78, 0.05]} />
        <meshStandardMaterial color="#1f130c" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[2.2, 0.05, 0.05]} />
        <meshStandardMaterial color="#1f130c" roughness={0.7} />
      </mesh>
      {/* Sash horizontal at 1/3 height for a more believable casement */}
      <mesh position={[0, 0.45, 0.05]}>
        <boxGeometry args={[2.2, 0.025, 0.05]} />
        <meshStandardMaterial color="#1f130c" roughness={0.75} />
      </mesh>

      {/* Faint warm interior reflection ghost — bottom-left bias */}
      <mesh position={[-0.45, -0.2, 0.046]}>
        <planeGeometry args={[1.0, 0.55]} />
        <meshBasicMaterial color="#ffb070" toneMapped={false} transparent opacity={0.045} />
      </mesh>

      {/* Glass pane (almost clear, in front of city) */}
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[2.18, 1.76]} />
        <meshPhysicalMaterial
          color="#a4c0e8"
          transparent
          opacity={0.06}
          roughness={0.03}
          metalness={0}
          transmission={0.85}
          thickness={0.15}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* String lights draped along the inside of the window frame */}
      <StringLights />
    </group>
  )
}

/** Warm fairy lights swagged inside the top of the window — pure dorm vibe. */
function StringLights() {
  // Generate a sagging swag along the top + sides of the window opening.
  const bulbs = useMemo(() => {
    const pts: { x: number; y: number; phase: number }[] = []
    const COUNT = 22
    for (let i = 0; i < COUNT; i++) {
      const t = i / (COUNT - 1)
      // Three swags across the top: u maps to local angle in each swag.
      const swag = Math.floor(t * 3)
      const u = (t * 3) - swag
      const xs = [-1.05, -0.36, 0.35, 1.05]
      const x = xs[swag] + (xs[swag + 1] - xs[swag]) * u
      // Sag downward proportional to sin(πu)
      const y = 0.78 - Math.sin(u * Math.PI) * 0.12
      pts.push({ x, y, phase: i * 0.74 })
    }
    return pts
  }, [])
  return (
    <group>
      {bulbs.map((b, i) => (
        <FairyLight key={i} {...b} />
      ))}
      {/* Cord between bulbs — drawn IN FRONT of the glass plane (z=0.045) so
          it reads as draped inside the room, not trapped between the panes. */}
      {bulbs.slice(0, -1).map((b, i) => {
        const next = bulbs[i + 1]
        const dx = next.x - b.x
        const dy = next.y - b.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx)
        return (
          <mesh
            key={`c-${i}`}
            position={[(b.x + next.x) / 2, (b.y + next.y) / 2, 0.07]}
            rotation={[0, 0, angle]}
          >
            <planeGeometry args={[len, 0.006]} />
            <meshBasicMaterial color="#2a241c" toneMapped={false} transparent opacity={0.9} />
          </mesh>
        )
      })}
    </group>
  )
}

function FairyLight({ x, y, phase }: { x: number; y: number; phase: number }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((state) => {
    if (!matRef.current) return
    const t = state.clock.elapsedTime * 1.6 + phase
    matRef.current.opacity = 0.85 + 0.15 * Math.sin(t)
  })
  return (
    <group position={[x, y, 0.05]}>
      {/* Outer halo */}
      <mesh>
        <circleGeometry args={[0.04, 16]} />
        <meshBasicMaterial color="#ffd070" toneMapped={false} transparent opacity={0.32} />
      </mesh>
      {/* Bright core */}
      <mesh position={[0, 0, 0.001]}>
        <circleGeometry args={[0.018, 16]} />
        <meshBasicMaterial ref={matRef} color="#fff0c0" toneMapped={false} transparent opacity={1} />
      </mesh>
    </group>
  )
}

function BuildingSilhouette({
  building,
  layer,
  index,
}: {
  building: Building
  layer: SkylineLayer
  index: number
}) {
  const lightRef = useRef<THREE.MeshBasicMaterial>(null)
  // Each aviation light blinks on its own phase
  const phase = useMemo(() => (index * 1.318) % (Math.PI * 2), [index])
  useFrame((state) => {
    if (!lightRef.current) return
    const t = state.clock.elapsedTime * 1.6 + phase
    // Sharp blink: ~10% on, 90% off
    const v = Math.max(0, Math.sin(t)) ** 16
    lightRef.current.opacity = v
  })

  const yCenter = layer.baseY + building.h / 2
  return (
    <group position={[building.x, yCenter, 0]}>
      {/* Body */}
      <mesh>
        <planeGeometry args={[building.w, building.h]} />
        <meshBasicMaterial color={layer.color} toneMapped={false} />
      </mesh>
      {/* Lit windows — small rectangles, slight per-window opacity variance */}
      {building.windows.map(([wx, wy], i) => (
        <mesh key={i} position={[wx, wy, 0.001]}>
          <planeGeometry args={[0.014, 0.012]} />
          <meshBasicMaterial
            color={layer.windowColor}
            toneMapped={false}
            transparent
            opacity={layer.windowOpacity * (0.55 + ((i * 37 + index) % 6) / 10)}
          />
        </mesh>
      ))}
      {building.antenna !== undefined && (
        <>
          <mesh position={[0, building.h / 2 + building.antenna / 2, 0.001]}>
            <planeGeometry args={[0.004, building.antenna]} />
            <meshBasicMaterial color={layer.color} toneMapped={false} />
          </mesh>
          {/* Aviation warning light — animated */}
          <mesh position={[0, building.h / 2 + building.antenna, 0.002]}>
            <circleGeometry args={[0.009, 12]} />
            <meshBasicMaterial ref={lightRef} color="#ff3a3a" toneMapped={false} transparent opacity={0} />
          </mesh>
        </>
      )}
    </group>
  )
}

function TwinkleStar({
  x, y, r, phase, speed,
}: { x: number; y: number; r: number; phase: number; speed: number }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((state) => {
    if (!matRef.current) return
    const t = state.clock.elapsedTime * speed + phase
    matRef.current.opacity = 0.55 + 0.45 * Math.sin(t) ** 2
  })
  return (
    <group position={[x, y, 0.0075]}>
      <mesh>
        <circleGeometry args={[r, 12]} />
        <meshBasicMaterial ref={matRef} color="#fffaea" transparent opacity={0.8} toneMapped={false} />
      </mesh>
      {/* Cross-shaped diffraction spikes */}
      <mesh>
        <planeGeometry args={[r * 5, r * 0.35]} />
        <meshBasicMaterial color="#fffaea" transparent opacity={0.18} toneMapped={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[r * 0.35, r * 5]} />
        <meshBasicMaterial color="#fffaea" transparent opacity={0.18} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Moon({ position }: { position: [number, number, number] }) {
  const craters = useMemo(() => {
    const rng = mulberry32(0x4321)
    return Array.from({ length: 5 }, () => ({
      x: (rng() - 0.5) * 0.13,
      y: (rng() - 0.5) * 0.13,
      r: 0.008 + rng() * 0.016,
    }))
  }, [])
  return (
    <group position={position}>
      {/* Outer atmospheric halo */}
      <mesh position={[0, 0, -0.001]}>
        <circleGeometry args={[0.28, 48]} />
        <meshBasicMaterial color="#fff5d6" transparent opacity={0.08} toneMapped={false} />
      </mesh>
      {/* Inner halo */}
      <mesh>
        <circleGeometry args={[0.16, 48]} />
        <meshBasicMaterial color="#fff5d6" transparent opacity={0.22} toneMapped={false} />
      </mesh>
      {/* Disc */}
      <mesh position={[0, 0, 0.001]}>
        <circleGeometry args={[0.1, 48]} />
        <meshBasicMaterial color="#fff5d6" toneMapped={false} />
      </mesh>
      {/* Subtle craters */}
      {craters.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, 0.002]}>
          <circleGeometry args={[c.r, 12]} />
          <meshBasicMaterial color="#e6d8a8" transparent opacity={0.4} toneMapped={false} />
        </mesh>
      ))}
      {/* Terminator shadow — slight crescent on the lower-right */}
      <mesh position={[0.018, -0.012, 0.0025]}>
        <circleGeometry args={[0.098, 48]} />
        <meshBasicMaterial color="#1a1a3a" transparent opacity={0.18} toneMapped={false} />
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
