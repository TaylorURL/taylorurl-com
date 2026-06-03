import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Search } from 'lucide-react'
import ProjectCard from '@components/sunday/ProjectCard'
import Surface from '@components/sunday/Surface'
import { SUNDAY_ROUTES } from '@constants/sunday/routes'
import { useGithubRepos } from '@hooks/sunday/useGithubRepos'
import { useProjects } from '@hooks/sunday/useProjects'
import { formatTime } from '@utils/sundayTime'

const STATUS_FILTERS = [
  { key: 'active', label: 'Active', value: 'active' },
  { key: 'paused', label: 'Paused', value: 'paused' },
  { key: 'archived', label: 'Archived', value: 'archived' },
  { key: 'all', label: 'All', value: null },
]

export default function SundayProjects() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusKey, setStatusKey] = useState('active')

  const status = STATUS_FILTERS.find(f => f.key === statusKey)
  const { projects, loading: projectsLoading } = useProjects(
    status?.value ? { status: status.value } : {}
  )
  const {
    repos,
    loading: reposLoading,
    lastSyncedAt,
  } = useGithubRepos({
    includeArchived: true,
  })

  const githubById = useMemo(() => {
    const map = new Map()
    for (const r of repos) map.set(Number(r.github_id), r)
    return map
  }, [repos])

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects
    const needle = search.toLowerCase()
    return projects.filter(p =>
      [p.name, p.client, p.stack, p.notes, p.github_full_name]
        .filter(Boolean)
        .some(field => field.toLowerCase().includes(needle))
    )
  }, [projects, search])

  function handleSync() {
    navigate(`${SUNDAY_ROUTES.CHAT}?prompt=${encodeURIComponent('Sunday, sync github.')}`)
  }

  const loading = projectsLoading || reposLoading

  return (
    <div className="w-full space-y-5 px-8 py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p
            className="font-mono text-[10.5px] uppercase tabular-nums tracking-[0.16em]"
            style={{ color: 'var(--sunday-text-faint)' }}
          >
            {filteredProjects.length} project{filteredProjects.length === 1 ? '' : 's'}
            {lastSyncedAt && <span className="ml-2">· synced {formatTime(lastSyncedAt)}</span>}
          </p>
          <h1 className="mt-1 text-[24px] font-semibold leading-none tracking-tight">Projects</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSync}
            aria-label="Sync GitHub now"
            className="sunday-press inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em]"
            style={{
              background: 'var(--sunday-surface)',
              color: 'var(--sunday-text-muted)',
              borderColor: 'var(--sunday-border-strong)',
            }}
          >
            <RefreshCw size={11} />
            Sync GitHub
          </button>
          <div className="relative w-full sm:w-64">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--sunday-text-faint)' }}
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, repo, notes…"
              className="w-full rounded-md border py-1.5 pl-8 pr-3 text-[13px]"
              style={{
                background: 'var(--sunday-surface)',
                borderColor: 'var(--sunday-border-strong)',
                color: 'var(--sunday-text)',
              }}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map(f => {
          const active = f.key === statusKey
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusKey(f.key)}
              className="sunday-press rounded-md border px-2.5 py-1 text-[12px]"
              style={{
                background: active ? 'var(--sunday-surface-2)' : 'var(--sunday-surface)',
                borderColor: active ? 'var(--sunday-border-hover)' : 'var(--sunday-border-strong)',
                color: active ? 'var(--sunday-text)' : 'var(--sunday-text-muted)',
                transition:
                  'background 140ms var(--sunday-ease-out), border-color 140ms var(--sunday-ease-out)',
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <SkeletonGrid count={6} />
      ) : filteredProjects.length === 0 ? (
        <Surface>
          <EmptyProjects status={status?.value} hasSearch={!!search.trim()} />
        </Surface>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project, i) => (
            <div
              key={project.id}
              className="sunday-rise-in"
              style={{ animationDelay: `${Math.min(i * 30, 180)}ms` }}
            >
              <ProjectCard
                project={project}
                github={
                  project.github_repo_id ? githubById.get(Number(project.github_repo_id)) : null
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyProjects({ status, hasSearch }) {
  if (hasSearch) {
    return (
      <p className="py-3 text-center text-[13px]" style={{ color: 'var(--sunday-text-muted)' }}>
        No projects match.
      </p>
    )
  }
  if (status === 'archived') {
    return (
      <p className="py-3 text-center text-[13px]" style={{ color: 'var(--sunday-text-muted)' }}>
        No archived projects.
      </p>
    )
  }
  return (
    <div className="space-y-2 py-3 text-center">
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--sunday-text-muted)' }}>
        No projects yet. Sunday auto-tracks every non-archived GitHub repo every 15 minutes.
      </p>
      <p
        className="mx-auto inline-block rounded border px-2.5 py-1.5 font-mono text-[11px]"
        style={{
          background: 'var(--sunday-bg-elevated)',
          borderColor: 'var(--sunday-border)',
          color: 'var(--sunday-text-faint)',
        }}
      >
        try: <span style={{ color: 'var(--sunday-accent-bright)' }}>Sunday, sync github now.</span>
      </p>
    </div>
  )
}

function SkeletonGrid({ count = 6 }) {
  return (
    <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sunday-skeleton h-32 w-full" />
      ))}
    </div>
  )
}
