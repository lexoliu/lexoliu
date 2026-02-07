import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

type PanelId = 'about' | 'github' | 'travel' | 'waterui'

interface BootSequence3DProps {
  onComplete: () => void
  scrollProgress?: number // 0 = room view, 1 = fullscreen CRT
  onOpenPanel?: (panel: PanelId) => void
  onClosePanel?: (panel: PanelId) => void
  onFocusPanel?: (panel: PanelId) => void
  onToggleLamp?: () => void
  onToggleMusic?: () => void
  lampOn?: boolean
  openPanels?: PanelId[] // Array of open panels, ordered by z-index (last = top)
}

type Phase = 'startup' | 'bios' | 'boot' | 'loading' | 'desktop'

// Desktop icon type
interface DesktopIcon {
  id: string
  name: string
  icon: 'folder' | 'terminal' | 'map' | 'droplet' | 'speaker'
  action: () => void
}

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

// Camera positions - base values
const ROOM_VIEW = {
  position: new THREE.Vector3(3, 1, 10),
  lookAt: new THREE.Vector3(-0.5, -0.8, -1),
}

// Screen view position calculated to show full CRT with bezel
// We want the CRT (width ~4.2, height ~3.4) to fit comfortably in view
const getScreenViewPosition = (aspect: number): THREE.Vector3 => {
  // Base distance that shows full CRT on a 16:9 screen
  const baseZ = 5.5

  // Adjust for aspect ratio - narrower screens need camera further back
  // On very wide screens (ultrawide), we can be slightly closer
  // On narrow screens (mobile portrait), we need to be further
  let zAdjust = 0
  if (aspect < 1) {
    // Portrait mode - need to be much further back
    zAdjust = (1 - aspect) * 3
  } else if (aspect < 1.5) {
    // Narrow landscape - slightly further
    zAdjust = (1.5 - aspect) * 1.5
  } else if (aspect > 2) {
    // Ultrawide - can be slightly closer
    zAdjust = -0.3
  }

  return new THREE.Vector3(0, 0, baseZ + zAdjust)
}

const SCREEN_VIEW_LOOKAT = new THREE.Vector3(0, 0, 0)

// Camera controller - interpolates between room view and screen close-up
function CameraRig({ scrollProgress = 0 }: { scrollProgress: number }) {
  const { camera, viewport } = useThree()
  const screenViewPos = useRef(new THREE.Vector3())

  useFrame(() => {
    // Calculate screen view position based on current aspect ratio
    const aspect = viewport.width / viewport.height
    screenViewPos.current.copy(getScreenViewPosition(aspect))

    // Smooth easing for the scroll progress
    const t = Math.min(1, Math.max(0, scrollProgress))
    const eased = t * t * (3 - 2 * t) // smoothstep

    // Interpolate position
    camera.position.lerpVectors(ROOM_VIEW.position, screenViewPos.current, eased)

    // Interpolate look-at target
    const lookAtTarget = new THREE.Vector3().lerpVectors(ROOM_VIEW.lookAt, SCREEN_VIEW_LOOKAT, eased)
    camera.lookAt(lookAtTarget)
  })

  return null
}

