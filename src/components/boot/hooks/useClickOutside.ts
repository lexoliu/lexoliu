import { useEffect, type RefObject } from 'react'

/**
 * Calls `onOutside` when a `mousedown` lands outside the referenced element.
 * Listener registration is deferred to the next tick so the click that opened
 * the popover does not immediately close it.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: MouseEvent) => {
      const node = ref.current
      if (!node) return
      if (e.target instanceof Node && node.contains(e.target)) return
      onOutside()
    }
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', handler)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', handler)
    }
  }, [ref, onOutside, enabled])
}
