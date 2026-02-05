import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface DialogueBubbleProps {
  children: ReactNode
  variant?: 'paper' | 'thought' | 'speech'
  className?: string
  delay?: number
}

export function DialogueBubble({
  children,
  variant = 'paper',
  className = '',
  delay = 0,
}: DialogueBubbleProps) {
  const baseStyles = 'relative px-6 py-4 text-ink'

  const variantStyles = {
    paper: 'paper-texture rounded-sm shadow-paper',
    thought: 'bg-paper rounded-2xl shadow-paper',
    speech: 'bg-paper rounded-lg shadow-paper speech-bubble',
  }

  return (
    <motion.div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      {children}
      {variant === 'speech' && (
        <div className="absolute -bottom-2 left-6 w-4 h-4 bg-paper transform rotate-45 shadow-sm" />
      )}
    </motion.div>
  )
}
