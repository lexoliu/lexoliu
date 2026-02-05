import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

export function Navigation() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)

  const isHome = location.pathname === '/'

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh')
  }

  const navItems = [
    { href: '/#about', label: t('nav.about') },
    { href: '/#travel', label: t('nav.travel') },
    { href: '/kitchen', label: t('nav.kitchen') },
    { href: '/#musings', label: t('nav.musings') },
  ]

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
    >
      <div className="mx-4 mt-4">
        <div
          className="max-w-4xl mx-auto px-6 py-3 rounded-2xl"
          style={{
            background: 'rgba(253, 246, 227, 0.85)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/">
              <motion.span
                className="text-ink font-bold text-lg"
                style={{ fontFamily: 'var(--font-handwriting)' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Lexo
              </motion.span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  className="text-ink/70 text-sm hover:text-ink transition-colors"
                  style={{ fontFamily: 'var(--font-handwriting)' }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {item.label}
                </motion.a>
              ))}

              {/* Language Switcher */}
              <motion.button
                onClick={toggleLanguage}
                className="px-3 py-1 text-xs rounded-full border border-ink/20 text-ink/70 hover:bg-ink/5 transition-colors"
                style={{ fontFamily: 'var(--font-pixel)' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {i18n.language === 'zh' ? 'EN' : '中'}
              </motion.button>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex items-center gap-3 md:hidden">
              {/* Language Switcher */}
              <motion.button
                onClick={toggleLanguage}
                className="px-2 py-1 text-xs rounded-full border border-ink/20 text-ink/70"
                style={{ fontFamily: 'var(--font-pixel)' }}
                whileTap={{ scale: 0.95 }}
              >
                {i18n.language === 'zh' ? 'EN' : '中'}
              </motion.button>

              {/* Hamburger */}
              <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className="w-8 h-8 flex flex-col items-center justify-center gap-1"
                whileTap={{ scale: 0.9 }}
              >
                <motion.span
                  className="w-5 h-0.5 bg-ink/70 rounded-full"
                  animate={isOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                />
                <motion.span
                  className="w-5 h-0.5 bg-ink/70 rounded-full"
                  animate={isOpen ? { opacity: 0 } : { opacity: 1 }}
                />
                <motion.span
                  className="w-5 h-0.5 bg-ink/70 rounded-full"
                  animate={isOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                />
              </motion.button>
            </div>
          </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="overflow-hidden md:hidden"
              >
                <div className="pt-4 pb-2 flex flex-col gap-3">
                  {navItems.map((item) => (
                    <motion.a
                      key={item.href}
                      href={item.href}
                      className="text-ink/70 text-sm py-2"
                      style={{ fontFamily: 'var(--font-handwriting)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsOpen(false)}
                    >
                      {item.label}
                    </motion.a>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.nav>
  )
}
