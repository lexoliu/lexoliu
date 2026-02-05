import { useEffect, useRef } from 'react'

interface Line {
  x: number
  y: number
  length: number
  angle: number
  speed: number
  opacity: number
  thickness: number
}

interface FlowingLinesProps {
  color?: string
  lineCount?: number
  className?: string
}

// Simple noise function for organic movement
function noise(x: number, y: number, t: number): number {
  const sin1 = Math.sin(x * 0.01 + t * 0.5)
  const sin2 = Math.sin(y * 0.01 + t * 0.3)
  const sin3 = Math.sin((x + y) * 0.005 + t * 0.2)
  return (sin1 + sin2 + sin3) / 3
}

export function FlowingLines({
  color = 'rgba(255, 255, 255, 0.6)',
  lineCount = 25,
  className = ''
}: FlowingLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const linesRef = useRef<Line[]>([])
  const animationRef = useRef<number>(0)
  const timeRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }
    resize()
    window.addEventListener('resize', resize)

    // Initialize lines - distribute evenly across the screen
    const initLines = () => {
      const rect = canvas.getBoundingClientRect()
      linesRef.current = Array.from({ length: lineCount }, (_, i) => {
        // Distribute lines across the screen using a grid-like pattern with randomness
        const cols = Math.ceil(Math.sqrt(lineCount))
        const rows = Math.ceil(lineCount / cols)
        const cellWidth = rect.width / cols
        const cellHeight = rect.height / rows
        const col = i % cols
        const row = Math.floor(i / cols)

        return {
          x: col * cellWidth + Math.random() * cellWidth,
          y: row * cellHeight + Math.random() * cellHeight,
          length: 40 + Math.random() * 80,
          angle: Math.PI * 0.2 + (Math.random() - 0.5) * 0.6, // Diagonal with variation
          speed: 0.4 + Math.random() * 0.6,
          opacity: 0.15 + Math.random() * 0.35,
          thickness: 1.5 + Math.random() * 1.5,
        }
      })
    }
    initLines()

    // Animation loop
    const animate = () => {
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)

      timeRef.current += 0.016 // ~60fps

      linesRef.current.forEach((line) => {
        // Get flow field angle from noise
        const noiseValue = noise(line.x, line.y, timeRef.current)
        const flowAngle = line.angle + noiseValue * 0.3

        // Update position
        line.x += Math.cos(flowAngle) * line.speed
        line.y += Math.sin(flowAngle) * line.speed

        // Wrap around screen
        if (line.x > rect.width + line.length) {
          line.x = -line.length
          line.y = Math.random() * rect.height
        }
        if (line.x < -line.length) {
          line.x = rect.width + line.length
          line.y = Math.random() * rect.height
        }
        if (line.y > rect.height + line.length) {
          line.y = -line.length
          line.x = Math.random() * rect.width
        }
        if (line.y < -line.length) {
          line.y = rect.height + line.length
          line.x = Math.random() * rect.width
        }

        // Draw line
        const endX = line.x + Math.cos(flowAngle) * line.length
        const endY = line.y + Math.sin(flowAngle) * line.length

        ctx.beginPath()
        ctx.moveTo(line.x, line.y)
        ctx.lineTo(endX, endY)
        ctx.strokeStyle = color.replace(/[\d.]+\)$/, `${line.opacity})`)
        ctx.lineWidth = line.thickness
        ctx.lineCap = 'round'
        ctx.stroke()
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [color, lineCount])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
    />
  )
}
