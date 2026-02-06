import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, RoundedBox, Text } from '@react-three/drei'
import * as THREE from 'three'

interface BootSequence3DProps {
  onComplete: () => void
  scrollProgress?: number // 0 = room view, 1 = fullscreen CRT
}

type Phase = 'startup' | 'bios' | 'boot' | 'loading' | 'desktop'

const BIOS_LINES = [
  'LEXO BIOS (C) 2024 Lexo Industries',
  'BIOS Date: 01/01/24  Ver: 1.0.0',
  '',
  'CPU: Curiosity Core @ ∞ Hz',
  'Memory Test: 16384K OK',
  '',
  'Detecting IDE Primary Master... [Imagination SSD]',
  'Detecting IDE Primary Slave... None',
  '',
  'Press DEL to enter SETUP, F8 for Boot Menu',
]

const BOOT_LINES = [
  'Starting LEXO.SYS...',
  '',
  'Loading system drivers:',
  '  rust.sys .............. OK',
  '  creativity.sys ........ OK',
  '  wanderlust.sys ........ OK',
  '  coffee.sys ............ [!] LOW CAFFEINE',
  '',
  'Initializing personality matrix...',
  'Starting desktop environment...',
]

// Camera positions
const ROOM_VIEW = {
  position: new THREE.Vector3(3, 1, 10),
  lookAt: new THREE.Vector3(-0.5, -0.8, -1),
}
const SCREEN_VIEW = {
  position: new THREE.Vector3(0, 0.12, 3.2),
  lookAt: new THREE.Vector3(0, 0.12, 1),
}

// Camera controller - interpolates between room view and screen close-up
function CameraRig({ scrollProgress = 0 }: { scrollProgress: number }) {
  const { camera } = useThree()

  useFrame(() => {
    // Smooth easing for the scroll progress
    const t = Math.min(1, Math.max(0, scrollProgress))
    const eased = t * t * (3 - 2 * t) // smoothstep

    // Interpolate position
    camera.position.lerpVectors(ROOM_VIEW.position, SCREEN_VIEW.position, eased)

    // Interpolate look-at target
    const lookAtTarget = new THREE.Vector3().lerpVectors(ROOM_VIEW.lookAt, SCREEN_VIEW.lookAt, eased)
    camera.lookAt(lookAtTarget)
  })

  return null
}

