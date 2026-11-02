/**
 * Bookshelf on the back wall. Two rows of mixed-color textbooks sitting
 * on the dividers (with one leaning), a photo frame, a small plant and a
 * mug on the top shelf — proper dorm-room book stack.
 */

const SHELF_THICKNESS = 0.06
const SHELF_DIVIDER_Y = [-0.6, 0.4] as const
const FRAME_DEPTH = 0.4
// Frame is a solid box centered at z=0, so its front face sits at +0.2.
// Shelves project FORWARD from the frame: shelf center z = 0.2 + shelf
// half-depth (0.16) = 0.36. Books and ornaments live in front of the frame
// face on the shelf, at the same z so they sit cleanly on it.
const SHELF_FRONT_Z = FRAME_DEPTH / 2 + 0.16

interface Book {
  x: number
  color: string
  spineColor?: string
  h: number
  w?: number
  lean?: number
}

const BOTTOM_ROW: ReadonlyArray<Book> = [
  { x: -1.2, color: '#c44d3e', spineColor: '#ffd23a', h: 0.7, w: 0.16 },
  { x: -1.0, color: '#2e6cb0', spineColor: '#f0e9d6', h: 0.78, w: 0.14 },
  { x: -0.83, color: '#3a8c4a', spineColor: '#ffd23a', h: 0.65, w: 0.18 },
  { x: -0.62, color: '#e0a635', spineColor: '#1a1a1a', h: 0.72, w: 0.15 },
  { x: -0.42, color: '#7a4eb0', spineColor: '#fff', h: 0.68, w: 0.16 },
  { x: -0.22, color: '#d4cfc4', spineColor: '#1a1a1a', h: 0.74, w: 0.13 },
  { x: -0.04, color: '#2a2520', spineColor: '#f5c84d', h: 0.7, w: 0.18 },
  { x: 0.16, color: '#a13d3d', spineColor: '#f0e9d6', h: 0.78, w: 0.14 },
  { x: 0.34, color: '#356b8c', spineColor: '#ffd23a', h: 0.66, w: 0.16, lean: 0.2 },
  { x: 0.55, color: '#5a8c3a', spineColor: '#fff', h: 0.7, w: 0.15 },
  { x: 0.74, color: '#1a3a5a', spineColor: '#e85d4c', h: 0.74, w: 0.18 },
  { x: 0.95, color: '#c4843e', spineColor: '#1a1a1a', h: 0.68, w: 0.14 },
  { x: 1.13, color: '#3a3030', spineColor: '#ffd23a', h: 0.72, w: 0.13 },
]

const TOP_ROW: ReadonlyArray<Book> = [
  { x: -1.18, color: '#3a8c4a', spineColor: '#fff', h: 0.6, w: 0.16 },
  { x: -0.98, color: '#c44d3e', spineColor: '#1a1a1a', h: 0.66, w: 0.14 },
  { x: -0.8, color: '#e0a635', spineColor: '#1a1a1a', h: 0.55, w: 0.18 },
  // Photo + plant + mug occupy the middle of the top shelf, so books
  // resume on the right side.
  { x: 0.18, color: '#7a4eb0', spineColor: '#ffd23a', h: 0.6, w: 0.15 },
  { x: 0.36, color: '#356b8c', spineColor: '#f0e9d6', h: 0.62, w: 0.13 },
  { x: 1.18, color: '#2a2520', spineColor: '#e85d4c', h: 0.58, w: 0.18 },
]

function BookMesh({ book, baseY }: { book: Book; baseY: number }) {
  const w = book.w ?? 0.16
  const lean = book.lean ?? 0
  // baseY is the Y of the shelf top surface. Book bottom must rest on it,
  // so book center y = baseY + h/2.
  return (
    <group position={[book.x, baseY + book.h / 2, SHELF_FRONT_Z]} rotation={[0, 0, lean]}>
      <mesh castShadow>
        <boxGeometry args={[w, book.h, 0.28]} />
        <meshStandardMaterial color={book.color} roughness={0.78} />
      </mesh>
      {/* Spine title strip — front face accent */}
      <mesh position={[0, 0, 0.141]}>
        <planeGeometry args={[w * 0.7, book.h * 0.18]} />
        <meshBasicMaterial color={book.spineColor ?? '#fff'} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Bookshelf() {
  // Compute baseY for each row: top of the divider plank.
  const bottomShelfTopY = SHELF_DIVIDER_Y[0] + SHELF_THICKNESS / 2
  const topShelfTopY = SHELF_DIVIDER_Y[1] + SHELF_THICKNESS / 2

  return (
    <group position={[0, 0.8, -3.5]}>
      {/* Frame */}
      <mesh>
        <boxGeometry args={[3.5, 2.5, FRAME_DEPTH]} />
        <meshStandardMaterial color="#3a2218" roughness={0.78} />
      </mesh>

      {/* Shelf planks */}
      {SHELF_DIVIDER_Y.map((y, i) => (
        <mesh key={i} position={[0, y, SHELF_FRONT_Z - 0.1]}>
          <boxGeometry args={[3.3, SHELF_THICKNESS, 0.32]} />
          <meshStandardMaterial color="#5a3a25" roughness={0.7} />
        </mesh>
      ))}

      {BOTTOM_ROW.map((b, i) => (
        <BookMesh key={`b-${i}`} book={b} baseY={bottomShelfTopY} />
      ))}
      {TOP_ROW.map((b, i) => (
        <BookMesh key={`t-${i}`} book={b} baseY={topShelfTopY} />
      ))}

      {/* Photo frame — sits on top shelf surface (top y = 0.4 + 0.03 = 0.43).
          Frame height 0.45, center y = 0.43 + 0.225 = 0.655. */}
      <group position={[-0.5, 0.655, SHELF_FRONT_Z - 0.05]}>
        <mesh>
          <boxGeometry args={[0.35, 0.45, 0.03]} />
          <meshStandardMaterial color="#4a3020" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.28, 0.38, 0.01]} />
          <meshStandardMaterial color="#8a9aaa" roughness={0.4} />
        </mesh>
      </group>

      {/* Small plant on top shelf — pot height 0.18 → bottom y=0.43, center y=0.52 */}
      <group position={[0.6, 0.52, SHELF_FRONT_Z - 0.05]}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.1, 0.18, 12]} />
          <meshStandardMaterial color="#a85530" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshStandardMaterial color="#3a8c4a" roughness={0.8} />
        </mesh>
      </group>

      {/* Mug — height 0.14, center y = 0.43 + 0.07 = 0.50 */}
      <group position={[0.95, 0.50, SHELF_FRONT_Z - 0.05]}>
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
