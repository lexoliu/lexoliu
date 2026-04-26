import { palette } from '../shared'

const CONTINENTS: ReadonlyArray<{ pos: [number, number, number]; size: [number, number] }> = [
  { pos: [-0.5, 0.2, 0.01], size: [0.6, 0.4] },
  { pos: [0.3, 0.1, 0.01], size: [0.5, 0.5] },
  { pos: [0.6, -0.3, 0.01], size: [0.3, 0.25] },
]

const PINS: ReadonlyArray<[number, number]> = [[0.35, 0.15]]

/** Framed world map on the left wall, gently angled toward the camera. */
export function WorldMap() {
  return (
    <group position={[-4.5, 1.2, -3]} rotation={[0, 0.3, 0]}>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[2.2, 1.5, 0.06]} />
        <meshStandardMaterial color="#3a2820" roughness={0.7} />
      </mesh>
      <mesh>
        <planeGeometry args={[2, 1.3]} />
        <meshStandardMaterial color="#e8e0d0" roughness={0.6} />
      </mesh>
      {CONTINENTS.map((c, i) => (
        <mesh key={i} position={c.pos}>
          <planeGeometry args={c.size} />
          <meshStandardMaterial color="#9a9a8a" transparent opacity={0.6} />
        </mesh>
      ))}
      {PINS.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.02]}>
          <circleGeometry args={[0.03, 16]} />
          <meshBasicMaterial color={palette.accent} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

const BUILDINGS: ReadonlyArray<{ x: number; h: number; w: number }> = [
  { x: -0.7, h: 0.4, w: 0.15 },
  { x: -0.45, h: 0.6, w: 0.18 },
  { x: -0.2, h: 0.35, w: 0.12 },
  { x: 0.0, h: 0.7, w: 0.2 },
  { x: 0.25, h: 0.45, w: 0.14 },
  { x: 0.5, h: 0.55, w: 0.16 },
  { x: 0.7, h: 0.38, w: 0.13 },
]

const CITY_LIGHTS: ReadonlyArray<[number, number]> = [
  [-0.45, -0.3], [-0.45, -0.1], [-0.45, 0.1],
  [0.0, -0.3], [0.0, -0.1], [0.0, 0.1], [0.0, 0.3],
  [0.5, -0.2], [0.5, 0.0], [0.5, 0.15],
]

/** Window with night-city silhouette and warm window-lights glittering. */
export function NightWindow() {
  return (
    <group position={[4.5, 1.5, -2]} rotation={[0, -0.4, 0]}>
      {/* Frame */}
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[2.4, 2, 0.15]} />
        <meshStandardMaterial color="#2a1810" roughness={0.85} />
      </mesh>
      {/* Glass */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[2.1, 1.7]} />
        <meshStandardMaterial color="#2c3f5a" roughness={0.1} metalness={0.3} transparent opacity={0.88} />
      </mesh>
      {/* Buildings */}
      {BUILDINGS.map((b, i) => (
        <mesh key={i} position={[b.x, -0.5 + b.h / 2, -0.01]}>
          <boxGeometry args={[b.w, b.h, 0.01]} />
          <meshBasicMaterial color="#1a2530" toneMapped={false} />
        </mesh>
      ))}
      {/* Lit windows */}
      {CITY_LIGHTS.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <planeGeometry args={[0.04, 0.03]} />
          <meshBasicMaterial color="#ffcc88" transparent opacity={0.85} toneMapped={false} />
        </mesh>
      ))}
      {/* Cross dividers */}
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[0.06, 1.7, 0.04]} />
        <meshStandardMaterial color="#3a2820" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[2.1, 0.06, 0.04]} />
        <meshStandardMaterial color="#3a2820" roughness={0.8} />
      </mesh>
    </group>
  )
}
