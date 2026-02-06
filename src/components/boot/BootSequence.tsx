import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface BootSequenceProps {
  onComplete: () => void
}

type Phase = 'black' | 'poweron' | 'bios' | 'boot' | 'loading' | 'desktop' | 'zoomin' | 'done'

const BIOS_LINES = [
  'LEXO BIOS (C) 2024 Lexo Industries',
  'BIOS Date: 01/01/24  Ver: 1.0.0',
  '',
  'CPU: Curiosity Core @ ∞ Hz',
  'Memory Test: 16384K OK',
  '',
  'Detecting Primary Master... [Imagination SSD]',
  'Detecting Primary Slave... None',
  '',
  'Press DEL to enter SETUP',
]

const BOOT_LINES = [
  'LEXO.SYS is loading...',
  '',
  'Loading system modules:',
  '  \\SYSTEM\\rust.dll',
  '  \\SYSTEM\\creativity.dll',
  '  \\SYSTEM\\wanderlust.dll',
  '  \\SYSTEM\\coffee.dll ............. [!] LOW',
  '',
  'Initializing personality matrix...',
  'Loading desktop environment...',
]

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [phase, setPhase] = useState<Phase>('black')
  const [biosLine, setBiosLine] = useState(0)
  const [bootLine, setBootLine] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // Phase transitions
  const nextPhase = useCallback((next: Phase, delay: number = 0) => {
    setTimeout(() => setPhase(next), delay)
  }, [])

  // Initial power on
  useEffect(() => {
    nextPhase('poweron', 500)
  }, [nextPhase])

  // Power on -> BIOS
  useEffect(() => {
    if (phase === 'poweron') {
      nextPhase('bios', 1000)
    }
  }, [phase, nextPhase])

  // BIOS text animation
  useEffect(() => {
    if (phase !== 'bios') return
    if (biosLine >= BIOS_LINES.length) {
      nextPhase('boot', 800)
      return
    }
    const timer = setTimeout(() => setBiosLine(prev => prev + 1), 80)
    return () => clearTimeout(timer)
  }, [phase, biosLine, nextPhase])

  // Boot text animation
  useEffect(() => {
    if (phase !== 'boot') return
    if (bootLine >= BOOT_LINES.length) {
      nextPhase('loading', 300)
      return
    }
    const timer = setTimeout(() => setBootLine(prev => prev + 1), 120)
    return () => clearTimeout(timer)
  }, [phase, bootLine, nextPhase])

  // Loading bar animation
  useEffect(() => {
    if (phase !== 'loading') return
    if (loadingProgress >= 100) {
      nextPhase('desktop', 500)
      return
    }
    const increment = Math.random() * 15 + 5
    const delay = Math.random() * 100 + 50
    const timer = setTimeout(() => {
      setLoadingProgress(prev => Math.min(prev + increment, 100))
    }, delay)
    return () => clearTimeout(timer)
  }, [phase, loadingProgress, nextPhase])

  // Desktop transition -> zoomin -> done
  useEffect(() => {
    if (phase === 'desktop') {
      nextPhase('zoomin', 1500)
    }
  }, [phase, nextPhase])

  // Zoom in -> done
  useEffect(() => {
    if (phase === 'zoomin') {
      nextPhase('done', 1200)
    }
  }, [phase, nextPhase])

  // Final cleanup
  useEffect(() => {
    if (phase === 'done') {
      onComplete()
    }
  }, [phase, onComplete])

  if (phase === 'done') return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] overflow-hidden"
        style={{ backgroundColor: '#000' }}
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* CRT Monitor Container */}
        <motion.div
          className="w-full h-full flex items-center justify-center p-4 md:p-8"
          animate={phase === 'zoomin' ? {
            scale: 2.5,
            y: '-10%',
          } : {}}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="relative w-full max-w-5xl aspect-[4/3] rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #3a3a3a 0%, #1a1a1a 50%, #0a0a0a 100%)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.1)',
              border: phase === 'zoomin' ? '0px solid transparent' : '12px solid #2a2a2a',
              borderRadius: phase === 'zoomin' ? '0px' : '24px',
            }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Screen bezel */}
            <div
              className="absolute inset-2 rounded-lg overflow-hidden"
              style={{
                background: '#000',
                boxShadow: 'inset 0 0 50px rgba(0,0,0,0.9)',
              }}
            >
              {/* Power on glow effect */}
              <AnimatePresence>
                {phase === 'poweron' && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      className="w-1 h-1 bg-white rounded-full"
                      animate={{
                        width: ['0.25rem', '100%'],
                        height: ['0.25rem', '0.125rem'],
                        opacity: [1, 0.8, 1],
                      }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* BIOS Screen */}
              <AnimatePresence>
                {phase === 'bios' && (
                  <motion.div
                    className="absolute inset-0 p-4 md:p-8 font-mono text-[10px] md:text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                  >
                    <div className="text-[#aaaaaa]">
                      {BIOS_LINES.slice(0, biosLine).map((line, i) => (
                        <div key={i} className={i === 0 ? 'text-white' : ''}>
                          {line || '\u00A0'}
                        </div>
                      ))}
                      {biosLine < BIOS_LINES.length && (
                        <span className="inline-block w-2 h-3 md:h-4 bg-[#aaaaaa] animate-pulse" />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Boot Screen */}
              <AnimatePresence>
                {(phase === 'boot' || phase === 'loading') && (
                  <motion.div
                    className="absolute inset-0 flex flex-col"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Boot text area */}
                    <div className="flex-1 p-4 md:p-8 font-mono text-[10px] md:text-sm overflow-hidden">
                      <div className="text-[#33ff33]">
                        {BOOT_LINES.slice(0, bootLine).map((line, i) => (
                          <div key={i} className={line.includes('[!]') ? 'text-[#E85D4C]' : ''}>
                            {line || '\u00A0'}
                          </div>
                        ))}
                        {phase === 'boot' && bootLine < BOOT_LINES.length && (
                          <span className="inline-block w-2 h-3 md:h-4 bg-[#33ff33] animate-pulse" />
                        )}
                      </div>
                    </div>

                    {/* Loading bar */}
                    {phase === 'loading' && (
                      <motion.div
                        className="p-4 md:p-8"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div className="text-center text-[#5A9A9A] text-xs md:text-sm font-mono mb-2">
                          Starting LEXO Desktop...
                        </div>
                        <div className="h-4 md:h-6 bg-[#1a1a1a] border border-[#333] rounded overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-[#5A9A9A] to-[#7ABABA]"
                            style={{ width: `${loadingProgress}%` }}
                          />
                        </div>
                        <div className="text-center text-[#666] text-[10px] md:text-xs font-mono mt-2">
                          {Math.floor(loadingProgress)}%
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Desktop transition - zoom into the actual site */}
              <AnimatePresence>
                {phase === 'desktop' && (
                  <motion.div
                    className="absolute inset-0 bg-[var(--color-hero-bg,#5A9A9A)]"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {/* Preview of desktop - simplified Hero */}
                    <div className="w-full h-full flex flex-col">
                      {/* Fake window */}
                      <motion.div
                        className="absolute top-4 left-4 bg-[#d4d0c8] shadow-lg"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        style={{ width: '120px' }}
                      >
                        <div className="h-4 bg-[#000080] flex items-center px-1">
                          <span className="text-white text-[8px]">status.txt</span>
                        </div>
                        <div className="p-1 text-[8px]">
                          <div className="text-[#000080]">MODE: ACTIVE</div>
                        </div>
                      </motion.div>

                      {/* Center Lexo text */}
                      <div className="flex-1 flex items-center justify-center">
                        <motion.div
                          className="text-[#1a1a2e] text-4xl md:text-6xl"
                          style={{ fontFamily: 'var(--font-chocolate)', fontWeight: 100 }}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2 }}
                        >
                          Lexo
                        </motion.div>
                      </div>

                      {/* Fake taskbar */}
                      <motion.div
                        className="h-6 bg-[#d4d0c8] flex items-center px-1"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        <div className="h-4 px-2 bg-[#d4d0c8] border border-[#808080] flex items-center gap-1">
                          <div className="w-3 h-3 grid grid-cols-2 gap-px">
                            <div className="bg-[#ff0000]" />
                            <div className="bg-[#00ff00]" />
                            <div className="bg-[#0000ff]" />
                            <div className="bg-[#ffff00]" />
                          </div>
                          <span className="text-[8px]">Start</span>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CRT Effects overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Scanlines */}
                <div
                  className="absolute inset-0 opacity-[0.03]"
                  style={{
                    background: 'repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 2px)',
                  }}
                />
                {/* Screen curvature shadow */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)',
                  }}
                />
                {/* Subtle flicker */}
                <motion.div
                  className="absolute inset-0 bg-white"
                  animate={{ opacity: [0, 0.02, 0, 0.01, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                />
              </div>
            </div>

            {/* Power LED */}
            <motion.div
              className="absolute bottom-3 right-4 w-2 h-2 rounded-full"
              animate={{
                backgroundColor: phase === 'black' ? '#333' : '#33ff33',
                boxShadow: phase === 'black' ? 'none' : '0 0 8px #33ff33',
                opacity: phase === 'zoomin' ? 0 : 1,
              }}
            />

            {/* Monitor brand */}
            <motion.div
              className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-[#555] tracking-widest"
              animate={{ opacity: phase === 'zoomin' ? 0 : 1 }}
            >
              LEXO
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Skip button */}
        {!['desktop', 'zoomin', 'done', 'black'].includes(phase) && (
          <motion.button
            className="absolute bottom-4 right-4 text-white/20 text-[10px] font-mono hover:text-white/50 transition-colors"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            onClick={() => {
              setPhase('desktop')
            }}
          >
            [SKIP]
          </motion.button>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
