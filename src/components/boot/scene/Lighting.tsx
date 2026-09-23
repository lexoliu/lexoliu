import type { Phase } from '../shared'

interface LightingProps {
  deskLampOn: boolean
  ceilingLampOn: boolean
  computerOn: boolean
  phase: Phase
}

/**
 * Lights split per source so each can be toggled independently:
 *   - ceilingLampOn drives the warm pendant pool that fills the room
 *   - deskLampOn drives the localized desk pool
 *   - moonlight + minimal ambient stay on regardless so the scene never
 *     collapses to pure black when both lamps are off
 */
export function Lighting({ deskLampOn, ceilingLampOn, computerOn, phase }: LightingProps) {
  const anyOn = deskLampOn || ceilingLampOn
  return (
    <>
      <ambientLight intensity={anyOn ? 0.6 : 0.28} color={anyOn ? '#f7e8d0' : '#2c3a55'} />
      <hemisphereLight
        intensity={anyOn ? 0.7 : 0.5}
        color={anyOn ? '#fff3e0' : '#8aa3c6'}
        groundColor="#1f1812"
      />
      {/* Warm city-glow rim from below the window — only when the room is dark */}
      {!anyOn && (
        <pointLight position={[4.6, 0.0, -0.5]} intensity={0.7} color="#c97a4a" distance={9} decay={1.7} />
      )}

      {/* Pendant — fills the room when on */}
      {ceilingLampOn && (
        <pointLight position={[0, 1.9, -0.3]} intensity={5.6} color="#ffe2b6" distance={16} decay={1.5} castShadow />
      )}

      {/* Desk lamp accent — small warm pool on the desk */}
      {deskLampOn && (
        <pointLight position={[1.85, -1.4, 0.1]} intensity={1.4} color="#ffb066" distance={3.5} decay={1.9} />
      )}

      {/* Window moonlight — stronger when both lamps are off so the scene stays readable */}
      <pointLight
        position={[5, 1.6, -0.5]}
        intensity={anyOn ? 0.55 : 1.45}
        color="#7a99c8"
        distance={12}
        decay={1.6}
      />

      {/* Soft front fill so we never lose the foreground silhouette */}
      <directionalLight
        position={[2.2, 2.5, 6]}
        intensity={anyOn ? 0.32 : 0.55}
        color="#a3c0e5"
      />

      {/* Phosphor glow from the CRT */}
      {computerOn && phase !== 'startup' && (
        <pointLight position={[0, 0.1, 2.4]} intensity={1.1} color="#8ad2d2" distance={6.5} />
      )}
    </>
  )
}
