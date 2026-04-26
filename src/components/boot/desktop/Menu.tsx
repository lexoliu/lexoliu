import { useRef, useState } from 'react'
import { fonts, palette } from '../shared'
import { useClickOutside } from '../hooks/useClickOutside'

export interface MenuItem {
  label: string
  shortcut?: string
  disabled?: boolean
  divider?: boolean
  onClick?: () => void
}

interface DropdownMenuProps {
  items: MenuItem[]
  onClose: () => void
  position?: { top?: string | number; left?: string | number; right?: string | number; bottom?: string | number }
  minWidth?: number
}

/** A Win95 cascading menu (file menu, context menu body, programs submenu). */
export function DropdownMenu({ items, onClose, position, minWidth = 160 }: DropdownMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClose)

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: position?.top ?? '100%',
        left: position?.left ?? 0,
        right: position?.right,
        bottom: position?.bottom,
        background: palette.buttonFace,
        border: `1px solid ${palette.shadow}`,
        boxShadow: `inset -1px -1px ${palette.darkShadow}, inset 1px 1px ${palette.hilight}, 2px 2px 4px rgba(0,0,0,0.3)`,
        minWidth: `${minWidth}px`,
        padding: '2px',
        zIndex: 300,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} style={{ height: '1px', background: palette.shadow, margin: '4px 2px', boxShadow: `0 1px 0 ${palette.hilight}` }} />
        ) : (
          <MenuItemButton
            key={i}
            label={item.label}
            shortcut={item.shortcut}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return
              item.onClick?.()
              onClose()
            }}
          />
        ),
      )}
    </div>
  )
}

interface MenuItemButtonProps {
  label: string
  shortcut?: string
  disabled?: boolean
  onClick: () => void
  paddingLeft?: number
}

export function MenuItemButton({ label, shortcut, disabled, onClick, paddingLeft = 24 }: MenuItemButtonProps) {
  const [hover, setHover] = useState(false)
  const active = hover && !disabled
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        padding: `3px 20px 3px ${paddingLeft}px`,
        background: active ? palette.navy : 'transparent',
        color: disabled ? palette.shadow : active ? palette.white : palette.black,
        border: 'none',
        textAlign: 'left',
        fontSize: '11px',
        fontFamily: fonts.body,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span>{label}</span>
      {shortcut && <span style={{ marginLeft: '20px' }}>{shortcut}</span>}
    </button>
  )
}

interface MenuBarProps {
  onCloseWindow: () => void
  onShowAbout: () => void
}

const MENU_BAR_DEFS = (onCloseWindow: () => void, onShowAbout: () => void): Record<string, MenuItem[]> => ({
  File: [
    { label: 'New', shortcut: 'Ctrl+N', disabled: true },
    { label: 'Open...', shortcut: 'Ctrl+O', disabled: true },
    { label: 'Save', shortcut: 'Ctrl+S', disabled: true },
    { label: 'Save As...', disabled: true },
    { divider: true, label: '' },
    { label: 'Print...', shortcut: 'Ctrl+P', disabled: true },
    { divider: true, label: '' },
    { label: 'Exit', onClick: onCloseWindow },
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
    { label: 'About', onClick: onShowAbout },
  ],
})

export function MenuBar({ onCloseWindow, onShowAbout }: MenuBarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const menus = MENU_BAR_DEFS(onCloseWindow, onShowAbout)

  return (
    <div style={{
      height: '20px',
      background: palette.buttonFace,
      display: 'flex',
      alignItems: 'center',
      borderBottom: `1px solid ${palette.shadow}`,
    }}>
      {Object.keys(menus).map((name) => (
        <div key={name} style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setActiveMenu((m) => (m === name ? null : name))
            }}
            onMouseEnter={() => activeMenu && setActiveMenu(name)}
            style={{
              background: activeMenu === name ? palette.navy : 'transparent',
              color: activeMenu === name ? palette.white : palette.black,
              border: 'none',
              padding: '2px 8px',
              fontSize: '11px',
              fontFamily: fonts.body,
              cursor: 'pointer',
            }}
          >
            {name}
          </button>
          {activeMenu === name && (
            <DropdownMenu items={menus[name]} onClose={() => setActiveMenu(null)} />
          )}
        </div>
      ))}
    </div>
  )
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  return (
    <DropdownMenu
      items={items}
      onClose={onClose}
      position={{ left: x, top: y }}
      minWidth={120}
    />
  )
}
