import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Github, Send } from 'lucide-react'
import Surface, { SurfaceHeader } from '@components/sunday/Surface'
import TaskRow from '@components/sunday/TaskRow'
import { SUNDAY_ROUTES } from '@constants/sunday/routes'
import { useProject } from '@hooks/sunday/useProjects'
import { useTasks } from '@hooks/sunday/useTasks'
import { useDispatches } from '@hooks/sunday/useDispatchLogs'
import { formatDateTime } from '@utils/sundayTime'

const STATUS_DOT = {
  pending: 'var(--sunday-text-muted)',
  running: 'var(--sunday-accent-bright)',
  completed: 'var(--sunday-positive)',
  failed: 'var(--sunday-danger)',
  cancelled: 'var(--sunday-text-faint)',
}

const PROJECT_STATUS_DOT = {
  active: 'var(--sunday-positive)',
  paused: 'var(--sunday-warning)',
  archived: 'var(--sunday-text-faint)',
}

export default function SundayProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { project, loading } = useProject(id)
  const { tasks } = useTasks({ projectId: id, status: ['open', 'in_progress'] })
  const { dispatches } = useDispatches({ projectId: id })

  if (loading) {
    return (
      <div className="w-full space-y-3 px-8 py-8">
        <div className="sunday-skeleton h-3 w-20" />
        <div className="sunday-skeleton h-6 w-48" />
        <div className="sunday-skeleton h-32 w-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="w-full px-8 py-8">
        <Surface>
          <p className="text-[13px]">Project not found.</p>
          <Link
            to={SUNDAY_ROUTES.PROJECTS}
            className="mt-3 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--sunday-accent-bright)' }}
          >
            <ArrowLeft size={11} /> Back
          </Link>
        </Surface>
      </div>
    )
  }

  function dispatchNew() {
    const prompt = `Sunday, dispatch a task to ${project.name}: `
    navigate(`${SUNDAY_ROUTES.CHAT}?prompt=${encodeURIComponent(prompt)}`)
  }

  return (
    <div className="w-full space-y-5 px-8 py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to={SUNDAY_ROUTES.PROJECTS}
            className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--sunday-accent-bright)' }}
          >
            <ArrowLeft size={11} /> Projects
          </Link>
          <h1 className="mt-2 text-[24px] font-semibold leading-none tracking-tight">
            {project.name}
          </h1>
          <div
            className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--sunday-text-muted)' }}
          >
            {project.client && <span>{project.client}</span>}
            {project.stack && (
              <span style={{ color: 'var(--sunday-text-faint)' }}>{project.stack}</span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: PROJECT_STATUS_DOT[project.status] ?? 'var(--sunday-text-faint)',
                }}
              />
              {project.status}
            </span>
            {project.github_full_name && (
              <a
                href={`https://github.com/${project.github_full_name}`}
                target="_blank"
                rel="noreferrer noopener"
                className="sunday-press inline-flex items-center gap-1 normal-case tracking-normal"
                style={{ color: 'var(--sunday-text-muted)' }}
              >
                <Github size={11} />
                <span className="font-mono lowercase">{project.github_full_name}</span>
              </a>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={dispatchNew}
          className="sunday-press inline-flex h-9 items-center gap-1.5 self-start rounded-md px-3 text-[12.5px] font-medium sm:self-auto"
          style={{
            background: 'var(--sunday-accent)',
            color: 'var(--sunday-on-accent)',
            border: '1px solid var(--sunday-accent)',
          }}
        >
          <Send size={12} strokeWidth={2.2} />
          Dispatch task
        </button>
      </header>

      {project.notes && (
        <Surface>
          <SurfaceHeader title="Notes" />
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{project.notes}</p>
        </Surface>
      )}

      {project.repo_path && (
        <Surface>
          <SurfaceHeader title="Repo" />
          <p
            className="rounded border px-2.5 py-1.5 font-mono text-[11.5px]"
            style={{
              background: 'var(--sunday-bg-elevated)',
              borderColor: 'var(--sunday-border-strong)',
              color: 'var(--sunday-text-muted)',
            }}
          >
            {project.repo_path}
          </p>
        </Surface>
      )}

      <Surface>
        <SurfaceHeader
          title="Open tasks"
          subtitle={
            tasks.length === 0 ? 'None.' : `${tasks.length} item${tasks.length === 1 ? '' : 's'}`
          }
        />
        {tasks.length === 0 ? null : (
          <div className="space-y-1.5">
            {tasks.map((task, i) => (
              <div
                key={task.id}
                className="sunday-rise-in"
                style={{ animationDelay: `${Math.min(i * 30, 150)}ms` }}
              >
                <TaskRow task={task} />
              </div>
            ))}
          </div>
        )}
      </Surface>

      <Surface>
        <SurfaceHeader title="Recent dispatches" />
        {dispatches.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--sunday-text-muted)' }}>
            No dispatches yet. Use the <span className="font-medium">Dispatch task</span> button or
            tell Sunday in chat.
          </p>
        ) : (
          <ul className="space-y-2">
            {dispatches.map((d, i) => (
              <li
                key={d.id}
                className="sunday-rise-in rounded-md border p-3"
                style={{
                  background: 'var(--sunday-bg-elevated)',
                  borderColor: 'var(--sunday-border)',
                  animationDelay: `${Math.min(i * 30, 150)}ms`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em]"
                    style={{ color: STATUS_DOT[d.status] ?? 'var(--sunday-text-muted)' }}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${d.status === 'running' ? 'sunday-live-dot' : ''}`}
                      style={{ background: STATUS_DOT[d.status] ?? 'var(--sunday-text-muted)' }}
                    />
                    {d.status}
                  </span>
                  <time
                    className="font-mono text-[10.5px] tabular-nums"
                    style={{ color: 'var(--sunday-text-faint)' }}
                  >
                    {formatDateTime(d.created_at)}
                  </time>
                </div>
                <p className="mt-2 text-[13px] leading-snug">{d.brief}</p>
                {d.result_summary && (
                  <p
                    className="mt-2 rounded border px-2.5 py-1.5 font-mono text-[11.5px] leading-relaxed"
                    style={{
                      background: 'var(--sunday-bg)',
                      borderColor: 'var(--sunday-border)',
                      color: 'var(--sunday-text-muted)',
                    }}
                  >
                    {d.result_summary}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  )
}
