import { useState } from 'react'
import { Html, RoundedBox, useCursor } from '@react-three/drei'
import { fonts, palette, type Phase, type DesktopIcon, type PanelId } from '../shared'
import { BootScreen } from './BootScreen'
import { Desktop } from '../desktop/Desktop'

interface CRTMonitorProps {
  screenOn: boolean
  phase: Phase
  biosLines: number
  bootLines: number
  loadingProgress: number
  icons: DesktopIcon[]
  openPanels: PanelId[]
  onOpenPanel: (panel: PanelId) => void
  onClosePanel: (panel: PanelId) => void
  onFocusPanel: (panel: PanelId) => void
  onTogglePower: () => void
  onShutdown: () => void
}

const SCREEN_KEYFRAMES = `@keyframes lexoBlink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }`

/**
 * The 3D CRT monitor. Houses every screen phase as an HTML overlay. Power
 * button on the bezel is a clickable hitbox that toggles the screen on/off.
 * Kept perfectly still so on-screen text stays readable when zoomed-in.
 */
export function CRTMonitor({
  screenOn,
  phase,
  biosLines,
  bootLines,
  loadingProgress,
  icons,
  openPanels,
  onOpenPanel,
  onClosePanel,
  onFocusPanel,
  onTogglePower,
  onShutdown,
}: CRTMonitorProps) {
  return (
    <group scale={0.66} position={[0, -0.776, -0.4]}>
      <MonitorShell />
      <ScreenSurface
        screenOn={screenOn}
        phase={phase}
        biosLines={biosLines}
        bootLines={bootLines}
        loadingProgress={loadingProgress}
        icons={icons}
        openPanels={openPanels}
        onOpenPanel={onOpenPanel}
        onClosePanel={onClosePanel}
        onFocusPanel={onFocusPanel}
        onShutdown={onShutdown}
      />
      <ControlPanel screenOn={screenOn} onTogglePower={onTogglePower} />
    </group>
  )
}

function MonitorShell() {
  return (
    <>
      {/* Front bezel */}
      <RoundedBox args={[4.2, 3.4, 0.35]} radius={0.1} position={[0, 0, 0.82]}>
        <meshStandardMaterial color="#d4cfc4" roughness={0.7} metalness={0.05} />
      </RoundedBox>

      {/* Inset screen frame */}
      <mesh position={[0, 0.12, 0.995]}>
        <boxGeometry args={[3.5, 2.6, 0.02]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} />
      </mesh>

      {/* Body */}
      <mesh position={[0, -0.05, -0.55]}>
        <boxGeometry args={[4, 3.2, 2.4]} />
        <meshStandardMaterial color="#c8c3b8" roughness={0.85} metalness={0.02} />
      </mesh>

      {/* Side panels for depth */}
      {[2.05, -2.05].map((x, i) => (
        <mesh key={i} position={[x, -0.05, -0.55]}>
          <boxGeometry args={[0.1, 3.2, 2.4]} />
          <meshStandardMaterial color="#c0bbb0" roughness={0.85} />
        </mesh>
      ))}

      {/* Top */}
      <mesh position={[0, 1.55, -0.55]}>
        <boxGeometry args={[4, 0.1, 2.4]} />
        <meshStandardMaterial color="#d0cbc0" roughness={0.8} />
      </mesh>

      {/* Back panel */}
      <mesh position={[0, 0, -1.8]}>
        <boxGeometry args={[3.4, 2.8, 0.1]} />
        <meshStandardMaterial color="#a8a398" roughness={0.9} />
      </mesh>

      {/* Vents */}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[0, 0.7 - i * 0.25, -1.82]}>
          <boxGeometry args={[2.2, 0.08, 0.02]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      ))}

      {/* Stand — top meets body bottom (body bottom local y = -0.05 - 1.6 = -1.65,
          so stand top = -1.65, stand center y = -1.79). Z must match body
          (body center z=-0.55, depth 2.4) so the stand doesn't poke out past
          the front bezel and crash into the keyboard on the desk. */}
      <mesh position={[0, -1.79, -0.55]}>
        <boxGeometry args={[3.6, 0.28, 2.4]} />
        <meshStandardMaterial color="#b8b3a8" roughness={0.8} />
      </mesh>
    </>
  )
}

