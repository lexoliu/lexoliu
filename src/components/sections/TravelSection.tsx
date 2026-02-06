import { useState, useRef, useEffect, memo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
// World TopoJSON (ISC license)
import worldTopo from 'world-atlas/countries-110m.json'

// Photo type
interface Photo {
  src: string
  width: number
  height: number
}

// Travel data with multiple photos per location
const travelSpots = [
  {
    id: 1,
    name: '杭州',
    coordinates: [120.15, 30.28] as [number, number],
    photos: [
      { src: 'https://picsum.photos/seed/hz1/800/600', width: 800, height: 600 },
      { src: 'https://picsum.photos/seed/hz2/600/800', width: 600, height: 800 },
      { src: 'https://picsum.photos/seed/hz3/800/500', width: 800, height: 500 },
      { src: 'https://picsum.photos/seed/hz4/700/700', width: 700, height: 700 },
    ],
  },
  {
    id: 2,
    name: '上海',
    coordinates: [121.47, 31.23] as [number, number],
    photos: [
      { src: 'https://picsum.photos/seed/sh1/800/600', width: 800, height: 600 },
      { src: 'https://picsum.photos/seed/sh2/600/900', width: 600, height: 900 },
      { src: 'https://picsum.photos/seed/sh3/900/600', width: 900, height: 600 },
    ],
  },
  {
    id: 3,
    name: '北京',
    coordinates: [116.40, 39.90] as [number, number],
    photos: [
      { src: 'https://picsum.photos/seed/bj1/800/600', width: 800, height: 600 },
      { src: 'https://picsum.photos/seed/bj2/700/800', width: 700, height: 800 },
      { src: 'https://picsum.photos/seed/bj3/800/600', width: 800, height: 600 },
      { src: 'https://picsum.photos/seed/bj4/600/600', width: 600, height: 600 },
      { src: 'https://picsum.photos/seed/bj5/900/600', width: 900, height: 600 },
    ],
  },
  {
    id: 4,
    name: '成都',
    coordinates: [104.06, 30.67] as [number, number],
    photos: [
      { src: 'https://picsum.photos/seed/cd1/800/600', width: 800, height: 600 },
      { src: 'https://picsum.photos/seed/cd2/600/800', width: 600, height: 800 },
    ],
  },
  {
    id: 5,
    name: '西安',
    coordinates: [108.94, 34.26] as [number, number],
    photos: [
      { src: 'https://picsum.photos/seed/xa1/800/500', width: 800, height: 500 },
      { src: 'https://picsum.photos/seed/xa2/700/900', width: 700, height: 900 },
      { src: 'https://picsum.photos/seed/xa3/800/600', width: 800, height: 600 },
    ],
  },
]


// Simple marker - dot with always-visible name
function MinimalMarker({
  spot,
  isActive,
  onClick,
}: {
  spot: typeof travelSpots[0]
  isActive: boolean
  onClick: () => void
}) {
  return (
    <motion.g
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      whileHover={{ scale: 1.1 }}
    >
      {/* Dot */}
      <motion.circle
        r={isActive ? 1.5 : 1}
        fill={isActive ? '#E85D4C' : 'rgba(253, 246, 227, 0.8)'}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      />

      {/* Always visible place name */}
      <text
        y={-4}
        textAnchor="middle"
        style={{
          fontFamily: 'var(--font-sans-cn)',
          fontSize: '2.5px',
          fontWeight: 500,
          fill: isActive ? '#E85D4C' : 'rgba(253, 246, 227, 0.9)',
        }}
      >
        {spot.name}
      </text>
    </motion.g>
  )
}

// Main world map component - THE HERO
const WorldMap = memo(function WorldMap({
  activeSpot,
  onSpotClick,
}: {
  activeSpot: number | null
  onSpotClick: (id: number | null) => void
}) {
  // Higher zoom = cities more spread out = less overlap
  const [position, setPosition] = useState({ coordinates: [110, 34] as [number, number], zoom: 5 })

  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ scale: 150 }}
      className="w-full h-full"
    >
      <ZoomableGroup
        center={position.coordinates}
        zoom={position.zoom}
        onMoveEnd={(pos) => setPosition(pos)}
        minZoom={5}
        maxZoom={5}
        filterZoomEvent={(evt) => evt.type !== 'wheel'}
      >
        <Geographies geography={worldTopo}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="transparent"
                stroke="rgba(253, 246, 227, 0.3)"
                strokeWidth={0.5}
                style={{
                  default: { outline: 'none' },
                  hover: { outline: 'none', fill: 'rgba(253, 246, 227, 0.08)' },
                  pressed: { outline: 'none' },
                }}
              />
            ))
          }
        </Geographies>

        {travelSpots.map((spot) => (
          <Marker key={spot.id} coordinates={spot.coordinates}>
            <MinimalMarker
              spot={spot}
              isActive={activeSpot === spot.id}
              onClick={() => onSpotClick(activeSpot === spot.id ? null : spot.id)}
            />
          </Marker>
        ))}
      </ZoomableGroup>
    </ComposableMap>
  )
})

