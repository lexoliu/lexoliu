import type { ReactNode } from 'react'
import { fonts, palette, win95Style } from '../shared'

export type DialogType = 'info' | 'warning' | 'error' | 'question'

export interface DialogState {
  title: string
  message: string
  type: DialogType
  showCancel: boolean
  onOk: () => void
  onCancel?: () => void
}

interface DialogProps {
  state: DialogState
  onResolve: (ok: boolean) => void
}

const DIALOG_ICONS: Record<DialogType, ReactNode> = {
  info: (
    <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
      <circle cx="16" cy="16" r="14" fill="#ffffff" stroke="#000080" strokeWidth="2" />
      <text x="16" y="22" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#000080">i</text>
    </svg>
  ),
  warning: (
    <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
      <path d="M16 2 L30 28 L2 28 Z" fill="#ffff00" stroke="#000000" strokeWidth="1" />
      <text x="16" y="24" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#000000">!</text>
    </svg>
  ),
  error: (
    <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
      <circle cx="16" cy="16" r="14" fill="#ff0000" stroke="#800000" strokeWidth="2" />
      <text x="16" y="22" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#ffffff">X</text>
    </svg>
  ),
  question: (
    <svg width="32" height="32" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
      <circle cx="16" cy="16" r="14" fill="#ffffff" stroke="#000080" strokeWidth="2" />
      <text x="16" y="22" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#000080">?</text>
    </svg>
  ),
}

export function Dialog({ state, onResolve }: DialogProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500,
        background: 'rgba(0, 0, 0, 0.18)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ ...win95Style.windowFrame, minWidth: '280px', maxWidth: '400px', boxShadow: '2px 2px 8px rgba(0,0,0,0.5)' }}>
        <div style={{ ...win95Style.titleBar, margin: '2px 2px 0 2px' }}>
          {state.title}
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0 }}>{DIALOG_ICONS[state.type]}</div>
          <div style={{ fontSize: '11px', fontFamily: fonts.win95, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
            {state.message}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '8px 16px 16px' }}>
          <button onClick={() => onResolve(true)} style={{ ...win95Style.raisedButton, minWidth: '75px', height: '23px', color: palette.black }}>
            OK
          </button>
          {state.showCancel && (
            <button onClick={() => onResolve(false)} style={{ ...win95Style.raisedButton, minWidth: '75px', height: '23px', color: palette.black }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
