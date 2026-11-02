import { ContactShadows } from '@react-three/drei'
import type { DesktopIcon, PanelId, Phase } from '../shared'
import { CameraRig } from './CameraRig'
import { Lighting } from './Lighting'
import { Room } from './Room'
import { Bookshelf } from './Bookshelf'
import { WorldMap, NightWindow, DormPoster } from './WallDecor'
import { DeskLamp } from './DeskLamp'
import { CeilingLight, WallSwitch } from './CeilingLight'
import { Plant } from './Plant'
import { DeskAccessories } from './DeskAccessories'
import { CoffeeMug } from './CoffeeMug'
import { CRTMonitor } from './CRTMonitor'
import { PostProcessing, SceneEnvironment } from './Atmosphere'

interface SceneProps {
  phase: Phase
  biosLines: number
  bootLines: number
  loadingProgress: number
  scrollProgress: number
  icons: DesktopIcon[]
  deskLampOn: boolean
  ceilingLampOn: boolean
  computerOn: boolean
  openPanels: PanelId[]
  onToggleDeskLamp: () => void
  onToggleCeilingLamp: () => void
  onTogglePower: () => void
  onShutdown: () => void
  onOpenPanel: (panel: PanelId) => void
  onClosePanel: (panel: PanelId) => void
  onFocusPanel: (panel: PanelId) => void
}

/** Top-level composition of every 3D element in the room. */
export function Scene(props: SceneProps) {
  // "Any light on" drives the warm-vs-cool fog/IBL split; either lamp
  // counts as "lit room".
  const anyLightOn = props.deskLampOn || props.ceilingLampOn
  return (
    <>
      {/* Subtle haze so the back wall recedes — colour matches the deepest
          wall tone so it never reads as grey fog, just air. */}
      <fog attach="fog" args={[anyLightOn ? '#1c130c' : '#0e1422', 10, 22]} />

      <CameraRig scrollProgress={props.scrollProgress} />
      <Lighting
        deskLampOn={props.deskLampOn}
        ceilingLampOn={props.ceilingLampOn}
        computerOn={props.computerOn}
        phase={props.phase}
      />

      <SceneEnvironment deskLampOn={props.deskLampOn} ceilingLampOn={props.ceilingLampOn} />

      <Room />
      <Bookshelf />
      <WorldMap />
      <DormPoster />
      <NightWindow />
      <Plant />
      <CoffeeMug />
      <DeskAccessories />
      <DeskLamp on={props.deskLampOn} onToggle={props.onToggleDeskLamp} />
      <CeilingLight on={props.ceilingLampOn} onToggle={props.onToggleCeilingLamp} />
      <WallSwitch on={props.ceilingLampOn} onToggle={props.onToggleCeilingLamp} />

      {/* Soft contact shadow under everything desk-height — anchors objects to the desktop. */}
      <ContactShadows
        position={[0, -1.99, -0.3]}
        opacity={0.4}
        scale={6}
        blur={2.4}
        far={1.5}
        resolution={512}
        color="#000000"
      />

      <CRTMonitor
        screenOn={props.computerOn && props.phase !== 'startup'}
        phase={props.phase}
        biosLines={props.biosLines}
        bootLines={props.bootLines}
        loadingProgress={props.loadingProgress}
        icons={props.icons}
        openPanels={props.openPanels}
        onOpenPanel={props.onOpenPanel}
        onClosePanel={props.onClosePanel}
        onFocusPanel={props.onFocusPanel}
        onTogglePower={props.onTogglePower}
        onShutdown={props.onShutdown}
      />

      <PostProcessing />
    </>
  )
}
