import { Sparkles } from '@react-three/drei'

/**
 * Subtle dust motes drifting in the warm pool of light around the desk —
 * adds atmospheric depth without competing with the foreground.
 */
export function DustMotes({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <Sparkles
      count={36}
      scale={[5, 2.5, 3]}
      position={[0, -0.4, 0.5]}
      size={2}
      speed={0.18}
      opacity={0.4}
      color="#f5d8a8"
    />
  )
}
