import type { CSSProperties } from 'react'

export type Phase =
  | 'startup'
  | 'bios'
  | 'boot'
  | 'loading'
  | 'desktop'
  /** Shutdown initiated (Win95 "Please wait while your computer shuts down" splash). */
  | 'shutting_down'
  /** Shutdown complete (Win95 "It is now safe to turn off your computer" splash). */
  | 'shutdown_safe'
export type PanelId = 'about' | 'github' | 'travel' | 'waterui'
export type IconKind = 'folder' | 'terminal' | 'map' | 'droplet' | 'speaker'

export interface DesktopIcon {
  id: string
  name: string
  icon: IconKind
  action: () => void
}

export const BIOS_LINES: readonly string[] = [
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

export const BOOT_LINES: readonly string[] = [
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

export const WINDOW_CONFIG: Record<PanelId, { title: string; initialX: number; initialY: number }> = {
  about: { title: 'About - Lexo', initialX: 80, initialY: 40 },
  github: { title: 'GitHub - @lexoliu', initialX: 100, initialY: 30 },
  travel: { title: 'Travel.txt - Notepad', initialX: 60, initialY: 50 },
  waterui: { title: 'WaterUI - Project', initialX: 90, initialY: 35 },
}

// Logical screen dimensions for the CRT html overlay; used for window clamping.
export const SCREEN_WIDTH = 680
export const SCREEN_HEIGHT = 500
export const TASKBAR_HEIGHT = 28

export const palette = {
  // Win95 chrome
  silver: '#c0c0c0',
  buttonFace: '#d4d0c8',
  hilight: '#ffffff',
  shadow: '#808080',
  darkShadow: '#404040',
  borderHilight: '#dfdfdf',

  // Win95 selection / titlebar
  navy: '#000080',
  navyLight: '#1084d0',
  white: '#ffffff',
  black: '#000000',

  // Desktop
  desktopTeal: '#5A9A9A',

  // Accents
  accent: '#E85D4C',
  accentSoft: '#ffae52',

  // Status colors
  led: '#33ff33',
  ledGlow: '#66ff88',
  ledOff: '#1a3320',

  // Screen
  screenOn: '#0a0a0a',
  screenOff: '#020202',
  bios: '#aaaaaa',
  biosHeader: '#ffffff',
  biosWarn: '#E85D4C',
} as const

export const fonts = {
  win95: '"MS Sans Serif", Tahoma, Arial, sans-serif',
  body: 'Tahoma, Arial, sans-serif',
  mono: '"Courier New", monospace',
} as const

// Canonical Win95 button border (raised look).
const raisedBorder = `inset -1px -1px ${palette.darkShadow}, inset 1px 1px ${palette.hilight}, inset -2px -2px ${palette.shadow}, inset 2px 2px ${palette.borderHilight}`
const sunkenBorder = `inset 1px 1px ${palette.darkShadow}, inset -1px -1px ${palette.hilight}, inset 2px 2px ${palette.shadow}, inset -2px -2px ${palette.borderHilight}`

export const win95Style: Record<string, CSSProperties> = {
  raisedButton: {
    background: palette.buttonFace,
    border: 'none',
    boxShadow: raisedBorder,
    fontFamily: fonts.win95,
    fontSize: '11px',
    cursor: 'pointer',
  },
  pressedButton: {
    background: palette.buttonFace,
    border: 'none',
    boxShadow: sunkenBorder,
    fontFamily: fonts.win95,
    fontSize: '11px',
    cursor: 'pointer',
  },
  windowFrame: {
    background: palette.silver,
    border: `2px outset ${palette.silver}`,
  },
  titleBar: {
    height: '18px',
    background: `linear-gradient(90deg, ${palette.navy} 0%, ${palette.navyLight} 100%)`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 4px',
    color: palette.white,
    fontFamily: fonts.win95,
    fontSize: '11px',
    fontWeight: 'bold',
  },
  contentArea: {
    margin: '0 2px',
    background: palette.white,
    border: `2px inset ${palette.silver}`,
    overflow: 'auto',
    padding: '8px',
    fontFamily: fonts.win95,
    fontSize: '11px',
  },
}

// Maps logical icon kind (used by 3D scene config) to the Win95 SVG icon name.
export const ICON_KIND_TO_WIN95: Record<IconKind, string> = {
  folder: 'my-computer',
  terminal: 'msdos',
  map: 'notepad',
  droplet: 'setup',
  speaker: 'cdplayer',
}

// Maps a panel to its Win95 SVG icon name (taskbar / start submenu).
export const PANEL_ICON: Record<PanelId, string> = {
  about: 'my-computer',
  github: 'msdos',
  travel: 'notepad',
  waterui: 'setup',
}
