import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Parallax } from 'react-scroll-parallax'

// Bento card component with different sizes
function BentoCard({
  children,
  className = '',
  index = 0,
  hover = true,
}: {
  children: React.ReactNode
  className?: string
  index?: number
  hover?: boolean
}) {
  return (
    <motion.div
      className={`rounded-3xl bg-paper/5 backdrop-blur-sm border border-paper/10 overflow-hidden ${className}`}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.1,
        type: 'spring',
        stiffness: 100,
        damping: 15,
      }}
      viewport={{ once: true, margin: '-50px' }}
      whileHover={hover ? {
        scale: 1.02,
        borderColor: 'rgba(232, 93, 76, 0.3)',
        transition: { duration: 0.2 }
      } : undefined}
    >
      {children}
    </motion.div>
  )
}

// Icon components for hobbies
function CodeIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  )
}

function TravelIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function FoodIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function PhotoIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ReadIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}

export function AboutSection() {
  const { t } = useTranslation()
  const sectionRef = useRef<HTMLElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })

  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '20%'])

  return (
    <section ref={sectionRef} id="about" className="sticky top-0 z-10 min-h-screen overflow-hidden bg-[#1A1A2E]">
      {/* Parallax background - extra layer for visual effect */}
      <Parallax translateY={[-30, 30]} className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, #1A1A2E 0%, #16213E 40%, #1A1A2E 100%)',
            y: backgroundY,
          }}
        />
      </Parallax>

      {/* Content */}
      <div className="relative z-10 px-6 md:px-12 lg:px-24 py-32">
        <div className="max-w-7xl mx-auto">
          {/* Section title */}
          <motion.h2
            className="text-paper/30 text-xs md:text-sm tracking-[0.3em] uppercase mb-12"
            style={{ fontFamily: 'var(--font-pixel)' }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {t('about.title')}
          </motion.h2>

          {/* Bento Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6 auto-rows-[120px] md:auto-rows-[140px]">

            {/* Main intro card - large */}
            <BentoCard className="col-span-2 md:col-span-4 lg:col-span-4 row-span-2 p-8 md:p-10" index={0}>
              <div className="h-full flex flex-col justify-center">
                <p
                  className="text-paper text-2xl md:text-4xl lg:text-5xl leading-snug"
                  style={{ fontFamily: 'var(--font-handwriting)' }}
                >
                  {t('about.intro1').split('Rust')[0]}
                  <span className="text-accent">Rust</span>
                  {t('about.intro1').split('Rust')[1] || ''}
                </p>
              </div>
            </BentoCard>

            {/* Coding hobby card */}
            <BentoCard className="col-span-1 md:col-span-2 row-span-2 p-6" index={1}>
              <div className="h-full flex flex-col justify-between">
                <div className="text-accent">
                  <CodeIcon />
                </div>
                <div>
                  <p className="text-paper/50 text-xs mb-1" style={{ fontFamily: 'var(--font-pixel)' }}>
                    PASSION
                  </p>
                  <p className="text-paper text-lg md:text-xl" style={{ fontFamily: 'var(--font-handwriting)' }}>
                    {t('about.hobby_coding')}
                  </p>
                </div>
              </div>
            </BentoCard>

            {/* Second intro */}
            <BentoCard className="col-span-2 md:col-span-3 row-span-1 p-6 md:p-8" index={2}>
              <p
                className="text-paper/70 text-lg md:text-2xl leading-snug"
                style={{ fontFamily: 'var(--font-handwriting)' }}
              >
                {t('about.intro2')}
              </p>
            </BentoCard>

            {/* Travel card */}
            <BentoCard className="col-span-1 row-span-1 p-5" index={3}>
              <div className="h-full flex flex-col justify-between">
                <div className="text-blue-400">
                  <TravelIcon />
                </div>
                <p className="text-paper text-sm md:text-base" style={{ fontFamily: 'var(--font-handwriting)' }}>
                  {t('about.hobby_travel')}
                </p>
              </div>
            </BentoCard>

            {/* Photo card */}
            <BentoCard className="col-span-1 row-span-1 p-5" index={4}>
              <div className="h-full flex flex-col justify-between">
                <div className="text-purple-400">
                  <PhotoIcon />
                </div>
                <p className="text-paper text-sm md:text-base" style={{ fontFamily: 'var(--font-handwriting)' }}>
                  {t('about.hobby_photo')}
                </p>
              </div>
            </BentoCard>

            {/* Food card */}
            <BentoCard className="col-span-1 row-span-1 p-5" index={5}>
              <div className="h-full flex flex-col justify-between">
                <div className="text-orange-400">
                  <FoodIcon />
                </div>
                <p className="text-paper text-sm md:text-base" style={{ fontFamily: 'var(--font-handwriting)' }}>
                  {t('about.hobby_food')}
                </p>
              </div>
            </BentoCard>

            {/* Third intro - philosophy */}
            <BentoCard className="col-span-2 md:col-span-2 row-span-1 p-6" index={6}>
              <p
                className="text-paper/50 text-base md:text-lg leading-snug"
                style={{ fontFamily: 'var(--font-handwriting)' }}
              >
                {t('about.intro3')}
              </p>
            </BentoCard>

            {/* Reading card */}
            <BentoCard className="col-span-1 row-span-1 p-5" index={7}>
              <div className="h-full flex flex-col justify-between">
                <div className="text-green-400">
                  <ReadIcon />
                </div>
                <p className="text-paper text-sm md:text-base" style={{ fontFamily: 'var(--font-handwriting)' }}>
                  {t('about.hobby_reading')}
                </p>
              </div>
            </BentoCard>

          </div>

          {/* Transition to GitHub section */}
          <motion.p
            className="text-paper/40 text-lg md:text-xl text-center mt-20"
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
