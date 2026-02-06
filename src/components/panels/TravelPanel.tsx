import { useState, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import worldTopo from 'world-atlas/countries-110m.json'
import { PanelOverlay } from './PanelOverlay'

// Photo type
interface Photo {
  src: string
  width: number
  height: number
}

// Travel data
const travelSpots = [
  {
    id: 1,
    name: 'Hangzhou',
    nameCn: '杭州',
    coordinates: [120.15, 30.28] as [number, number],
    photos: [
      { src: 'https://picsum.photos/seed/hz1/800/600', width: 800, height: 600 },
      { src: 'https://picsum.photos/seed/hz2/600/800', width: 600, height: 800 },
      { src: 'https://picsum.photos/seed/hz3/800/500', width: 800, height: 500 },
    ],
  },
  {
    id: 2,
    name: 'Shanghai',
    nameCn: '上海',
    coordinates: [121.47, 31.23] as [number, number],
    photos: [
      { src: 'https://picsum.photos/seed/sh1/800/600', width: 800, height: 600 },
      { src: 'https://picsum.photos/seed/sh2/600/900', width: 600, height: 900 },
    ],
  },
  {
    id: 3,
    name: 'Beijing',
    nameCn: '北京',
    coordinates: [116.4, 39.9] as [number, number],
    photos: [
      { src: 'https://picsum.photos/seed/bj1/800/600', width: 800, height: 600 },
      { src: 'https://picsum.photos/seed/bj2/700/800', width: 700, height: 800 },
      { src: 'https://picsum.photos/seed/bj3/800/600', width: 800, height: 600 },
    ],
  },
  {
    id: 4,
    name: 'Chengdu',
    nameCn: '成都',
    coordinates: [104.06, 30.67] as [number, number],
    photos: [
      { src: 'https://picsum.photos/seed/cd1/800/600', width: 800, height: 600 },
    ],
  },
  {
    id: 5,
    name: 'Xian',
    nameCn: '西安',
    coordinates: [108.94, 34.26] as [number, number],
    photos: [
      { src: 'https://picsum.photos/seed/xa1/800/500', width: 800, height: 500 },
      { src: 'https://picsum.photos/seed/xa2/700/900', width: 700, height: 900 },
    ],
  },
]

// Compact world map
const CompactMap = memo(function CompactMap({
  activeSpot,
  onSpotClick,
}: {
  activeSpot: number | null
  onSpotClick: (id: number | null) => void
}) {
  return (
    <div className="h-48 border border-black/10 bg-black/5 overflow-hidden">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 400, center: [110, 34] }}
        className="w-full h-full"
      >
        <ZoomableGroup center={[110, 34]} zoom={1} minZoom={1} maxZoom={1}>
          <Geographies geography={worldTopo}>
            {({ geographies }: { geographies: { rsmKey: string }[] }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="transparent"
                  stroke="rgba(0, 0, 0, 0.2)"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {travelSpots.map((spot) => (
            <Marker key={spot.id} coordinates={spot.coordinates}>
              <g
                onClick={() => onSpotClick(activeSpot === spot.id ? null : spot.id)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  r={activeSpot === spot.id ? 4 : 3}
                  fill={activeSpot === spot.id ? '#E85D4C' : 'rgba(0, 0, 0, 0.6)'}
                />
                <text
                  y={-6}
                  textAnchor="middle"
                  style={{
                    fontSize: '6px',
                    fontWeight: activeSpot === spot.id ? 'bold' : 'normal',
                    fill: activeSpot === spot.id ? '#E85D4C' : 'rgba(0, 0, 0, 0.7)',
                  }}
                >
                  {spot.name}
                </text>
              </g>
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  )
})

// Photo lightbox
function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: {
  photos: Photo[]
  currentIndex: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/60 hover:text-white text-xl"
        style={{ fontFamily: 'var(--font-pixel)' }}
      >
        X CLOSE
      </button>

      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPrev()
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
        >
          &larr;
        </button>
      )}

      <motion.img
        src={photos[currentIndex].src}
        alt=""
        className="max-w-[80vw] max-h-[80vh] object-contain"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
      />

      {currentIndex < photos.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
        >
          &rarr;
        </button>
      )}
    </motion.div>
  )
}

interface TravelPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function TravelPanel({ isOpen, onClose }: TravelPanelProps) {
  const { t, i18n } = useTranslation()
  const [activeSpot, setActiveSpot] = useState<number | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const activeSpotData = activeSpot ? travelSpots.find((s) => s.id === activeSpot) : null

  const openLightbox = useCallback((index: number) => setLightboxIndex(index), [])
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])
  const goToPrev = useCallback(() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i)), [])
  const goToNext = useCallback(
    () =>
      setLightboxIndex((i) =>
        i !== null && activeSpotData && i < activeSpotData.photos.length - 1 ? i + 1 : i
      ),
    [activeSpotData]
  )

  return (
    <>
      <PanelOverlay isOpen={isOpen} onClose={onClose} title={t('travel.title')}>
        <div className="space-y-4">
          {/* Map */}
          <CompactMap activeSpot={activeSpot} onSpotClick={setActiveSpot} />

          {/* City list */}
          <div>
            <p
              className="text-xs tracking-widest uppercase mb-2 text-black/50"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              VISITED CITIES
            </p>
            <div className="flex flex-wrap gap-2">
              {travelSpots.map((spot) => (
                <button
                  key={spot.id}
                  onClick={() => setActiveSpot(activeSpot === spot.id ? null : spot.id)}
                  className={`px-3 py-1.5 text-sm border transition-colors ${
                    activeSpot === spot.id
                      ? 'bg-black text-white border-black'
                      : 'bg-transparent text-black border-black/20 hover:border-black'
                  }`}
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {i18n.language === 'zh' ? spot.nameCn : spot.name}
                </button>
              ))}
            </div>
          </div>

          {/* Photos for selected city */}
          <AnimatePresence mode="wait">
            {activeSpotData && (
              <motion.div
                key={activeSpotData.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="border-t border-black/10 pt-4"
              >
                <p
                  className="text-sm font-bold mb-3"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {i18n.language === 'zh' ? activeSpotData.nameCn : activeSpotData.name}
                  <span className="text-black/40 font-normal ml-2">
                    {activeSpotData.photos.length} photos
                  </span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {activeSpotData.photos.map((photo, index) => (
                    <motion.button
                      key={index}
                      onClick={() => openLightbox(index)}
                      className="aspect-square overflow-hidden bg-black/5 hover:opacity-80 transition-opacity"
                      whileHover={{ scale: 1.02 }}
                    >
                      <img
                        src={photo.src}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PanelOverlay>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && activeSpotData && (
          <PhotoLightbox
            photos={activeSpotData.photos}
            currentIndex={lightboxIndex}
            onClose={closeLightbox}
            onPrev={goToPrev}
            onNext={goToNext}
          />
        )}
      </AnimatePresence>
    </>
  )
}
