import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { DotMatrixSilhouette, mockSilhouetteData } from '@/components/common/DotMatrixSilhouette'

// Simple card component
function Card({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      className={`bg-white/5 border border-white/10 rounded-lg p-6 ${className}`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      viewport={{ once: true, margin: '-50px' }}
    >
      {children}
    </motion.div>
  )
}

// Hobby tag component
function HobbyTag({ label, icon }: { label: string; icon: string }) {
  return (
    <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-paper/70 text-sm">
      <span>{icon}</span>
      <span style={{ fontFamily: 'var(--font-sans)' }}>{label}</span>
    </span>
  )
}

export function AboutSection() {
  const { t } = useTranslation()

  return (
    <section id="about" className="sticky top-0 z-10 min-h-screen overflow-hidden bg-[var(--color-about-bg)]">
      {/* Dot matrix silhouette background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <DotMatrixSilhouette
          data={mockSilhouetteData}
          dotSize={8}
          gap={3}
          opacity={0.04}
          className="scale-[6] md:scale-[8] translate-x-1/3"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 px-6 md:px-12 lg:px-24 py-24 md:py-32">
        <div className="max-w-5xl mx-auto">
          {/* Section label - pixel font */}
          <motion.p
            className="text-paper/30 text-xs tracking-[0.3em] uppercase mb-8"
            style={{ fontFamily: 'var(--font-pixel)' }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {t('about.title')}
          </motion.p>

          {/* Main headline - big and bold */}
          <motion.h2
            className="text-paper text-4xl md:text-6xl lg:text-7xl leading-tight mb-16"
            style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {t('about.intro1').split('Rust')[0]}
            <span className="text-accent">Rust</span>
            {t('about.intro1').split('Rust')[1] || '.'}
          </motion.h2>

          {/* Two column layout */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {/* Left - description cards */}
            <div className="space-y-6">
              <Card delay={0.1}>
                <p
                  className="text-paper/80 text-lg md:text-xl leading-relaxed"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {t('about.intro2')}
                </p>
              </Card>

              <Card delay={0.2}>
                <p
                  className="text-paper/60 text-base md:text-lg leading-relaxed"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {t('about.intro3')}
                </p>
              </Card>
            </div>

            {/* Right - hobbies */}
            <Card delay={0.3} className="flex flex-col justify-center">
              <p
                className="text-paper/40 text-xs tracking-[0.2em] uppercase mb-4"
                style={{ fontFamily: 'var(--font-pixel)' }}
              >
                {t('about.hobbies')}
              </p>
              <div className="flex flex-wrap gap-3">
                <HobbyTag label={t('about.hobby_coding')} icon="<>" />
                <HobbyTag label={t('about.hobby_travel')} icon="*" />
                <HobbyTag label={t('about.hobby_photo')} icon="[]" />
                <HobbyTag label={t('about.hobby_food')} icon="~" />
                <HobbyTag label={t('about.hobby_reading')} icon="#" />
              </div>
            </Card>
          </div>

          {/* Transition text */}
          <motion.p
            className="text-paper/40 text-lg md:text-xl text-center"
            style={{ fontFamily: 'var(--font-handwriting)' }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {t('about.transition_to_github')}
          </motion.p>
        </div>
      </div>
    </section>
  )
}