interface ScreenSurfaceProps {
  screenOn: boolean
  phase: Phase
  biosLines: number
  bootLines: number
  loadingProgress: number
  icons: DesktopIcon[]
  openPanels: PanelId[]
  onOpenPanel: (panel: PanelId) => void
  onClosePanel: (panel: PanelId) => void
  onFocusPanel: (panel: PanelId) => void
  onShutdown: () => void
}

function ScreenSurface({
  screenOn,
  phase,
  biosLines,
  bootLines,
  loadingProgress,
  icons,
  openPanels,
  onOpenPanel,
  onClosePanel,
  onFocusPanel,
  onShutdown,
}: ScreenSurfaceProps) {
  return (
    <>
      {/* Glass plane */}
      <mesh position={[0, 0.12, 1.01]}>
        <planeGeometry args={[3.4, 2.5]} />
        <meshBasicMaterial color={screenOn ? palette.screenOn : palette.screenOff} toneMapped={false} />
      </mesh>

      {/* Screen content */}
      <Html
        transform
        position={[0, 0.1, 1.025]}
        distanceFactor={1.7}
        style={{
          width: '680px',
          height: '500px',
          background: screenOn ? palette.screenOn : palette.screenOff,
          overflow: 'hidden',
          position: 'relative',
          fontFamily: fonts.mono,
          fontSize: '13px',
          lineHeight: '1.35',
        }}
      >
        {phase === 'desktop' && screenOn ? (
          /* Desktop fills the full screen (680x500). Windows can now maximize
             to the entire screen area (minus the taskbar) without negative-
             margin hacks. */
          <Desktop
            icons={icons}
            openPanels={openPanels}
            onOpenPanel={onOpenPanel}
            onClosePanel={onClosePanel}
            onFocusPanel={onFocusPanel}
            onShutdown={onShutdown}
          />
        ) : (
          /* Boot/BIOS/loading content gets a CRT-safe inner padding so text
             doesn't run all the way to the bezel. */
          <div style={{
            width: '100%',
            height: '100%',
            padding: '20px',
            position: 'relative',
            boxSizing: 'border-box',
          }}>
            <BootScreen
              phase={phase}
              biosLines={biosLines}
              bootLines={bootLines}
              loadingProgress={loadingProgress}
              screenOn={screenOn}
            />
          </div>
        )}
        <CrtFx />
        <style>{SCREEN_KEYFRAMES}</style>
      </Html>
    </>
  )
}

/**
 * Scanlines + radial vignette + slight green channel offset to evoke a real
 * CRT phosphor mask. Fully decorative; ignores pointer events.
 */
function CrtFx() {
  return (
    <>
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.10) 2px, rgba(0,0,0,0.10) 4px)',
        zIndex: 10,
        mixBlendMode: 'multiply',
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 55%, rgba(0,0,0,0.4) 100%)',
        zIndex: 11,
      }} />
    </>
  )
}

interface ControlPanelProps {
  screenOn: boolean
  onTogglePower: () => void
}

function ControlPanel({ screenOn, onTogglePower }: ControlPanelProps) {
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const ledColor = screenOn ? palette.led : palette.ledOff

  return (
    <>
      <mesh position={[0, -1.55, 0.92]}>
        <boxGeometry args={[4, 0.4, 0.18]} />
        <meshStandardMaterial color="#a8a398" roughness={0.75} />
      </mesh>
      {/* Brand label */}
      <mesh position={[0, -1.55, 1.02]}>
        <planeGeometry args={[0.8, 0.15]} />
        <meshBasicMaterial color="#909090" />
      </mesh>
      {/* LED */}
      <mesh position={[1.15, -1.55, 1.02]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshBasicMaterial color={ledColor} toneMapped={false} />
      </mesh>
      {screenOn && (
        <pointLight position={[1.15, -1.55, 1.1]} intensity={0.4} color={palette.ledGlow} distance={0.6} />
      )}
      {/* Power button */}
      <mesh
        position={[1.5, -1.55, 1.02]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true) }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => { e.stopPropagation(); onTogglePower() }}
      >
        <cylinderGeometry args={[0.14, 0.14, 0.06, 24]} />
        <meshStandardMaterial color={hover ? '#5a5a5a' : '#3a3a3a'} roughness={0.4} />
      </mesh>
    </>
  )
}

