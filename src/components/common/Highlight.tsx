import type { ReactNode } from 'react'

interface HighlightProps {
  children: ReactNode
  color?: 'yellow' | 'teal' | 'red'
  variant?: 'underline' | 'background'
}

export function Highlight({
  children,
  color = 'yellow',
  variant = 'underline',
}: HighlightProps) {
  const colors = {
    yellow: {
      underline: 'linear-gradient(180deg, transparent 60%, var(--color-highlight) 60%)',
      background: 'var(--color-highlight-soft)',
    },
    teal: {
      underline: 'linear-gradient(180deg, transparent 60%, var(--color-bg-light) 60%)',
      background: 'rgba(122, 163, 176, 0.3)',
    },
    red: {
      underline: 'linear-gradient(180deg, transparent 60%, var(--color-accent-soft) 60%)',
      background: 'rgba(240, 113, 103, 0.2)',
    },
  }

  if (variant === 'underline') {
    return (
      <span
        className="px-1"
        style={{ background: colors[color].underline }}
      >
        {children}
      </span>
    )
  }

  return (
    <span
      className="px-2 py-0.5 rounded-sm"
      style={{ backgroundColor: colors[color].background }}
    >
      {children}
    </span>
  )
}
