import { Check, AlertTriangle, Loader2, Wrench } from 'lucide-react'

const TOOL_LABELS = {
  memory_search: 'memory.search',
  memory_write: 'memory.write',
  memory_update: 'memory.update',
  memory_delete: 'memory.delete',
  tasks_add: 'tasks.add',
  tasks_list: 'tasks.list',
  tasks_complete: 'tasks.complete',
  tasks_snooze: 'tasks.snooze',
  tasks_update: 'tasks.update',
  projects_list: 'projects.list',
  projects_get: 'projects.get',
  projects_create: 'projects.create',
  projects_update: 'projects.update',
  home_assistant_list_entities: 'ha.list',
  home_assistant_get_state: 'ha.state',
  home_assistant_call_service: 'ha.call',
  claude_code_dispatch: 'code.dispatch',
  claude_code_status: 'code.status',
  claude_code_list_recent: 'code.list',
  web_search: 'web.search',
  web_fetch: 'web.fetch',
  time_now: 'time.now',
  time_schedule_reminder: 'time.remind',
}

const STATUS = {
  running: { color: 'var(--sunday-accent-bright)', Icon: Loader2, spin: true },
  complete: { color: 'var(--sunday-text-muted)', Icon: Check, spin: false },
  error: { color: 'var(--sunday-danger)', Icon: AlertTriangle, spin: false },
}

export default function ToolCallChip({ toolName, status = 'running', durationMs }) {
  const label = TOOL_LABELS[toolName] ?? toolName
  const meta = STATUS[status] ?? STATUS.complete
  const Icon = meta.Icon ?? Wrench

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[10.5px]"
      style={{
        background: 'var(--sunday-bg-elevated)',
        color: meta.color,
        borderColor: 'var(--sunday-border-strong)',
      }}
    >
      <Icon size={10} className={meta.spin ? 'animate-spin' : ''} strokeWidth={2.4} />
      <span style={{ color: 'var(--sunday-text)' }}>{label}</span>
      {typeof durationMs === 'number' && status !== 'running' && (
        <span className="tabular-nums" style={{ color: 'var(--sunday-text-faint)' }}>
          {durationMs}ms
        </span>
      )}
    </span>
  )
}
