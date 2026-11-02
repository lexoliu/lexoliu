import { MeshReflectorMaterial } from '@react-three/drei'

/**
 * Floor, back/side walls, the wooden desk and its legs. The desk surface
 * uses MeshReflectorMaterial so the warm pendant and CRT glow pool gently
 * across the wood — that subtle reflection is what makes the room feel
 * "real" instead of "flat".
 */
const FLOOR_PLANK_COLUMNS = [-6, -3, 0, 3, 6] as const
const FLOOR_LEVEL = -2.5
const DESK_TOP = -2.05
// Legs span exactly floor → desk underside (height = DESK_TOP - 0.05 - FLOOR_LEVEL = 0.4)
const LEG_HEIGHT = 0.4
const LEG_Y = (FLOOR_LEVEL + DESK_TOP - 0.05) / 2 // -2.3
const DESK_WIDTH = 7.6
const DESK_DEPTH = 2.4
const LEG_INSET = 0.2
const DESK_LEGS: ReadonlyArray<readonly [number, number, number]> = [
  [-(DESK_WIDTH / 2 - LEG_INSET), LEG_Y, -1.55],
  [DESK_WIDTH / 2 - LEG_INSET, LEG_Y, -1.55],
  [-(DESK_WIDTH / 2 - LEG_INSET), LEG_Y, 0.55],
  [DESK_WIDTH / 2 - LEG_INSET, LEG_Y, 0.55],
]

export function Room() {
  return (
    <>
      <Floor />
      <Walls />
      <Desk />
      <Rug />
    </>
  )
}

function Rug() {
  // Layered: wide soft rug underneath, smaller patterned top adds texture.
  const RUG_W = 5.4
  const RUG_D = 3.2
  return (
    <group position={[0, FLOOR_LEVEL + 0.005, 0.6]}>
      {/* Base — burgundy plush */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[RUG_W, RUG_D]} />
        <meshStandardMaterial color="#5a2a2a" roughness={0.95} />
      </mesh>
      {/* Cream border ring drawn just above the base to suggest a pattern */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[Math.min(RUG_W, RUG_D) * 0.42, Math.min(RUG_W, RUG_D) * 0.46, 4, 1]} />
        <meshStandardMaterial color="#d8c8a4" roughness={0.9} side={2} />
      </mesh>
      {/* Inner medallion */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.5, 6]} />
        <meshStandardMaterial color="#3a1818" roughness={0.95} />
      </mesh>
      {/* Tassels along front edge */}
      {[-2.2, -1.5, -0.8, 0, 0.8, 1.5, 2.2].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.001, RUG_D / 2 + 0.07]}>
          <planeGeometry args={[0.05, 0.14]} />
          <meshStandardMaterial color="#d8c8a4" roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

function Floor() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_LEVEL, 0]} receiveShadow>
        <planeGeometry args={[25, 20]} />
        <meshStandardMaterial color="#1f1812" roughness={0.85} metalness={0.02} />
      </mesh>
      {FLOOR_PLANK_COLUMNS.map((x) => (
        <mesh key={x} position={[x, FLOOR_LEVEL + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.025, 20]} />
          <meshStandardMaterial color="#1a120c" transparent opacity={0.32} />
        </mesh>
      ))}
    </>
  )
}

function Walls() {
  return (
    <>
      {/* Back */}
      <mesh position={[0, 2, -4]} receiveShadow>
        <planeGeometry args={[30, 15]} />
        <meshStandardMaterial color="#3a302a" roughness={0.9} />
      </mesh>
      {/* Left */}
      <mesh position={[-10, 2, 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[15, 12]} />
        <meshStandardMaterial color="#332a25" roughness={0.92} />
      </mesh>
      {/* Right */}
      <mesh position={[10, 2, 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[15, 12]} />
        <meshStandardMaterial color="#332a25" roughness={0.92} />
      </mesh>

      {/* Skirting board along the floor / back wall */}
      <mesh position={[0, -2.18, -3.96]}>
        <boxGeometry args={[20, 0.18, 0.05]} />
        <meshStandardMaterial color="#1d140e" roughness={0.85} />
      </mesh>
    </>
  )
}

function Desk() {
  return (
    <>
      {/* Desk core (matte underside + front face) */}
      <mesh position={[0, DESK_TOP - 0.025, -0.5]} receiveShadow castShadow>
        <boxGeometry args={[DESK_WIDTH, 0.05, DESK_DEPTH]} />
        <meshStandardMaterial color="#3a2618" roughness={0.85} />
      </mesh>
      {/* Reflective top (subtle, low-res for performance) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, DESK_TOP + 0.001, -0.5]}
        receiveShadow
      >
        <planeGeometry args={[DESK_WIDTH, DESK_DEPTH]} />
        <MeshReflectorMaterial
          color="#4a3124"
          roughness={0.78}
          metalness={0.05}
          mirror={0.18}
          mixBlur={2.6}
          mixStrength={0.55}
          blur={[200, 80]}
          resolution={512}
          minDepthThreshold={0.6}
          maxDepthThreshold={1.2}
          depthScale={1.2}
        />
      </mesh>
      {/* Front edge trim */}
      <mesh position={[0, DESK_TOP, 0.69]}>
        <boxGeometry args={[DESK_WIDTH, 0.08, 0.08]} />
        <meshStandardMaterial color="#5a3b2b" roughness={0.62} />
      </mesh>
      {DESK_LEGS.map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[0.12, LEG_HEIGHT, 0.12]} />
          <meshStandardMaterial color="#2f1f15" roughness={0.74} />
        </mesh>
      ))}
    </>
  )
}
