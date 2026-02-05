import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { DialogueOverlay } from '@/components/dialogue'
import introData from '@data/dialogue/intro.json'

// Large-scale dot matrix display for LEXO - the hero element
function DotMatrixDisplay() {
  const [hoveredDot, setHoveredDot] = useState<string | null>(null)

  // 7x5 patterns for each letter - designed for visual impact
  const patterns: Record<string, number[][]> = {
    L: [
      [1, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [1, 1, 1, 1, 1],
    ],
    E: [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [1, 1, 1, 1, 0],
      [1, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [1, 1, 1, 1, 1],
    ],
    X: [
      [1, 0, 0, 0, 1],
      [0, 1, 0, 1, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 1, 0, 1, 0],
      [1, 0, 0, 0, 1],
    ],
    O: [
      [0, 1, 1, 1, 0],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [0, 1, 1, 1, 0],
    ],
  }

  const letters = ['L', 'E', 'X', 'O']
  const dotSize = 12
  const gap = 4
  const letterGap = 24

  return (
    <div className="flex items-center justify-center">
      {letters.map((letter, letterIndex) => (
        <motion.div
          key={letter}
          className="flex flex-col"
          style={{ marginRight: letterIndex < letters.length - 1 ? letterGap : 0 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: letterIndex * 0.1 + 0.3, duration: 0.5 }}
        >
          {patterns[letter].map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {row.map((dot, colIndex) => {
                const dotId = `${letterIndex}-${rowIndex}-${colIndex}`
                const isActive = dot === 1
                const isHovered = hoveredDot === dotId

                return (
                  <motion.div
                    key={colIndex}
                    className="rounded-full transition-all duration-150"
                    style={{
                      width: dotSize,
                      height: dotSize,
                      margin: gap / 2,
                      backgroundColor: isActive
                        ? isHovered
                          ? '#E85D4C'
                          : '#1a1a2e'
                        : 'rgba(26, 26, 46, 0.1)',
                    }}
                    onMouseEnter={() => isActive && setHoveredDot(dotId)}
                    onMouseLeave={() => setHoveredDot(null)}
                    whileHover={isActive ? { scale: 1.3 } : {}}
                  />
                )
              })}
            </div>
          ))}
        </motion.div>
      ))}
    </div>
  )
}

// Minimal window frame - Windows 95 inspired but refined
function WindowFrame({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-[#d4d0c8] shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#ffffff,inset_-2px_-2px_#808080,inset_2px_2px_#dfdfdf] ${className}`}>
      <div className="h-5 bg-[#000080] flex items-center justify-between px-1">
        <span className="text-white text-[10px] tracking-wide" style={{ fontFamily: 'var(--font-pixel)' }}>
          {title}
        </span>
        <div className="flex gap-px">
          <button className="w-3 h-3 bg-[#d4d0c8] shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#ffffff] flex items-center justify-center text-[8px] leading-none">
            _
          </button>
          <button className="w-3 h-3 bg-[#d4d0c8] shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#ffffff] flex items-center justify-center text-[8px] leading-none">
            x
          </button>
        </div>
      </div>
      <div className="p-2">{children}</div>
    </div>
  )
}

// Clock component
function Clock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <span style={{ fontFamily: 'var(--font-pixel)' }}>
      {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
    </span>
  )
}

export function HeroSection() {
  const [isDialogueOpen, setIsDialogueOpen] = useState(false)
  const { i18n } = useTranslation()

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh')
  }

  return (
    <>
      <section className="min-h-screen sticky top-0 z-0 overflow-hidden bg-[#5A9A9A] flex flex-col">
        {/* Main content area */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
          {/* Dot matrix LEXO - the hero */}
          <motion.div
            className="mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <DotMatrixDisplay />
          </motion.div>

          {/* Tagline */}
          <motion.p
            className="text-[#1a1a2e] text-sm tracking-[0.3em] uppercase mb-8"
            style={{ fontFamily: 'var(--font-pixel)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {i18n.language === 'zh' ? 'Developer / Explorer / Creator' : 'Developer / Explorer / Creator'}
          </motion.p>

          {/* Action buttons in Windows style */}
          <motion.div
            className="flex gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <button
              onClick={() => setIsDialogueOpen(true)}
              className="px-6 py-2 bg-[#d4d0c8] shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#ffffff,inset_-2px_-2px_#808080,inset_2px_2px_#dfdfdf] text-xs tracking-wide hover:bg-[#e4e0d8] active:shadow-[inset_1px_1px_#0a0a0a,inset_-1px_-1px_#ffffff,inset_2px_2px_#808080,inset_-2px_-2px_#dfdfdf]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              DIALOGUE
            </button>
            <button
              onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-6 py-2 bg-[#d4d0c8] shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#ffffff,inset_-2px_-2px_#808080,inset_2px_2px_#dfdfdf] text-xs tracking-wide hover:bg-[#e4e0d8] active:shadow-[inset_1px_1px_#0a0a0a,inset_-1px_-1px_#ffffff,inset_2px_2px_#808080,inset_-2px_-2px_#dfdfdf]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              EXPLORE
            </button>
          </motion.div>
        </div>

        {/* Floating info windows */}
        <motion.div
          className="absolute top-8 left-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.2 }}
        >
          <WindowFrame title="status.txt" className="w-40">
            <div className="text-[10px] space-y-1" style={{ fontFamily: 'var(--font-pixel)' }}>
              <p className="text-[#000080]">MODE: ACTIVE</p>
              <p className="text-[#808080]">LANG: RUST</p>
              <p className="text-[#808080]">LOC: CHINA</p>
            </div>
          </WindowFrame>
        </motion.div>

        <motion.div
          className="absolute top-8 right-8"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.4 }}
        >
          <WindowFrame title="lang.cfg" className="w-32">
            <button
              onClick={toggleLanguage}
              className="w-full text-[10px] text-left hover:bg-[#000080] hover:text-white px-1"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              {i18n.language === 'zh' ? '> ENGLISH' : '> CHINESE'}
            </button>
          </WindowFrame>
        </motion.div>

        {/* Taskbar */}
        <motion.div
          className="h-8 bg-[#d4d0c8] shadow-[inset_0_1px_#ffffff] flex items-center justify-between px-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6 }}
        >
          <button className="h-6 px-2 bg-[#d4d0c8] shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#ffffff,inset_-2px_-2px_#808080,inset_2px_2px_#dfdfdf] flex items-center gap-1 text-[10px] active:shadow-[inset_1px_1px_#0a0a0a,inset_-1px_-1px_#ffffff]">
            <div className="w-4 h-4 grid grid-cols-2 gap-px">
              <div className="bg-[#ff0000]" />
              <div className="bg-[#00ff00]" />
              <div className="bg-[#0000ff]" />
              <div className="bg-[#ffff00]" />
            </div>
            <span style={{ fontFamily: 'var(--font-pixel)' }}>Start</span>
          </button>

          <div className="h-6 px-3 bg-[#d4d0c8] shadow-[inset_1px_1px_#808080,inset_-1px_-1px_#ffffff] flex items-center text-[10px]">
            <Clock />
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 2 }}
        >
          <motion.div
            className="w-px h-8 bg-[#1a1a2e]"
            animate={{ scaleY: [1, 1.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>
      </section>

      <DialogueOverlay
        messages={introData.messages}
        typingSpeed={40}
        isOpen={isDialogueOpen}
        onClose={() => setIsDialogueOpen(false)}
      />
    </>
  )
}
