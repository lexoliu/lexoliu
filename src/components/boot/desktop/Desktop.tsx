import { useMemo, useRef, useState } from 'react'
import { fonts, palette, type DesktopIcon, type PanelId, WINDOW_CONFIG } from '../shared'
import { DesktopIconCell } from './Icon'
import { ContextMenu, type MenuItem } from './Menu'
import { StartMenu } from './StartMenu'
import { Win95Window } from './Window'
import { Taskbar } from './Taskbar'
import { Dialog, type DialogState } from './Dialog'
import { AboutContent, GitHubContent, TravelContent, WaterUIContent } from '../content/panels'

interface DesktopProps {
  icons: DesktopIcon[]
  openPanels: PanelId[]
  onOpenPanel: (panel: PanelId) => void
  onClosePanel: (panel: PanelId) => void
  onFocusPanel: (panel: PanelId) => void
}

const PANEL_CONTENT: Record<PanelId, () => React.ReactNode> = {
  about: () => <AboutContent />,
  github: () => <GitHubContent />,
  travel: () => <TravelContent />,
  waterui: () => <WaterUIContent />,
}

/**
 * The full Win95 desktop experience: icons, taskbar, start menu, draggable
 * windows, context menus and dialogs. Lives entirely inside the CRT's HTML
 * overlay.
 */
export function Desktop({ icons, openPanels, onOpenPanel, onClosePanel, onFocusPanel }: DesktopProps) {
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; iconId?: string } | null>(null)
  const [minimized, setMinimized] = useState<PanelId[]>([])
  const [startOpen, setStartOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const desktopRef = useRef<HTMLDivElement>(null)

  const isMinimized = (panel: PanelId) => minimized.includes(panel)
  const topPanel = openPanels.length ? openPanels[openPanels.length - 1] : null

  const handleDesktopClick = () => {
    setSelectedIcon(null)
    setContextMenu(null)
    setStartOpen(false)
  }

  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
    setStartOpen(false)
  }

  const handleTaskbarClick = (panel: PanelId) => {
    if (isMinimized(panel)) {
      setMinimized((m) => m.filter((p) => p !== panel))
      onFocusPanel(panel)
      return
    }
    if (topPanel === panel) {
      setMinimized((m) => [...m, panel])
    } else {
      onFocusPanel(panel)
    }
  }

  const contextMenuItems: MenuItem[] = useMemo(() => {
    if (!contextMenu) return []
    if (contextMenu.iconId) {
      const icon = icons.find((i) => i.id === contextMenu.iconId)
      return [
        { label: 'Open', onClick: () => icon?.action() },
        { label: 'Properties', onClick: () => {}, disabled: true },
      ]
    }
    return [
      { label: 'Arrange Icons', onClick: () => {}, disabled: true },
      { label: 'Refresh', onClick: () => window.location.reload() },
      { label: 'Properties', onClick: () => {}, disabled: true },
    ]
  }, [contextMenu, icons])

  return (
    <div
      ref={desktopRef}
      style={{
        width: '100%',
        height: '100%',
        background: palette.desktopTeal,
        margin: '-24px',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={handleDesktopClick}
      onContextMenu={handleDesktopContextMenu}
    >
      <div style={{ flex: 1, padding: '8px', position: 'relative' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 70px)',
          gap: '4px',
          alignContent: 'start',
        }}>
          {icons.map((icon) => (
            <DesktopIconCell
              key={icon.id}
              icon={icon.icon}
              name={icon.name}
              selected={selectedIcon === icon.id}
              onSelect={() => setSelectedIcon(icon.id)}
              onActivate={icon.action}
              onContextMenu={(x, y) => {
                setSelectedIcon(icon.id)
                setContextMenu({ x, y, iconId: icon.id })
                setStartOpen(false)
              }}
            />
          ))}
        </div>
        <Watermark />
      </div>

      <Taskbar
        openPanels={openPanels}
        topPanel={topPanel}
        isMinimized={isMinimized}
        onTaskbarClick={handleTaskbarClick}
        onStartClick={(e) => {
          e.stopPropagation()
          setStartOpen((o) => !o)
          setContextMenu(null)
        }}
        startActive={startOpen}
        startMenu={
          startOpen ? (
            <StartMenu
              onClose={() => setStartOpen(false)}
              onOpenPanel={onOpenPanel}
              onShowDialog={setDialog}
            />
          ) : null
        }
      />

      {openPanels.map((panel, index) => {
        if (isMinimized(panel)) return null
        const config = WINDOW_CONFIG[panel]
        return (
          <Win95Window
            key={panel}
            title={config.title}
            initialX={config.initialX}
            initialY={config.initialY}
            zIndex={100 + index}
            onClose={() => onClosePanel(panel)}
            onMinimize={() => setMinimized((m) => [...m, panel])}
            onFocus={() => onFocusPanel(panel)}
            onShowDialog={setDialog}
          >
            {PANEL_CONTENT[panel]()}
          </Win95Window>
        )
      })}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {dialog && (
        <Dialog
          state={dialog}
          onResolve={(ok) => {
            if (ok) dialog.onOk()
            else dialog.onCancel?.()
            setDialog(null)
          }}
        />
      )}
    </div>
  )
}

function Watermark() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        color: 'rgba(26, 26, 46, 0.12)',
        fontSize: '52px',
        fontFamily: `var(--font-chocolate, "Brush Script MT", ${fonts.body})`,
        fontWeight: 100,
      }}>
        Lexo
      </div>
    </div>
  )
}
