/**
 * Static bookshelf decoration on the back wall. Pure visual element — no
 * click affordance, since we don't have anything meaningful to surface from a
 * book.
 */

const BOOKS = [
  { x: -1.2, color: '#4a3030', h: 0.55 },
  { x: -0.9, color: '#3a4050', h: 0.5 },
  { x: -0.6, color: '#E85D4C', h: 0.52 }, // Rust accent
  { x: -0.3, color: '#2a3a2a', h: 0.48 },
  { x: 0.0, color: '#4a4a3a', h: 0.54 },
  { x: 0.3, color: '#3a3a4a', h: 0.5 },
  { x: 0.6, color: '#5a4a3a', h: 0.51 },
  { x: 0.9, color: '#3a4a4a', h: 0.53 },
] as const

const SHELF_DIVIDER_Y = [-0.6, 0.4] as const

export function Bookshelf() {
  return (
    <group position={[0, 0.8, -3.5]}>
      {/* Frame */}
      <mesh>
        <boxGeometry args={[3.5, 2.5, 0.4]} />
        <meshStandardMaterial color="#2a1810" roughness={0.78} />
      </mesh>

      {SHELF_DIVIDER_Y.map((y, i) => (
        <mesh key={i} position={[0, y, 0.05]}>
          <boxGeometry args={[3.3, 0.06, 0.35]} />
          <meshStandardMaterial color="#3a2820" roughness={0.8} />
        </mesh>
      ))}

      {BOOKS.map((book, i) => (
        <mesh key={i} position={[book.x, 0, 0.05]} castShadow>
          <boxGeometry args={[0.18, book.h, 0.28]} />
          <meshStandardMaterial color={book.color} roughness={0.7} />
        </mesh>
      ))}

      {/* Photo frame */}
      <group position={[-0.8, 0.85, 0.1]}>
        <mesh>
          <boxGeometry args={[0.35, 0.45, 0.03]} />
          <meshStandardMaterial color="#4a3020" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.28, 0.38, 0.01]} />
          <meshStandardMaterial color="#8a9aaa" roughness={0.4} />
        </mesh>
      </group>

      {/* Small plant on top shelf */}
      <group position={[0.7, 0.75, 0.1]}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.1, 0.18, 12]} />
          <meshStandardMaterial color="#5a4030" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshStandardMaterial color="#2a5a2a" roughness={0.8} />
        </mesh>
      </group>

      {/* Mug */}
      <group position={[1.0, -0.8, 0.08]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.07, 0.14, 16]} />
          <meshStandardMaterial color="#d4d0c8" roughness={0.5} />
        </mesh>
        <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.05, 0.015, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#d4d0c8" roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}
