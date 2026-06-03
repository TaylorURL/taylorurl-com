import { Link } from 'react-router-dom'
import { ExternalLink, Github, GitFork, Lock, Star } from 'lucide-react'
import { SUNDAY_ROUTES } from '@constants/sunday/routes'
import { formatShortDate } from '@utils/sundayTime'

const STATUS_DOT = {
  active: 'var(--sunday-positive)',
  paused: 'var(--sunday-warning)',
  archived: 'var(--sunday-text-faint)',
}

export default function ProjectCard({ project, github }) {
  const path = SUNDAY_ROUTES.PROJECT_DETAIL.replace(':id', project.id)
  const language = github?.language ?? project.stack
  const pushedAt = github?.pushed_at
    ? new Date(github.pushed_at)
    : project.updated_at
      ? new Date(project.updated_at)
      : null
  const lastActivityLabel = github?.pushed_at ? 'pushed' : 'updated'
  const notes = project.notes ?? github?.description

  return (
    <Link
      to={path}
      className="sunday-card flex h-full flex-col rounded-lg border p-3.5"
      style={{
        background: 'var(--sunday-surface)',
        borderColor: 'var(--sunday-border-strong)',
        color: 'var(--sunday-text)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold tracking-tight">{project.name}</h3>
          {github?.full_name && (
            <div className="mt-0.5 flex items-center gap-1.5">
              <Github size={11} strokeWidth={1.8} style={{ color: 'var(--sunday-text-faint)' }} />
              <span
                className="min-w-0 truncate font-mono text-[11px]"
                style={{ color: 'var(--sunday-text-muted)' }}
              >
                {github.full_name}
              </span>
              {github.private && (
                <Lock size={10} strokeWidth={2} style={{ color: 'var(--sunday-text-faint)' }} />
              )}
              {github.fork && (
                <GitFork size={10} strokeWidth={2} style={{ color: 'var(--sunday-text-faint)' }} />
              )}
            </div>
          )}
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--sunday-text-faint)' }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: STATUS_DOT[project.status] ?? 'var(--sunday-text-faint)' }}
          />
          {project.status}
        </span>
      </div>

      {project.client && (
        <p className="mt-1.5 text-[12px]" style={{ color: 'var(--sunday-text-muted)' }}>
          {project.client}
        </p>
      )}

      {notes && (
        <p
          className="mt-2 line-clamp-2 text-[12.5px] leading-snug"
          style={{ color: 'var(--sunday-text-muted)' }}
        >
          {notes}
        </p>
      )}

      <div
        className="mt-auto flex items-center justify-between gap-2 border-t pt-2.5 font-mono text-[10.5px] tabular-nums"
        style={{ color: 'var(--sunday-text-faint)', borderColor: 'var(--sunday-border)' }}
      >
        <div className="flex items-center gap-3">
          {language && (
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--sunday-accent-bright)' }}
              />
              {language}
            </span>
          )}
          {github && (github.stargazers_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Star size={10} /> {github.stargazers_count}
            </span>
          )}
          {github && (github.open_issues_count ?? 0) > 0 && (
            <span>{github.open_issues_count} issues</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {pushedAt && (
            <span>
              {lastActivityLabel} {formatShortDate(pushedAt)}
            </span>
          )}
          {github?.html_url && (
            <a
              href={github.html_url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Open on GitHub"
              onClick={e => e.stopPropagation()}
              className="sunday-press inline-flex items-center"
              style={{ color: 'var(--sunday-text-faint)' }}
            >
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </Link>
  )
}
