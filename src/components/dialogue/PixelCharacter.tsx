import { motion } from 'framer-motion'

interface PixelCharacterProps {
  onClick: () => void
  className?: string
}

export function PixelCharacter({ onClick, className = '' }: PixelCharacterProps) {
  return (
    <motion.button
      className={`relative cursor-pointer group ${className}`}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label="与角色对话"
    >
      {/* Simple pixel character - 16x16 style scaled up */}
      <svg
        width="80"
        height="96"
        viewBox="0 0 16 20"
        className="pixelated"
        style={{ imageRendering: 'pixelated' }}
      >
        {/* Hair */}
        <rect x="4" y="0" width="8" height="1" fill="#2C3E50" />
        <rect x="3" y="1" width="10" height="1" fill="#2C3E50" />
        <rect x="3" y="2" width="10" height="2" fill="#2C3E50" />

        {/* Face */}
        <rect x="4" y="4" width="8" height="1" fill="#F5D6C6" />
        <rect x="3" y="5" width="10" height="4" fill="#F5D6C6" />

        {/* Eyes */}
        <rect x="5" y="6" width="2" height="2" fill="#2C3E50" />
        <rect x="9" y="6" width="2" height="2" fill="#2C3E50" />
        {/* Eye shine */}
        <rect x="5" y="6" width="1" height="1" fill="#FFF" />
        <rect x="9" y="6" width="1" height="1" fill="#FFF" />

        {/* Mouth - subtle smile */}
        <rect x="6" y="8" width="4" height="1" fill="#D4A59A" />

        {/* Body / Shirt */}
        <rect x="4" y="9" width="8" height="1" fill="#5A9A9A" />
        <rect x="3" y="10" width="10" height="4" fill="#5A9A9A" />

        {/* Arms */}
        <rect x="1" y="10" width="2" height="3" fill="#F5D6C6" />
        <rect x="13" y="10" width="2" height="3" fill="#F5D6C6" />

        {/* Legs */}
        <rect x="4" y="14" width="3" height="3" fill="#4A5568" />
        <rect x="9" y="14" width="3" height="3" fill="#4A5568" />

        {/* Feet */}
        <rect x="3" y="17" width="4" height="2" fill="#2C3E50" />
        <rect x="9" y="17" width="4" height="2" fill="#2C3E50" />
      </svg>

      {/* Floating animation shadow */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-2 bg-black/20 rounded-full blur-sm"
        animate={{ scaleX: [1, 0.9, 1], opacity: [0.3, 0.2, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </motion.button>
  )
}