// Win95 Dialog Component - replaces native alert/confirm
function Win95Dialog({
  title,
  message,
  type = 'info',
  onOk,
  onCancel,
  showCancel = false,
}: {
  title: string
  message: string
  type?: 'info' | 'warning' | 'error' | 'question'
  onOk: () => void
  onCancel?: () => void
  showCancel?: boolean
}) {
  // Dialog icons
  const icons = {
    info: (
      <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
        <circle cx="16" cy="16" r="14" fill="#ffffff" stroke="#000080" strokeWidth="2"/>
        <text x="16" y="22" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#000080">i</text>
      </svg>
    ),
    warning: (
      <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
        <path d="M16 2 L30 28 L2 28 Z" fill="#ffff00" stroke="#000000" strokeWidth="1"/>
        <text x="16" y="24" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#000000">!</text>
      </svg>
    ),
    error: (
      <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
        <circle cx="16" cy="16" r="14" fill="#ff0000" stroke="#800000" strokeWidth="2"/>
        <text x="16" y="22" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#ffffff">X</text>
      </svg>
    ),
    question: (
      <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
        <circle cx="16" cy="16" r="14" fill="#ffffff" stroke="#000080" strokeWidth="2"/>
        <text x="16" y="22" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#000080">?</text>
      </svg>
    ),
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Dialog window */}
      <div
        style={{
          background: '#c0c0c0',
          border: '2px outset #c0c0c0',
          boxShadow: '2px 2px 8px rgba(0,0,0,0.5)',
          minWidth: '280px',
          maxWidth: '400px',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            height: '18px',
            background: 'linear-gradient(90deg, #000080 0%, #1084d0 100%)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 4px',
            margin: '2px 2px 0 2px',
          }}
        >
          <span
            style={{
              color: 'white',
              fontSize: '11px',
              fontWeight: 'bold',
              fontFamily: 'MS Sans Serif, Tahoma, sans-serif',
            }}
          >
            {title}
          </span>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-start',
          }}
        >
          {/* Icon */}
          <div style={{ flexShrink: 0 }}>
            {icons[type]}
          </div>
          {/* Message */}
          <div
            style={{
              fontSize: '11px',
              fontFamily: 'MS Sans Serif, Tahoma, sans-serif',
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {message}
          </div>
        </div>

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 16px 16px',
          }}
        >
          <button
            onClick={onOk}
            style={{
              minWidth: '75px',
              height: '23px',
              background: '#c0c0c0',
              border: 'none',
              boxShadow: 'inset -1px -1px #404040, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf',
              fontSize: '11px',
              fontFamily: 'MS Sans Serif, Tahoma, sans-serif',
              cursor: 'pointer',
            }}
          >
            OK
          </button>
          {showCancel && (
            <button
              onClick={onCancel}
              style={{
                minWidth: '75px',
                height: '23px',
                background: '#c0c0c0',
                border: 'none',
                boxShadow: 'inset -1px -1px #404040, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf',
                fontSize: '11px',
                fontFamily: 'MS Sans Serif, Tahoma, sans-serif',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Context Menu Component
function ContextMenu({
  x,
  y,
  onClose,
  items,
}: {
  x: number
  y: number
  onClose: () => void
  items: { label: string; onClick: () => void; disabled?: boolean }[]
}) {
  useEffect(() => {
    const handleClick = () => onClose()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [onClose])

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        background: '#d4d0c8',
        border: '1px solid #808080',
        boxShadow: 'inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, 2px 2px 4px rgba(0,0,0,0.3)',
        zIndex: 200,
        minWidth: '120px',
        padding: '2px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            if (!item.disabled) {
              item.onClick()
              onClose()
            }
          }}
          style={{
            display: 'block',
            width: '100%',
            padding: '4px 20px 4px 8px',
            background: 'transparent',
            border: 'none',
            textAlign: 'left',
            fontSize: '11px',
            fontFamily: 'Tahoma, Arial, sans-serif',
            cursor: item.disabled ? 'default' : 'pointer',
            color: item.disabled ? '#808080' : 'black',
          }}
          onMouseEnter={(e) => {
            if (!item.disabled) {
              e.currentTarget.style.background = '#000080'
              e.currentTarget.style.color = 'white'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = item.disabled ? '#808080' : 'black'
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// Authentic Win95 32x32 pixel-art style icons
function Win95IconImage({ type, size = 32 }: { type: string; size?: number }) {
  // More authentic Win95 style icons with proper 3D effects and shading
  const icons: Record<string, React.ReactNode> = {
    // My Computer style - for About
    'my-computer': (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
        {/* Monitor body */}
        <rect x="4" y="4" width="24" height="18" fill="#c0c0c0"/>
        <rect x="5" y="5" width="22" height="16" fill="#000080"/>
        <rect x="6" y="6" width="20" height="14" fill="#008080"/>
        {/* Monitor base */}
        <rect x="10" y="22" width="12" height="2" fill="#808080"/>
        <rect x="8" y="24" width="16" height="3" fill="#c0c0c0"/>
        {/* 3D effect on monitor */}
        <path d="M4 4 L28 4 L27 5 L5 5 L5 21 L4 22 Z" fill="#dfdfdf"/>
        <path d="M28 4 L28 22 L27 21 L27 5 Z" fill="#808080"/>
        <path d="M4 22 L5 21 L27 21 L28 22 Z" fill="#404040"/>
        {/* Screen shine */}
        <rect x="7" y="7" width="3" height="3" fill="rgba(255,255,255,0.3)"/>
      </svg>
    ),
    // MS-DOS Prompt style - for GitHub
    'msdos': (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
        {/* Window frame */}
        <rect x="2" y="4" width="28" height="24" fill="#c0c0c0"/>
        <rect x="3" y="5" width="26" height="22" fill="#000080"/>
        {/* Title bar */}
        <rect x="4" y="6" width="24" height="3" fill="#000080"/>
        {/* Screen */}
        <rect x="4" y="10" width="24" height="16" fill="#000000"/>
        {/* Command prompt text */}
        <text x="6" y="18" fill="#c0c0c0" fontSize="6" fontFamily="monospace">C:\&gt;_</text>
        {/* 3D borders */}
        <path d="M2 4 L30 4 L29 5 L3 5 L3 27 L2 28 Z" fill="#dfdfdf"/>
        <path d="M30 4 L30 28 L29 27 L29 5 Z" fill="#808080"/>
      </svg>
    ),
    // Notepad/Document style - for Travel
    'notepad': (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
        {/* Paper */}
        <rect x="6" y="4" width="20" height="24" fill="#ffffff"/>
        {/* Fold corner */}
        <path d="M20 4 L26 10 L20 10 Z" fill="#c0c0c0"/>
        <path d="M20 4 L26 10" stroke="#808080" strokeWidth="1" fill="none"/>
        {/* Lines on paper */}
        <line x1="8" y1="12" x2="18" y2="12" stroke="#000080" strokeWidth="1"/>
        <line x1="8" y1="15" x2="22" y2="15" stroke="#000080" strokeWidth="1"/>
        <line x1="8" y1="18" x2="20" y2="18" stroke="#000080" strokeWidth="1"/>
        <line x1="8" y1="21" x2="16" y2="21" stroke="#000080" strokeWidth="1"/>
        {/* 3D border */}
        <path d="M6 4 L20 4 L20 10 L26 10 L26 28 L6 28 Z" fill="none" stroke="#808080" strokeWidth="1"/>
      </svg>
    ),
    // Setup/Application style - for WaterUI
    'setup': (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
        {/* Box */}
        <rect x="4" y="8" width="24" height="20" fill="#ffff00"/>
        <rect x="5" y="9" width="22" height="18" fill="#c0c000"/>
        {/* CD/Disk */}
        <ellipse cx="16" cy="18" rx="8" ry="4" fill="#c0c0c0"/>
        <ellipse cx="16" cy="18" rx="3" ry="1.5" fill="#808080"/>
        {/* Label */}
        <rect x="8" y="10" width="16" height="4" fill="#ffffff"/>
        <text x="10" y="13" fill="#000000" fontSize="4" fontFamily="Arial">SETUP</text>
        {/* 3D effect */}
        <path d="M4 8 L28 8 L27 9 L5 9 Z" fill="#ffff80"/>
        <path d="M28 8 L28 28 L27 27 L27 9 Z" fill="#808000"/>
      </svg>
    ),
    // CD/Speaker for Music
    'cdplayer': (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
        {/* Player body */}
        <rect x="4" y="8" width="24" height="16" fill="#c0c0c0"/>
        {/* CD */}
        <circle cx="16" cy="16" r="6" fill="#e0e0e0" stroke="#808080" strokeWidth="1"/>
        <circle cx="16" cy="16" r="2" fill="#808080"/>
        {/* Rainbow effect on CD */}
        <path d="M12 14 Q16 12 20 14" stroke="#ff0000" strokeWidth="0.5" fill="none"/>
        <path d="M11 16 Q16 14 21 16" stroke="#00ff00" strokeWidth="0.5" fill="none"/>
        <path d="M12 18 Q16 16 20 18" stroke="#0000ff" strokeWidth="0.5" fill="none"/>
        {/* Controls */}
        <rect x="6" y="20" width="4" height="2" fill="#000000"/>
        <rect x="12" y="20" width="4" height="2" fill="#000000"/>
        {/* 3D border */}
        <path d="M4 8 L28 8 L27 9 L5 9 Z" fill="#dfdfdf"/>
        <path d="M28 8 L28 24 L27 23 L27 9 Z" fill="#808080"/>
      </svg>
    ),
    // Windows Flag for Start button
    'windows-flag': (
      <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
        <rect x="1" y="1" width="6" height="6" fill="#ff0000"/>
        <rect x="8" y="1" width="6" height="6" fill="#00ff00"/>
        <rect x="1" y="8" width="6" height="6" fill="#0000ff"/>
        <rect x="8" y="8" width="6" height="6" fill="#ffff00"/>
        {/* Waving effect */}
        <path d="M0 0 Q4 2 7 0 L7 7 Q4 5 0 7 Z" fill="#ff0000"/>
        <path d="M8 0 Q12 2 15 0 L15 7 Q12 5 8 7 Z" fill="#00ff00"/>
        <path d="M0 8 Q4 10 7 8 L7 15 Q4 13 0 15 Z" fill="#0000ff"/>
        <path d="M8 8 Q12 10 15 8 L15 15 Q12 13 8 15 Z" fill="#ffff00"/>
      </svg>
    ),
    // Small icon for title bar
    'small-window': (
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
        <rect x="1" y="1" width="14" height="14" fill="#c0c0c0"/>
        <rect x="2" y="2" width="12" height="2" fill="#000080"/>
        <rect x="2" y="5" width="12" height="9" fill="#ffffff"/>
      </svg>
    ),
  }

  return <>{icons[type] || icons['my-computer']}</>
}

// Desktop Icon Component with authentic Win95 styling
function Win95Icon({
  icon,
  name,
  onClick,
  onRightClick,
  isSelected,
  onSelect,
}: {
  icon: DesktopIcon['icon']
  name: string
  onClick: () => void
  onRightClick?: (x: number, y: number) => void
  isSelected?: boolean
  onSelect?: () => void
}) {
  // Map icon types to Win95 style icons
  const iconTypeMap: Record<DesktopIcon['icon'], string> = {
    folder: 'my-computer',
    terminal: 'msdos',
    map: 'notepad',
    droplet: 'setup',
    speaker: 'cdplayer',
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    onRightClick?.(e.clientX, e.clientY)
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
      onDoubleClick={onClick}
      onContextMenu={handleContextMenu}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        padding: '2px',
        cursor: 'default',
        width: '75px',
        marginBottom: '8px',
      }}
    >
      {/* Icon with selection highlight */}
      <div style={{
        width: '32px',
        height: '32px',
        filter: isSelected ? 'brightness(0.7) sepia(1) hue-rotate(190deg) saturate(5)' : 'none',
      }}>
        <Win95IconImage type={iconTypeMap[icon]} size={32} />
      </div>
      {/* Label with Win95 authentic styling */}
      <span style={{
        color: 'white',
        fontSize: '11px',
        fontFamily: 'MS Sans Serif, Tahoma, sans-serif',
        textShadow: '1px 1px 0px black, -1px -1px 0px black, 1px -1px 0px black, -1px 1px 0px black',
        textAlign: 'center',
        lineHeight: 1.1,
        background: isSelected ? '#000080' : 'transparent',
        padding: '1px 2px',
        maxWidth: '70px',
        wordWrap: 'break-word',
      }}>
        {name}
      </span>
    </div>
  )
}

// Win95 Menu Item
interface MenuItem {
  label: string
  shortcut?: string
  disabled?: boolean
  divider?: boolean
  onClick?: () => void
}

// Win95 Dropdown Menu Component
function Win95DropdownMenu({
  items,
  onClose,
}: {
  items: MenuItem[]
  onClose: () => void
}) {
  useEffect(() => {
    const handleClickOutside = () => onClose()
    setTimeout(() => document.addEventListener('click', handleClickOutside), 0)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [onClose])

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        background: '#d4d0c8',
        border: '1px solid #808080',
        boxShadow: 'inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, 2px 2px 4px rgba(0,0,0,0.2)',
        minWidth: '160px',
        padding: '2px',
        zIndex: 300,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div
            key={i}
            style={{
              height: '1px',
              background: '#808080',
              margin: '4px 2px',
              boxShadow: '0 1px 0 #ffffff',
            }}
          />
        ) : (
          <button
            key={i}
            onClick={() => {
              if (!item.disabled) {
                item.onClick?.()
                onClose()
              }
            }}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              padding: '3px 20px 3px 24px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              fontSize: '11px',
              fontFamily: 'Tahoma, Arial, sans-serif',
              cursor: item.disabled ? 'default' : 'pointer',
              color: item.disabled ? '#808080' : 'black',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.background = '#000080'
                e.currentTarget.style.color = 'white'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = item.disabled ? '#808080' : 'black'
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span style={{ color: 'inherit', marginLeft: '20px' }}>{item.shortcut}</span>
            )}
          </button>
        )
      )}
    </div>
  )
}

