import * as THREE from 'three'

const LEAVES: ReadonlyArray<{ rx: number; ry: number; rz: number; y: number }> = [
  { rx: -0.3, ry: 0, rz: 0.2, y: 0.4 },
  { rx: 0.2, ry: 1.5, rz: -0.3, y: 0.45 },
  { rx: -0.1, ry: 3, rz: 0.1, y: 0.35 },
  { rx: 0.3, ry: 4.5, rz: -0.2, y: 0.5 },
]

/** A small monstera-style plant in a terracotta pot on the desk. */
export function Plant() {
  return (
    <group position={[2.3, -1.98, 0.3]}>
      {/* Pot */}
      <mesh castShadow>
        <cylinderGeometry args={[0.15, 0.12, 0.2, 16]} />
        <meshStandardMaterial color="#6a4534" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.02, 16]} />
        <meshStandardMaterial color="#2a1d14" roughness={1} />
      </mesh>
      {LEAVES.map((leaf, i) => (
        <mesh key={i} position={[0, leaf.y, 0]} rotation={[leaf.rx, leaf.ry, leaf.rz]} castShadow>
          <sphereGeometry args={[0.12, 12, 6, 0, Math.PI]} />
          <meshStandardMaterial color="#2a6a3a" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}
