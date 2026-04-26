import * as THREE from 'three'

/** A small ceramic coffee mug on the desk — visible in the room view as a
 *  splash of warmth between the keyboard and the monitor base. */
export function CoffeeMug() {
  return (
    // Sits on the desk surface (y = -2.0 + body half-height) just left of
    // the keyboard, in the warm pool of the desk lamp.
    <group position={[-1.65, -1.89, 0.55]}>
      {/* Body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.13, 0.11, 0.22, 24]} />
        <meshStandardMaterial color="#f5e6c8" roughness={0.42} />
      </mesh>
      {/* Coffee surface */}
      <mesh position={[0, 0.105, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.005, 24]} />
        <meshStandardMaterial color="#3a1f10" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Handle */}
      <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.07, 0.018, 8, 20, Math.PI]} />
        <meshStandardMaterial color="#f5e6c8" roughness={0.42} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
