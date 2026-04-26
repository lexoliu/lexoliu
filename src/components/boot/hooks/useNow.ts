import { useEffect, useState } from 'react'

/**
 * Returns the current time, refreshed every `intervalMs` (default 15s) so the
 * Win95 clock in the system tray actually ticks instead of showing the time
 * the desktop happened to mount at.
 */
export function useNow(intervalMs: number = 15_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
