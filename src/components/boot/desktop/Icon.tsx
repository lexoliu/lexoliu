import { type CSSProperties } from 'react'
import { fonts, palette, type IconKind, ICON_KIND_TO_WIN95 } from '../shared'

const pixelated: CSSProperties = { imageRendering: 'pixelated' }

interface IconImageProps {
  type: string
  size?: number
}

/**
 * The classic Win95 SVG icon set used on the desktop, taskbar, start menu and
 * window title bars. Each entry is rendered at its native 32×32 (or 16×16 for
 * tiny icons) viewBox; the consumer scales via the `size` prop.
 */
export function Win95IconImage({ type, size = 32 }: IconImageProps) {
  switch (type) {
    case 'my-computer':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" style={pixelated}>
          <rect x="4" y="4" width="24" height="18" fill="#c0c0c0" />
          <rect x="5" y="5" width="22" height="16" fill="#000080" />
          <rect x="6" y="6" width="20" height="14" fill="#008080" />
          <rect x="10" y="22" width="12" height="2" fill="#808080" />
          <rect x="8" y="24" width="16" height="3" fill="#c0c0c0" />
          <path d="M4 4 L28 4 L27 5 L5 5 L5 21 L4 22 Z" fill="#dfdfdf" />
          <path d="M28 4 L28 22 L27 21 L27 5 Z" fill="#808080" />
          <path d="M4 22 L5 21 L27 21 L28 22 Z" fill="#404040" />
          <rect x="7" y="7" width="3" height="3" fill="rgba(255,255,255,0.3)" />
        </svg>
      )
    case 'msdos':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" style={pixelated}>
          <rect x="2" y="4" width="28" height="24" fill="#c0c0c0" />
          <rect x="3" y="5" width="26" height="22" fill="#000080" />
          <rect x="4" y="6" width="24" height="3" fill="#000080" />
          <rect x="4" y="10" width="24" height="16" fill="#000000" />
          <text x="6" y="18" fill="#c0c0c0" fontSize="6" fontFamily="monospace">{'C:\\>_'}</text>
          <path d="M2 4 L30 4 L29 5 L3 5 L3 27 L2 28 Z" fill="#dfdfdf" />
          <path d="M30 4 L30 28 L29 27 L29 5 Z" fill="#808080" />
        </svg>
      )
    case 'notepad':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" style={pixelated}>
          <rect x="6" y="4" width="20" height="24" fill="#ffffff" />
          <path d="M20 4 L26 10 L20 10 Z" fill="#c0c0c0" />
          <path d="M20 4 L26 10" stroke="#808080" strokeWidth="1" fill="none" />
          <line x1="8" y1="12" x2="18" y2="12" stroke="#000080" strokeWidth="1" />
          <line x1="8" y1="15" x2="22" y2="15" stroke="#000080" strokeWidth="1" />
          <line x1="8" y1="18" x2="20" y2="18" stroke="#000080" strokeWidth="1" />
          <line x1="8" y1="21" x2="16" y2="21" stroke="#000080" strokeWidth="1" />
          <path d="M6 4 L20 4 L20 10 L26 10 L26 28 L6 28 Z" fill="none" stroke="#808080" strokeWidth="1" />
        </svg>
      )
    case 'setup':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" style={pixelated}>
          <rect x="4" y="8" width="24" height="20" fill="#ffff00" />
          <rect x="5" y="9" width="22" height="18" fill="#c0c000" />
          <ellipse cx="16" cy="18" rx="8" ry="4" fill="#c0c0c0" />
          <ellipse cx="16" cy="18" rx="3" ry="1.5" fill="#808080" />
          <rect x="8" y="10" width="16" height="4" fill="#ffffff" />
          <text x="10" y="13" fill="#000000" fontSize="4" fontFamily="Arial">SETUP</text>
          <path d="M4 8 L28 8 L27 9 L5 9 Z" fill="#ffff80" />
          <path d="M28 8 L28 28 L27 27 L27 9 Z" fill="#808000" />
        </svg>
      )
    case 'cdplayer':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" style={pixelated}>
          <rect x="4" y="8" width="24" height="16" fill="#c0c0c0" />
          <circle cx="16" cy="16" r="6" fill="#e0e0e0" stroke="#808080" strokeWidth="1" />
          <circle cx="16" cy="16" r="2" fill="#808080" />
          <path d="M12 14 Q16 12 20 14" stroke="#ff0000" strokeWidth="0.5" fill="none" />
          <path d="M11 16 Q16 14 21 16" stroke="#00ff00" strokeWidth="0.5" fill="none" />
          <path d="M12 18 Q16 16 20 18" stroke="#0000ff" strokeWidth="0.5" fill="none" />
          <rect x="6" y="20" width="4" height="2" fill="#000000" />
          <rect x="12" y="20" width="4" height="2" fill="#000000" />
          <path d="M4 8 L28 8 L27 9 L5 9 Z" fill="#dfdfdf" />
          <path d="M28 8 L28 24 L27 23 L27 9 Z" fill="#808080" />
        </svg>
      )
    case 'small-window':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={pixelated}>
          <rect x="1" y="1" width="14" height="14" fill="#c0c0c0" />
          <rect x="2" y="2" width="12" height="2" fill="#000080" />
          <rect x="2" y="5" width="12" height="9" fill="#ffffff" />
        </svg>
      )
    case 'programs':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={pixelated}>
          <rect x="1" y="1" width="14" height="14" fill="#ffff00" />
          <rect x="2" y="2" width="12" height="12" fill="#c0c000" />
          <rect x="3" y="3" width="10" height="2" fill="#000080" />
          <rect x="3" y="6" width="10" height="7" fill="#ffffff" />
        </svg>
      )
    case 'documents':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={pixelated}>
          <rect x="2" y="1" width="10" height="13" fill="#ffffff" stroke="#808080" strokeWidth="1" />
          <path d="M9 1 L12 4 L9 4 Z" fill="#c0c0c0" />
          <rect x="1" y="3" width="10" height="13" fill="#ffff00" stroke="#808080" strokeWidth="1" />
        </svg>
      )
    case 'settings':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={pixelated}>
          <rect x="1" y="3" width="14" height="10" fill="#c0c0c0" />
          <rect x="2" y="4" width="12" height="2" fill="#000080" />
          <rect x="3" y="7" width="4" height="4" fill="#ffffff" />
          <rect x="8" y="7" width="5" height="2" fill="#808080" />
        </svg>
      )
    case 'find':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={pixelated}>
          <circle cx="6" cy="6" r="5" fill="#ffffff" stroke="#000000" strokeWidth="1" />
          <line x1="10" y1="10" x2="15" y2="15" stroke="#000000" strokeWidth="2" />
          <circle cx="6" cy="6" r="3" fill="none" stroke="#808080" strokeWidth="1" />
        </svg>
      )
    case 'help':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={pixelated}>
          <rect x="1" y="1" width="14" height="14" fill="#ffff00" />
          <text x="8" y="12" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000080">?</text>
        </svg>
      )
    case 'run':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={pixelated}>
          <rect x="1" y="2" width="14" height="12" fill="#c0c0c0" />
          <rect x="2" y="3" width="12" height="2" fill="#000080" />
          <rect x="2" y="6" width="12" height="7" fill="#ffffff" />
          <text x="4" y="11" fontSize="6" fill="#000000">Run</text>
        </svg>
      )
    case 'shutdown':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={pixelated}>
          <rect x="2" y="4" width="12" height="10" fill="#c0c0c0" />
          <rect x="4" y="6" width="8" height="6" fill="#000000" />
          <rect x="5" y="2" width="6" height="3" fill="#808080" />
          <circle cx="8" cy="9" r="2" fill="#00ff00" />
        </svg>
      )
    case 'windows-flag':
      return (
        <svg width={size} height={size} viewBox="0 0 18 16" style={{ imageRendering: 'auto' }}>
          <path d="M1 1 Q3 0 4 1 L4 7 Q3 6 1 7 Z" fill="#ff0000" />
          <path d="M5 1 Q7 0 8 1 L8 7 Q7 6 5 7 Z" fill="#00ff00" />
          <path d="M1 8 Q3 7 4 8 L4 14 Q3 13 1 14 Z" fill="#0000ff" />
          <path d="M5 8 Q7 7 8 8 L8 14 Q7 13 5 14 Z" fill="#ffff00" />
        </svg>
      )
    default:
      return null
  }
}

