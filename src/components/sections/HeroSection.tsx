import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { DialogueOverlay } from '@/components/dialogue'
import introData from '@data/dialogue/intro.json'

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

  return (
    <>
      <section className="min-h-screen sticky top-0 z-0 overflow-hidden bg-[var(--color-hero-bg)] flex flex-col">
        {/* Main content area */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
          {/* Chocolate font LEXO - handwritten warmth meets Win95 system */}
          <motion.h1
            className="text-8xl md:text-[12rem] lg:text-[14rem] text-[#1a1a2e] select-none"
            style={{ fontFamily: 'var(--font-chocolate)' }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            Lexo
          </motion.h1>

          {/* Tagline */}
          <motion.p
            className="text-[#1a1a2e] text-sm tracking-[0.3em] uppercase mb-8 mt-4"
            style={{ fontFamily: 'var(--font-pixel)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {i18n.language === 'zh' ? 'Developer / Explorer / Creator' : 'Developer / Explorer / Creator'}
          </motion.p>

          {/* Action buttons in Windows style */}
          <motion.div
            className="flex gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
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

        {/* Floating status window - keep for Win95 aesthetic */}
        <motion.div
          className="absolute top-8 left-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 }}
        >
          <WindowFrame title="status.txt" className="w-40">
            <div className="text-[10px] space-y-1" style={{ fontFamily: 'var(--font-pixel)' }}>
              <p className="text-[#000080]">MODE: ACTIVE</p>
              <p className="text-[#808080]">LANG: RUST</p>
              <p className="text-[#808080]">LOC: CHINA</p>
            </div>
          </WindowFrame>
        </motion.div>

        {/* Taskbar */}
        <motion.div
          className="h-8 bg-[#d4d0c8] shadow-[inset_0_1px_#ffffff] flex items-center justify-between px-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
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
          transition={{ delay: 1.5 }}
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
