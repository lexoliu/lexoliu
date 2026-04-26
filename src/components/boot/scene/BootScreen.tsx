import { fonts, palette, BIOS_LINES, BOOT_LINES, type Phase } from '../shared'

interface BootScreenProps {
  phase: Phase
  biosLines: number
  bootLines: number
  loadingProgress: number
  screenOn: boolean
}

/**
 * Renders the inside-screen content for any phase EXCEPT desktop. Desktop is
 * handled by the `<Desktop>` component instead.
 */
export function BootScreen({ phase, biosLines, bootLines, loadingProgress, screenOn }: BootScreenProps) {
  if (!screenOn) return <PowerOffOverlay />
  if (phase === 'bios') return <BiosOutput shown={biosLines} />
  if (phase === 'boot' || phase === 'loading') return <BootOutput shown={bootLines} phase={phase} progress={loadingProgress} />
  return null
}

function BiosOutput({ shown }: { shown: number }) {
  return (
    <div style={{ color: palette.bios }}>
      {BIOS_LINES.slice(0, shown).map((line, i) => (
        <div key={i} style={{ color: i === 0 ? palette.biosHeader : palette.bios }}>
          {line || ' '}
        </div>
      ))}
      {shown < BIOS_LINES.length && <BlinkingCursor />}
    </div>
  )
}

function BootOutput({ shown, phase, progress }: { shown: number; phase: Phase; progress: number }) {
  return (
    <div>
      <div style={{ color: palette.led }}>
        {BOOT_LINES.slice(0, shown).map((line, i) => (
          <div key={i} style={{ color: line.includes('[!]') ? palette.biosWarn : palette.led }}>
            {line || ' '}
          </div>
        ))}
      </div>
      {phase === 'loading' && <LoadingBar progress={progress} />}
    </div>
  )
}

function LoadingBar({ progress }: { progress: number }) {
  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ color: palette.desktopTeal, textAlign: 'center', marginBottom: '8px', fontSize: '13px' }}>
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
          width: `${progress}%`,
          background: `linear-gradient(90deg, ${palette.desktopTeal}, #7ABABA)`,
          transition: 'width 0.1s ease-out',
        }} />
      </div>
      <div style={{ color: '#555', textAlign: 'center', marginTop: '6px', fontSize: '12px' }}>
        {Math.floor(progress)}%
      </div>
    </div>
  )
}

function BlinkingCursor() {
  return (
    <span style={{
      display: 'inline-block',
      width: '10px',
      height: '16px',
      background: palette.bios,
      animation: 'lexoBlink 1s step-end infinite',
    }} />
  )
}

function PowerOffOverlay() {
  return (
    <div style={{ color: '#5f5f5f', textAlign: 'center', marginTop: '45%', fontSize: '12px', fontFamily: fonts.mono }}>
      POWER OFF
    </div>
  )
}
