import { memo } from 'react'

interface DotMatrixSilhouetteProps {
  data: number[][]
  dotSize?: number
  gap?: number
  opacity?: number
  color?: string
  className?: string
}

// Dot matrix silhouette for decorative background
// Used in About section as a subtle personal touch
export const DotMatrixSilhouette = memo(function DotMatrixSilhouette({
  data,
  dotSize = 8,
  gap = 2,
  opacity = 0.08,
  color = '#FDF6E3',
  className = '',
}: DotMatrixSilhouetteProps) {
  if (data.length === 0) return null

  return (
    <div
      className={`flex flex-col items-center justify-center ${className}`}
      style={{ opacity }}
    >
      {data.map((row, y) => (
        <div key={y} className="flex">
          {row.map((dot, x) => (
            <div
              key={`${y}-${x}`}
              className="rounded-full"
              style={{
                width: dotSize,
                height: dotSize,
                margin: gap / 2,
                backgroundColor: dot ? color : 'transparent',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
})

