import { Circle, CheckCircle2, Clock, AlertCircle, Repeat, X } from 'lucide-react'
import { formatShortDate } from '@utils/sundayTime'

const PRIORITY_DOT = {
  urgent: 'var(--sunday-danger)',
  high: 'var(--sunday-warning)',
  normal: 'var(--sunday-text-muted)',
  low: 'var(--sunday-text-faint)',
}

export default function TaskRow({ task, onComplete, onReopen, onDelete }) {
  const isDone = task.status === 'done'
  const isSnoozed = task.status === 'snoozed'
  const due = task.due ? new Date(task.due) : null
  const overdue = due && due < new Date() && !isDone
  const fromRecurring = !!task.parent_recurrence_id

  const Icon = isDone ? CheckCircle2 : isSnoozed ? Clock : overdue ? AlertCircle : Circle
  const iconColor = overdue
    ? 'var(--sunday-danger)'
    : isDone
      ? 'var(--sunday-positive)'
      : 'var(--sunday-text-muted)'

  function handleToggle(e) {
    e.preventDefault()
    e.stopPropagation()
    if (isDone) {
      onReopen?.(task.id)
    } else {
      onComplete?.(task.id)
    }
  }

  function handleDelete(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm('Delete this task?')) return
    onDelete?.(task.id)
  }

  return (
    <div
      className="group flex items-start gap-3 rounded-md border px-3 py-2"
      style={{
        background: 'var(--sunday-surface)',
        borderColor: 'var(--sunday-border-strong)',
        color: 'var(--sunday-text)',
        opacity: isDone ? 0.6 : 1,
        transition: 'border-color 140ms var(--sunday-ease-out)',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--sunday-border-hover)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--sunday-border-strong)')}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isDone ? 'Reopen task' : 'Mark task done'}
        className="sunday-press mt-0.5 shrink-0 rounded-full"
        style={{ color: iconColor, transition: 'color 140ms var(--sunday-ease-out)' }}
      >
        <Icon size={16} strokeWidth={2} />
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={`text-[13.5px] leading-snug ${isDone ? 'line-through' : ''}`}
          style={{ color: isDone ? 'var(--sunday-text-muted)' : 'var(--sunday-text)' }}
        >
          {task.title}
        </div>
        <div
          className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10.5px]"
          style={{ color: 'var(--sunday-text-faint)' }}
        >
          <span className="inline-flex items-center gap-1 uppercase tracking-[0.12em]">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: PRIORITY_DOT[task.priority] }}
            />
            {task.priority}
          </span>
          {due && (
            <span
              className="tabular-nums"
              style={{ color: overdue ? 'var(--sunday-danger)' : 'var(--sunday-text-faint)' }}
            >
              due {formatShortDate(due)}
            </span>
          )}
          {isSnoozed && task.snooze_until && (
            <span className="tabular-nums">snz {formatShortDate(task.snooze_until)}</span>
          )}
          {fromRecurring && (
            <span
              className="inline-flex items-center gap-1 rounded border px-1 py-0.5"
              style={{
                background: 'var(--sunday-bg-elevated)',
                borderColor: 'var(--sunday-border)',
                color: 'var(--sunday-accent-bright)',
              }}
              title="Spawned by a recurring template"
            >
              <Repeat size={9} />
              recurring
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        aria-label="Delete task"
        className="sunday-press shrink-0 self-start rounded p-0.5 opacity-0 group-hover:opacity-100"
        style={{
          color: 'var(--sunday-text-faint)',
          transition: 'opacity 140ms var(--sunday-ease-out), color 140ms var(--sunday-ease-out)',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--sunday-danger)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--sunday-text-faint)')}
      >
        <X size={12} />
      </button>
    </div>
  )
}
