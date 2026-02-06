import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { PanelOverlay } from './PanelOverlay'

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

        const pinnedRepos: PinnedRepo[] = pinnedData.map(
          (repo: {
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
          })
        )

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

// Contribution heatmap - compact version
function ContributionGraph({ contributions }: { contributions: ContributionDay[] }) {
  // Take last 20 weeks for compact view
  const recentContributions = contributions.slice(-140)
  const weeks: ContributionDay[][] = []
  for (let i = 0; i < recentContributions.length; i += 7) {
    weeks.push(recentContributions.slice(i, i + 7))
  }

  const getColor = (level: number) => {
    const colors = [
      'rgba(0, 0, 0, 0.08)',
      'rgba(232, 93, 76, 0.3)',
      'rgba(232, 93, 76, 0.5)',
      'rgba(232, 93, 76, 0.7)',
      'rgba(232, 93, 76, 1)',
    ]
    return colors[Math.min(level, 4)]
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-[2px] min-w-max">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-[2px]">
            {week.map((day) => (
              <motion.div
                key={day.date}
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: getColor(day.level) }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: weekIndex * 0.02 }}
                title={`${day.date}: ${day.count} contributions`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Repo card - compact
function RepoCard({ repo }: { repo: PinnedRepo }) {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 bg-black/5 border border-black/10 hover:bg-black/10 hover:border-[#E85D4C]/50 transition-all"
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
          {repo.name}
        </h4>
        {repo.stars > 0 && (
          <span className="flex items-center gap-1 text-black/50 text-xs">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {repo.stars}
          </span>
        )}
      </div>
      <p className="text-black/50 text-xs line-clamp-1" style={{ fontFamily: 'var(--font-sans)' }}>
        {repo.description || 'No description'}
      </p>
      {repo.language && (
        <div className="flex items-center gap-1 mt-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: repo.languageColor || '#dea584' }}
          />
          <span className="text-black/40 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
            {repo.language}
          </span>
        </div>
      )}
    </a>
  )
}

interface GitHubPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function GitHubPanel({ isOpen, onClose }: GitHubPanelProps) {
  const { contributions, totalContributions, pinnedRepos, loading, error } = useGitHubData()

  return (
    <PanelOverlay isOpen={isOpen} onClose={onClose}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
            @{GITHUB_USERNAME}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <motion.div
              className="w-8 h-8 border-2 border-black/20 border-t-[#E85D4C] rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : error ? (
          <p className="text-black/50">{error}</p>
        ) : (
          <>
            {/* Contribution count */}
            <div>
              <span className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
                {totalContributions.toLocaleString()}
              </span>
              <span className="text-black/50 text-sm ml-2">contributions this year</span>
            </div>

            {/* Contribution Graph */}
            <div>
              <p
                className="text-xs tracking-widest uppercase mb-2 text-black/50"
                style={{ fontFamily: 'var(--font-pixel)' }}
              >
                ACTIVITY
              </p>
              <ContributionGraph contributions={contributions} />
            </div>

            {/* Pinned Repos */}
            {pinnedRepos.length > 0 && (
              <div>
                <p
                  className="text-xs tracking-widest uppercase mb-3 text-black/50"
                  style={{ fontFamily: 'var(--font-pixel)' }}
                >
                  PINNED REPOS
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {pinnedRepos.slice(0, 4).map((repo) => (
                    <RepoCard key={repo.name} repo={repo} />
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <a
              href={`https://github.com/${GITHUB_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-bold hover:bg-[#E85D4C] transition-colors"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              View Full Profile
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </a>
          </>
        )}
      </div>
    </PanelOverlay>
  )
}
