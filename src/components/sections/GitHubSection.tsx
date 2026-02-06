import { useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const GITHUB_USERNAME = 'lexoliu'

// Types
interface ContributionDay {
  date: string
  count: number
  level: number
}

interface PinnedRepo {
  name: string
  description: string
  url: string
  stars: number
  forks: number
  language: string
  languageColor: string
}

interface GitHubData {
  contributions: ContributionDay[]
  totalContributions: number
  pinnedRepos: PinnedRepo[]
  loading: boolean
  error: string | null
}

// Fetch GitHub data hook
function useGitHubData(): GitHubData {
  const [data, setData] = useState<GitHubData>({
    contributions: [],
    totalContributions: 0,
    pinnedRepos: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    async function fetchData() {
      try {
        const contribRes = await fetch(
          `https://github-contributions-api.jogruber.de/v4/${GITHUB_USERNAME}?y=last`
        )
        const contribData = await contribRes.json()

        const contributions: ContributionDay[] = []
        let total = 0
        if (contribData.contributions) {
          for (const day of contribData.contributions) {
            contributions.push({
              date: day.date,
              count: day.count,
              level: day.level,
            })
            total += day.count
          }
        }

        const pinnedRes = await fetch(
          `https://gh-pinned-repos.egoist.dev/?username=${GITHUB_USERNAME}`
        )
        const pinnedData = await pinnedRes.json()

        const pinnedRepos: PinnedRepo[] = pinnedData.map((repo: {
          repo: string
          description: string
          link: string
          stars: number
          forks: number
          language: string
          languageColor: string
        }) => ({
          name: repo.repo,
          description: repo.description || '',
          url: repo.link,
          stars: repo.stars,
          forks: repo.forks,
          language: repo.language,
          languageColor: repo.languageColor,
        }))

        setData({
          contributions,
          totalContributions: total,
          pinnedRepos,
          loading: false,
          error: null,
        })
      } catch {
        setData((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to load GitHub data',
        }))
      }
    }

    fetchData()
  }, [])

  return data
}

// Animated counter
function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.8', 'start 0.5'],
  })

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (progress) => {
      setDisplayValue(Math.floor(progress * value))
    })
    return () => unsubscribe()
  }, [scrollYProgress, value])

  return <span ref={ref}>{displayValue.toLocaleString()}</span>
}

// Contribution heatmap with scroll reveal
function ContributionGraph({ contributions }: { contributions: ContributionDay[] }) {
  const recentContributions = contributions.slice(-364)
  const weeks: ContributionDay[][] = []
  for (let i = 0; i < recentContributions.length; i += 7) {
    weeks.push(recentContributions.slice(i, i + 7))
  }

  const getColor = (level: number) => {
    const colors = [
      'rgba(253, 246, 227, 0.08)',
      'rgba(232, 93, 76, 0.3)',
      'rgba(232, 93, 76, 0.5)',
      'rgba(232, 93, 76, 0.7)',
      'rgba(232, 93, 76, 1)',
    ]
    return colors[Math.min(level, 4)]
  }

  return (
    <div className="overflow-x-auto pb-4 custom-scrollbar">
      <div className="flex gap-[2px] min-w-max">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-[2px]">
            {week.map((day) => (
              <motion.div
                key={day.date}
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: getColor(day.level) }}
                initial={{ scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: weekIndex * 0.01,
                  type: 'spring',
                  stiffness: 300,
                }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.8 }}
                title={`${day.date}: ${day.count} contributions`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Pinned repo card - simplified
function RepoCard({ repo, index }: { repo: PinnedRepo; index: number }) {
  return (
    <motion.a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-6 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-accent/30 transition-all group"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      viewport={{ once: true }}
    >
      <div className="flex items-start justify-between mb-3">
        <h4
          className="text-paper text-lg font-bold group-hover:text-accent transition-colors"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {repo.name}
        </h4>
        {repo.stars > 0 && (
          <span className="flex items-center gap-1 text-paper/50 text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {repo.stars}
          </span>
        )}
      </div>

      <p className="text-paper/50 text-sm mb-4 line-clamp-2" style={{ fontFamily: 'var(--font-sans)' }}>
        {repo.description || 'No description'}
      </p>

      {repo.language && (
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: repo.languageColor || '#dea584' }}
          />
          <span className="text-paper/40 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
            {repo.language}
          </span>
        </div>
      )}
    </motion.a>
  )
}

export function GitHubSection() {
  const { t } = useTranslation()
  const { contributions, totalContributions, pinnedRepos, loading, error } = useGitHubData()
  const sectionRef = useRef<HTMLElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })

  const titleScale = useTransform(scrollYProgress, [0, 0.3], [0.9, 1])
  const titleOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1])

  return (
    <section ref={sectionRef} id="github" className="sticky top-0 z-20 min-h-screen overflow-hidden bg-[var(--color-github-bg)]">
      <div className="relative z-10 min-h-screen flex flex-col justify-center px-6 md:px-12 lg:px-24 py-24 md:py-32">
        {/* Section label */}
        <motion.p
          className="text-paper/30 text-xs tracking-[0.3em] uppercase mb-8"
          style={{ fontFamily: 'var(--font-pixel)' }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          PROJECTS
        </motion.p>

        {/* Big animated header */}
        <motion.div
          className="mb-16"
          style={{ scale: titleScale, opacity: titleOpacity }}
        >
          <motion.div
            className="flex items-center gap-4 mb-4"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <svg className="w-12 h-12 text-paper" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <h2
              className="text-paper text-4xl md:text-6xl font-bold"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              @{GITHUB_USERNAME}
            </h2>
          </motion.div>

          {!loading && (
            <motion.p
              className="text-5xl md:text-7xl font-bold text-accent"
              style={{ fontFamily: 'var(--font-mono)' }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <AnimatedNumber value={totalContributions} />
              <span className="text-paper/30 text-xl md:text-2xl ml-3">contributions</span>
            </motion.p>
          )}
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <motion.div
              className="w-10 h-10 border-2 border-paper/20 border-t-accent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : error ? (
          <p className="text-paper/50">{error}</p>
        ) : (
          <>
            {/* Contribution Graph */}
            <motion.div
              className="mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <ContributionGraph contributions={contributions} />
            </motion.div>

            {/* Pinned Repos */}
            {pinnedRepos.length > 0 && (
              <div className="mb-12">
                <motion.p
                  className="text-paper/30 text-xs tracking-[0.3em] uppercase mb-6"
                  style={{ fontFamily: 'var(--font-pixel)' }}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                >
                  PINNED REPOSITORIES
                </motion.p>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pinnedRepos.map((repo, index) => (
                    <RepoCard key={repo.name} repo={repo} index={index} />
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <motion.a
              href={`https://github.com/${GITHUB_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 bg-paper text-ink rounded-lg text-base font-bold hover:bg-accent hover:text-paper transition-all"
              style={{ fontFamily: 'var(--font-mono)' }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              View Full Profile
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </motion.a>

            {/* Transition to Travel section */}
            <motion.p
              className="text-paper/40 text-lg md:text-xl text-center mt-16"
              style={{ fontFamily: 'var(--font-handwriting)' }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              {t('github.transition_to_travel')}
            </motion.p>
          </>
        )}
      </div>
    </section>
  )
}
