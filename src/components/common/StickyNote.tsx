import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface StickyNoteProps {
  children: ReactNode
  color?: 'cream' | 'warm' | 'aged'
  rotation?: number
  className?: string
  tapeFix?: 'top' | 'corner' | 'none'
}

export function StickyNote({
  children,
  color = 'cream',
  rotation = 0,
  className = '',
  tapeFix = 'top',
}: StickyNoteProps) {
  const colorStyles = {
    cream: 'bg-paper',
    warm: 'bg-paper-warm',
    aged: 'bg-paper-aged',
  }

  return (
    <motion.div
      className={`relative cursor-default ${className}`}
      initial={{ opacity: 0, scale: 0.9, rotate: rotation - 5, y: 20 }}
      animate={{ opacity: 1, scale: 1, rotate: rotation, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 120,
        damping: 14,
      }}
      whileHover={{
        scale: 1.02,
        rotate: rotation + 0.5,
        y: -4,
        boxShadow: '4px 8px 16px rgba(0,0,0,0.2)',
        transition: { type: 'spring', stiffness: 300, damping: 20 },
      }}
      whileTap={{
        scale: 0.99,
        rotate: rotation - 0.5,
        transition: { duration: 0.1 },
      }}
    >
      {/* Tape decoration - refined with glassmorphism, shadows and highlights */}
      {tapeFix === 'top' && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform -rotate-2">
          {/* Tape shadow */}
          <div className="absolute inset-0 translate-y-1 bg-black/10 rounded-sm blur-sm" />
          {/* Tape body - glassmorphism */}
          <div
            className="relative w-14 h-7 rounded-sm overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.6) 100%)',
              backdropFilter: 'blur(8px)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            {/* Highlight stripe */}
            <div
              className="absolute top-1 left-1 right-1 h-1 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
              }}
            />
            {/* Subtle texture lines */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
              }}
            />
          </div>
        </div>
      )}

      {tapeFix === 'corner' && (
        <div className="absolute -top-2 -right-2 transform rotate-45">
          {/* Tape shadow */}
          <div className="absolute inset-0 translate-y-1 translate-x-1 bg-black/10 rounded-sm blur-sm" />
          {/* Tape body - glassmorphism */}
          <div
            className="relative w-10 h-10 rounded-sm overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.6) 100%)',
              backdropFilter: 'blur(8px)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            {/* Diagonal highlight */}
            <div
              className="absolute top-0 left-0 w-full h-full"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%)',
              }}
            />
          </div>
        </div>
      )}

      {/* Paper body */}
      <div
        className={`${colorStyles[color]} paper-texture p-6 shadow-sticky relative`}
        style={{
          clipPath:
            'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)',
        }}
      >
        {/* Folded corner effect - more refined */}
        <div
          className="absolute bottom-0 right-0 w-5 h-5"
          style={{
            background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.08) 50%)',
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-4 h-4"
          style={{
            background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.03) 50%)',
            transform: 'translate(-1px, -1px)',
          }}
        />
        {children}
      </div>
    </motion.div>
  )
}
