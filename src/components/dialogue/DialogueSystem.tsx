import { motion } from 'framer-motion'
import { useDialogue } from '@/hooks/useDialogue'

interface DialogueMessage {
  id: string
  text: string
  delay?: number
}

interface DialogueSystemProps {
  messages: DialogueMessage[]
  typingSpeed?: number
  className?: string
}

export function DialogueSystem({
  messages,
  typingSpeed = 40,
  className = '',
}: DialogueSystemProps) {
  const { visibleMessages, currentTypingText, isTyping, isComplete } =
    useDialogue({
      messages,
      typingSpeed,
    })

  return (
    <div className={`relative max-w-2xl ${className}`}>
      {/* Pixel border - classic RPG style with thick white border */}
      <div className="relative">
        {/* Outer border - white, thick, pixelated corners */}
        <div
          className="absolute inset-0 bg-paper"
          style={{
            clipPath: `polygon(
              /* Top left corner */
              0 8px, 8px 8px, 8px 0,
              /* Top right corner */
              calc(100% - 8px) 0, calc(100% - 8px) 8px, 100% 8px,
              /* Bottom right corner */
              100% calc(100% - 8px), calc(100% - 8px) calc(100% - 8px), calc(100% - 8px) 100%,
              /* Bottom left corner */
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
          <div className="px-8 py-6 min-h-[100px]">
            {/* Dialogue text */}
            <div className="space-y-2">
              {visibleMessages.map((msg) => (
                <p
                  key={msg.id}
                  className="text-paper text-lg leading-loose tracking-wide"
                  style={{ fontFamily: 'var(--font-pixel-cn)' }}
                >
                  {msg.text}
                </p>
              ))}

              {/* Currently typing line */}
              {currentTypingText !== null && (
                <p
                  className="text-paper text-lg leading-loose tracking-wide"
                  style={{ fontFamily: 'var(--font-pixel-cn)' }}
                >
                  {currentTypingText}
                  {isTyping && (
                    <motion.span
                      className="inline-block w-3 h-5 bg-paper ml-1 align-middle"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.4, repeat: Infinity }}
                    />
                  )}
                </p>
              )}
            </div>

            {/* Continue indicator ▼ */}
            {!isTyping && !isComplete && visibleMessages.length > 0 && (
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
    </div>
  )
}
