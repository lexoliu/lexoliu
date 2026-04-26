import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fonts, palette, SCREEN_HEIGHT, SCREEN_WIDTH, TASKBAR_HEIGHT, win95Style } from '../shared'
import { MenuBar } from './Menu'
import type { DialogState } from './Dialog'
import { Win95IconImage } from './Icon'

interface WindowProps {
  title: string
  width?: number
  height?: number
  initialX: number
  initialY: number
  zIndex: number
  onClose: () => void
  onMinimize: () => void
  onFocus: () => void
  onShowDialog: (dialog: DialogState) => void
  children: ReactNode
}

const DEFAULT_WIDTH = 520
const DEFAULT_HEIGHT = 400

/**
 * Win95-style draggable, minimisable, maximisable window. Drag shows the
 * authentic dotted ghost outline; release snaps the actual window.
 */
export function Win95Window({
  title,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  initialX,
  initialY,
  zIndex,
  onClose,
  onMinimize,
  onFocus,
  onShowDialog,
  children,
}: WindowProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY })
  const [isDragging, setIsDragging] = useState(false)
  const [ghostPosition, setGhostPosition] = useState({ x: 0, y: 0 })
  const dragOffset = useRef({ x: 0, y: 0 })
  const [isMaximized, setIsMaximized] = useState(false)

  const currentWidth = isMaximized ? SCREEN_WIDTH : width
  const currentHeight = isMaximized ? SCREEN_HEIGHT - TASKBAR_HEIGHT : height

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return
    setIsDragging(true)
    setGhostPosition(position)
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, Math.min(SCREEN_WIDTH - currentWidth, e.clientX - dragOffset.current.x))
      const newY = Math.max(0, Math.min(SCREEN_HEIGHT - currentHeight, e.clientY - dragOffset.current.y))
      setGhostPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setPosition(ghostPosition)
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, ghostPosition, currentWidth, currentHeight])

  const handleMaximize = () => {
    setIsMaximized((prev) => {
      if (!prev) setPosition({ x: 0, y: 0 })
      else setPosition({ x: initialX, y: initialY })
      return !prev
    })
  }

  return (
    <>
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            left: ghostPosition.x,
            top: ghostPosition.y,
            width: currentWidth,
            height: currentHeight,
            border: `2px dotted ${palette.black}`,
            zIndex: zIndex + 100,
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        onMouseDown={onFocus}
        style={{
          ...win95Style.windowFrame,
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: currentWidth,
          height: currentHeight,
          display: 'flex',
          flexDirection: 'column',
          zIndex,
          userSelect: 'none',
          visibility: isDragging ? 'hidden' : 'visible',
        }}
      >
        <TitleBar
          title={title}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleMaximize}
          onMinimize={onMinimize}
          onMaximize={handleMaximize}
          onClose={onClose}
        />
        <MenuBar
          onCloseWindow={onClose}
          onShowAbout={() => onShowDialog({
            title: 'About Lexo Desktop',
            message: 'Lexo Desktop v1.0\n\nBuilt with React + Three.js',
            type: 'info',
            showCancel: false,
            onOk: () => {},
          })}
        />
        <div style={{ ...win95Style.contentArea, flex: 1 }}>{children}</div>
        <StatusBar />
      </div>
    </>
  )
}

interface TitleBarProps {
  title: string
  onMouseDown: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
}

function TitleBar({ title, onMouseDown, onDoubleClick, onMinimize, onMaximize, onClose }: TitleBarProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      style={{
        ...win95Style.titleBar,
        margin: '2px 2px 0 2px',
        cursor: 'default',
        gap: '3px',
      }}
    >
      <div style={{ width: '16px', height: '16px', flexShrink: 0 }}>
        <Win95IconImage type="small-window" size={16} />
      </div>
      <span style={{
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {title}
      </span>
      <div style={{ display: 'flex', gap: '2px' }} onMouseDown={(e) => e.stopPropagation()}>
        <ChromeButton onClick={onMinimize} aria-label="Minimize">
          <div style={{ width: '6px', height: '2px', background: palette.black, marginTop: '8px' }} />
        </ChromeButton>
        <ChromeButton onClick={onMaximize} aria-label="Maximize">
          <div style={{ width: '9px', height: '9px', border: `1px solid ${palette.black}`, borderTop: `2px solid ${palette.black}` }} />
        </ChromeButton>
        <ChromeButton onClick={onClose} aria-label="Close">
          <span style={{ fontFamily: 'Marlett, Arial', fontSize: '10px', fontWeight: 'bold', lineHeight: '14px' }}>✕</span>
        </ChromeButton>
      </div>
    </div>
  )
}

interface ChromeButtonProps {
  onClick: () => void
  children: ReactNode
  'aria-label': string
}

function ChromeButton({ onClick, children, ...rest }: ChromeButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      style={{
        ...win95Style.raisedButton,
        width: '16px',
        height: '14px',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

function StatusBar() {
  return (
    <div style={{
      height: '18px',
      background: palette.buttonFace,
      borderTop: `1px solid ${palette.shadow}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 4px',
      fontSize: '10px',
      color: palette.darkShadow,
      fontFamily: fonts.body,
    }}>
      Ready
    </div>
  )
}
