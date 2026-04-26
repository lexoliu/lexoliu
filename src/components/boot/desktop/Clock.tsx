import { fonts, palette } from '../shared'
import { useNow } from '../hooks/useNow'

const TIME_FMT: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
}

const VolumeIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }}>
    <rect x="2" y="5" width="4" height="6" fill="#000" />
    <path d="M6 5 L10 2 L10 14 L6 11 Z" fill="#808080" />
    <path d="M11 5 Q13 8 11 11" stroke="#000" strokeWidth="1" fill="none" />
  </svg>
)

/** Inset system tray with auto-updating clock and a volume icon. */
export function SystemTray() {
  const now = useNow(15_000)
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '2px 8px',
      height: '22px',
      background: palette.buttonFace,
      border: `1px inset ${palette.silver}`,
      fontSize: '11px',
      fontFamily: fonts.win95,
      color: palette.black,
    }}>
      {VolumeIcon}
      <span>{now.toLocaleTimeString('en-US', TIME_FMT)}</span>
    </div>
  )
}
