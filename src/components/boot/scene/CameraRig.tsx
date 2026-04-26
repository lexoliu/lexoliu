import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useRef } from 'react'

const ROOM_POSITION = new THREE.Vector3(3.6, 1.25, 9.4)
const ROOM_LOOKAT = new THREE.Vector3(-0.2, -1.0, -0.5)
const SCREEN_LOOKAT = new THREE.Vector3(0, 0, 0)
const SCREEN_BASE_Z = 5.5

/**
 * Smoothly lerps the camera between the cozy room view and the close-up CRT
 * view as the user scrolls. Reused per-frame buffers avoid GC churn.
 */
export function CameraRig({ scrollProgress }: { scrollProgress: number }) {
  const { camera, viewport } = useThree()
  const screenPos = useRef(new THREE.Vector3())
  const lookAt = useRef(new THREE.Vector3())

  useFrame(() => {
    const aspect = viewport.width / viewport.height
    screenPos.current.set(0, 0, screenZForAspect(aspect))

    const t = THREE.MathUtils.clamp(scrollProgress, 0, 1)
    const eased = t * t * (3 - 2 * t)

    camera.position.lerpVectors(ROOM_POSITION, screenPos.current, eased)
    lookAt.current.lerpVectors(ROOM_LOOKAT, SCREEN_LOOKAT, eased)
    camera.lookAt(lookAt.current)
  })

  return null
}

function screenZForAspect(aspect: number): number {
  if (aspect < 1) return SCREEN_BASE_Z + (1 - aspect) * 3
  if (aspect < 1.5) return SCREEN_BASE_Z + (1.5 - aspect) * 1.5
  if (aspect > 2) return SCREEN_BASE_Z - 0.3
  return SCREEN_BASE_Z
}