interface DesktopIconCellProps {
  icon: IconKind
  name: string
  selected: boolean
  onSelect: () => void
  onActivate: () => void
  onContextMenu: (x: number, y: number) => void
}

/**
 * A single labelled desktop shortcut. Single-click selects, double-click
 * activates, right-click opens a context menu.
 */
export function DesktopIconCell({
  icon,
  name,
  selected,
  onSelect,
  onActivate,
  onContextMenu,
}: DesktopIconCellProps) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onDoubleClick={onActivate}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e.clientX, e.clientY)
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        padding: '2px',
        cursor: 'default',
        width: '75px',
        marginBottom: '8px',
        userSelect: 'none',
      }}
    >
      <div style={{ width: '32px', height: '32px', filter: selected ? 'brightness(0.85) saturate(1.4) hue-rotate(-10deg)' : 'none' }}>
        <Win95IconImage type={ICON_KIND_TO_WIN95[icon]} size={32} />
      </div>
      <span style={{
        color: palette.white,
        fontSize: '11px',
        fontFamily: fonts.win95,
        textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
        textAlign: 'center',
        lineHeight: 1.1,
        background: selected ? palette.navy : 'transparent',
        padding: '1px 3px',
        maxWidth: '70px',
        wordWrap: 'break-word',
      }}>
        {name}
      </span>
    </div>
  )
}
