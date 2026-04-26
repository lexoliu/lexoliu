import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

interface DialogueMessage {
  id: string
  text: string
}

interface UseDialogueOptions {
  messages: DialogueMessage[]
  typingSpeed?: number
  onComplete?: () => void
  enabled?: boolean
}

export function useDialogue({
  messages,
  typingSpeed = 50,
  onComplete,
  enabled = true,
}: UseDialogueOptions) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'typing' | 'waiting'>('idle')

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevEnabled = useRef(false)
  const isFirstRun = useRef(true)

  const currentMessage = messages[currentIndex]
  const isComplete = currentIndex >= messages.length
  const isTyping = phase === 'typing'
  const waitingForAdvance = phase === 'waiting'

  // Current displayed text derived from charIndex
  const currentText = currentMessage ? currentMessage.text.slice(0, charIndex) : ''

  // Messages that have been fully typed (all before currentIndex)
  const visibleMessages = useMemo(
    () => messages.slice(0, currentIndex),
    [messages, currentIndex]
  )

  // Text currently being typed (null if complete)
  const currentTypingText = isComplete ? null : currentText

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current)
    }
  }, [])

  // Handle enabled change - start typing when becoming enabled
  useEffect(() => {
    // Skip first run to avoid triggering on mount
    if (isFirstRun.current) {
      isFirstRun.current = false
      prevEnabled.current = enabled
      // If already enabled on mount, start typing
      if (enabled && currentMessage) {
        const timer = setTimeout(() => {
          setCharIndex(0)
          setPhase('typing')
        }, 0)
        return () => clearTimeout(timer)
      }
      return
    }

    if (enabled && !prevEnabled.current && currentMessage) {
      // Just became enabled, start typing
      const timer = setTimeout(() => {
        setCharIndex(0)
        setPhase('typing')
      }, 0)
      prevEnabled.current = enabled
      return () => clearTimeout(timer)
    }

    if (!enabled && prevEnabled.current) {
      // Just became disabled
      if (typingTimer.current) clearTimeout(typingTimer.current)
      const timer = setTimeout(() => setPhase('idle'), 0)
      prevEnabled.current = enabled
      return () => clearTimeout(timer)
    }

    prevEnabled.current = enabled
  }, [enabled, currentMessage])

  // Handle message index change - start typing new message
  useEffect(() => {
    if (enabled && currentMessage && phase === 'idle') {
      const timer = setTimeout(() => {
        setCharIndex(0)
        setPhase('typing')
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [enabled, currentIndex, currentMessage, phase])

  // Typing animation
  useEffect(() => {
    if (phase !== 'typing' || !currentMessage) return

    if (charIndex < currentMessage.text.length) {
      typingTimer.current = setTimeout(() => {
        setCharIndex(prev => prev + 1)
      }, typingSpeed)
    } else {
      // Done typing this message
      typingTimer.current = setTimeout(() => {
        setPhase('waiting')
      }, 0)
    }

    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current)
    }
  }, [phase, charIndex, currentMessage, typingSpeed])

  const skipToEnd = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current)
    if (currentMessage) {
      setCharIndex(currentMessage.text.length)
      setPhase('waiting')
    }
  }, [currentMessage])

  const advance = useCallback(() => {
    if (phase === 'typing') {
      skipToEnd()
    } else if (phase === 'waiting') {
      const nextIndex = currentIndex + 1
      if (nextIndex >= messages.length) {
        onComplete?.()
      } else {
        setCurrentIndex(nextIndex)
        setCharIndex(0)
        setPhase('typing')
      }
    }
  }, [phase, currentIndex, messages.length, skipToEnd, onComplete])

  const reset = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current)
    setCurrentIndex(0)
    setCharIndex(0)
    setPhase('idle')
  }, [])

  return {
    currentText,
    currentTypingText,
    visibleMessages,
    isTyping,
    isComplete,
    waitingForAdvance,
    advance,
    skipToEnd,
    reset,
  }
}
