import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as SelectPrimitive from '@radix-ui/react-select'
import { MessageSquare, Pencil, Play, Plus, Repeat, Save, Trash2, X } from 'lucide-react'
import { Button } from '@components/ui/button'
import { Field } from '@components/ui/field'
import { Input } from '@components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select'
import { Textarea } from '@components/ui/textarea'
import { SUNDAY_ROUTES } from '@constants/sunday/routes'
import { useAuth } from '@hooks/useAuth'
import { useScheduledPrompts } from '@hooks/sunday/useTasks'
import { formatRelative } from '@utils/sundayTime'

const ACTIVE_CONV_KEY = 'sunday.activeConversationId'

const RECURRENCE_OPTIONS = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays (Mon–Fri)' },
  { value: 'weekly:mon', label: 'Every Monday' },
  { value: 'weekly:tue', label: 'Every Tuesday' },
  { value: 'weekly:wed', label: 'Every Wednesday' },
  { value: 'weekly:thu', label: 'Every Thursday' },
  { value: 'weekly:fri', label: 'Every Friday' },
  { value: 'weekly:sat', label: 'Every Saturday' },
  { value: 'weekly:sun', label: 'Every Sunday' },
  { value: 'monthly:1', label: 'Monthly · 1st' },
  { value: 'monthly:15', label: 'Monthly · 15th' },
  { value: 'monthly:last', label: 'Monthly · last day' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const DAY_NAMES = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

function formatClockLabel(hour = 9, minute = 0) {
  const period = hour < 12 ? 'AM' : 'PM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`
}

function ruleLabel(rule, hour = 9, minute = 0) {
  const timeStr = formatClockLabel(hour, minute)
  if (!rule) return '—'
  if (rule === 'daily') return `Every day · ${timeStr}`
  if (rule === 'weekdays') return `Mon–Fri · ${timeStr}`
  if (rule.startsWith('weekly:')) {
    const day = DAY_NAMES[rule.slice(7)] ?? rule.slice(7)
    return `Every ${day} · ${timeStr}`
  }
  if (rule.startsWith('monthly:')) {
    const target = rule.slice(8)
    if (target === 'last') return `Last day of month · ${timeStr}`
    return `Monthly · ${target}${ordinal(target)} · ${timeStr}`
  }
  return rule
}

function ordinal(s) {
  const n = parseInt(s, 10)
  if (!Number.isFinite(n)) return ''
  const v = n % 100
  if (v >= 11 && v <= 13) return 'th'
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
}

function firedLabel(iso) {
  return iso ? `fired ${formatRelative(iso)}` : 'not yet fired'
}

export default function SundayTasks() {
  const { user } = useAuth()
  const { items, loading, add, update, remove, runNow } = useScheduledPrompts()
  const [composerOpen, setComposerOpen] = useState(false)

  async function handleAdd(payload) {
    if (!user?.id) return
    await add({ userId: user.id, ...payload })
    setComposerOpen(false)
  }

  return (
    <div className="w-full space-y-7 px-8 py-8">
      <header className="sunday-fade-up space-y-2.5">
        <h1
          className="text-[28px] font-semibold leading-tight tracking-tight"
          style={{ color: 'var(--sunday-text)' }}
        >
          Tasks
        </h1>
        <p
          className="max-w-2xl text-[13.5px] leading-relaxed"
          style={{ color: 'var(--sunday-text-muted)' }}
        >
          Scheduled prompts that Sunday auto-runs in a background chat. Each result lands as a new
          conversation in Chat.
        </p>
        <p
          className="max-w-2xl rounded-md border px-3 py-2 text-[12.5px] leading-relaxed"
          style={{
            background: 'var(--sunday-accent-softer)',
            borderColor: 'var(--sunday-accent-soft)',
            color: 'var(--sunday-text-muted)',
          }}
        >
          These fire from Sunday's local daemon — independent of any browser. You can close every
          tab and they still run on schedule as long as the daemon is loaded on the Mac.
        </p>
      </header>

      <Composer
        open={composerOpen}
        onOpen={() => setComposerOpen(true)}
        onCancel={() => setComposerOpen(false)}
        onSubmit={handleAdd}
      />

      {loading && items.length === 0 ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {items.map((template, i) => (
            <ScheduledPromptCard
              key={template.id}
              template={template}
              user={user}
              onUpdate={update}
              onRemove={remove}
              onRunNow={runNow}
              animationDelay={`${Math.min(i * 40, 200)}ms`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- collapsed composer button + form ----------

function Composer({ open, onOpen, onCancel, onSubmit }) {
  if (!open) {
    return (
      <Button onClick={onOpen} variant="primary" size="lg" className="self-start">
        <Plus size={14} strokeWidth={2.4} />
        New scheduled prompt
      </Button>
    )
  }
  return <PromptForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />
}

// ---------- card ----------

function ScheduledPromptCard({ template, user, onUpdate, onRemove, onRunNow, animationDelay }) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [running, setRunning] = useState(false)

  async function handleRunNow() {
    if (!user?.id) return
    setRunning(true)
    try {
      const conversationId = await onRunNow({ userId: user.id, template })
      if (conversationId) {
        window.localStorage.setItem(ACTIVE_CONV_KEY, conversationId)
        navigate(SUNDAY_ROUTES.CHAT)
      }
    } finally {
      setRunning(false)
    }
  }

  function openLastConversation() {
    if (!template.conversation_id) return
    window.localStorage.setItem(ACTIVE_CONV_KEY, template.conversation_id)
    navigate(SUNDAY_ROUTES.CHAT)
  }

  function handleDelete() {
    if (window.confirm(`Stop running "${template.title}"?`)) onRemove(template.id)
  }

  if (editing) {
    return (
      <div className="sunday-fade-up" style={{ animationDelay }}>
        <PromptForm
          mode="edit"
          initial={template}
          onSubmit={async patch => {
            await onUpdate(template.id, patch)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  const promptPreview = (template.prompt ?? '').trim() || template.title

  return (
    <div
      className="sunday-card-alive sunday-fade-up group relative rounded-xl border p-4"
      style={{
        background: 'var(--sunday-surface)',
        borderColor: 'var(--sunday-border-strong)',
        animationDelay,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-[15px] font-semibold tracking-tight"
            style={{ color: 'var(--sunday-text)' }}
          >
            {template.title}
          </h2>
          <p
            className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--sunday-accent-bright)' }}
          >
            <Repeat size={10} strokeWidth={2.2} />
            {ruleLabel(template.recurrence_rule, template.fire_hour, template.fire_minute)}
          </p>
        </div>
        <CardActions
          onRunNow={handleRunNow}
          onEdit={() => setEditing(true)}
          onDelete={handleDelete}
          running={running}
        />
      </div>

      <p
        className="mt-3 line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed"
        style={{ color: 'var(--sunday-text-muted)' }}
      >
        {promptPreview}
      </p>

      <div
        className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 font-mono text-[10.5px] tabular-nums"
        style={{ borderColor: 'var(--sunday-border)', color: 'var(--sunday-text-faint)' }}
      >
        <span>{firedLabel(template.last_recurrence_fired_at)}</span>
        {template.conversation_id && (
          <button
            type="button"
            onClick={openLastConversation}
            className="sunday-press inline-flex items-center gap-1"
            style={{
              color: 'var(--sunday-accent-bright)',
              transition: 'color 140ms var(--sunday-ease-out)',
            }}
          >
            <MessageSquare size={10} strokeWidth={2.2} />
            open last conversation
          </button>
        )}
      </div>
    </div>
  )
}

function CardActions({ onRunNow, onEdit, onDelete, running }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button onClick={onRunNow} disabled={running} size="sm" variant="primary">
        <Play size={11} strokeWidth={2.4} />
        {running ? 'Running…' : 'Run now'}
      </Button>
      <Button onClick={onEdit} size="icon" variant="secondary" aria-label="Edit">
        <Pencil size={12} strokeWidth={2.1} />
      </Button>
      <Button onClick={onDelete} size="icon" variant="secondary" aria-label="Delete">
        <Trash2 size={12} strokeWidth={2.1} />
      </Button>
    </div>
  )
}

// ---------- shared form ----------

function PromptForm({ mode, initial, onSubmit, onCancel }) {
  const isEdit = mode === 'edit'
  const [title, setTitle] = useState(initial?.title ?? '')
  const [rule, setRule] = useState(initial?.recurrence_rule ?? 'daily')
  const [prompt, setPrompt] = useState(initial?.prompt ?? '')
  const [priority, setPriority] = useState(initial?.priority ?? 'normal')
  const [fireHour, setFireHour] = useState(
    typeof initial?.fire_hour === 'number' ? initial.fire_hour : 9
  )
  const [fireMinute, setFireMinute] = useState(
    typeof initial?.fire_minute === 'number' ? initial.fire_minute : 0
  )
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = title.trim().length > 0 && rule.trim().length > 0

  async function handleSubmit(e) {
    e?.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      if (isEdit) {
        await onSubmit({
          title: title.trim(),
          recurrence_rule: rule,
          prompt: prompt.trim(),
          priority,
          fire_hour: fireHour,
          fire_minute: fireMinute,
        })
      } else {
        await onSubmit({
          title: title.trim(),
          rule,
          prompt: prompt.trim(),
          priority,
          fireHour,
          fireMinute,
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault()
      onCancel?.()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKey}
      className="sunday-fade-up rounded-2xl border p-6"
      style={{
        background: 'var(--sunday-surface)',
        borderColor: 'var(--sunday-border-hover)',
        boxShadow: '0 0 0 4px var(--sunday-accent-softer)',
      }}
    >
      <div
        className="mb-5 flex items-center justify-between border-b pb-3"
        style={{ borderColor: 'var(--sunday-border)' }}
      >
        <h3
          className="text-[14px] font-semibold tracking-tight"
          style={{ color: 'var(--sunday-text)' }}
        >
          {isEdit ? 'Edit scheduled prompt' : 'New scheduled prompt'}
        </h3>
        <Button onClick={onCancel} variant="ghost" size="icon" aria-label="Cancel" type="button">
          <X size={13} strokeWidth={2.1} />
        </Button>
      </div>

      <div className="space-y-5">
        <Field label="Name" hint="What to call this task." htmlFor="scheduled-prompt-name">
          <Input
            id="scheduled-prompt-name"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Nightly summary"
            size="lg"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr_1.4fr_1fr]">
          <Field label="Schedule">
            <Select value={rule} onValueChange={setRule}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a schedule" />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Fire time (CT)">
            <TimePicker
              hour={fireHour}
              minute={fireMinute}
              onChange={(h, m) => {
                setFireHour(h)
                setFireMinute(m)
              }}
            />
          </Field>

          <Field label="Priority">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field
          label="Prompt"
          hint="What Sunday should do each time this fires. Same as if you typed it into Chat."
          htmlFor="scheduled-prompt-body"
        >
          <Textarea
            id="scheduled-prompt-body"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={6}
            placeholder="e.g. Summarize what I accomplished today, what's still open, and the top 3 things to focus on tomorrow. Pull from recent memories, tool calls, and open tasks."
            className="min-h-[140px]"
          />
        </Field>
      </div>

      <div
        className="mt-6 flex items-center justify-between gap-3 border-t pt-4"
        style={{ borderColor: 'var(--sunday-border)' }}
      >
        <p
          className="hidden font-mono text-[10.5px] uppercase tracking-[0.16em] sm:inline"
          style={{ color: 'var(--sunday-text-faint)' }}
        >
          Esc to cancel
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={onCancel} variant="ghost" type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || submitting} variant="primary">
            {isEdit ? <Save size={12} strokeWidth={2.4} /> : <Plus size={12} strokeWidth={2.4} />}
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </Button>
        </div>
      </div>
    </form>
  )
}

// ---------- time picker ----------

/**
 * 3 Radix Selects sharing a single outer "input shell" so the time picker
 * reads as one control. Each segment opens its own dropdown.
 */
function TimePicker({ hour, minute, onChange }) {
  const period = hour < 12 ? 'AM' : 'PM'
  const displayHour = hour % 12 || 12

  function setDisplayHour(next) {
    const h = Number(next)
    const newHour = period === 'AM' ? (h === 12 ? 0 : h) : h === 12 ? 12 : h + 12
    onChange(newHour, minute)
  }

  function setMinute(next) {
    onChange(hour, Number(next))
  }

  function setPeriod(next) {
    const h12 = hour % 12 || 12
    const newHour = next === 'AM' ? (h12 === 12 ? 0 : h12) : h12 === 12 ? 12 : h12 + 12
    onChange(newHour, minute)
  }

  return (
    <div
      className="inline-flex h-9 items-center rounded-md border px-2.5 transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-[var(--sunday-accent)] focus-within:shadow-[0_0_0_3px_var(--sunday-accent-soft)]"
      style={{
        background: 'var(--sunday-surface-2)',
        borderColor: 'var(--sunday-border-input)',
      }}
    >
      <TimeSegment
        value={String(displayHour)}
        onValueChange={setDisplayHour}
        ariaLabel="Hour"
        options={Array.from({ length: 12 }, (_, i) => ({
          value: String(i + 1),
          label: String(i + 1),
        }))}
      />
      <span
        aria-hidden
        className="select-none px-[1px] font-mono text-[13.5px] tabular-nums leading-none"
        style={{ color: 'var(--sunday-text-muted)' }}
      >
        :
      </span>
      <TimeSegment
        value={String(minute)}
        onValueChange={setMinute}
        ariaLabel="Minute"
        options={Array.from({ length: 12 }, (_, i) => {
          const m = i * 5
          return { value: String(m), label: String(m).padStart(2, '0') }
        })}
      />
      <span aria-hidden className="w-2 shrink-0" />
      <TimeSegment
        value={period}
        onValueChange={setPeriod}
        ariaLabel="AM or PM"
        options={[
          { value: 'AM', label: 'AM' },
          { value: 'PM', label: 'PM' },
        ]}
      />
    </div>
  )
}

function TimeSegment({ value, onValueChange, ariaLabel, options, className }) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={`sunday-press rounded px-1 py-0.5 font-mono text-[13.5px] tabular-nums leading-none outline-none transition-colors duration-100 hover:bg-[var(--sunday-surface-3)] data-[state=open]:bg-[var(--sunday-surface-3)] ${className ?? ''}`}
        style={{ color: 'var(--sunday-text)' }}
      >
        <SelectPrimitive.Value />
      </SelectPrimitive.Trigger>
      <SelectContent sideOffset={6}>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectPrimitive.Root>
  )
}

// ---------- empty / skeleton ----------

function EmptyState() {
  return (
    <div
      className="space-y-2 rounded-xl border border-dashed px-6 py-12 text-center"
      style={{
        borderColor: 'var(--sunday-border-strong)',
        background: 'var(--sunday-surface)',
      }}
    >
      <p className="text-[14px] font-medium" style={{ color: 'var(--sunday-text)' }}>
        No scheduled prompts yet
      </p>
      <p
        className="mx-auto max-w-md text-[12.5px] leading-relaxed"
        style={{ color: 'var(--sunday-text-muted)' }}
      >
        Click <em>New scheduled prompt</em> above. Each one becomes an automatic chat Sunday runs on
        a schedule — daily standups, weekly summaries, anything you'd otherwise have to remember to
        type.
      </p>
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="sunday-skeleton h-28 w-full rounded-xl" />
      ))}
    </div>
  )
}
