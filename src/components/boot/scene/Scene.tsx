import { ContactShadows } from '@react-three/drei'
import type { DesktopIcon, PanelId, Phase } from '../shared'
import { CameraRig } from './CameraRig'
import { Lighting } from './Lighting'
import { Room } from './Room'
import { Bookshelf } from './Bookshelf'
import { WorldMap, NightWindow } from './WallDecor'
import { DeskLamp } from './DeskLamp'
import { CeilingLight, WallSwitch } from './CeilingLight'
import { Plant } from './Plant'
import { DeskAccessories } from './DeskAccessories'
import { CoffeeMug } from './CoffeeMug'
import { CRTMonitor } from './CRTMonitor'
import { DustMotes } from './Atmosphere'

interface SceneProps {
  phase: Phase
  biosLines: number
  bootLines: number
  loadingProgress: number
  scrollProgress: number
  icons: DesktopIcon[]
  lampOn: boolean
  computerOn: boolean
  openPanels: PanelId[]
  onToggleLamp: () => void
  onTogglePower: () => void
  onOpenPanel: (panel: PanelId) => void
  onClosePanel: (panel: PanelId) => void
  onFocusPanel: (panel: PanelId) => void
}

/** Top-level composition of every 3D element in the room. */
export function Scene(props: SceneProps) {
  return (
    <>
      <CameraRig scrollProgress={props.scrollProgress} />
      <Lighting lampOn={props.lampOn} computerOn={props.computerOn} phase={props.phase} />

      <Room />
      <Bookshelf />
      <WorldMap />
      <NightWindow />
      <Plant />
      <CoffeeMug />
      <DeskAccessories />
      <DeskLamp on={props.lampOn} onToggle={props.onToggleLamp} />
      <CeilingLight on={props.lampOn} onToggle={props.onToggleLamp} />
      <WallSwitch on={props.lampOn} onToggle={props.onToggleLamp} />
      <DustMotes visible={props.lampOn} />

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
      />
    </>
  )
}
