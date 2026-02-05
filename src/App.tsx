import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ParallaxProvider } from 'react-scroll-parallax'
import { HeroSection, AboutSection, GitHubSection, TravelSection } from '@/components/sections'
import { KitchenPage } from '@/pages/KitchenPage'

function HomePage() {
  const { t } = useTranslation()

  return (
    <main className="min-h-screen bg-[#0D1117]">
      <HeroSection />
      <AboutSection />
      <GitHubSection />
      <TravelSection />

      {/* Footer */}
      <footer className="sticky top-0 z-40 py-12 px-6 text-center bg-[#5A9A9A]">
        <p className="text-ink/60 text-sm" style={{ fontFamily: 'var(--font-handwriting)' }}>
          {t('footer.copyright')}
        </p>
        <div className="mt-4 flex justify-center gap-6">
          <a
            href="https://twitter.com/is_lexo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink/60 hover:text-ink transition-colors"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            Twitter
          </a>
          <a
            href="https://github.com/lexoliu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink/60 hover:text-ink transition-colors"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            GitHub
          </a>
          <a
            href="mailto:me@lexo.cool"
            className="text-ink/60 hover:text-ink transition-colors"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            Email
          </a>
        </div>
      </footer>
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
