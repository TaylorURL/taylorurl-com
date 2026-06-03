import { useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select'
import TaskRow from '@components/sunday/TaskRow'
import Surface from '@components/sunday/Surface'
import { useAuth } from '@hooks/useAuth'
import { useTasks } from '@hooks/sunday/useTasks'
import { useProjects } from '@hooks/sunday/useProjects'

const STATUS_FILTERS = [
  { value: ['open', 'in_progress'], label: 'Active', key: 'active' },
  { value: 'snoozed', label: 'Snoozed', key: 'snoozed' },
  { value: 'done', label: 'Done', key: 'done' },
  { value: 'cancelled', label: 'Cancelled', key: 'cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const NO_PROJECT_VALUE = '__none__'

export default function SundayTodo() {
  const [filterKey, setFilterKey] = useState('active')
  const filter = STATUS_FILTERS.find(f => f.key === filterKey) ?? STATUS_FILTERS[0]
  const { user } = useAuth()
  const { tasks, loading, complete, reopen, remove, add } = useTasks({ status: filter.value })
  const { projects } = useProjects({ status: 'active' })

  const grouped = useMemo(() => groupByProject(tasks, projects), [tasks, projects])
  const count = tasks.length

  return (
    <div className="w-full space-y-6 px-8 py-8">
      <header className="sunday-fade-up space-y-2.5">
        <h1
          className="text-[28px] font-semibold leading-tight tracking-tight"
          style={{ color: 'var(--sunday-text)' }}
        >
          Todo
        </h1>
        <p
          className="max-w-2xl text-[13.5px] leading-relaxed"
          style={{ color: 'var(--sunday-text-muted)' }}
        >
          One-off things you (or Sunday) need to get done. For prompts that should auto-run on a
          schedule, use <em>Tasks</em>.
        </p>
      </header>

      <QuickAdd user={user} projects={projects} onAdd={add} />

      <div className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map(f => {
          const active = f.key === filterKey
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterKey(f.key)}
              className="sunday-press rounded-md border px-2.5 py-1 text-[12px]"
              style={{
                background: active ? 'var(--sunday-surface-2)' : 'var(--sunday-surface)',
                borderColor: active ? 'var(--sunday-border-hover)' : 'var(--sunday-border-strong)',
                color: active ? 'var(--sunday-text)' : 'var(--sunday-text-muted)',
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <SkeletonList />
      ) : tasks.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-5">
          {grouped.map(([groupName, groupTasks], groupIdx) => (
            <section
              key={groupName ?? 'loose'}
              className="sunday-fade-up space-y-2"
              style={{ animationDelay: `${groupIdx * 50}ms` }}
            >
              <h2
                className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
                style={{ color: 'var(--sunday-text-faint)' }}
              >
                {groupName ?? 'No project'} · {groupTasks.length}
              </h2>
              <div className="space-y-1.5">
                {groupTasks.map((task, i) => (
                  <div
                    key={task.id}
                    className="sunday-fade-up"
                    style={{ animationDelay: `${Math.min(i * 30, 150)}ms` }}
                  >
                    <TaskRow
                      task={task}
                      onComplete={complete}
                      onReopen={reopen}
                      onDelete={remove}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- quick-add ----------

function QuickAdd({ user, projects, onAdd }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('normal')
  const [due, setDue] = useState('')
  const [projectId, setProjectId] = useState(NO_PROJECT_VALUE)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef(null)

  async function handleSubmit(e) {
    e?.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || !user?.id) {
      inputRef.current?.focus()
      return
    }
    setSubmitting(true)
    try {
      await onAdd({
        userId: user.id,
        title: trimmed,
        priority,
        projectId: projectId === NO_PROJECT_VALUE ? null : projectId,
        due: dueInputToIso(due),
      })
      setTitle('')
      setDue('')
      inputRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <Input
        ref={inputRef}
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="What needs doing?"
        size="lg"
        aria-label="What needs doing?"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger size="md" aria-label="Priority" className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map(p => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={due}
            onChange={e => setDue(e.target.value)}
            size="md"
            className="w-[160px] tabular-nums"
            aria-label="Due date"
          />

          {projects.length > 0 && (
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger size="md" aria-label="Project" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT_VALUE}>No project</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Button type="submit" variant="primary" size="md" disabled={submitting}>
          <Plus size={13} strokeWidth={2.4} />
          {submitting ? 'Adding…' : 'Add todo'}
        </Button>
      </div>
    </form>
  )
}

// ---------- helpers ----------

function dueInputToIso(value) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString()
}

function groupByProject(tasks, projects) {
  const projectName = new Map(projects.map(p => [p.id, p.name]))
  const groups = new Map()
  for (const task of tasks) {
    const key = task.project_id ?? null
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(task)
  }
  return Array.from(groups.entries()).map(([id, items]) => [
    id ? (projectName.get(id) ?? id.slice(0, 8)) : null,
    items,
  ])
}

// ---------- empty / skeleton ----------

function EmptyState({ filter }) {
  const message =
    filter.key === 'active'
      ? "Inbox zero. Type above to add something — or tell Sunday in chat ('Sunday, add a todo: …')."
      : `No ${filter.label.toLowerCase()} todos.`
  return (
    <Surface>
      <p className="py-3 text-center text-[13px]" style={{ color: 'var(--sunday-text-muted)' }}>
        {message}
      </p>
    </Surface>
  )
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="sunday-skeleton h-3 w-24" />
          {Array.from({ length: 3 }).map((__, j) => (
            <div key={j} className="sunday-skeleton h-12 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}
