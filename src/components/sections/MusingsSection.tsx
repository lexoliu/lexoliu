import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import rough from 'roughjs'

// Sample musings data
const musings = [
  {
    id: 1,
    date: '2024.01.15',
    content: {
      zh: '今天终于把那个困扰我一周的 bug 修好了。原来是生命周期的问题，Rust 的借用检查器又救了我一命。',
      en: 'Finally fixed that bug that haunted me for a week. Turns out it was a lifetime issue. Rust\'s borrow checker saved me again.',
    },
  },
  {
    id: 2,
    date: '2024.01.10',
    content: {
      zh: '在西湖边走了一下午，冬天的西湖有种特别的宁静。拍了很多照片，准备整理到相册里。',
      en: 'Spent the afternoon walking by West Lake. The winter scenery has a special tranquility. Took lots of photos to add to my album.',
    },
  },
  {
    id: 3,
    date: '2024.01.05',
    content: {
      zh: '尝试做了一道新菜——红烧肉。火候掌握得不太好，下次要小火慢炖久一点。',
      en: 'Tried making braised pork belly for the first time. Didn\'t quite nail the heat control. Need to simmer longer next time.',
    },
  },
]

function RoughDivider() {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = svgRef.current
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const rc = rough.svg(svg)
    svg.appendChild(
      rc.line(0, 10, 200, 10, {
        stroke: 'rgba(50, 50, 50, 0.15)',
        strokeWidth: 1,
        roughness: 1.5,
      })
    )
  }, [])

  return <svg ref={svgRef} viewBox="0 0 200 20" className="w-32 h-4 mx-auto my-6" />
}

export function MusingsSection() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'zh' | 'en'

  return (
    <section id="musings" className="py-20 md:py-32 px-6 md:px-12 lg:px-24 bg-bg-primary">
      <div className="max-w-3xl mx-auto">
        {/* Section title */}
        <motion.h2
          className="text-ink text-2xl md:text-3xl mb-4"
          style={{ fontFamily: 'var(--font-handwriting-zh)' }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {t('musings.title')}
        </motion.h2>

        <motion.p
          className="text-ink/60 mb-12"
          style={{ fontFamily: 'var(--font-handwriting)' }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {t('musings.subtitle')}
        </motion.p>

        {/* Musings list */}
        <div className="space-y-8">
          {musings.map((musing, index) => (
            <motion.article
              key={musing.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <motion.div
                className="p-6 bg-paper rounded-lg relative"
                style={{
                  boxShadow: '2px 4px 12px rgba(0, 0, 0, 0.06)',
                }}
                whileHover={{
                  y: -4,
                  boxShadow: '4px 8px 20px rgba(0, 0, 0, 0.1)',
                  transition: { type: 'spring', stiffness: 300, damping: 20 },
                }}
              >
                {/* Date badge */}
                <span
                  className="text-xs text-ink/40 mb-3 block"
                  style={{ fontFamily: 'var(--font-pixel)' }}
                >
                  {musing.date}
                </span>

                {/* Content */}
                <p
                  className="text-ink/80 leading-relaxed"
                  style={{ fontFamily: 'var(--font-handwriting)' }}
                >
                  {musing.content[lang]}
                </p>
              </motion.div>

              {index < musings.length - 1 && <RoughDivider />}
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
