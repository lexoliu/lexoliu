import type { Phase } from '../shared'

interface LightingProps {
  lampOn: boolean
  computerOn: boolean
  phase: Phase
}

/**
 * Single source of truth for all lights. The room is meant to read clearly in
 * both states (lamp on / off) so the dark mode keeps a soft moonlit fill from
 * the window and never collapses to pure black.
 */
export function Lighting({ lampOn, computerOn, phase }: LightingProps) {
  return (
    <>
      <ambientLight intensity={lampOn ? 0.55 : 0.32} color={lampOn ? '#f5e6cc' : '#3b4a64'} />
      <hemisphereLight
        intensity={lampOn ? 0.6 : 0.45}
        color={lampOn ? '#fff1dc' : '#7a93b8'}
        groundColor="#1f1812"
      />

      {/* Warm pendant light (drives most of the room when on) */}
      {lampOn && (
        <pointLight position={[0, 1.9, -0.3]} intensity={4.5} color="#ffe2b6" distance={14} decay={1.6} castShadow />
      )}

      {/* Desk lamp accent */}
      {lampOn && (
        <pointLight position={[2.0, -1.0, 0.6]} intensity={2.6} color="#ffb066" distance={6} decay={1.8} />
      )}

      {/* Window moonlight – stronger when the lamps are off so the scene stays readable */}
      <pointLight
        position={[5, 1.6, -0.5]}
        intensity={lampOn ? 0.55 : 1.45}
        color="#7a99c8"
        distance={12}
        decay={1.6}
      />

      {/* Soft front fill so we never lose the foreground silhouette */}
      <directionalLight
        position={[2.2, 2.5, 6]}
        intensity={lampOn ? 0.32 : 0.55}
        color="#a3c0e5"
      />

      {/* Phosphor glow from the CRT */}
      {computerOn && phase !== 'startup' && (
        <pointLight position={[0, 0.1, 2.4]} intensity={1.1} color="#8ad2d2" distance={6.5} />
      )}
    </>
  )
}
