import { useTranslation } from 'react-i18next'
import { PanelOverlay } from './PanelOverlay'

interface AboutPanelProps {
  isOpen: boolean
  onClose: () => void
}

// Hobby tag component - no emoji
function HobbyTag({ label, symbol }: { label: string; symbol: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-black/5 border border-black/20 text-black/80 text-sm"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      <span className="font-mono text-xs">{symbol}</span>
      <span>{label}</span>
    </span>
  )
}

export function AboutPanel({ isOpen, onClose }: AboutPanelProps) {
  const { t } = useTranslation()

  return (
    <PanelOverlay isOpen={isOpen} onClose={onClose} title={t('about.title')}>
      <div className="space-y-6">
        {/* Tagline */}
        <p
          className="text-xl leading-relaxed"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {t('about.intro1').split('Rust')[0]}
          <span className="text-[#E85D4C] font-bold">Rust</span>
          {t('about.intro1').split('Rust')[1] || '.'}
        </p>

        {/* Description */}
        <div className="space-y-3">
          <p
            className="text-base leading-relaxed text-black/80"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {t('about.intro2')}
          </p>
          <p
            className="text-sm leading-relaxed text-black/60"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {t('about.intro3')}
          </p>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-black/10" />

        {/* Hobbies */}
        <div>
          <p
            className="text-xs tracking-widest uppercase mb-3 text-black/50"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            {t('about.hobbies')}
          </p>
          <div className="flex flex-wrap gap-2">
            <HobbyTag label={t('about.hobby_coding')} symbol="<>" />
            <HobbyTag label={t('about.hobby_travel')} symbol="*" />
            <HobbyTag label={t('about.hobby_photo')} symbol="[]" />
            <HobbyTag label={t('about.hobby_food')} symbol="~" />
            <HobbyTag label={t('about.hobby_reading')} symbol="#" />
          </div>
        </div>

        {/* Current focus */}
        <div className="bg-black/5 border border-black/10 p-4">
          <p
            className="text-xs tracking-widest uppercase mb-2 text-black/50"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            CURRENT FOCUS
          </p>
          <p style={{ fontFamily: 'var(--font-mono)' }}>
            Building{' '}
            <a
              href="https://github.com/water-rs/waterui"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E85D4C] hover:underline"
            >
              WaterUI
            </a>{' '}
            - a cross-platform GUI framework for Rust
          </p>
        </div>
      </div>
    </PanelOverlay>
  )
}
