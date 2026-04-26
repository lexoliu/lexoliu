import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { BootSequence3D } from '@/components/boot'
import { KitchenPage } from '@/pages/KitchenPage'
import { useAudio } from '@/hooks/useAudio'

// Height of zoom zone in vh units
const ZOOM_ZONE_HEIGHT = 100

// Panel types - now supports multiple open panels
type PanelId = 'about' | 'github' | 'travel' | 'waterui'

function HomePage() {
  const [scrollProgress, setScrollProgress] = useState(0)
  // Multiple open panels with z-index ordering (last in array = topmost)
  const [openPanels, setOpenPanels] = useState<PanelId[]>([])
  const [lampOn, setLampOn] = useState(true)

  // Audio hook - no audio file for now (can be added later)
  const { toggle: toggleMusic } = useAudio()

  // Handle scroll to calculate zoom progress - works even during boot
  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY
    const viewportHeight = window.innerHeight
    const zoomZoneHeight = viewportHeight * (ZOOM_ZONE_HEIGHT / 100)

    // Calculate zoom progress (0 to 1 over the zoom zone)
    const progress = Math.min(1, Math.max(0, scrollY / zoomZoneHeight))
    setScrollProgress(progress)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Reset scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Panel handlers - support multiple windows
  const openPanel = useCallback((panel: PanelId) => {
    setOpenPanels((prev) => {
      // If already open, bring to front
      if (prev.includes(panel)) {
        return [...prev.filter((p) => p !== panel), panel]
      }
      // Otherwise add to top
      return [...prev, panel]
    })
  }, [])

  const closePanel = useCallback((panel: PanelId) => {
    setOpenPanels((prev) => prev.filter((p) => p !== panel))
  }, [])

  // Bring a panel to front (when clicked)
  const focusPanel = useCallback((panel: PanelId) => {
    setOpenPanels((prev) => {
      if (!prev.includes(panel)) return prev
      return [...prev.filter((p) => p !== panel), panel]
    })
  }, [])

  const toggleLamp = useCallback(() => {
    setLampOn((prev) => !prev)
  }, [])

  return (
    <>
      {/* 3D Room - the entire experience */}
      <BootSequence3D
        onComplete={() => {}}
        scrollProgress={scrollProgress}
        onOpenPanel={openPanel}
        onClosePanel={closePanel}
        onFocusPanel={focusPanel}
        onToggleLamp={toggleLamp}
        onToggleMusic={toggleMusic}
        lampOn={lampOn}
        openPanels={openPanels}
      />

      {/* Spacer for zoom zone scrolling */}
      <div style={{ height: `${100 + ZOOM_ZONE_HEIGHT}vh` }} />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/kitchen" element={<KitchenPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
