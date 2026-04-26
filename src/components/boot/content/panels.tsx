import { palette } from '../shared'

const ACCENT_TEXT = { color: palette.accent, fontWeight: 'bold' as const }
const NAVY_TEXT = { color: palette.navy }
const SUBTLE_TEXT = { color: '#606060' }
const HINT_TEXT = { color: palette.shadow }

const HOBBIES = ['Coding', 'Travel', 'Photo', 'Food', 'Reading'] as const
const CITIES = ['Hangzhou', 'Shanghai', 'Beijing', 'Chengdu', 'Xian'] as const
const PINNED_REPOS = [
  { name: 'waterui', desc: 'Cross-platform GUI framework for Rust', lang: 'Rust' },
  { name: 'lexoliu.github.io', desc: 'Personal website', lang: 'TypeScript' },
] as const

export function AboutContent() {
  return (
    <div style={{ lineHeight: 1.5 }}>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', ...NAVY_TEXT }}>Lexo</div>
        <div style={{ fontSize: '11px', ...HINT_TEXT }}>Software Developer</div>
      </div>
      <Section label="About:">
        <div>I love coding, especially <span style={ACCENT_TEXT}>Rust</span>.</div>
        <div style={{ marginTop: '4px', fontSize: '11px', color: '#404040' }}>
          Building a cross-platform GUI framework to make Rust development easier.
        </div>
      </Section>
      <Section label="Hobbies:">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {HOBBIES.map((hobby) => (
            <span
              key={hobby}
              style={{
                padding: '2px 8px',
                background: palette.buttonFace,
                border: `1px solid ${palette.shadow}`,
                fontSize: '10px',
              }}
            >
              {hobby}
            </span>
          ))}
        </div>
      </Section>
      <Section label="Current Focus:">
        <div style={{ fontSize: '11px' }}>
          Building <span style={NAVY_TEXT}>WaterUI</span> — a cross-platform GUI framework for Rust
        </div>
      </Section>
      <div style={{ borderTop: `1px solid ${palette.buttonFace}`, paddingTop: '8px', fontSize: '10px', ...HINT_TEXT }}>
        Contact: me@lexo.cool
      </div>
    </div>
  )
}

export function GitHubContent() {
  return (
    <div style={{ lineHeight: 1.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <GitHubMark />
        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>@lexoliu</span>
      </div>
      <Section label="Pinned Repositories:">
        {PINNED_REPOS.map((repo) => (
          <div
            key={repo.name}
            style={{
              padding: '8px',
              marginBottom: '6px',
              background: '#f5f5f5',
              border: `1px solid ${palette.buttonFace}`,
            }}
          >
            <div style={{ fontWeight: 'bold', ...NAVY_TEXT, fontSize: '12px' }}>{repo.name}</div>
            <div style={{ fontSize: '10px', ...SUBTLE_TEXT, marginTop: '2px' }}>{repo.desc}</div>
            <div style={{ fontSize: '9px', ...HINT_TEXT, marginTop: '4px' }}>
              <span style={{ color: palette.accent }}>*</span> {repo.lang}
            </div>
          </div>
        ))}
      </Section>
      <ExternalLink href="https://github.com/lexoliu">View Profile</ExternalLink>
    </div>
  )
}

export function TravelContent() {
  return (
    <div style={{ lineHeight: 1.5 }}>
      <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>
        Travel Map · Visited Cities
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        marginBottom: '16px',
      }}>
        {CITIES.map((city) => (
          <div
            key={city}
            style={{
              padding: '8px 12px',
              background: '#f5f5f5',
              border: `1px solid ${palette.buttonFace}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ color: palette.accent, fontSize: '16px' }}>*</span>
            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{city}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '10px', ...SUBTLE_TEXT, textAlign: 'center' }}>
        Click on desktop icons to explore more...
      </div>
    </div>
  )
}

export function WaterUIContent() {
  return (
    <div style={{ lineHeight: 1.5, textAlign: 'center' }}>
      <div style={{
        width: '64px',
        height: '64px',
        margin: '0 auto 12px',
        background: '#000',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <img
          src="https://avatars.githubusercontent.com/u/154332053?s=200&v=4"
          alt="WaterUI"
          style={{ width: '100%', height: '100%', borderRadius: '8px' }}
        />
      </div>
      <div style={{ fontSize: '20px', fontWeight: 'bold', ...NAVY_TEXT, marginBottom: '4px' }}>
        WaterUI
      </div>
      <div style={{ fontSize: '12px', ...HINT_TEXT, marginBottom: '16px' }}>
        Learn Rust, Run Native
      </div>
      <div style={{
        textAlign: 'left',
        padding: '12px',
        background: '#f5f5f5',
        border: `1px solid ${palette.buttonFace}`,
        marginBottom: '16px',
        fontSize: '11px',
      }}>
        A cross-platform GUI framework for Rust that aims to make native app development simple and enjoyable.
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
        <ExternalLink href="https://github.com/water-rs/waterui">GitHub</ExternalLink>
        <ExternalLink href="https://waterui.dev">Website</ExternalLink>
      </div>
    </div>
  )
}

interface SectionProps {
  label: string
  children: React.ReactNode
}

function Section({ label, children }: SectionProps) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{label}</div>
      {children}
    </div>
  )
}

interface ExternalLinkProps {
  href: string
  children: React.ReactNode
}

function ExternalLink({ href, children }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        background: palette.buttonFace,
        border: `1px solid ${palette.shadow}`,
        boxShadow: `inset -1px -1px ${palette.darkShadow}, inset 1px 1px ${palette.hilight}`,
        textDecoration: 'none',
        color: palette.black,
        fontSize: '11px',
        cursor: 'pointer',
      }}
    >
      {children}
    </a>
  )
}

function GitHubMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#000">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}
