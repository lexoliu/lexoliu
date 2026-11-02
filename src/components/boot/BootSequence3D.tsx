import { Suspense, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import type { DesktopIcon, PanelId } from './shared'
import { useBootPhase } from './hooks/useBootPhase'
import { Scene } from './scene/Scene'

interface BootSequence3DProps {
  onComplete: () => void
  scrollProgress?: number
  onOpenPanel?: (panel: PanelId) => void
  onClosePanel?: (panel: PanelId) => void
  onFocusPanel?: (panel: PanelId) => void
  onToggleDeskLamp?: () => void
  onToggleCeilingLamp?: () => void
  onToggleMusic?: () => void
  deskLampOn?: boolean
  ceilingLampOn?: boolean
  openPanels?: PanelId[]
}

/**
 * The entire personal-page experience: a 3D lo-fi room with a CRT that boots
 * a Win95-style desktop. Phase progression is handled by the `useBootPhase`
 * hook; everything else lives inside `<Scene>`.
 */
export function BootSequence3D({
  onComplete,
  scrollProgress = 0,
  onOpenPanel,
  onClosePanel,
  onFocusPanel,
  onToggleDeskLamp,
  onToggleCeilingLamp,
  onToggleMusic,
  deskLampOn = true,
  ceilingLampOn = true,
  openPanels = [],
}: BootSequence3DProps) {
  const [computerOn, setComputerOn] = useState(true)
  const { phase, biosLines, bootLines, loadingProgress, skipToDesktop, requestShutdown, restart } =
    useBootPhase({ onComplete })

  // Power button: from "shutdown_safe" → restart boot. From any live state →
  // toggle the screen physically off (the BootScreen renders POWER OFF).
  const handlePowerButton = () => {
    if (phase === 'shutdown_safe') {
      restart()
      setComputerOn(true)
      return
    }
    setComputerOn((p) => !p)
  }

  const icons = useMemo<DesktopIcon[]>(() => [
    { id: 'about', name: 'ABOUT.exe', icon: 'folder', action: () => onOpenPanel?.('about') },
    { id: 'github', name: 'GitHub', icon: 'terminal', action: () => onOpenPanel?.('github') },
    { id: 'travel', name: 'Travel.txt', icon: 'map', action: () => onOpenPanel?.('travel') },
    { id: 'waterui', name: 'WaterUI', icon: 'droplet', action: () => onOpenPanel?.('waterui') },
    { id: 'music', name: 'Music', icon: 'speaker', action: () => onToggleMusic?.() },
  ], [onOpenPanel, onToggleMusic])

  const handlePanel = (cb?: (panel: PanelId) => void) => (panel: PanelId) => cb?.(panel)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: '#0b0a0c' }}>
      <Canvas
        camera={{ position: [3.6, 1.25, 9.4], fov: 45 }}
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
        onCreated={({ gl }) => { gl.toneMappingExposure = 1.3 }}
      >
        <Suspense fallback={null}>
          <Scene
            phase={phase}
            biosLines={biosLines}
            bootLines={bootLines}
            loadingProgress={loadingProgress}
            scrollProgress={scrollProgress}
            icons={icons}
            deskLampOn={deskLampOn}
            ceilingLampOn={ceilingLampOn}
            computerOn={computerOn}
            openPanels={openPanels}
            onToggleDeskLamp={() => onToggleDeskLamp?.()}
            onToggleCeilingLamp={() => onToggleCeilingLamp?.()}
            onShutdown={requestShutdown}
            onTogglePower={handlePowerButton}
            onOpenPanel={handlePanel(onOpenPanel)}
            onClosePanel={handlePanel(onClosePanel)}
            onFocusPanel={handlePanel(onFocusPanel)}
          />
        </Suspense>
      </Canvas>

      {phase !== 'desktop' && phase !== 'startup' && <SkipButton onClick={skipToDesktop} />}
      <Vignette />
    </div>
  )
}

function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        color: 'rgba(255,255,255,0.3)',
        fontSize: '11px',
        fontFamily: 'monospace',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
      }}
    >
      [SKIP]
    </button>
  )
}

function Vignette() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.45) 100%)',
    }} />
  )
}