// Lightbox component for full-screen photo viewing
function Lightbox({
  photo,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  photo: Photo
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onPrev()
      if (e.key === 'ArrowRight' && hasNext) onNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onPrev, onNext, hasPrev, hasNext])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.95) 0%, rgba(2, 6, 23, 0.98) 100%)',
      }}
    >
      {/* Close button */}
      <button
        className="absolute top-6 right-6 text-paper/50 hover:text-paper p-2 transition-colors"
        onClick={onClose}
        style={{ fontFamily: 'var(--font-pixel)' }}
      >
        X CLOSE
      </button>

      {/* Previous button */}
      {hasPrev && (
        <motion.button
          className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-paper/10 text-paper/70 hover:bg-paper/20 hover:text-paper flex items-center justify-center backdrop-blur-sm transition-all"
          onClick={(e) => {
            e.stopPropagation()
            onPrev()
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          &larr;
        </motion.button>
      )}

      {/* Image with fancy border */}
      <motion.div
        className="relative"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: -20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-accent/30 via-paper/20 to-accent/30 rounded-lg blur-sm" />
        <img
          src={photo.src}
          alt=""
          className="relative max-w-[85vw] max-h-[85vh] object-contain rounded-lg"
        />
      </motion.div>

      {/* Next button */}
      {hasNext && (
        <motion.button
          className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-paper/10 text-paper/70 hover:bg-paper/20 hover:text-paper flex items-center justify-center backdrop-blur-sm transition-all"
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          &rarr;
        </motion.button>
      )}
    </motion.div>
  )
}

// Photo gallery grid - lightbox handled by parent
function PhotoGallery({
  photos,
  locationName,
  onPhotoClick,
}: {
  photos: Photo[]
  locationName: string
  onPhotoClick: (index: number) => void
}) {
  if (photos.length === 0) return null

  return (
    <motion.div
      className="h-full flex flex-col"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-paper text-xl"
          style={{ fontFamily: 'var(--font-handwriting-cn)' }}
        >
          {locationName}
        </h3>
        <span className="text-paper/40 text-xs" style={{ fontFamily: 'var(--font-pixel)' }}>
          {photos.length} PHOTOS
        </span>
      </div>

      {/* Scrollable photo grid */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo, index) => (
            <motion.button
              key={index}
              className="relative aspect-square overflow-hidden rounded-lg cursor-pointer group"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPhotoClick(index)}
            >
              {/* Glow border on hover */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
              <img
                src={photo.src}
                alt=""
                className="relative w-full h-full object-cover rounded-lg"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-end justify-center pb-3">
                <span className="text-paper/80 text-xs" style={{ fontFamily: 'var(--font-pixel)' }}>
                  VIEW
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export function TravelSection() {
  const [activeSpot, setActiveSpot] = useState<number | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const { t } = useTranslation()
  const sectionRef = useRef<HTMLElement>(null)

  const activeSpotData = activeSpot ? travelSpots.find((s) => s.id === activeSpot) : null

  // Lightbox handlers
  const openLightbox = useCallback((index: number) => setLightboxIndex(index), [])
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])
  const goToPrev = useCallback(() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i)), [])
  const goToNext = useCallback(
    () => setLightboxIndex((i) => (i !== null && activeSpotData && i < activeSpotData.photos.length - 1 ? i + 1 : i)),
    [activeSpotData]
  )

  return (
    <section
      ref={sectionRef}
      id="travel"
      className="sticky top-0 z-30 min-h-screen overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--color-travel-bg) 0%, #6B2D2D 100%)',
      }}
    >
      {/* Section label */}
      <div className="absolute top-8 left-6 md:left-12 z-20">
        <motion.p
          className="text-paper/30 text-xs tracking-[0.3em] uppercase"
          style={{ fontFamily: 'var(--font-pixel)' }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          TRAVELS
        </motion.p>
      </div>

      {/* Map - covers entire area */}
      <div className="absolute inset-0">
        <WorldMap activeSpot={activeSpot} onSpotClick={setActiveSpot} />
      </div>

      {/* Title - floating on top */}
      <div className="relative z-10 pt-16 md:pt-24 px-6 md:px-12 lg:px-24">
        <h2
          className="text-paper text-3xl md:text-5xl tracking-wider"
          style={{ fontFamily: 'var(--font-pixel)' }}
        >
          <span className="bg-highlight px-2 text-ink">{t('travel.title')}</span>
        </h2>
      </div>

      {/* Photo gallery - slides in from right */}
      <AnimatePresence>
        {activeSpotData && (
          <motion.div
            className="hidden lg:block absolute right-0 top-0 bottom-0 w-72 z-20"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="h-full bg-[#5A2020]/90 backdrop-blur-sm p-4 border-l border-paper/20">
              <button
                onClick={() => setActiveSpot(null)}
                className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-paper/60 hover:text-paper text-lg"
              >
                x
              </button>
              <PhotoGallery
                photos={activeSpotData.photos}
                locationName={activeSpotData.name}
                onPhotoClick={openLightbox}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile photo gallery - floating overlay */}
      <AnimatePresence>
        {activeSpotData && (
          <>
            <motion.div
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveSpot(null)}
            />
            <motion.div
              className="lg:hidden fixed right-0 top-0 bottom-0 w-full sm:w-80 z-50"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className="h-full bg-[#5A2020]/95 backdrop-blur-sm p-5 border-l border-paper/20">
                <button
                  onClick={() => setActiveSpot(null)}
                  className="absolute top-4 right-4 text-paper/60 hover:text-paper text-xl"
                >
                  x
                </button>
                <PhotoGallery
                  photos={activeSpotData.photos}
                  locationName={activeSpotData.name}
                  onPhotoClick={openLightbox}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Lightbox - rendered at top level to avoid transform issues */}
      <AnimatePresence>
        {lightboxIndex !== null && activeSpotData && (
          <Lightbox
            photo={activeSpotData.photos[lightboxIndex]}
            onClose={closeLightbox}
            onPrev={goToPrev}
            onNext={goToNext}
            hasPrev={lightboxIndex > 0}
            hasNext={lightboxIndex < activeSpotData.photos.length - 1}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
