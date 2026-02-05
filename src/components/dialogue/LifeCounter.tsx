import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface LifeCounterProps {
  className?: string
}

export function LifeCounter({ className = '' }: LifeCounterProps) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatTime = (totalSeconds: number): string => {
    if (totalSeconds < 60) {
      return `${totalSeconds} 秒`
    }
    const minutes = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${minutes} 分 ${secs} 秒`
  }

  return (
    <motion.span
      key={seconds}
      initial={{ opacity: 0.5, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`font-mono text-accent tabular-nums ${className}`}
    >
      {formatTime(seconds)}
    </motion.span>
  )
}
