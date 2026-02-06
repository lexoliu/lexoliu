import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ParallaxProvider } from 'react-scroll-parallax'
import { HeroSection, AboutSection, WaterUISection, GitHubSection, TravelSection } from '@/components/sections'
import { KitchenPage } from '@/pages/KitchenPage'

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
  return (
    <main className="min-h-screen bg-[var(--color-footer-bg)]">
      <HeroSection />
      <AboutSection />
      <WaterUISection />
      <GitHubSection />
      <TravelSection />
      <Footer />
    </main>
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
