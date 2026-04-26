/**
 * Floor, back/side walls, the wooden desk and its legs. Receives shadows so
 * `ContactShadows` from drei can ground objects against it.
 */
const FLOOR_PLANK_COLUMNS = [-6, -3, 0, 3, 6] as const
const DESK_LEGS: ReadonlyArray<readonly [number, number, number]> = [
  [-2.3, -2.5, -1.55],
  [2.3, -2.5, -1.55],
  [-2.3, -2.5, 0.45],
  [2.3, -2.5, 0.45],
]

const FLOOR_LEVEL = -2.5
const DESK_TOP = -2.05

export function Room() {
  return (
    <>
      <Floor />
      <Walls />
      <Desk />
    </>
  )
}

function Floor() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_LEVEL, 0]} receiveShadow>
        <planeGeometry args={[25, 20]} />
        <meshStandardMaterial color="#3d2c22" roughness={0.82} metalness={0.02} />
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
      {/* Subtle wall picture-rail trim — long thin plank along the back wall */}
      <mesh position={[0, 0.6, -3.97]}>
        <boxGeometry args={[18, 0.06, 0.04]} />
        <meshStandardMaterial color="#2a1f17" roughness={0.85} />
      </mesh>
    </>
  )
}

function Desk() {
  return (
    <>
      {/* Desktop surface */}
      <mesh position={[0, DESK_TOP, -0.5]} receiveShadow>
        <boxGeometry args={[5.2, 0.1, 2.4]} />
        <meshStandardMaterial color="#4a3124" roughness={0.65} metalness={0.04} />
      </mesh>
      {/* Front edge trim */}
      <mesh position={[0, DESK_TOP, 0.69]}>
        <boxGeometry args={[5.2, 0.08, 0.08]} />
        <meshStandardMaterial color="#5a3b2b" roughness={0.62} />
      </mesh>
      {DESK_LEGS.map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[0.1, 0.9, 0.1]} />
          <meshStandardMaterial color="#3f2b20" roughness={0.74} />
        </mesh>
      ))}
    </>
  )
}
