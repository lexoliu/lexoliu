import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export function WaterUISection() {
  const { t } = useTranslation()

  return (
    <section
      id="waterui"
      className="sticky top-0 z-15 min-h-screen overflow-hidden bg-white flex items-center justify-center"
    >
      <div className="text-center px-6">
        {/* Section label */}
        <motion.p
          className="text-ink/30 text-xs tracking-[0.3em] uppercase mb-12"
          style={{ fontFamily: 'var(--font-pixel)' }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {t('waterui.label')}
        </motion.p>

        {/* Logo */}
        <motion.a
          href="https://github.com/water-rs/waterui"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.05 }}
        >
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-ink flex items-center justify-center overflow-hidden shadow-lg">
            <img
              src="https://avatars.githubusercontent.com/u/154332053?s=200&v=4"
              alt="WaterUI Logo"
              className="w-full h-full object-cover"
            />
          </div>
        </motion.a>

        {/* Title */}
        <motion.h2
          className="text-ink text-4xl md:text-6xl font-bold mb-4"
          style={{ fontFamily: 'var(--font-mono)' }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          WaterUI
        </motion.h2>

        {/* Tagline */}
        <motion.p
          className="text-ink/50 text-lg md:text-xl mb-8"
          style={{ fontFamily: 'var(--font-sans)' }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          {t('waterui.tagline')}
        </motion.p>

        {/* Link */}
        <motion.a
          href="https://waterui.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-ink/60 hover:text-accent transition-colors"
          style={{ fontFamily: 'var(--font-mono)' }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          waterui.dev
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </motion.a>
      </div>
    </section>
  )
}