// Win95 Menu Bar Component
function Win95MenuBar({ onClose, onShowDialog }: { onClose: () => void; onShowDialog?: (dialog: { title: string; message: string; type: 'info' | 'warning' | 'error' | 'question' }) => void }) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: 'New', shortcut: 'Ctrl+N', disabled: true },
      { label: 'Open...', shortcut: 'Ctrl+O', disabled: true },
      { label: 'Save', shortcut: 'Ctrl+S', disabled: true },
      { label: 'Save As...', disabled: true },
      { divider: true, label: '' },
      { label: 'Print...', shortcut: 'Ctrl+P', disabled: true },
      { divider: true, label: '' },
      { label: 'Exit', onClick: onClose },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', disabled: true },
      { divider: true, label: '' },
      { label: 'Cut', shortcut: 'Ctrl+X', disabled: true },
      { label: 'Copy', shortcut: 'Ctrl+C', disabled: true },
      { label: 'Paste', shortcut: 'Ctrl+V', disabled: true },
      { label: 'Delete', shortcut: 'Del', disabled: true },
      { divider: true, label: '' },
      { label: 'Select All', shortcut: 'Ctrl+A', disabled: true },
    ],
    View: [
      { label: 'Toolbar', disabled: true },
      { label: 'Status Bar', disabled: true },
      { divider: true, label: '' },
      { label: 'Zoom In', disabled: true },
      { label: 'Zoom Out', disabled: true },
    ],
    Help: [
      { label: 'Help Topics', shortcut: 'F1', disabled: true },
      { divider: true, label: '' },
      { label: 'About', onClick: () => onShowDialog?.({ title: 'About Lexo Desktop', message: 'Lexo Desktop v1.0\n\nBuilt with React + Three.js', type: 'info' }) },
    ],
  }

  return (
    <div
      style={{
        height: '20px',
        background: '#d4d0c8',
        display: 'flex',
        alignItems: 'center',
        padding: '0',
        borderBottom: '1px solid #808080',
      }}
    >
      {Object.keys(menus).map((menuName) => (
        <div key={menuName} style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setActiveMenu(activeMenu === menuName ? null : menuName)
            }}
            onMouseEnter={() => {
              if (activeMenu) setActiveMenu(menuName)
            }}
            style={{
              background: activeMenu === menuName ? '#000080' : 'transparent',
              color: activeMenu === menuName ? 'white' : 'black',
              border: 'none',
              padding: '2px 8px',
              fontSize: '11px',
              fontFamily: 'Tahoma, Arial, sans-serif',
              cursor: 'pointer',
            }}
          >
            {menuName}
          </button>
          {activeMenu === menuName && (
            <Win95DropdownMenu
              items={menus[menuName]}
              onClose={() => setActiveMenu(null)}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// Authentic Win95 Start Menu Component
function Win95StartMenu({ onClose, onOpenPanel, onShowDialog }: {
  onClose: () => void
  onOpenPanel: (panel: PanelId) => void
  onShowDialog: (dialog: {
    title: string
    message: string
    type: 'info' | 'warning' | 'error' | 'question'
    showCancel: boolean
    onOk: () => void
    onCancel?: () => void
  }) => void
}) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)

  useEffect(() => {
    const handleClickOutside = () => onClose()
    setTimeout(() => document.addEventListener('click', handleClickOutside), 0)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [onClose])

  // Authentic Win95 menu icons (16x16)
  const menuIcons = {
    programs: (
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
        <rect x="1" y="1" width="14" height="14" fill="#ffff00"/>
        <rect x="2" y="2" width="12" height="12" fill="#c0c000"/>
        <rect x="3" y="3" width="10" height="2" fill="#000080"/>
        <rect x="3" y="6" width="10" height="7" fill="#ffffff"/>
      </svg>
    ),
    documents: (
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
        <rect x="2" y="1" width="10" height="13" fill="#ffffff" stroke="#808080" strokeWidth="1"/>
        <path d="M9 1 L12 4 L9 4 Z" fill="#c0c0c0"/>
        <rect x="1" y="3" width="10" height="13" fill="#ffff00" stroke="#808080" strokeWidth="1"/>
      </svg>
    ),
    settings: (
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
        <rect x="1" y="3" width="14" height="10" fill="#c0c0c0"/>
        <rect x="2" y="4" width="12" height="2" fill="#000080"/>
        <rect x="3" y="7" width="4" height="4" fill="#ffffff"/>
        <rect x="8" y="7" width="5" height="2" fill="#808080"/>
      </svg>
    ),
    find: (
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
        <circle cx="6" cy="6" r="5" fill="#ffffff" stroke="#000000" strokeWidth="1"/>
        <line x1="10" y1="10" x2="15" y2="15" stroke="#000000" strokeWidth="2"/>
        <circle cx="6" cy="6" r="3" fill="none" stroke="#808080" strokeWidth="1"/>
      </svg>
    ),
    help: (
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
        <rect x="1" y="1" width="14" height="14" fill="#ffff00"/>
        <text x="8" y="12" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000080">?</text>
      </svg>
    ),
    run: (
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
        <rect x="1" y="2" width="14" height="12" fill="#c0c0c0"/>
        <rect x="2" y="3" width="12" height="2" fill="#000080"/>
        <rect x="2" y="6" width="12" height="7" fill="#ffffff"/>
        <text x="4" y="11" fontSize="6" fill="#000000">Run</text>
      </svg>
    ),
    shutdown: (
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
        <rect x="2" y="4" width="12" height="10" fill="#c0c0c0"/>
        <rect x="4" y="6" width="8" height="6" fill="#000000"/>
        <rect x="5" y="2" width="6" height="3" fill="#808080"/>
        <circle cx="8" cy="9" r="2" fill="#00ff00"/>
      </svg>
    ),
  }

  const menuItems = [
    { id: 'programs', icon: menuIcons.programs, label: 'Programs', hasSubmenu: true, bold: true },
    { id: 'documents', icon: menuIcons.documents, label: 'Documents', hasSubmenu: true, bold: true },
    { id: 'settings', icon: menuIcons.settings, label: 'Settings', hasSubmenu: true, bold: true },
    { id: 'find', icon: menuIcons.find, label: 'Find', hasSubmenu: true, bold: true },
    { id: 'divider1', divider: true },
    { id: 'help', icon: menuIcons.help, label: 'Help', bold: true },
    { id: 'run', icon: menuIcons.run, label: 'Run...', bold: true },
    { id: 'divider2', divider: true },
    { id: 'shutdown', icon: menuIcons.shutdown, label: 'Shut Down...', bold: true },
  ]

  const programsSubmenu = [
    { label: 'About.exe', onClick: () => { onOpenPanel('about'); onClose() } },
    { label: 'GitHub', onClick: () => { onOpenPanel('github'); onClose() } },
    { label: 'Travel.txt', onClick: () => { onOpenPanel('travel'); onClose() } },
    { label: 'WaterUI', onClick: () => { onOpenPanel('waterui'); onClose() } },
  ]

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '28px',
        left: '2px',
        background: '#c0c0c0',
        border: '2px outset #c0c0c0',
        boxShadow: '2px 2px 4px rgba(0,0,0,0.4)',
        minWidth: '170px',
        zIndex: 200,
        display: 'flex',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Windows95 vertical banner - authentic gradient */}
      <div
        style={{
          width: '21px',
          background: 'linear-gradient(to top, #000080 0%, #1084d0 100%)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingBottom: '4px',
        }}
      >
        <span
          style={{
            color: '#c0c0c0',
            fontSize: '18px',
            fontWeight: 'bold',
            fontFamily: 'Arial Black, Arial, sans-serif',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            letterSpacing: '-1px',
            textShadow: '1px 1px 0 #000000',
          }}
        >
          <span style={{ fontWeight: 'bold' }}>Lexo</span>
          <span style={{ fontWeight: 'normal', fontFamily: 'Arial, sans-serif', fontSize: '16px' }}>95</span>
        </span>
      </div>

      {/* Menu items */}
      <div style={{ flex: 1, padding: '2px' }}>
        {menuItems.map((item) =>
          item.divider ? (
            <div
              key={item.id}
              style={{
                height: '2px',
                margin: '3px 2px',
                borderTop: '1px solid #808080',
                borderBottom: '1px solid #ffffff',
              }}
            />
          ) : (
            <div
              key={item.id}
              style={{ position: 'relative' }}
              onMouseEnter={() => {
                setHoveredItem(item.id)
                if (item.hasSubmenu) setActiveSubmenu(item.id)
              }}
              onMouseLeave={() => {
                setHoveredItem(null)
              }}
            >
              <button
                onClick={() => {
                  if (item.id === 'shutdown') {
                    onShowDialog({
                      title: 'Shut Down Windows',
                      message: 'Are you sure you want to shut down?',
                      type: 'question',
                      showCancel: true,
                      onOk: () => window.location.reload(),
                      onCancel: () => {},
                    })
                    onClose()
                  } else if (item.id === 'help') {
                    onShowDialog({
                      title: 'About Lexo Desktop',
                      message: 'Lexo Desktop v1.0\n\nBuilt with React + Three.js',
                      type: 'info',
                      showCancel: false,
                      onOk: () => {},
                    })
                    onClose()
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '3px 6px',
                  background: hoveredItem === item.id ? '#000080' : 'transparent',
                  color: hoveredItem === item.id ? 'white' : 'black',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontFamily: 'MS Sans Serif, Tahoma, sans-serif',
                  fontWeight: item.bold ? 'normal' : 'normal',
                  cursor: 'pointer',
                }}
              >
                <span style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.hasSubmenu && <span style={{ fontSize: '8px', marginRight: '4px' }}>▶</span>}
              </button>

              {/* Programs Submenu */}
              {item.id === 'programs' && activeSubmenu === 'programs' && hoveredItem === 'programs' && (
                <div
                  style={{
                    position: 'absolute',
                    left: '100%',
                    top: '-2px',
                    background: '#c0c0c0',
                    border: '2px outset #c0c0c0',
                    boxShadow: '2px 2px 4px rgba(0,0,0,0.4)',
                    minWidth: '150px',
                    padding: '2px',
                    zIndex: 201,
                  }}
                  onMouseEnter={() => setActiveSubmenu('programs')}
                >
                  {programsSubmenu.map((subItem, i) => (
                    <button
                      key={i}
                      onClick={subItem.onClick}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        width: '100%',
                        padding: '3px 20px 3px 6px',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontFamily: 'MS Sans Serif, Tahoma, sans-serif',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#000080'
                        e.currentTarget.style.color = 'white'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'black'
                      }}
                    >
                      <span style={{ width: '16px', height: '16px' }}>
                        <Win95IconImage type={
                          subItem.label === 'About.exe' ? 'my-computer' :
                          subItem.label === 'GitHub' ? 'msdos' :
                          subItem.label === 'Travel.txt' ? 'notepad' : 'setup'
                        } size={16} />
                      </span>
                      {subItem.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

// Win95 Window Component with authentic Win95 drag and minimize effects
function Win95Window({
  title,
  onClose,
  onMinimize,
  onFocus,
  children,
  width = 520,
  height = 400,
  initialX,
  initialY,
  zIndex = 100,
  taskbarButtonRect,
}: {
  title: string
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  children: React.ReactNode
  width?: number
  height?: number
  initialX?: number
  initialY?: number
  zIndex?: number
  taskbarButtonRect?: { x: number; y: number; width: number; height: number }
}) {
  const [position, setPosition] = useState({
    x: initialX ?? 90,
    y: initialY ?? 50,
  })
  // Drag state: 'none' | 'dragging'
  const [isDragging, setIsDragging] = useState(false)
  // The ghost outline position while dragging (Win95 style - shows dotted outline)
  const [ghostPosition, setGhostPosition] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isMaximized, setIsMaximized] = useState(false)
  // Minimize animation state
  const [minimizeState, setMinimizeState] = useState<'normal' | 'minimizing' | 'restoring'>('normal')
  const [minimizeProgress, setMinimizeProgress] = useState(0)
  const windowRef = useRef<HTMLDivElement>(null)

  // Handle drag start - Win95 style: show dotted outline
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return
    setIsDragging(true)
    setGhostPosition({ x: position.x, y: position.y })
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  // Handle dragging - move the ghost outline, not the actual window
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, Math.min(680 - width, e.clientX - dragOffset.x))
      const newY = Math.max(0, Math.min(500 - height, e.clientY - dragOffset.y))
      // Only update ghost position while dragging
      setGhostPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      // On release, snap window to ghost position
      setPosition(ghostPosition)
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, width, height, ghostPosition])

  // Toggle maximize
  const handleMaximize = () => {
    setIsMaximized(!isMaximized)
    if (!isMaximized) {
      setPosition({ x: 0, y: 0 })
    } else {
      setPosition({ x: initialX ?? 90, y: initialY ?? 50 })
    }
  }

  // Minimize animation - Win95 style: shrink toward taskbar
  const handleMinimize = () => {
    if (minimizeState !== 'normal') return
    setMinimizeState('minimizing')
    setMinimizeProgress(0)
  }

  // Minimize animation effect
  useEffect(() => {
    if (minimizeState !== 'minimizing') return

    const startTime = Date.now()
    const duration = 150 // 150ms for Win95 authentic feel

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(1, elapsed / duration)
      setMinimizeProgress(progress)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        // Animation complete - call onMinimize
        setMinimizeState('normal')
        setMinimizeProgress(0)
        onMinimize?.()
      }
    }

    requestAnimationFrame(animate)
  }, [minimizeState, onMinimize])

  const currentWidth = isMaximized ? 680 : width
  const currentHeight = isMaximized ? 472 : height

  // Calculate minimize transform - shrink toward taskbar
  const getMinimizeTransform = () => {
    if (minimizeState !== 'minimizing') return {}

    // Target: taskbar button position (bottom of screen, roughly)
    const targetX = taskbarButtonRect?.x ?? 60
    const targetY = taskbarButtonRect?.y ?? 470
    const targetScale = 0.1

    // Interpolate position and scale
    const currentX = position.x + (targetX - position.x) * minimizeProgress
    const currentY = position.y + (targetY - position.y) * minimizeProgress
    const scale = 1 - (1 - targetScale) * minimizeProgress

    return {
      transform: `translate(${currentX - position.x}px, ${currentY - position.y}px) scale(${scale})`,
      transformOrigin: 'top left',
      opacity: 1 - minimizeProgress * 0.5,
    }
  }

  return (
    <>
      {/* Win95 Authentic Drag Ghost - Dotted outline rectangle */}
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            left: `${ghostPosition.x}px`,
            top: `${ghostPosition.y}px`,
            width: `${currentWidth}px`,
            height: `${currentHeight}px`,
            border: '2px dotted #000000',
            background: 'transparent',
            zIndex: zIndex + 100,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Actual Window */}
      <div
        ref={windowRef}
        onMouseDown={onFocus}
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${currentWidth}px`,
          height: `${currentHeight}px`,
          background: '#c0c0c0',
          border: '2px outset #c0c0c0',
          display: 'flex',
          flexDirection: 'column',
          zIndex,
          userSelect: 'none',
          // Hide window while dragging (only show ghost outline)
          visibility: isDragging ? 'hidden' : 'visible',
          ...getMinimizeTransform(),
        }}
      >
        {/* Title bar - draggable with authentic Win95 gradient */}
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={handleMaximize}
          style={{
            height: '18px',
            background: 'linear-gradient(90deg, #000080 0%, #1084d0 100%)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 2px',
            cursor: 'default',
            margin: '2px 2px 0 2px',
          }}
        >
          {/* Window icon */}
          <div style={{ width: '16px', height: '16px', marginRight: '3px', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
              <rect x="1" y="1" width="14" height="14" fill="#c0c0c0"/>
              <rect x="2" y="2" width="12" height="2" fill="#000080"/>
              <rect x="2" y="5" width="12" height="9" fill="#ffffff"/>
            </svg>
          </div>
          <span
            style={{
              color: 'white',
              fontSize: '11px',
              fontWeight: 'bold',
              fontFamily: 'MS Sans Serif, Tahoma, sans-serif',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
          <div style={{ display: 'flex', gap: '2px', marginLeft: '2px' }} onMouseDown={(e) => e.stopPropagation()}>
            {/* Minimize button - authentic Win95 */}
            <button
              onClick={(e) => { e.stopPropagation(); handleMinimize() }}
              style={{
                width: '16px',
                height: '14px',
                background: '#c0c0c0',
                border: 'none',
                boxShadow: 'inset -1px -1px #404040, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <div style={{ width: '6px', height: '2px', background: '#000000', marginBottom: '3px' }} />
            </button>
            {/* Maximize button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleMaximize() }}
              style={{
                width: '16px',
                height: '14px',
                background: '#c0c0c0',
                border: 'none',
                boxShadow: 'inset -1px -1px #404040, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <div style={{ width: '9px', height: '9px', border: '1px solid #000000', borderTop: '2px solid #000000' }} />
            </button>
            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); onClose() }}
              style={{
                width: '16px',
                height: '14px',
                background: '#c0c0c0',
                border: 'none',
                boxShadow: 'inset -1px -1px #404040, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                fontFamily: 'Marlett, Arial',
                fontSize: '10px',
                fontWeight: 'bold',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Menu bar */}
        <Win95MenuBar onClose={onClose} />

        {/* Content area */}
        <div
          style={{
            flex: 1,
            margin: '0 2px',
            background: 'white',
            border: '2px inset #c0c0c0',
            overflow: 'auto',
            padding: '8px',
            fontFamily: 'MS Sans Serif, Tahoma, sans-serif',
            fontSize: '11px',
          }}
        >
          {children}
        </div>

        {/* Status bar */}
        <div
          style={{
            height: '18px',
            background: '#d4d0c8',
            borderTop: '1px solid #808080',
            display: 'flex',
            alignItems: 'center',
            padding: '0 4px',
            fontSize: '10px',
            color: '#404040',
            fontFamily: 'Tahoma, Arial, sans-serif',
          }}
        >
          Ready
        </div>
      </div>
    </>
  )
}

// Win95 About Panel Content
function AboutContent() {
  return (
    <div style={{ lineHeight: 1.5 }}>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#000080' }}>Lexo</div>
        <div style={{ fontSize: '11px', color: '#808080' }}>Software Developer</div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>About:</div>
        <div>I love coding, especially <span style={{ color: '#E85D4C', fontWeight: 'bold' }}>Rust</span>.</div>
        <div style={{ marginTop: '4px', fontSize: '11px', color: '#404040' }}>
          Building a cross-platform GUI framework to make Rust development easier.
        </div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Hobbies:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {['Coding', 'Travel', 'Photo', 'Food', 'Reading'].map((hobby) => (
            <span
              key={hobby}
              style={{
                padding: '2px 8px',
                background: '#d4d0c8',
                border: '1px solid #808080',
                fontSize: '10px',
              }}
            >
              {hobby}
            </span>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Current Focus:</div>
        <div style={{ fontSize: '11px' }}>
          Building <span style={{ color: '#000080' }}>WaterUI</span> - a cross-platform GUI framework for Rust
        </div>
      </div>
      <div style={{ borderTop: '1px solid #d4d0c8', paddingTop: '8px', fontSize: '10px', color: '#808080' }}>
        Contact: me@lexo.cool
      </div>
    </div>
  )
}

// Win95 GitHub Panel Content
function GitHubContent() {
  return (
    <div style={{ lineHeight: 1.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#000">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>@lexoliu</span>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Pinned Repositories:</div>
        {[
          { name: 'waterui', desc: 'Cross-platform GUI framework for Rust', lang: 'Rust' },
          { name: 'lexoliu.github.io', desc: 'Personal website', lang: 'TypeScript' },
        ].map((repo) => (
          <div
            key={repo.name}
            style={{
              padding: '8px',
              marginBottom: '6px',
              background: '#f5f5f5',
              border: '1px solid #d4d0c8',
            }}
          >
            <div style={{ fontWeight: 'bold', color: '#000080', fontSize: '12px' }}>{repo.name}</div>
            <div style={{ fontSize: '10px', color: '#606060', marginTop: '2px' }}>{repo.desc}</div>
            <div style={{ fontSize: '9px', color: '#808080', marginTop: '4px' }}>
              <span style={{ color: '#E85D4C' }}>*</span> {repo.lang}
            </div>
          </div>
        ))}
      </div>
      <a
        href="https://github.com/lexoliu"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-block',
          padding: '4px 12px',
          background: '#d4d0c8',
          border: '1px solid #808080',
          boxShadow: 'inset -1px -1px #0a0a0a, inset 1px 1px #ffffff',
          textDecoration: 'none',
          color: 'black',
          fontSize: '11px',
          cursor: 'pointer',
        }}
      >
        View Profile
      </a>
    </div>
  )
}

// Win95 Travel Panel Content
function TravelContent() {
  const cities = [
    { name: 'Hangzhou', cn: '杭州' },
    { name: 'Shanghai', cn: '上海' },
    { name: 'Beijing', cn: '北京' },
    { name: 'Chengdu', cn: '成都' },
    { name: 'Xian', cn: '西安' },
  ]

  return (
    <div style={{ lineHeight: 1.5 }}>
      <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>
        Travel Map - Visited Cities
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        {cities.map((city) => (
          <div
            key={city.name}
            style={{
              padding: '8px 12px',
              background: '#f5f5f5',
              border: '1px solid #d4d0c8',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ color: '#E85D4C', fontSize: '16px' }}>*</span>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{city.name}</div>
              <div style={{ fontSize: '10px', color: '#808080' }}>{city.cn}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '10px', color: '#606060', textAlign: 'center' }}>
        Click on desktop icons to explore more...
      </div>
    </div>
  )
}

// Win95 WaterUI Panel Content
function WaterUIContent() {
  return (
    <div style={{ lineHeight: 1.5, textAlign: 'center' }}>
      <div
        style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 12px',
          background: '#000',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src="https://avatars.githubusercontent.com/u/154332053?s=200&v=4"
          alt="WaterUI"
          style={{ width: '100%', height: '100%', borderRadius: '8px' }}
        />
      </div>
      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#000080', marginBottom: '4px' }}>
        WaterUI
      </div>
      <div style={{ fontSize: '12px', color: '#808080', marginBottom: '16px' }}>
        Learn Rust, Run Native
      </div>
      <div
        style={{
          textAlign: 'left',
          padding: '12px',
          background: '#f5f5f5',
          border: '1px solid #d4d0c8',
          marginBottom: '16px',
          fontSize: '11px',
        }}
      >
        A cross-platform GUI framework for Rust that aims to make native app development simple and enjoyable.
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
        <a
          href="https://github.com/water-rs/waterui"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '4px 12px',
            background: '#d4d0c8',
            border: '1px solid #808080',
            boxShadow: 'inset -1px -1px #0a0a0a, inset 1px 1px #ffffff',
            textDecoration: 'none',
            color: 'black',
            fontSize: '11px',
          }}
        >
          GitHub
        </a>
        <a
          href="https://waterui.dev"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '4px 12px',
            background: '#d4d0c8',
            border: '1px solid #808080',
            boxShadow: 'inset -1px -1px #0a0a0a, inset 1px 1px #ffffff',
            textDecoration: 'none',
            color: 'black',
            fontSize: '11px',
          }}
        >
          Website
        </a>
      </div>
    </div>
  )
}

// Window configuration for each panel type
const WINDOW_CONFIG: Record<PanelId, { title: string; initialX: number; initialY: number }> = {
  about: { title: 'About - Lexo', initialX: 80, initialY: 40 },
  github: { title: 'GitHub - @lexoliu', initialX: 100, initialY: 30 },
  travel: { title: 'Travel.txt - Notepad', initialX: 60, initialY: 50 },
  waterui: { title: 'WaterUI - Project', initialX: 90, initialY: 35 },
}

// Win95 Desktop Component with full interactivity - supports multiple windows
function Win95Desktop({
  desktopIcons,
  openPanels,
  onClosePanel,
  onOpenPanel,
  onFocusPanel,
}: {
  desktopIcons: DesktopIcon[]
  openPanels: PanelId[]
  onClosePanel: (panel: PanelId) => void
  onOpenPanel: (panel: PanelId) => void
  onFocusPanel: (panel: PanelId) => void
}) {
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; iconId?: string } | null>(null)
  const [minimizedWindows, setMinimizedWindows] = useState<PanelId[]>([])
  const [startMenuOpen, setStartMenuOpen] = useState(false)
  const [startButtonPressed, setStartButtonPressed] = useState(false)
  // Win95-style dialog state
  const [dialog, setDialog] = useState<{
    title: string
    message: string
    type: 'info' | 'warning' | 'error' | 'question'
    showCancel: boolean
    onOk: () => void
    onCancel?: () => void
  } | null>(null)
  // Track taskbar button refs for each panel (for minimize animation target)
  const taskbarButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Handle desktop click - deselect icon and close menus
  const handleDesktopClick = () => {
    setSelectedIcon(null)
    setContextMenu(null)
    setStartMenuOpen(false)
  }

  // Handle desktop right-click
  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
    setStartMenuOpen(false)
  }

  // Handle icon right-click
  const handleIconRightClick = (iconId: string, x: number, y: number) => {
    setSelectedIcon(iconId)
    setContextMenu({ x, y, iconId })
    setStartMenuOpen(false)
  }

  // Check if window is minimized
  const isMinimized = (panel: PanelId) => minimizedWindows.includes(panel)

  // Minimize window
  const handleMinimize = (panel: PanelId) => {
    setMinimizedWindows((prev) => [...prev, panel])
  }

  // Restore window from taskbar
  const handleRestore = (panel: PanelId) => {
    setMinimizedWindows((prev) => prev.filter((p) => p !== panel))
    onFocusPanel(panel)
  }

  // Handle taskbar button click - toggle minimize/restore or bring to front
  const handleTaskbarClick = (panel: PanelId) => {
    if (isMinimized(panel)) {
      handleRestore(panel)
    } else {
      // If it's the topmost window, minimize it
      const topPanel = openPanels[openPanels.length - 1]
      if (topPanel === panel) {
        handleMinimize(panel)
      } else {
        // Otherwise bring to front
        onFocusPanel(panel)
      }
    }
  }

  // Get taskbar button rect for minimize animation
  const getTaskbarButtonRect = (panel: PanelId) => {
    const btn = taskbarButtonRefs.current[panel]
    if (btn) {
      const rect = btn.getBoundingClientRect()
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
    }
    return { x: 60, y: 470, width: 100, height: 22 }
  }

  // Toggle start menu
  const handleStartClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setStartMenuOpen(!startMenuOpen)
    setContextMenu(null)
  }

  // Get context menu items
  const getContextMenuItems = () => {
    if (contextMenu?.iconId) {
      const icon = desktopIcons.find((i) => i.id === contextMenu.iconId)
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
  }

  // Get z-index for a panel (higher index = on top)
  const getZIndex = (panel: PanelId) => {
    const index = openPanels.indexOf(panel)
    return 100 + index
  }

  // Render window content based on panel type
  const renderWindowContent = (panel: PanelId) => {
    switch (panel) {
      case 'about': return <AboutContent />
      case 'github': return <GitHubContent />
      case 'travel': return <TravelContent />
      case 'waterui': return <WaterUIContent />
    }
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#5A9A9A',
        margin: '-24px',
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={handleDesktopClick}
      onContextMenu={handleDesktopContextMenu}
    >
      {/* Desktop area */}
      <div style={{ flex: 1, padding: '8px', position: 'relative' }}>
        {/* Desktop Icons Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 70px)',
          gap: '4px',
          alignContent: 'start',
        }}>
          {desktopIcons.map((icon) => (
            <Win95Icon
              key={icon.id}
              icon={icon.icon}
              name={icon.name}
              onClick={icon.action}
              isSelected={selectedIcon === icon.id}
              onSelect={() => setSelectedIcon(icon.id)}
              onRightClick={(x, y) => handleIconRightClick(icon.id, x, y)}
            />
          ))}
        </div>

        {/* Center Lexo watermark */}
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
            fontFamily: 'var(--font-chocolate, "Brush Script MT", cursive)',
            fontWeight: 100,
          }}>
            Lexo
          </div>
        </div>
      </div>

      {/* Taskbar - Authentic Win95 style */}
      <div style={{
        height: '28px',
        background: '#c0c0c0',
        display: 'flex',
        alignItems: 'center',
        padding: '2px 2px',
        borderTop: '1px solid #dfdfdf',
        gap: '2px',
        position: 'relative',
      }}>
        {/* Start button - Authentic Win95 with Windows logo */}
        <button
          onClick={handleStartClick}
          onMouseDown={() => setStartButtonPressed(true)}
          onMouseUp={() => setStartButtonPressed(false)}
          onMouseLeave={() => setStartButtonPressed(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 6px 2px 3px',
            height: '22px',
            background: '#c0c0c0',
            border: 'none',
            boxShadow: startButtonPressed || startMenuOpen
              ? 'inset 1px 1px #404040, inset -1px -1px #ffffff, inset 2px 2px #808080'
              : 'inset -1px -1px #404040, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf',
            fontSize: '11px',
            fontWeight: 'bold',
            fontFamily: 'MS Sans Serif, Tahoma, sans-serif',
            cursor: 'pointer',
          }}
        >
          {/* Windows logo - waving flag style */}
          <svg width="18" height="16" viewBox="0 0 18 16" style={{ imageRendering: 'auto' }}>
            {/* Red quadrant (top-left) with wave */}
            <path d="M1 1 Q3 0 4 1 L4 7 Q3 6 1 7 Z" fill="#ff0000"/>
            {/* Green quadrant (top-right) with wave */}
            <path d="M5 1 Q7 0 8 1 L8 7 Q7 6 5 7 Z" fill="#00ff00"/>
            {/* Blue quadrant (bottom-left) with wave */}
            <path d="M1 8 Q3 7 4 8 L4 14 Q3 13 1 14 Z" fill="#0000ff"/>
            {/* Yellow quadrant (bottom-right) with wave */}
            <path d="M5 8 Q7 7 8 8 L8 14 Q7 13 5 14 Z" fill="#ffff00"/>
          </svg>
          <span style={{ marginTop: '-1px' }}>Start</span>
        </button>

        {/* Start Menu */}
        {startMenuOpen && (
          <Win95StartMenu
            onClose={() => setStartMenuOpen(false)}
            onOpenPanel={onOpenPanel}
            onShowDialog={setDialog}
          />
        )}

        {/* Taskbar divider */}
        <div style={{ width: '2px', height: '22px', borderLeft: '1px solid #808080', borderRight: '1px solid #ffffff', marginLeft: '2px', marginRight: '2px' }} />

        {/* Taskbar buttons for all open windows - with icons */}
        {openPanels.map((panel) => {
          const config = WINDOW_CONFIG[panel]
          const isTop = openPanels[openPanels.length - 1] === panel && !isMinimized(panel)
          const iconType = panel === 'about' ? 'my-computer' :
                          panel === 'github' ? 'msdos' :
                          panel === 'travel' ? 'notepad' : 'setup'
          return (
            <button
              key={panel}
              ref={(el) => { taskbarButtonRefs.current[panel] = el }}
              onClick={() => handleTaskbarClick(panel)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                height: '22px',
                minWidth: '80px',
                maxWidth: '140px',
                background: '#c0c0c0',
                border: 'none',
                boxShadow: isTop
                  ? 'inset 1px 1px #404040, inset -1px -1px #ffffff'
                  : 'inset -1px -1px #404040, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf',
                fontSize: '11px',
                fontFamily: 'MS Sans Serif, Tahoma, sans-serif',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ width: '16px', height: '16px', flexShrink: 0 }}>
                <Win95IconImage type={iconType} size={16} />
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {config.title.split(' - ')[0]}
              </span>
            </button>
          )
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* System tray with sunken border */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 8px',
          height: '22px',
          background: '#c0c0c0',
          border: '1px inset #c0c0c0',
          fontSize: '11px',
          fontFamily: 'MS Sans Serif, Tahoma, sans-serif',
        }}>
          {/* Volume icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
            <rect x="2" y="5" width="4" height="6" fill="#000"/>
            <path d="M6 5 L10 2 L10 14 L6 11 Z" fill="#808080"/>
            <path d="M11 5 Q13 8 11 11" stroke="#000" strokeWidth="1" fill="none"/>
          </svg>
          {/* Clock */}
          <span>{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
        </div>
      </div>

      {/* Win95 Window Panels - render all open, non-minimized windows */}
      {openPanels.map((panel) => {
        if (isMinimized(panel)) return null
        const config = WINDOW_CONFIG[panel]
        return (
          <Win95Window
            key={panel}
            title={config.title}
            onClose={() => onClosePanel(panel)}
            onMinimize={() => handleMinimize(panel)}
            onFocus={() => onFocusPanel(panel)}
            initialX={config.initialX}
            initialY={config.initialY}
            zIndex={getZIndex(panel)}
            taskbarButtonRect={getTaskbarButtonRect(panel)}
          >
            {renderWindowContent(panel)}
          </Win95Window>
        )
      })}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={getContextMenuItems()}
        />
      )}

      {/* Win95-style Dialog */}
      {dialog && (
        <Win95Dialog
          title={dialog.title}
          message={dialog.message}
          type={dialog.type}
          showCancel={dialog.showCancel}
          onOk={() => {
            dialog.onOk()
            setDialog(null)
          }}
          onCancel={() => {
            dialog.onCancel?.()
            setDialog(null)
          }}
        />
      )}
    </div>
  )
}

// Full 3D CRT Monitor with screen content
function CRTMonitor3D({
  screenOn,
  biosLines,
  bootLines,
  loadingProgress,
  phase,
  desktopIcons,
  openPanels,
  onClosePanel,
  onOpenPanel,
  onFocusPanel,
}: {
  screenOn: boolean
  biosLines: number
  bootLines: number
  loadingProgress: number
  phase: Phase
  desktopIcons: DesktopIcon[]
  openPanels: PanelId[]
  onClosePanel: (panel: PanelId) => void
  onOpenPanel: (panel: PanelId) => void
  onFocusPanel: (panel: PanelId) => void
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
            <Win95Desktop
              desktopIcons={desktopIcons}
              openPanels={openPanels}
              onClosePanel={onClosePanel}
              onOpenPanel={onOpenPanel}
              onFocusPanel={onFocusPanel}
            />
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

// Bookshelf Component
function Bookshelf({ onClick }: { onClick?: () => void }) {
  return (
    <group position={[0, 0.8, -3.5]} onClick={onClick}>
      {/* Main shelf frame - dark wood */}
      <mesh>
        <boxGeometry args={[3.5, 2.5, 0.4]} />
        <meshStandardMaterial color="#2a1810" roughness={0.85} />
      </mesh>

      {/* Shelf dividers */}
      {[-0.6, 0.4].map((y, i) => (
        <mesh key={i} position={[0, y, 0.05]}>
          <boxGeometry args={[3.3, 0.06, 0.35]} />
          <meshStandardMaterial color="#3a2820" roughness={0.8} />
        </mesh>
      ))}

      {/* Books on middle shelf */}
      {[
        { x: -1.2, color: '#4a3030', h: 0.55 },
        { x: -0.9, color: '#3a4050', h: 0.5 },
        { x: -0.6, color: '#E85D4C', h: 0.52 }, // Rust book - accent color
        { x: -0.3, color: '#2a3a2a', h: 0.48 },
        { x: 0.0, color: '#4a4a3a', h: 0.54 },
        { x: 0.3, color: '#3a3a4a', h: 0.5 },
        { x: 0.6, color: '#5a4a3a', h: 0.51 },
        { x: 0.9, color: '#3a4a4a', h: 0.53 },
      ].map((book, i) => (
        <mesh key={i} position={[book.x, 0, 0.05]}>
          <boxGeometry args={[0.18, book.h, 0.28]} />
          <meshStandardMaterial color={book.color} roughness={0.7} />
        </mesh>
      ))}

      {/* Photo frame on top shelf */}
      <mesh position={[-0.8, 0.85, 0.1]}>
        <boxGeometry args={[0.35, 0.45, 0.03]} />
        <meshStandardMaterial color="#4a3020" roughness={0.6} />
      </mesh>
      <mesh position={[-0.8, 0.85, 0.12]}>
        <boxGeometry args={[0.28, 0.38, 0.01]} />
        <meshStandardMaterial color="#8a9aaa" roughness={0.4} />
      </mesh>

      {/* Small plant on top shelf */}
      <group position={[0.7, 0.75, 0.1]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.1, 0.18, 8]} />
          <meshStandardMaterial color="#5a4030" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color="#2a5a2a" roughness={0.8} />
        </mesh>
      </group>

      {/* Mug on bottom shelf */}
      <group position={[1.0, -0.8, 0.08]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.07, 0.14, 16]} />
          <meshStandardMaterial color="#d4d0c8" roughness={0.5} />
        </mesh>
        {/* Handle */}
        <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.05, 0.015, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#d4d0c8" roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

// World Map on Wall
function WorldMapDecor({ onClick }: { onClick?: () => void }) {
  return (
    <group position={[-4.5, 1.2, -3]} rotation={[0, 0.3, 0]} onClick={onClick}>
      {/* Frame */}
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[2.2, 1.5, 0.06]} />
        <meshStandardMaterial color="#3a2820" roughness={0.8} />
      </mesh>
      {/* Map surface */}
      <mesh>
        <planeGeometry args={[2, 1.3]} />
        <meshStandardMaterial color="#e8e0d0" roughness={0.6} />
      </mesh>
      {/* Continents (simplified shapes) */}
      <mesh position={[-0.5, 0.2, 0.01]}>
        <planeGeometry args={[0.6, 0.4]} />
        <meshStandardMaterial color="#9a9a8a" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0.3, 0.1, 0.01]}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshStandardMaterial color="#9a9a8a" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0.6, -0.3, 0.01]}>
        <planeGeometry args={[0.3, 0.25]} />
        <meshStandardMaterial color="#9a9a8a" transparent opacity={0.6} />
      </mesh>
      {/* Location pins */}
      {[
        [0.35, 0.15], // China area
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.02]}>
          <circleGeometry args={[0.03, 16]} />
          <meshBasicMaterial color="#E85D4C" />
        </mesh>
      ))}
    </group>
  )
}

// Window with city view
function WindowWithView() {
  return (
    <group position={[4.5, 1.5, -2]} rotation={[0, -0.4, 0]}>
      {/* Window frame - dark wood */}
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[2.4, 2, 0.15]} />
        <meshStandardMaterial color="#2a1810" roughness={0.85} />
      </mesh>

      {/* Window glass - night city view (blue gradient) */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[2.1, 1.7]} />
        <meshStandardMaterial
          color="#334455"
          roughness={0.1}
          metalness={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* City silhouette */}
      {[
        { x: -0.7, h: 0.4, w: 0.15 },
        { x: -0.45, h: 0.6, w: 0.18 },
        { x: -0.2, h: 0.35, w: 0.12 },
        { x: 0.0, h: 0.7, w: 0.2 },
        { x: 0.25, h: 0.45, w: 0.14 },
        { x: 0.5, h: 0.55, w: 0.16 },
        { x: 0.7, h: 0.38, w: 0.13 },
      ].map((building, i) => (
        <mesh key={i} position={[building.x, -0.5 + building.h / 2, -0.01]}>
          <boxGeometry args={[building.w, building.h, 0.01]} />
          <meshBasicMaterial color="#1a2530" />
        </mesh>
      ))}

      {/* Window lights in buildings */}
      {[
        [-0.45, -0.3], [-0.45, -0.1], [-0.45, 0.1],
        [0.0, -0.3], [0.0, -0.1], [0.0, 0.1], [0.0, 0.3],
        [0.5, -0.2], [0.5, 0.0], [0.5, 0.15],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <planeGeometry args={[0.04, 0.03]} />
          <meshBasicMaterial color="#ffcc88" transparent opacity={0.8} />
        </mesh>
      ))}

      {/* Cross frame dividers */}
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[0.06, 1.7, 0.04]} />
        <meshStandardMaterial color="#3a2820" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[2.1, 0.06, 0.04]} />
        <meshStandardMaterial color="#3a2820" roughness={0.8} />
      </mesh>

      {/* Blue light from window */}
      <pointLight position={[0, 0, 1]} intensity={1.2} color="#445566" distance={6} />
    </group>
  )
}

// Desk Lamp
function DeskLamp({ lampOn, onClick }: { lampOn: boolean, onClick?: () => void }) {
  return (
    <group position={[-2.2, -1.98, 0.2]} onClick={onClick}>
      {/* Invisible hitbox for easier clicking */}
      <mesh position={[0, 0.4, -0.1]}>
        <boxGeometry args={[0.6, 1.0, 0.6]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Base */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.05, 16]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Arm - lower */}
      <mesh position={[0, 0.25, 0]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.7} />
      </mesh>

      {/* Arm - upper */}
      <mesh position={[0, 0.55, -0.15]} rotation={[-0.5, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.4, 8]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.7} />
      </mesh>

      {/* Lamp shade */}
      <mesh position={[0, 0.7, -0.3]} rotation={[0.6, 0, 0]}>
        <coneGeometry args={[0.15, 0.2, 16, 1, true]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Warm light when on */}
      {lampOn && (
        <>
          <pointLight position={[0, 0.6, -0.25]} intensity={3} color="#ff9944" distance={4} />
          <mesh position={[0, 0.65, -0.28]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#ffcc88" />
          </mesh>
        </>
      )}
    </group>
  )
}

// Decorative Plant
function Plant() {
  return (
    <group position={[2.3, -1.98, 0.3]}>
      {/* Pot */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.15, 0.12, 0.2, 16]} />
        <meshStandardMaterial color="#5a4030" roughness={0.9} />
      </mesh>

      {/* Soil */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.02, 16]} />
        <meshStandardMaterial color="#3a2a20" roughness={1} />
      </mesh>

      {/* Leaves (monstera-style simplified) */}
      {[
        { rx: -0.3, ry: 0, rz: 0.2, y: 0.4 },
        { rx: 0.2, ry: 1.5, rz: -0.3, y: 0.45 },
        { rx: -0.1, ry: 3, rz: 0.1, y: 0.35 },
        { rx: 0.3, ry: 4.5, rz: -0.2, y: 0.5 },
      ].map((leaf, i) => (
        <mesh key={i} position={[0, leaf.y, 0]} rotation={[leaf.rx, leaf.ry, leaf.rz]}>
          <sphereGeometry args={[0.12, 8, 4, 0, Math.PI]} />
          <meshStandardMaterial color="#2a6a3a" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

// Ceiling Light - Simple industrial Edison bulb pendant
function CeilingLight({ isOn, onClick }: { isOn: boolean, onClick?: () => void }) {
  return (
    <group position={[0, 2.2, -0.5]} onClick={onClick}>
      {/* Simple ceiling canopy */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.04, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Twisted fabric cord */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.42, 8]} />
        <meshStandardMaterial color="#2a2520" roughness={0.9} />
      </mesh>

      {/* Brass socket */}
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.1, 12]} />
        <meshStandardMaterial color="#8b7355" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Edison bulb - classic elongated shape */}
      <group position={[0, -0.26, 0]}>
        {/* Bulb glass */}
        <mesh>
          <capsuleGeometry args={[0.05, 0.1, 8, 16]} />
          <meshStandardMaterial
            color={isOn ? "#fff8e0" : "#e8e4dc"}
            roughness={0.1}
            metalness={0}
            transparent
            opacity={0.85}
            emissive={isOn ? "#ff9933" : "#000000"}
            emissiveIntensity={isOn ? 0.6 : 0}
          />
        </mesh>

        {/* Filament glow when on */}
        {isOn && (
          <mesh>
            <cylinderGeometry args={[0.006, 0.006, 0.06, 6]} />
            <meshBasicMaterial color="#ffaa44" />
          </mesh>
        )}
      </group>

      {/* Light when on */}
      {isOn && (
        <pointLight
          position={[0, -0.26, 0]}
          intensity={4}
          color="#ffeecc"
          distance={12}
        />
      )}
    </group>
  )
}

// Main 3D Scene - cozy lofi room with desk and CRT
function Scene({
  phase,
  biosLines,
  bootLines,
  loadingProgress,
  scrollProgress,
  desktopIcons,
  lampOn,
  openPanels,
  onClickBookshelf,
  onClickWorldMap,
  onClickLamp,
  onClosePanel,
  onOpenPanel,
  onFocusPanel,
}: {
  phase: Phase
  biosLines: number
  bootLines: number
  loadingProgress: number
  scrollProgress: number
  desktopIcons: DesktopIcon[]
  lampOn: boolean
  openPanels: PanelId[]
  onClickBookshelf?: () => void
  onClickWorldMap?: () => void
  onClickLamp?: () => void
  onClosePanel: (panel: PanelId) => void
  onOpenPanel: (panel: PanelId) => void
  onFocusPanel: (panel: PanelId) => void
}) {
  return (
    <>
      <CameraRig scrollProgress={scrollProgress} />

      {/* === LOFI ROOM LIGHTING === */}
      {/* Soft ambient - brighter when lamp is on */}
      <ambientLight intensity={lampOn ? 0.5 : 0.15} color={lampOn ? "#f5e8d8" : "#0a0805"} />

      {/* Main warm desk lamp light (when on) - fills the room */}
      {lampOn && (
        <>
          {/* Direct lamp light */}
          <pointLight
            position={[-2, 0, 1]}
            intensity={3}
            color="#ff9944"
            distance={10}
          />
          {/* Bounced light filling the room */}
          <pointLight
            position={[0, 1, 0]}
            intensity={1.5}
            color="#ffcc88"
            distance={12}
          />
        </>
      )}

      {/* Subtle fill from right - window light */}
      <pointLight
        position={[5, 2, 0]}
        intensity={lampOn ? 0.6 : 1.2}
        color="#445566"
        distance={10}
      />

      {/* Soft overhead fill */}
      <pointLight
        position={[0, 4, 2]}
        intensity={lampOn ? 0.3 : 0.6}
        color="#554433"
        distance={12}
      />

      {/* Screen glow when on - softer, teal tinted */}
      {phase !== 'startup' && (
        <pointLight position={[0, 0, 2.5]} intensity={0.8} color="#5A9A9A" distance={5} />
      )}

      {/* ===== LOFI ROOM ===== */}
      {/* Floor - dark wood planks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]} receiveShadow>
        <planeGeometry args={[25, 20]} />
        <meshStandardMaterial color="#1a1210" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Wood floor plank lines */}
      {[-6, -3, 0, 3, 6].map((x) => (
        <mesh key={`plank-${x}`} position={[x, -2.49, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.02, 20]} />
          <meshStandardMaterial color="#0a0805" transparent opacity={0.3} />
        </mesh>
      ))}

      {/* Back wall - dark warm */}
      <mesh position={[0, 2, -4]}>
        <planeGeometry args={[30, 15]} />
        <meshStandardMaterial color="#0f0d0a" roughness={0.95} />
      </mesh>

      {/* Left wall */}
      <mesh position={[-10, 2, 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[15, 12]} />
        <meshStandardMaterial color="#0d0a08" roughness={0.95} />
      </mesh>

      {/* Right wall */}
      <mesh position={[10, 2, 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[15, 12]} />
        <meshStandardMaterial color="#0d0a08" roughness={0.95} />
      </mesh>

      {/* ===== WOODEN DESK ===== */}
      {/* Desktop surface - warm dark wood */}
      <mesh position={[0, -2.05, -0.5]} receiveShadow>
        <boxGeometry args={[6, 0.12, 3]} />
        <meshStandardMaterial color="#2a1810" roughness={0.75} metalness={0.02} />
      </mesh>

      {/* Desk front edge trim */}
      <mesh position={[0, -2.05, 1]}>
        <boxGeometry args={[6, 0.08, 0.08]} />
        <meshStandardMaterial color="#3a2820" roughness={0.7} />
      </mesh>

      {/* Desk legs - wood */}
      {[[-2.7, -2.5, -1.8], [2.7, -2.5, -1.8], [-2.7, -2.5, 0.7], [2.7, -2.5, 0.7]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <boxGeometry args={[0.1, 0.9, 0.1]} />
          <meshStandardMaterial color="#2a1810" roughness={0.8} />
        </mesh>
      ))}

      {/* ===== ROOM DECORATIONS ===== */}
      <Bookshelf onClick={onClickBookshelf} />
      <WorldMapDecor onClick={onClickWorldMap} />
      <WindowWithView />
      <DeskLamp lampOn={lampOn} onClick={onClickLamp} />
      <Plant />

      {/* The CRT Monitor */}
      <CRTMonitor3D
        screenOn={phase !== 'startup'}
        biosLines={biosLines}
        bootLines={bootLines}
        loadingProgress={loadingProgress}
        phase={phase}
        desktopIcons={desktopIcons}
        openPanels={openPanels}
        onClosePanel={onClosePanel}
        onOpenPanel={onOpenPanel}
        onFocusPanel={onFocusPanel}
      />
    </>
  )
}

export function BootSequence3D({
  onComplete,
  scrollProgress = 0,
  onOpenPanel,
  onClosePanel,
  onFocusPanel,
  onToggleLamp,
  onToggleMusic,
  lampOn = true,
  openPanels = [],
}: BootSequence3DProps) {
  const [phase, setPhase] = useState<Phase>('startup')
  const [biosLine, setBiosLine] = useState(0)
  const [bootLine, setBootLine] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // Desktop icons configuration
  const desktopIcons: DesktopIcon[] = [
    {
      id: 'about',
      name: 'ABOUT.exe',
      icon: 'folder',
      action: () => onOpenPanel?.('about'),
    },
    {
      id: 'github',
      name: 'GitHub',
      icon: 'terminal',
      action: () => onOpenPanel?.('github'),
    },
    {
      id: 'travel',
      name: 'Travel.txt',
      icon: 'map',
      action: () => onOpenPanel?.('travel'),
    },
    {
      id: 'waterui',
      name: 'WaterUI',
      icon: 'droplet',
      action: () => onOpenPanel?.('waterui'),
    },
    {
      id: 'music',
      name: 'Music',
      icon: 'speaker',
      action: () => onToggleMusic?.(),
    },
  ]

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
            desktopIcons={desktopIcons}
            lampOn={lampOn}
            openPanels={openPanels ?? []}
            onClickBookshelf={() => onOpenPanel?.('about')}
            onClickWorldMap={() => onOpenPanel?.('travel')}
            onClickLamp={() => onToggleLamp?.()}
            onClosePanel={(panel) => onClosePanel?.(panel)}
            onOpenPanel={(panel) => onOpenPanel?.(panel)}
            onFocusPanel={(panel) => onFocusPanel?.(panel)}
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
