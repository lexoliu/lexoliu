import { useState, useRef, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'lofi-music-enabled'

interface UseAudioReturn {
  playing: boolean
  toggle: () => void
  audioRef: React.RefObject<HTMLAudioElement | null>
}

export function useAudio(audioSrc?: string): UseAudioReturn {
  const [playing, setPlaying] = useState(() => {
    // Check localStorage for saved preference, default to false
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved === 'true'
    }
    return false
  })

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio element
  useEffect(() => {
    if (audioSrc && !audioRef.current) {
      audioRef.current = new Audio(audioSrc)
      audioRef.current.loop = true
      audioRef.current.volume = 0.3

      // If saved preference was "playing", start playing
      if (playing) {
        audioRef.current.play().catch(() => {
          // Browser may block autoplay, that's ok
          setPlaying(false)
        })
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [audioSrc, playing])

  const toggle = useCallback(() => {
    if (!audioRef.current) return

    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
      localStorage.setItem(STORAGE_KEY, 'false')
    } else {
      audioRef.current.play().catch(() => {
        // Browser blocked autoplay
      })
      setPlaying(true)
      localStorage.setItem(STORAGE_KEY, 'true')
    }
  }, [playing])

  return { playing, toggle, audioRef }
}
