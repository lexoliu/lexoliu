import { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ParallaxProvider } from 'react-scroll-parallax'
import { AboutSection, WaterUISection, GitHubSection, TravelSection } from '@/components/sections'
import { BootSequence3D } from '@/components/boot'
import { KitchenPage } from '@/pages/KitchenPage'

// Height of zoom zone in vh units
const ZOOM_ZONE_HEIGHT = 100

function Footer() {
  const { t, i18n } = useTranslation()

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh')
  }

  return (
    <footer className="sticky top-0 z-40 py-16 px-6 bg-[var(--color-footer-bg)] relative overflow-hidden">
      {/* Large watermark text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span
          className="text-[20vw] font-bold text-white/[0.02]"
          style={{ fontFamily: 'var(--font-chocolate)' }}
        >
          LEXO
        </span>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Social links */}
        <div className="flex justify-center gap-8 mb-8">
          <a
            href="https://twitter.com/is_lexo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-paper/50 hover:text-accent transition-colors text-sm"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            Twitter
          </a>
          <a
            href="https://github.com/lexoliu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-paper/50 hover:text-accent transition-colors text-sm"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            GitHub
          </a>
          <a
            href="mailto:me@lexo.cool"
            className="text-paper/50 hover:text-accent transition-colors text-sm"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            Email
          </a>
        </div>

        {/* Divider */}
        <div className="w-16 h-px bg-paper/10 mx-auto mb-8" />

        {/* Language toggle and copyright */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={toggleLanguage}
            className="px-4 py-2 border border-paper/20 rounded text-paper/50 hover:text-paper hover:border-paper/40 transition-all text-xs"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            {i18n.language === 'zh' ? 'ENGLISH' : '中文'}
          </button>

          <p
            className="text-paper/30 text-sm"
            style={{ fontFamily: 'var(--font-handwriting)' }}
          >
            {t('footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  )
}

function HomePage() {
  const [bootComplete, setBootComplete] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [zoomComplete, setZoomComplete] = useState(false)
  const lastScrollY = useRef(0)
  const isBouncingBack = useRef(false)

  // Handle scroll to calculate zoom progress
  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY
    const viewportHeight = window.innerHeight
    const zoomZoneHeight = viewportHeight * (ZOOM_ZONE_HEIGHT / 100)

    // If boot not complete, bounce back
    if (!bootComplete) {
      if (scrollY > 0 && !isBouncingBack.current) {
        isBouncingBack.current = true
        window.scrollTo({ top: 0, behavior: 'smooth' })
        setTimeout(() => {
          isBouncingBack.current = false
        }, 500)
      }
      return
    }

    // Calculate zoom progress (0 to 1 over the zoom zone)
    const progress = Math.min(1, Math.max(0, scrollY / zoomZoneHeight))
    setScrollProgress(progress)

    // Check if zoom is complete
    if (progress >= 1 && !zoomComplete) {
      setZoomComplete(true)
    }

    lastScrollY.current = scrollY
  }, [bootComplete, zoomComplete])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Reset scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      {/* 3D Room - fixed background layer, always rendered */}
      <BootSequence3D
        onComplete={() => setBootComplete(true)}
        scrollProgress={scrollProgress}
      />

      {/* Spacer for boot sequence (100vh) + zoom zone (100vh) */}
      <div style={{ height: `${100 + ZOOM_ZONE_HEIGHT}vh` }} />

      {/* Main content - scrolls over the 3D CRT screen after zoom complete */}
      {/* No HeroSection - the 3D CRT screen IS the hero */}
      <main
        className="relative"
        style={{
          zIndex: 10,
          opacity: zoomComplete ? 1 : 0,
          transition: 'opacity 0.3s ease-out',
          pointerEvents: zoomComplete ? 'auto' : 'none',
        }}
      >
        <AboutSection />
        <WaterUISection />
        <GitHubSection />
        <TravelSection />
        <Footer />
      </main>
    </>
  )
}

function App() {
  return (
    <ParallaxProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/kitchen" element={<KitchenPage />} />
        </Routes>
      </BrowserRouter>
    </ParallaxProvider>
  )
}

export default App
