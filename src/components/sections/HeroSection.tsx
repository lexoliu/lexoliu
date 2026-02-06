import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { DialogueOverlay } from '@/components/dialogue'
import introData from '@data/dialogue/intro.json'

export function HeroSection() {
  const [isDialogueOpen, setIsDialogueOpen] = useState(false)
  const { i18n } = useTranslation()

  return (
    <>
      <section className="min-h-screen sticky top-0 z-0 overflow-hidden bg-[var(--color-hero-bg)] flex flex-col">
        {/* Main content area */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
          {/* Chocolate font LEXO - brush script like unc0ver.dev */}
          <motion.h1
            className="text-8xl md:text-[12rem] lg:text-[14rem] text-[#1a1a2e] select-none"
            style={{ fontFamily: 'var(--font-chocolate)', fontWeight: 100 }}
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
