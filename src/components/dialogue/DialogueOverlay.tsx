import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDialogue } from '@/hooks/useDialogue'

interface Message {
  id: string
  text: string
}

interface DialogueOverlayProps {
  messages: Message[]
  typingSpeed?: number
  isOpen: boolean
  onClose: () => void
}

export function DialogueOverlay({
  messages,
  typingSpeed = 40,
  isOpen,
  onClose,
}: DialogueOverlayProps) {
  const { currentText, isTyping, isComplete, waitingForAdvance, advance, reset } =
    useDialogue({
      messages,
      typingSpeed,
      onComplete: onClose,
      enabled: isOpen,
    })

  // Reset when closing
  useEffect(() => {
    if (!isOpen) {
      reset()
    }
  }, [isOpen, reset])

  // Handle keyboard
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        advance()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, advance, onClose])

  return (
    <AnimatePresence>
      {isOpen && !isComplete && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-6 md:p-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Dark overlay */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* OMORI style dialogue box */}
          <motion.div
            className="relative w-full max-w-2xl cursor-pointer select-none"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={advance}
          >
            {/* Main box - white background, black border, hard shadow */}
            <div
              className="bg-white border-4 border-black p-6 md:p-8"
              style={{ boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)' }}
            >
              {/* Text content */}
              <p
                className="text-black text-lg md:text-xl leading-relaxed min-h-[60px]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {currentText}
                {isTyping && (
                  <motion.span
                    className="inline-block w-2 h-5 bg-black ml-1 align-middle"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.4, repeat: Infinity }}
                  />
                )}
              </p>

              {/* Continue indicator - bouncing triangle */}
              {waitingForAdvance && (
                <motion.div
                  className="absolute bottom-4 right-6"
                  animate={{ y: [0, 4, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <span className="text-black text-lg">▼</span>
                </motion.div>
              )}
            </div>

            {/* Hint text */}
            <p
              className="text-white/60 text-xs text-center mt-4"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              CLICK TO CONTINUE · ESC TO CLOSE
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
