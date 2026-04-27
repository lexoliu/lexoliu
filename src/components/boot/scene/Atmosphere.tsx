import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, ChromaticAberration, BrightnessContrast } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import * as THREE from 'three'

/**
 * Procedurally generated IBL using drei Lightformers — gives every standard
 * material proper environmental reflections (warm bounce from above, cool
 * window light from one side, soft ground bounce) without fetching any
 * external HDR. Runs once into a tiny cubemap (`frames={1}`).
 */
export function SceneEnvironment({ lampOn }: { lampOn: boolean }) {
  return (
    <Environment frames={1} resolution={64} background={false} environmentIntensity={lampOn ? 0.85 : 0.5}>
      {/* Warm overhead — pendant glow */}
      <Lightformer
        form="rect"
        intensity={lampOn ? 4.0 : 0.6}
        position={[0, 4, 0]}
        scale={[6, 1, 6]}
        color="#ffe2b6"
        rotation={[Math.PI / 2, 0, 0]}
      />
      {/* Cool window side — moonlight */}
      <Lightformer
        form="rect"
        intensity={lampOn ? 1.1 : 2.4}
        position={[5, 1.5, 0]}
        scale={[1, 3, 4]}
        color="#7a99c8"
        rotation={[0, -Math.PI / 2, 0]}
      />
      {/* Subtle ground bounce */}
      <Lightformer
        form="rect"
        intensity={0.4}
        position={[0, -3, 0]}
        scale={[8, 1, 8]}
        color="#2a1d14"
        rotation={[-Math.PI / 2, 0, 0]}
      />
      {/* Behind-camera fill — keeps near faces from going pitch black */}
      <Lightformer
        form="rect"
        intensity={lampOn ? 0.6 : 0.9}
        position={[0, 0, 8]}
        scale={[6, 4, 1]}
        color={lampOn ? '#f3d7b0' : '#637996'}
      />
    </Environment>
  )
}

/**
 * Post-processing chain — bloom on warm pendant + CRT phosphor + city
 * lights, gentle vignette and a touch of chromatic aberration for the CRT
 * look. Multisampling at 4 keeps polygon edges from shimmering.
 */
export function PostProcessing() {
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <Bloom
        intensity={0.6}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.4}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
      <BrightnessContrast brightness={0.02} contrast={0.06} />
      <ChromaticAberration
        offset={new THREE.Vector2(0.0006, 0.0006)}
        radialModulation
        modulationOffset={0.4}
        blendFunction={BlendFunction.NORMAL}
      />
      <Vignette eskil={false} offset={0.2} darkness={0.85} />
    </EffectComposer>
  )
}
