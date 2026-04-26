import { useRef, useState, type ReactNode } from 'react'
import { fonts, palette, type PanelId, PANEL_ICON } from '../shared'
import { useClickOutside } from '../hooks/useClickOutside'
import { Win95IconImage } from './Icon'
import type { DialogState } from './Dialog'

interface StartMenuProps {
  onClose: () => void
  onOpenPanel: (panel: PanelId) => void
  onShowDialog: (dialog: DialogState) => void
}

interface MenuRow {
  id: string
  icon?: ReactNode
  label?: string
  hasSubmenu?: boolean
  divider?: boolean
  onClick?: () => void
}

const PROGRAMS_LABELS: Record<PanelId, string> = {
  about: 'About.exe',
  github: 'GitHub',
  travel: 'Travel.txt',
  waterui: 'WaterUI',
}

export function StartMenu({ onClose, onOpenPanel, onShowDialog }: StartMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClose)

  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  const showShutdownDialog = () => {
    onShowDialog({
      title: 'Shut Down Windows',
      message: 'Are you sure you want to shut down?',
      type: 'question',
      showCancel: true,
      onOk: () => window.location.reload(),
      onCancel: () => {},
    })
    onClose()
  }

  const showHelpDialog = () => {
    onShowDialog({
      title: 'About Lexo Desktop',
      message: 'Lexo Desktop v1.0\n\nBuilt with React + Three.js',
      type: 'info',
      showCancel: false,
      onOk: () => {},
    })
    onClose()
  }

  const items: MenuRow[] = [
    { id: 'programs', icon: <Win95IconImage type="programs" size={16} />, label: 'Programs', hasSubmenu: true },
    { id: 'documents', icon: <Win95IconImage type="documents" size={16} />, label: 'Documents', hasSubmenu: true },
    { id: 'settings', icon: <Win95IconImage type="settings" size={16} />, label: 'Settings', hasSubmenu: true },
    { id: 'find', icon: <Win95IconImage type="find" size={16} />, label: 'Find', hasSubmenu: true },
    { id: 'd1', divider: true },
    { id: 'help', icon: <Win95IconImage type="help" size={16} />, label: 'Help', onClick: showHelpDialog },
    { id: 'run', icon: <Win95IconImage type="run" size={16} />, label: 'Run...' },
    { id: 'd2', divider: true },
    { id: 'shutdown', icon: <Win95IconImage type="shutdown" size={16} />, label: 'Shut Down...', onClick: showShutdownDialog },
  ]

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: '28px',
        left: '2px',
        background: palette.silver,
        border: `2px outset ${palette.silver}`,
        boxShadow: '2px 2px 4px rgba(0,0,0,0.4)',
        minWidth: '170px',
        zIndex: 200,
        display: 'flex',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <StartBanner />
      <div style={{ flex: 1, padding: '2px' }}>
        {items.map((item) =>
          item.divider ? (
            <div
              key={item.id}
              style={{ height: '2px', margin: '3px 2px', borderTop: `1px solid ${palette.shadow}`, borderBottom: `1px solid ${palette.hilight}` }}
            />
          ) : (
            <div
              key={item.id}
              style={{ position: 'relative' }}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <StartMenuRow
                icon={item.icon}
                label={item.label ?? ''}
                hovered={hoveredItem === item.id}
                hasSubmenu={!!item.hasSubmenu}
                onClick={item.onClick}
              />
              {item.id === 'programs' && hoveredItem === 'programs' && (
                <ProgramsSubmenu
                  onSelect={(panel) => {
                    onOpenPanel(panel)
                    onClose()
                  }}
                />
              )}
            </div>
          ),
        )}
      </div>
    </div>
  )
}

function StartBanner() {
  return (
    <div style={{
      width: '21px',
      background: `linear-gradient(to top, ${palette.navy} 0%, ${palette.navyLight} 100%)`,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingBottom: '4px',
    }}>
      <span style={{
        color: palette.silver,
        fontSize: '18px',
        fontWeight: 'bold',
        fontFamily: 'Arial Black, Arial, sans-serif',
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        letterSpacing: '-1px',
        textShadow: `1px 1px 0 ${palette.black}`,
      }}>
        <span style={{ fontWeight: 'bold' }}>Lexo</span>
        <span style={{ fontWeight: 'normal', fontFamily: 'Arial, sans-serif', fontSize: '16px' }}>95</span>
      </span>
    </div>
  )
}

interface StartMenuRowProps {
  icon?: ReactNode
  label: string
  hovered: boolean
  hasSubmenu: boolean
  onClick?: () => void
}

function StartMenuRow({ icon, label, hovered, hasSubmenu, onClick }: StartMenuRowProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        width: '100%',
        padding: '3px 6px',
        background: hovered ? palette.navy : 'transparent',
        color: hovered ? palette.white : palette.black,
        border: 'none',
        textAlign: 'left',
        fontSize: '11px',
        fontFamily: fonts.win95,
        cursor: 'pointer',
      }}
    >
      <span style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {hasSubmenu && <span style={{ fontSize: '8px', marginRight: '4px' }}>▶</span>}
    </button>
  )
}

interface ProgramsSubmenuProps {
  onSelect: (panel: PanelId) => void
}

function ProgramsSubmenu({ onSelect }: ProgramsSubmenuProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '100%',
        top: '-2px',
        background: palette.silver,
        border: `2px outset ${palette.silver}`,
        boxShadow: '2px 2px 4px rgba(0,0,0,0.4)',
        minWidth: '150px',
        padding: '2px',
        zIndex: 201,
      }}
    >
      {(Object.keys(PROGRAMS_LABELS) as PanelId[]).map((panel) => (
        <SubmenuRow
          key={panel}
          label={PROGRAMS_LABELS[panel]}
          icon={<Win95IconImage type={PANEL_ICON[panel]} size={16} />}
          onClick={() => onSelect(panel)}
        />
      ))}
    </div>
  )
}

interface SubmenuRowProps {
  label: string
  icon: ReactNode
  onClick: () => void
}

function SubmenuRow({ label, icon, onClick }: SubmenuRowProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        width: '100%',
        padding: '3px 20px 3px 6px',
        background: hover ? palette.navy : 'transparent',
        color: hover ? palette.white : palette.black,
        border: 'none',
        textAlign: 'left',
        fontSize: '11px',
        fontFamily: fonts.win95,
        cursor: 'pointer',
      }}
    >
      <span style={{ width: '16px', height: '16px' }}>{icon}</span>
      {label}
    </button>
  )
}
