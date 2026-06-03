import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MessageSquare } from 'lucide-react'
import Surface, { SurfaceHeader } from '@components/sunday/Surface'
import SynthesisCard from '@components/sunday/SynthesisCard'
import TaskRow from '@components/sunday/TaskRow'
import LiveDot from '@components/sunday/LiveDot'
import { Button } from '@components/ui/button'
import { SUNDAY_ROUTES } from '@constants/sunday/routes'
import { useLatestSynthesis } from '@hooks/sunday/useSynthesis'
import { useTasks } from '@hooks/sunday/useTasks'
import { useProjects } from '@hooks/sunday/useProjects'
import { SUNDAY_TZ, formatLongDate, formatTime } from '@utils/sundayTime'

export default function SundayToday() {
  const { synthesis, loading: synthLoading } = useLatestSynthesis()
  const { tasks, loading: tasksLoading } = useTasks({ status: ['open', 'in_progress'] })
  const { projects, loading: projectsLoading } = useProjects({ status: 'active' })

  const { greeting, longDate, clock } = useGreeting()

  return (
    <div className="w-full space-y-7 px-8 py-8">
      <header className="sunday-fade-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2.5">
          <h1
            className="text-[28px] font-semibold leading-[1.05] tracking-tight"
            style={{ color: 'var(--sunday-text)' }}
          >
            {greeting},{' '}
            <span
              style={{
                background:
                  'linear-gradient(90deg, var(--sunday-accent-bright), var(--sunday-accent))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Trenton
            </span>
            <span style={{ color: 'var(--sunday-text-muted)' }}>.</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2.5">
            <LiveDot tone="positive" />
            <p
              className="text-[13.5px] font-medium tabular-nums"
              style={{ color: 'var(--sunday-text-muted)' }}
            >
              {longDate}
            </p>
            <span
              className="text-[13.5px]"
              style={{ color: 'var(--sunday-text-faint)' }}
              aria-hidden
            >
              ·
            </span>
            <p
              className="text-[13.5px] font-medium tabular-nums"
              style={{ color: 'var(--sunday-accent-bright)' }}
            >
              {clock} CT
            </p>
          </div>
          <p className="max-w-xl text-[13.5px]" style={{ color: 'var(--sunday-text-muted)' }}>
            Sunday's standing by — chat anything, scope a task, or dispatch code to one of your
            repos.
          </p>
        </div>
        <Button asChild size="lg" variant="primary" className="self-start sm:self-auto">
          <Link to={SUNDAY_ROUTES.CHAT} className="group">
            <MessageSquare size={14} strokeWidth={2.1} />
            Open chat
            <ArrowRight
              size={14}
              strokeWidth={2.1}
              className="transition-transform duration-150 group-hover:translate-x-0.5"
            />
          </Link>
        </Button>
      </header>

      <QuickStats
        tasks={tasks}
        projects={projects}
        loading={tasksLoading || projectsLoading || synthLoading}
        hasSynthesis={!!synthesis}
      />

      {synthLoading ? <SkeletonSynthesis /> : <SynthesisCard synthesis={synthesis} />}

      <div className="grid gap-5 md:grid-cols-2">
        <Surface>
          <SurfaceHeader
            title="Open todos"
            subtitle={tasks.length === 0 ? 'Inbox zero.' : `${tasks.length} pending`}
            action={
              <Link
                to={SUNDAY_ROUTES.TODO}
                className="font-mono text-[10.5px] uppercase tracking-[0.14em]"
                style={{ color: 'var(--sunday-accent-bright)' }}
              >
                All →
              </Link>
            }
          />
          {tasksLoading ? (
            <SkeletonRows count={4} />
          ) : tasks.length === 0 ? (
            <EmptyHint
              message="Nothing pending. Ask Sunday to capture something."
              prompt="Sunday, add a todo: "
            />
          ) : (
            <div className="space-y-1.5">
              {tasks.slice(0, 5).map((task, i) => (
                <div
                  key={task.id}
                  className="sunday-fade-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <TaskRow task={task} />
                </div>
              ))}
            </div>
          )}
        </Surface>

        <Surface>
          <SurfaceHeader
            title="Active projects"
            subtitle={projects.length === 0 ? 'None yet.' : `${projects.length} active`}
            action={
              <Link
                to={SUNDAY_ROUTES.PROJECTS}
                className="font-mono text-[10.5px] uppercase tracking-[0.14em]"
                style={{ color: 'var(--sunday-accent-bright)' }}
              >
                All →
              </Link>
            }
          />
          {projectsLoading ? (
            <SkeletonRows count={4} />
          ) : projects.length === 0 ? (
            <EmptyHint message="No tracked projects yet." prompt="Sunday, track my " />
          ) : (
            <ul className="space-y-1.5">
              {projects.slice(0, 5).map((project, i) => (
                <li
                  key={project.id}
                  className="sunday-fade-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <Link
                    to={SUNDAY_ROUTES.PROJECT_DETAIL.replace(':id', project.id)}
                    className="sunday-card-alive flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-[13px]"
                    style={{
                      background: 'var(--sunday-surface)',
                      borderColor: 'var(--sunday-border-strong)',
                      color: 'var(--sunday-text)',
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
                    {project.client && (
                      <span
                        className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em]"
                        style={{ color: 'var(--sunday-text-faint)' }}
                      >
                        {project.client}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </div>
  )
}

/**
 * Reactive greeting: phrase changes by hour of day (CT), full date string is
 * cached per render, and the clock ticks once a second so the header feels
 * persistently alive without forcing the whole page to re-render heavily.
 */
function useGreeting() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: SUNDAY_TZ,
      hour: 'numeric',
      hour12: false,
    }).format(now),
    10
  )
  const greeting =
    hour < 5
      ? 'Working late'
      : hour < 12
        ? 'Good morning'
        : hour < 17
          ? 'Good afternoon'
          : hour < 21
            ? 'Good evening'
            : 'Good night'
  return {
    greeting,
    longDate: formatLongDate(now),
    clock: formatTime(now),
  }
}

function QuickStats({ tasks, projects, loading, hasSynthesis }) {
  const items = [
    { label: 'Tasks', value: loading ? '—' : tasks.length },
    { label: 'Projects', value: loading ? '—' : projects.length },
    {
      label: 'Synthesis',
      value: loading ? '—' : hasSynthesis ? 'ready' : 'none yet',
    },
  ]
  return (
    <ul
      className="grid grid-cols-3 overflow-hidden rounded-lg border"
      style={{
        background: 'var(--sunday-surface)',
        borderColor: 'var(--sunday-border-strong)',
      }}
    >
      {items.map((item, i) => (
        <li
          key={item.label}
          className={`flex items-center justify-between px-4 py-3 ${
            i < items.length - 1 ? 'border-r' : ''
          }`}
          style={{ borderColor: 'var(--sunday-border)' }}
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{ color: 'var(--sunday-text-faint)' }}
          >
            {item.label}
          </span>
          <span
            className="text-[15px] font-semibold tabular-nums tracking-tight"
            style={{ color: 'var(--sunday-text)' }}
          >
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  )
}

function EmptyHint({ message, prompt }) {
  return (
    <div className="space-y-2 py-2">
      <p className="text-[13px]" style={{ color: 'var(--sunday-text-muted)' }}>
        {message}
      </p>
      <p
        className="rounded border px-2.5 py-1.5 font-mono text-[11px]"
        style={{
          background: 'var(--sunday-bg-elevated)',
          borderColor: 'var(--sunday-border)',
          color: 'var(--sunday-text-faint)',
        }}
      >
        try: <span style={{ color: 'var(--sunday-accent-bright)' }}>{prompt}…</span>
      </p>
    </div>
  )
}

function SkeletonRows({ count = 4 }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sunday-skeleton h-9 w-full" />
      ))}
    </div>
  )
}

function SkeletonSynthesis() {
  return (
    <Surface>
      <div className="sunday-skeleton mb-3 h-3 w-32" />
      <div className="sunday-skeleton mb-2 h-3 w-full" />
      <div className="sunday-skeleton mb-2 h-3 w-[92%]" />
      <div className="sunday-skeleton h-3 w-[78%]" />
    </Surface>
  )
}
