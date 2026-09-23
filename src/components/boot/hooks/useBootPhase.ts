import { useEffect, useState } from 'react'
import { BIOS_LINES, BOOT_LINES, type Phase } from '../shared'

interface BootPhaseOptions {
  onComplete?: () => void
}

interface BootPhaseState {
  phase: Phase
  biosLines: number
  bootLines: number
  loadingProgress: number
  skipToDesktop: () => void
  /** Begin Win95-style shutdown sequence: shutting_down → shutdown_safe. */
  requestShutdown: () => void
  /** Restart from the very beginning (used by power button when off). */
  restart: () => void
}

/**
 * Drives the boot phase state machine: startup → bios → boot → loading → desktop.
 * Each phase advances autonomously via timers. `skipToDesktop` jumps to the end.
 */
export function useBootPhase({ onComplete }: BootPhaseOptions = {}): BootPhaseState {
  const [phase, setPhase] = useState<Phase>('startup')
  const [biosLines, setBiosLines] = useState(0)
  const [bootLines, setBootLines] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // startup → bios
  useEffect(() => {
    if (phase !== 'startup') return
    const id = window.setTimeout(() => setPhase('bios'), 1500)
    return () => window.clearTimeout(id)
  }, [phase])

  // bios text animation
  useEffect(() => {
    if (phase !== 'bios') return
    if (biosLines >= BIOS_LINES.length) {
      const id = window.setTimeout(() => setPhase('boot'), 600)
      return () => window.clearTimeout(id)
    }
    const id = window.setTimeout(() => setBiosLines((n) => n + 1), 100)
    return () => window.clearTimeout(id)
  }, [phase, biosLines])

  // boot text animation
  useEffect(() => {
    if (phase !== 'boot') return
    if (bootLines >= BOOT_LINES.length) {
      const id = window.setTimeout(() => setPhase('loading'), 250)
      return () => window.clearTimeout(id)
    }
    const id = window.setTimeout(() => setBootLines((n) => n + 1), 130)
    return () => window.clearTimeout(id)
  }, [phase, bootLines])

  // loading bar
  useEffect(() => {
    if (phase !== 'loading') return
    if (loadingProgress >= 100) {
      const id = window.setTimeout(() => setPhase('desktop'), 350)
      return () => window.clearTimeout(id)
    }
    const increment = Math.random() * 12 + 4
    const delay = Math.random() * 70 + 35
    const id = window.setTimeout(() => {
      setLoadingProgress((p) => Math.min(p + increment, 100))
    }, delay)
    return () => window.clearTimeout(id)
  }, [phase, loadingProgress])

  // desktop reached
  useEffect(() => {
    if (phase !== 'desktop' || !onComplete) return
    const id = window.setTimeout(onComplete, 500)
    return () => window.clearTimeout(id)
  }, [phase, onComplete])

  // shutting_down → shutdown_safe after ~1.6s
  useEffect(() => {
    if (phase !== 'shutting_down') return
    const id = window.setTimeout(() => setPhase('shutdown_safe'), 1600)
    return () => window.clearTimeout(id)
  }, [phase])

  return {
    phase,
    biosLines,
    bootLines,
    loadingProgress,
    skipToDesktop: () => {
      setBiosLines(BIOS_LINES.length)
      setBootLines(BOOT_LINES.length)
      setLoadingProgress(100)
      setPhase('desktop')
    },
    requestShutdown: () => setPhase('shutting_down'),
    restart: () => {
      setBiosLines(0)
      setBootLines(0)
      setLoadingProgress(0)
      setPhase('startup')
    },
  }
}
