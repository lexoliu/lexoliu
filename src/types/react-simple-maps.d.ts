declare module 'react-simple-maps' {
  import { ComponentType, ReactNode } from 'react'

  export interface ComposableMapProps {
    projection?: string
    projectionConfig?: {
      scale?: number
      center?: [number, number]
      rotate?: [number, number, number]
    }
    width?: number
    height?: number
    className?: string
    children?: ReactNode
  }

  export interface ZoomableGroupProps {
    center?: [number, number]
    zoom?: number
    minZoom?: number
    maxZoom?: number
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }) => void
    filterZoomEvent?: (event: WheelEvent | TouchEvent) => boolean
    children?: ReactNode
  }

  export interface GeographiesProps {
    geography: object | string
    children: (data: { geographies: Array<{ rsmKey: string }> }) => ReactNode
  }

  export interface GeographyProps {
    geography: object
    fill?: string
    stroke?: string
    strokeWidth?: number
    style?: {
      default?: object
      hover?: object
      pressed?: object
    }
  }

  export interface MarkerProps {
    coordinates: [number, number]
    children?: ReactNode
  }

  export const ComposableMap: ComponentType<ComposableMapProps>
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>
  export const Geographies: ComponentType<GeographiesProps>
  export const Geography: ComponentType<GeographyProps>
  export const Marker: ComponentType<MarkerProps>
}
