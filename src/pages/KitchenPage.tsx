import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

// Language switcher - minimal corner button
function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh')
  }

  return (
    <motion.button
      onClick={toggleLanguage}
      className="fixed top-4 right-4 z-50 px-3 py-1.5 text-xs rounded-full bg-paper/80 text-ink/70 hover:bg-paper hover:text-ink transition-colors backdrop-blur-sm"
      style={{ fontFamily: 'var(--font-pixel)' }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {i18n.language === 'zh' ? 'EN' : '中'}
    </motion.button>
  )
}

// Sample recipe data
const recipes = [
  {
    id: 1,
    name: { zh: '红烧肉', en: 'Braised Pork Belly' },
    photo: 'https://picsum.photos/seed/hongshaorou/400/300',
    date: '2024.01.05',
    tags: ['meat', 'chinese'],
  },
  {
    id: 2,
    name: { zh: '番茄炒蛋', en: 'Tomato Scrambled Eggs' },
    photo: 'https://picsum.photos/seed/fanqiechaoegg/400/300',
    date: '2024.01.03',
    tags: ['egg', 'quick'],
  },
  {
    id: 3,
    name: { zh: '蒜蓉西兰花', en: 'Garlic Broccoli' },
    photo: 'https://picsum.photos/seed/broccoli/400/300',
    date: '2023.12.28',
    tags: ['vegetable', 'healthy'],
  },
  {
    id: 4,
    name: { zh: '可乐鸡翅', en: 'Cola Chicken Wings' },
    photo: 'https://picsum.photos/seed/colachicken/400/300',
    date: '2023.12.20',
    tags: ['meat', 'sweet'],
  },
  {
    id: 5,
    name: { zh: '蛋炒饭', en: 'Egg Fried Rice' },
    photo: 'https://picsum.photos/seed/friedrice/400/300',
    date: '2023.12.15',
    tags: ['rice', 'quick'],
  },
  {
    id: 6,
    name: { zh: '麻婆豆腐', en: 'Mapo Tofu' },
    photo: 'https://picsum.photos/seed/mapotofu/400/300',
    date: '2023.12.10',
    tags: ['tofu', 'spicy'],
  },
]

function RecipeCard({
  recipe,
  index,
  lang,
}: {
  recipe: (typeof recipes)[0]
  index: number
  lang: 'zh' | 'en'
}) {
  return (
    <motion.div
      className="group cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: 'spring', stiffness: 100 }}
    >
      <motion.div
        className="relative overflow-hidden rounded-lg bg-paper"
        style={{
          boxShadow: '2px 4px 12px rgba(0, 0, 0, 0.08)',
        }}
        whileHover={{
          y: -8,
          boxShadow: '4px 12px 24px rgba(0, 0, 0, 0.15)',
          transition: { type: 'spring', stiffness: 300, damping: 20 },
        }}
      >
        {/* Photo */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <motion.img
            src={recipe.photo}
            alt={recipe.name[lang]}
            className="w-full h-full object-cover"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.4 }}
          />
          {/* Pixel corner decoration */}
          <div
            className="absolute top-0 left-0 w-3 h-3 bg-paper"
            style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
          />
          <div
            className="absolute top-0 right-0 w-3 h-3 bg-paper"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
          />
          <div
            className="absolute bottom-0 left-0 w-3 h-3 bg-paper"
            style={{ clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }}
          />
          <div
            className="absolute bottom-0 right-0 w-3 h-3 bg-paper"
            style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}
          />
        </div>

        {/* Info */}
        <div className="p-4">
          <h3
            className="text-ink font-medium text-lg mb-1"
            style={{ fontFamily: lang === 'zh' ? 'var(--font-handwriting-zh)' : 'var(--font-handwriting)' }}
          >
            {recipe.name[lang]}
          </h3>
          <span
            className="text-ink/40 text-xs"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            {recipe.date}
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function KitchenPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'zh' | 'en'
  const [filter, setFilter] = useState<string | null>(null)

  const allTags = Array.from(new Set(recipes.flatMap((r) => r.tags)))
  const filteredRecipes = filter
    ? recipes.filter((r) => r.tags.includes(filter))
    : recipes

  return (
    <div className="min-h-screen bg-bg-primary">
      <LanguageSwitcher />

      <main className="pt-8 pb-20 px-6 md:px-12 lg:px-24">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-ink/60 hover:text-ink mb-6 transition-colors"
            >
              <span style={{ fontFamily: 'var(--font-pixel)' }}>←</span>
              <span style={{ fontFamily: 'var(--font-handwriting)' }}>
                {t('kitchen.back')}
              </span>
            </Link>

            <h1
              className="text-ink text-3xl md:text-4xl mb-2"
              style={{ fontFamily: 'var(--font-handwriting-zh)' }}
            >
              {t('kitchen.title')}
            </h1>
            <p
              className="text-ink/60"
              style={{ fontFamily: 'var(--font-handwriting)' }}
            >
              {t('kitchen.subtitle')}
            </p>
          </motion.div>

          {/* Tag filters */}
          <motion.div
            className="flex flex-wrap gap-2 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <motion.button
              onClick={() => setFilter(null)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                filter === null
                  ? 'bg-ink text-paper border-ink'
                  : 'border-ink/20 text-ink/60 hover:border-ink/40'
              }`}
              style={{ fontFamily: 'var(--font-pixel)' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ALL
            </motion.button>
            {allTags.map((tag) => (
              <motion.button
                key={tag}
                onClick={() => setFilter(tag)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  filter === tag
                    ? 'bg-ink text-paper border-ink'
                    : 'border-ink/20 text-ink/60 hover:border-ink/40'
                }`}
                style={{ fontFamily: 'var(--font-pixel)' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {tag.toUpperCase()}
              </motion.button>
            ))}
          </motion.div>

          {/* Recipe grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe, index) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                index={index}
                lang={lang}
              />
            ))}
          </div>

          {/* Stats */}
          <motion.div
            className="mt-16 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p
              className="text-ink/40 text-sm"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              {recipes.length} RECIPES RECORDED
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
