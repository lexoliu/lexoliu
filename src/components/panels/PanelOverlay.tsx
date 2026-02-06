import { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PanelOverlayProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

export function PanelOverlay({ isOpen, onClose, children, title }: PanelOverlayProps) {
  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* OMORI-style panel */}
          <motion.div
            className="relative bg-white border-4 border-black p-8 max-w-2xl max-h-[80vh] overflow-auto"
            style={{
              boxShadow: '8px 8px 0 0 rgba(0,0,0,1)',
            }}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-black hover:bg-black hover:text-white transition-colors border-2 border-black"
              style={{ fontFamily: 'var(--font-pixel)' }}
              aria-label="Close"
            >
              X
            </button>

            {/* Title */}
            {title && (
              <h2
                className="text-black text-2xl font-bold mb-6 pr-8"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {title}
              </h2>
            )}

            {/* Content */}
            <div className="text-black">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
