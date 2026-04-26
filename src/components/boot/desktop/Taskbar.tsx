import { useState, type ReactNode } from 'react'
import { fonts, palette, type PanelId, PANEL_ICON, WINDOW_CONFIG, win95Style, TASKBAR_HEIGHT } from '../shared'
import { Win95IconImage } from './Icon'
import { SystemTray } from './Clock'

interface TaskbarProps {
  openPanels: PanelId[]
  topPanel: PanelId | null
  isMinimized: (panel: PanelId) => boolean
  onTaskbarClick: (panel: PanelId) => void
  onStartClick: (e: React.MouseEvent) => void
  startActive: boolean
  startMenu: ReactNode
}

export function Taskbar({
  openPanels,
  topPanel,
  isMinimized,
  onTaskbarClick,
  onStartClick,
  startActive,
  startMenu,
}: TaskbarProps) {
  return (
    <div style={{
      height: `${TASKBAR_HEIGHT}px`,
      background: palette.silver,
      display: 'flex',
      alignItems: 'center',
      padding: '2px',
      borderTop: `1px solid ${palette.borderHilight}`,
      gap: '2px',
      position: 'relative',
    }}>
      <StartButton onClick={onStartClick} active={startActive} />
      {startMenu}
      <Divider />
      {openPanels.map((panel) => (
        <TaskbarButton
          key={panel}
          panel={panel}
          isTop={topPanel === panel && !isMinimized(panel)}
          onClick={() => onTaskbarClick(panel)}
        />
      ))}
      <div style={{ flex: 1 }} />
      <SystemTray />
    </div>
  )
}

interface StartButtonProps {
  onClick: (e: React.MouseEvent) => void
  active: boolean
}

function StartButton({ onClick, active }: StartButtonProps) {
  const [pressed, setPressed] = useState(false)
  const sunken = pressed || active
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        ...(sunken ? win95Style.pressedButton : win95Style.raisedButton),
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        padding: '2px 6px 2px 3px',
        height: '22px',
        fontWeight: 'bold',
        color: palette.black,
      }}
    >
      <Win95IconImage type="windows-flag" size={18} />
      <span style={{ marginTop: '-1px' }}>Start</span>
    </button>
  )
}

function Divider() {
  return (
    <div style={{
      width: '2px',
      height: '22px',
      borderLeft: `1px solid ${palette.shadow}`,
      borderRight: `1px solid ${palette.hilight}`,
      margin: '0 2px',
    }} />
  )
}

interface TaskbarButtonProps {
  panel: PanelId
  isTop: boolean
  onClick: () => void
}

function TaskbarButton({ panel, isTop, onClick }: TaskbarButtonProps) {
  const config = WINDOW_CONFIG[panel]
  return (
    <button
      onClick={onClick}
      style={{
        ...(isTop ? win95Style.pressedButton : win95Style.raisedButton),
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        height: '22px',
        minWidth: '90px',
        maxWidth: '160px',
        fontFamily: fonts.win95,
        textAlign: 'left',
        color: palette.black,
      }}
    >
      <span style={{ width: '16px', height: '16px', flexShrink: 0 }}>
        <Win95IconImage type={PANEL_ICON[panel]} size={16} />
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {config.title.split(' - ')[0]}
      </span>
    </button>
  )
}