// Full 3D CRT Monitor with screen content
function CRTMonitor3D({
  screenOn,
  biosLines,
  bootLines,
  loadingProgress,
  phase
}: {
  screenOn: boolean
  biosLines: number
  bootLines: number
  loadingProgress: number
  phase: Phase
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.025
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.02
    }
  })

  return (
    <group ref={groupRef}>
      {/* ===== MONITOR FRONT ===== */}
      {/* Front bezel - cream/beige color */}
      <RoundedBox args={[4.2, 3.4, 0.35]} radius={0.1} position={[0, 0, 0.82]}>
        <meshStandardMaterial color="#d4cfc4" roughness={0.75} metalness={0.05} />
      </RoundedBox>

      {/* Screen frame (dark inset) */}
      <mesh position={[0, 0.12, 0.995]}>
        <boxGeometry args={[3.5, 2.6, 0.02]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} />
      </mesh>

      {/* Screen glass surface */}
      <mesh position={[0, 0.12, 1.01]}>
        <planeGeometry args={[3.4, 2.5]} />
        <meshBasicMaterial color={screenOn ? "#0a0a0a" : "#030303"} />
      </mesh>

      {/* Screen content via HTML overlay - fills the CRT screen */}
      <Html
        transform
        position={[0, 0.1, 1.025]}
        distanceFactor={1.7}
        style={{
          width: '680px',
          height: '500px',
          background: screenOn ? '#0a0a0a' : '#020202',
          overflow: 'hidden',
        }}
      >
        <div style={{
          width: '100%',
          height: '100%',
          padding: '20px',
          fontFamily: '"Courier New", monospace',
          fontSize: '13px',
          lineHeight: '1.35',
          position: 'relative',
          boxSizing: 'border-box',
        }}>
          {/* BIOS Phase */}
          {phase === 'bios' && (
            <div style={{ color: '#aaaaaa' }}>
              {BIOS_LINES.slice(0, biosLines).map((line, i) => (
                <div key={i} style={{ color: i === 0 ? '#ffffff' : '#aaaaaa' }}>
                  {line || '\u00A0'}
                </div>
              ))}
              {biosLines < BIOS_LINES.length && (
                <span style={{
                  display: 'inline-block',
                  width: '10px',
                  height: '16px',
                  background: '#aaaaaa',
                  animation: 'blink 1s step-end infinite',
                }} />
              )}
            </div>
          )}

          {/* Boot Phase */}
          {(phase === 'boot' || phase === 'loading') && (
            <div>
              <div style={{ color: '#33ff33' }}>
                {BOOT_LINES.slice(0, bootLines).map((line, i) => (
                  <div key={i} style={{
                    color: line.includes('[!]') ? '#E85D4C' : '#33ff33'
                  }}>
                    {line || '\u00A0'}
                  </div>
                ))}
              </div>

              {phase === 'loading' && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{
                    color: '#5A9A9A',
                    textAlign: 'center',
                    marginBottom: '8px',
                    fontSize: '13px',
                  }}>
                    Starting LEXO Desktop...
                  </div>
                  <div style={{
                    height: '18px',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${loadingProgress}%`,
                      background: 'linear-gradient(90deg, #5A9A9A, #7ABABA)',
                      transition: 'width 0.1s ease-out',
                    }} />
                  </div>
                  <div style={{
                    color: '#555',
                    textAlign: 'center',
                    marginTop: '6px',
                    fontSize: '12px'
                  }}>
                    {Math.floor(loadingProgress)}%
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Desktop Phase */}
          {phase === 'desktop' && (
            <div style={{
              width: '100%',
              height: '100%',
              background: '#5A9A9A',
              margin: '-24px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Mini status window */}
              <div style={{
                width: '130px',
                background: '#d4d0c8',
                boxShadow: 'inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf',
              }}>
                <div style={{
                  height: '18px',
                  background: '#000080',
                  padding: '0 4px',
                  color: 'white',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  status.txt
                </div>
                <div style={{ padding: '4px 6px', fontSize: '10px' }}>
                  <div style={{ color: '#000080' }}>MODE: ACTIVE</div>
                  <div style={{ color: '#808080' }}>LANG: RUST</div>
                  <div style={{ color: '#808080' }}>LOC: CHINA</div>
                </div>
              </div>

              {/* Center Lexo */}
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{
                  color: '#1a1a2e',
                  fontSize: '52px',
                  fontFamily: 'var(--font-chocolate, "Brush Script MT", cursive)',
                  fontWeight: 100,
                }}>
                  Lexo
                </div>
              </div>

              {/* Taskbar */}
              <div style={{
                height: '28px',
                background: '#d4d0c8',
                marginLeft: '-16px',
                marginRight: '-16px',
                marginBottom: '-16px',
                display: 'flex',
                alignItems: 'center',
                padding: '0 4px',
                boxShadow: 'inset 0 1px #ffffff',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 10px',
                  background: '#d4d0c8',
                  boxShadow: 'inset -1px -1px #0a0a0a, inset 1px 1px #ffffff',
                  fontSize: '11px',
                  fontWeight: 'bold',
                }}>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1px',
                  }}>
                    <div style={{ background: '#ff0000' }} />
                    <div style={{ background: '#00ff00' }} />
                    <div style={{ background: '#0000ff' }} />
                    <div style={{ background: '#ffff00' }} />
                  </div>
                  Start
                </div>
              </div>
            </div>
          )}

          {/* CRT scanlines overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
            zIndex: 10,
          }} />

          {/* CRT vignette */}
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.35) 100%)',
            zIndex: 11,
          }} />

          <style>{`
            @keyframes blink {
              0%, 50% { opacity: 1; }
              51%, 100% { opacity: 0; }
            }
          `}</style>
        </div>
      </Html>

      {/* ===== MONITOR BODY (THE BIG BACK) ===== */}
      {/* Main CRT body */}
      <mesh position={[0, -0.05, -0.55]}>
        <boxGeometry args={[4, 3.2, 2.4]} />
        <meshStandardMaterial color="#c8c3b8" roughness={0.85} metalness={0.02} />
      </mesh>

      {/* Back panel */}
      <mesh position={[0, 0, -1.8]}>
        <boxGeometry args={[3.4, 2.8, 0.1]} />
        <meshStandardMaterial color="#a8a398" roughness={0.9} />
      </mesh>

      {/* Ventilation slots on back */}
      {[...Array(7)].map((_, i) => (
        <mesh key={i} position={[0, 0.7 - i * 0.25, -1.82]}>
          <boxGeometry args={[2.2, 0.08, 0.02]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      ))}

      {/* ===== MONITOR BASE/STAND ===== */}
      <mesh position={[0, -1.9, 0.15]}>
        <boxGeometry args={[3.6, 0.28, 1.8]} />
        <meshStandardMaterial color="#b8b3a8" roughness={0.8} />
      </mesh>

      {/* Front control panel */}
      <mesh position={[0, -1.55, 0.92]}>
        <boxGeometry args={[4, 0.4, 0.18]} />
        <meshStandardMaterial color="#a8a398" roughness={0.75} />
      </mesh>

      {/* Power button */}
      <mesh position={[1.5, -1.55, 1.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.05, 20]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.4} />
      </mesh>

      {/* Power LED */}
      <mesh position={[1.15, -1.55, 1.02]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshBasicMaterial color={screenOn ? "#33ff33" : "#333333"} />
      </mesh>
      {/* LED glow */}
      {screenOn && (
        <pointLight position={[1.15, -1.55, 1.1]} intensity={0.3} color="#33ff33" distance={0.5} />
      )}

      {/* Brand label */}
      <mesh position={[0, -1.55, 1.02]}>
        <planeGeometry args={[0.8, 0.15]} />
        <meshBasicMaterial color="#909090" />
      </mesh>

      {/* Side panels for depth */}
      <mesh position={[2.05, -0.05, -0.55]}>
        <boxGeometry args={[0.1, 3.2, 2.4]} />
        <meshStandardMaterial color="#c0bbb0" roughness={0.85} />
      </mesh>
      <mesh position={[-2.05, -0.05, -0.55]}>
        <boxGeometry args={[0.1, 3.2, 2.4]} />
        <meshStandardMaterial color="#c0bbb0" roughness={0.85} />
      </mesh>

      {/* Top panel */}
      <mesh position={[0, 1.55, -0.55]}>
        <boxGeometry args={[4, 0.1, 2.4]} />
        <meshStandardMaterial color="#d0cbc0" roughness={0.8} />
      </mesh>
    </group>
  )
}

// Main 3D Scene - cozy room with desk and CRT
function Scene({ phase, biosLines, bootLines, loadingProgress, scrollProgress }: {
  phase: Phase
  biosLines: number
  bootLines: number
  loadingProgress: number
  scrollProgress: number
}) {
  return (
    <>
      <CameraRig scrollProgress={scrollProgress} />

      {/* Room ambient - bright enough to see everything */}
      <ambientLight intensity={1.2} color="#665550" />

      {/* Main room light from above - bright */}
      <pointLight
        position={[0, 5, 3]}
        intensity={3}
        color="#fff5ee"
        distance={20}
      />

      {/* Desk lamp - warm accent light */}
      <pointLight
        position={[2.5, 0, 0.5]}
        intensity={3}
        color="#ffdd88"
        distance={8}
      />

      {/* Fill light from left side */}
      <pointLight
        position={[-4, 2, 4]}
        intensity={1.5}
        color="#bbaa99"
        distance={15}
      />

      {/* Fill light from camera side */}
      <pointLight
        position={[5, 1, 10]}
        intensity={1}
        color="#998877"
        distance={15}
      />

      {/* Screen glow when on */}
      {phase !== 'startup' && (
        <pointLight position={[0, 0, 2.5]} intensity={1} color="#5A9A9A" distance={10} />
      )}

      {/* ===== ROOM ENVIRONMENT ===== */}
      {/* Floor - dark wood */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]} receiveShadow>
        <planeGeometry args={[20, 15]} />
        <meshStandardMaterial color="#1a1410" roughness={0.85} />
      </mesh>

      {/* Back wall - positioned to fill the view */}
      <mesh position={[-2, 2, -3.5]}>
        <planeGeometry args={[30, 15]} />
        <meshStandardMaterial color="#1a1520" roughness={0.9} />
      </mesh>

      {/* ===== DESK ===== */}
      {/* Desktop surface - warm wood */}
      <mesh position={[0, -2.05, -0.5]} receiveShadow>
        <boxGeometry args={[6, 0.12, 3]} />
        <meshStandardMaterial color="#5a4535" roughness={0.75} />
      </mesh>
      {/* Desk front edge */}
      <mesh position={[0, -2.15, 1]}>
        <boxGeometry args={[6, 0.08, 0.15]} />
        <meshStandardMaterial color="#4d3a2a" roughness={0.8} />
      </mesh>
      {/* Desk legs */}
      {[[-2.7, -2.5, -1.8], [2.7, -2.5, -1.8], [-2.7, -2.5, 0.7], [2.7, -2.5, 0.7]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <boxGeometry args={[0.1, 0.9, 0.1]} />
          <meshStandardMaterial color="#3d2d20" roughness={0.85} />
        </mesh>
      ))}

      {/* ===== DESK LAMP ===== */}
      <group position={[2.5, -2.05, 0.3]}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.2, 0.25, 0.1, 16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.8, 0]} rotation={[0, 0, -0.15]}>
          <cylinderGeometry args={[0.02, 0.02, 1.4, 8]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.8} />
        </mesh>
        <mesh position={[-0.15, 1.4, 0]} rotation={[0.2, 0, -0.2]}>
          <coneGeometry args={[0.25, 0.35, 16, 1, true]} />
          <meshStandardMaterial color="#2d2d2d" roughness={0.5} metalness={0.6} side={2} />
        </mesh>
        <pointLight position={[-0.15, 1.3, 0]} intensity={1.2} color="#ffdd99" distance={3} />
      </group>

      {/* ===== DECORATIONS ===== */}
      {/* Coffee mug */}
      <group position={[-2, -1.99, 0.5]}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.1, 0.2, 16]} />
          <meshStandardMaterial color="#e8e0d5" roughness={0.4} />
        </mesh>
        <mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.08, 0.02, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#e8e0d5" roughness={0.4} />
        </mesh>
      </group>

      {/* Book stack on left */}
      <group position={[-2.2, -1.93, -0.8]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.5, 0.08, 0.35]} />
          <meshStandardMaterial color="#8b4513" roughness={0.9} />
        </mesh>
        <mesh position={[0.02, 0.08, 0]}>
          <boxGeometry args={[0.45, 0.06, 0.32]} />
          <meshStandardMaterial color="#2d4a3e" roughness={0.9} />
        </mesh>
        <mesh position={[-0.02, 0.15, 0]}>
          <boxGeometry args={[0.48, 0.05, 0.34]} />
          <meshStandardMaterial color="#4a3c5a" roughness={0.9} />
        </mesh>
      </group>

      {/* Small plant on right */}
      <group position={[2.3, -1.93, -0.6]}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.1, 0.08, 0.16, 8]} />
          <meshStandardMaterial color="#8b5a2b" roughness={0.8} />
        </mesh>
        {/* Leaves */}
        {[0, 0.8, 1.6, 2.4, 3.2].map((angle, i) => (
          <mesh key={i} position={[Math.cos(angle) * 0.06, 0.2 + i * 0.03, Math.sin(angle) * 0.06]} rotation={[0.3, angle, 0.2]}>
            <planeGeometry args={[0.08, 0.15]} />
            <meshStandardMaterial color="#3a5a3a" roughness={0.8} side={2} />
          </mesh>
        ))}
      </group>

      {/* The CRT Monitor */}
      <CRTMonitor3D
        screenOn={phase !== 'startup'}
        biosLines={biosLines}
        bootLines={bootLines}
        loadingProgress={loadingProgress}
        phase={phase}
      />
    </>
  )
}

export function BootSequence3D({ onComplete, scrollProgress = 0 }: BootSequence3DProps) {
  const [phase, setPhase] = useState<Phase>('startup')
  const [biosLine, setBiosLine] = useState(0)
  const [bootLine, setBootLine] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)


  const nextPhase = useCallback((next: Phase, delay: number = 0) => {
    setTimeout(() => setPhase(next), delay)
  }, [])

  // Phase: startup -> bios
  useEffect(() => {
    if (phase === 'startup') nextPhase('bios', 1500)
  }, [phase, nextPhase])

  // Phase: bios text animation
  useEffect(() => {
    if (phase !== 'bios') return
    if (biosLine >= BIOS_LINES.length) {
      nextPhase('boot', 600)
      return
    }
    const timer = setTimeout(() => setBiosLine(prev => prev + 1), 100)
    return () => clearTimeout(timer)
  }, [phase, biosLine, nextPhase])

  // Phase: boot text animation
  useEffect(() => {
    if (phase !== 'boot') return
    if (bootLine >= BOOT_LINES.length) {
      nextPhase('loading', 250)
      return
    }
    const timer = setTimeout(() => setBootLine(prev => prev + 1), 130)
    return () => clearTimeout(timer)
  }, [phase, bootLine, nextPhase])

  // Phase: loading bar
  useEffect(() => {
    if (phase !== 'loading') return
    if (loadingProgress >= 100) {
      nextPhase('desktop', 350)
      return
    }
    const increment = Math.random() * 12 + 4
    const delay = Math.random() * 70 + 35
    const timer = setTimeout(() => {
      setLoadingProgress(prev => Math.min(prev + increment, 100))
    }, delay)
    return () => clearTimeout(timer)
  }, [phase, loadingProgress, nextPhase])

  // Phase: desktop reached - call onComplete to enable scrolling
  useEffect(() => {
    if (phase === 'desktop') {
      // Small delay then allow scrolling
      const timer = setTimeout(onComplete, 500)
      return () => clearTimeout(timer)
    }
  }, [phase, onComplete])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      background: '#0a0a0f',
    }}>
      <Canvas
        camera={{ position: [3, 1, 10], fov: 45 }}
        shadows
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <Scene
            phase={phase}
            biosLines={biosLine}
            bootLines={bootLine}
            loadingProgress={loadingProgress}
            scrollProgress={scrollProgress}
          />
        </Suspense>
      </Canvas>

      {/* Skip button during boot - skips directly to desktop */}
      {phase !== 'desktop' && phase !== 'startup' && (
        <button
          onClick={() => setPhase('desktop')}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            color: 'rgba(255,255,255,0.2)',
            fontSize: '11px',
            fontFamily: 'monospace',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
        >
          [SKIP]
        </button>
      )}

      {/* Subtle vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
      }} />
    </div>
  )
}
