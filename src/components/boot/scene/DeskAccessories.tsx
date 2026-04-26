import { Instances, Instance } from '@react-three/drei'

const KEY_ROWS = 5
const KEY_COLS = 14
const KEY_PITCH = 0.105
const KEY_DEPTH_PITCH = 0.085

/**
 * Keyboard + mouse on the desk. The keyboard's keycaps are rendered with
 * drei's `<Instances>` so all 70 keys share a single draw call, instead of
 * spawning 70 separate meshes.
 */
export function DeskAccessories() {
  return (
    <group position={[0, -1.985, 0.42]}>
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

      {/* Mouse: rounded body + tail */}
      <group position={[1.42, 0.04, 0.05]}>
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
    </group>
  )
}
