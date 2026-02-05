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
          className="fixed inset-x-0 bottom-0 z-50 p-4 md:p-8"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.3 }}
          onClick={advance}
        >
          {/* Dialogue box - fixed at bottom */}
          <div className="max-w-3xl mx-auto relative cursor-pointer select-none">
            {/* Outer border - white, pixelated corners */}
            <div
              className="absolute inset-0 bg-paper"
              style={{
                clipPath: `polygon(
                  0 8px, 8px 8px, 8px 0,
                  calc(100% - 8px) 0, calc(100% - 8px) 8px, 100% 8px,
                  100% calc(100% - 8px), calc(100% - 8px) calc(100% - 8px), calc(100% - 8px) 100%,
                  8px 100%, 8px calc(100% - 8px), 0 calc(100% - 8px)
                )`,
              }}
            />

            {/* Inner dark box */}
            <div
              className="relative bg-[#1a1a2e] mx-[6px] my-[6px]"
              style={{
                clipPath: `polygon(
                  0 6px, 6px 6px, 6px 0,
                  calc(100% - 6px) 0, calc(100% - 6px) 6px, 100% 6px,
                  100% calc(100% - 6px), calc(100% - 6px) calc(100% - 6px), calc(100% - 6px) 100%,
                  6px 100%, 6px calc(100% - 6px), 0 calc(100% - 6px)
                )`,
              }}
            >
              {/* Content area */}
              <div className="px-8 py-6 min-h-[80px]">
                {/* Single message at a time */}
                <p
                  className="text-paper text-lg leading-loose tracking-wide"
                  style={{ fontFamily: 'var(--font-pixel-cn)' }}
                >
                  {currentText}
                  {isTyping && (
                    <motion.span
                      className="inline-block w-3 h-5 bg-paper ml-1 align-middle"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.4, repeat: Infinity }}
                    />
                  )}
                </p>

                {/* Continue indicator ▼ */}
                {waitingForAdvance && (
                  <motion.div
                    className="absolute bottom-4 right-6"
                    animate={{ y: [0, 6, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <span
                      className="text-highlight text-sm"
                      style={{ fontFamily: 'var(--font-pixel)' }}
                    >
                      ▼
                    </span>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Hint text */}
          <p className="text-center text-paper/40 text-xs mt-3 font-mono">
            点击继续 · ESC 关闭
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
