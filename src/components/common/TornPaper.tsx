import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface TornPaperProps {
  children: ReactNode
  className?: string
  tornEdge?: 'top' | 'bottom' | 'both'
}

export function TornPaper({
  children,
  className = '',
  tornEdge = 'bottom',
}: TornPaperProps) {
  const tornTop = tornEdge === 'top' || tornEdge === 'both'
  const tornBottom = tornEdge === 'bottom' || tornEdge === 'both'

  return (
    <motion.div
      className={`relative ${className}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Top torn edge */}
      {tornTop && (
        <div
          className="absolute top-0 left-0 right-0 h-3 bg-paper"
          style={{
            clipPath: `polygon(
              0% 100%, 3% 40%, 6% 100%, 9% 60%, 12% 100%, 15% 30%,
              18% 100%, 21% 55%, 24% 100%, 27% 45%, 30% 100%, 33% 65%,
              36% 100%, 39% 35%, 42% 100%, 45% 50%, 48% 100%, 51% 40%,
              54% 100%, 57% 70%, 60% 100%, 63% 45%, 66% 100%, 69% 55%,
              72% 100%, 75% 35%, 78% 100%, 81% 60%, 84% 100%, 87% 45%,
              90% 100%, 93% 55%, 96% 100%, 100% 50%, 100% 100%
            )`,
          }}
        />
      )}

      {/* Main content */}
      <div className="paper-texture p-8 shadow-paper">{children}</div>

      {/* Bottom torn edge */}
      {tornBottom && (
        <div
          className="absolute bottom-0 left-0 right-0 h-3 bg-paper"
          style={{
            clipPath: `polygon(
              0% 0%, 3% 60%, 6% 0%, 9% 40%, 12% 0%, 15% 70%,
              18% 0%, 21% 45%, 24% 0%, 27% 55%, 30% 0%, 33% 35%,
              36% 0%, 39% 65%, 42% 0%, 45% 50%, 48% 0%, 51% 60%,
              54% 0%, 57% 30%, 60% 0%, 63% 55%, 66% 0%, 69% 45%,
              72% 0%, 75% 65%, 78% 0%, 81% 40%, 84% 0%, 87% 55%,
              90% 0%, 93% 45%, 96% 0%, 100% 50%, 100% 0%
            )`,
          }}
        />
      )}
    </motion.div>
  )
}
