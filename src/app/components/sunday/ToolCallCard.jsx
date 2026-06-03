import {
  AlertTriangle,
  Brain,
  Check,
  CheckSquare,
  Code,
  FolderKanban,
  Github,
  Globe,
  Home,
  Loader2,
  MonitorSmartphone,
  Terminal,
  Timer,
} from 'lucide-react'

const TOOL_CATEGORIES = {
  Memory: {
    icon: Brain,
    accentColor: 'var(--sunday-accent-bright)',
    tools: ['memory_search', 'memory_write', 'memory_update', 'memory_delete'],
  },
  Tasks: {
    icon: CheckSquare,
    accentColor: '#22c55e',
    tools: [
      'tasks_add',
      'tasks_list',
      'tasks_complete',
      'tasks_snooze',
      'tasks_update',
      'tasks_recurring_list',
      'tasks_recurring_update',
      'tasks_recurring_run_now',
      'tasks_recurring_delete',
    ],
  },
  GitHub: {
    icon: Github,
    accentColor: '#8b5cf6',
    tools: ['github_list_repos', 'github_sync', 'github_track_repo', 'github_list_issues'],
  },
  Devices: {
    icon: MonitorSmartphone,
    accentColor: '#14b8a6',
    tools: ['devices_list'],
  },
  Projects: {
    icon: FolderKanban,
    accentColor: '#a78bfa',
    tools: ['projects_list', 'projects_get', 'projects_create', 'projects_update'],
  },
  Home: {
    icon: Home,
    accentColor: '#f59e0b',
    tools: [
      'home_assistant_list_entities',
      'home_assistant_get_state',
      'home_assistant_call_service',
    ],
  },
  Code: {
    icon: Code,
    accentColor: '#06b6d4',
    tools: ['claude_code_dispatch', 'claude_code_status', 'claude_code_list_recent'],
  },
  Web: {
    icon: Globe,
    accentColor: '#3b82f6',
    tools: ['web_search', 'web_fetch'],
  },
  Time: {
    icon: Timer,
    accentColor: '#ec4899',
    tools: ['time_now', 'time_schedule_reminder'],
  },
  // Claude Code built-ins that leak through the daemon's allowed-tools list.
  // Rendered muted because they're plumbing the user mostly doesn't care about.
  System: {
    icon: Terminal,
    accentColor: 'var(--sunday-text-muted)',
    tools: [
      'Bash',
      'Read',
      'Write',
      'Edit',
      'Glob',
      'Grep',
      'Agent',
      'Skill',
      'TodoWrite',
      'ToolSearch',
      'NotebookEdit',
      'BashOutput',
      'KillShell',
      'WebFetch',
      'WebSearch',
    ],
  },
}

const HUMAN_LABELS = {
  memory_search: 'Searched memory',
  memory_write: 'Saved to memory',
  memory_update: 'Updated memory',
  memory_delete: 'Deleted memory entry',
  tasks_add: 'Created task',
  tasks_list: 'Listed tasks',
  tasks_complete: 'Completed task',
  tasks_snooze: 'Snoozed task',
  tasks_update: 'Updated task',
  tasks_recurring_list: 'Listed scheduled prompts',
  tasks_recurring_update: 'Updated scheduled prompt',
  tasks_recurring_run_now: 'Fired scheduled prompt',
  tasks_recurring_delete: 'Deleted scheduled prompt',
  projects_list: 'Listed projects',
  projects_get: 'Fetched project',
  projects_create: 'Created project',
  projects_update: 'Updated project',
  home_assistant_list_entities: 'Listed devices',
  home_assistant_get_state: 'Checked device state',
  home_assistant_call_service: 'Called home service',
  claude_code_dispatch: 'Dispatched coding session',
  claude_code_status: 'Checked code status',
  claude_code_list_recent: 'Listed recent sessions',
  web_search: 'Searched the web',
  web_fetch: 'Fetched web page',
  time_now: 'Checked current time',
  time_schedule_reminder: 'Scheduled reminder',
  github_list_repos: 'Listed GitHub repos',
  github_sync: 'Synced GitHub',
  github_track_repo: 'Tracked GitHub repo',
  github_list_issues: 'Listed GitHub issues',
  devices_list: 'Listed connected devices',
  Bash: 'Ran shell commands',
  Read: 'Read files',
  Write: 'Wrote files',
  Edit: 'Edited files',
  Glob: 'Searched paths',
  Grep: 'Searched contents',
  Agent: 'Dispatched subagent',
  Skill: 'Invoked skill',
  TodoWrite: 'Updated work plan',
  ToolSearch: 'Discovered tools',
  NotebookEdit: 'Edited notebook',
  BashOutput: 'Read shell output',
  KillShell: 'Stopped shell',
  WebFetch: 'Fetched web page',
  WebSearch: 'Searched the web',
}

const STATUS_CONFIG = {
  running: { Icon: Loader2, color: 'var(--sunday-accent-bright)', spin: true },
  complete: { Icon: Check, color: '#22c55e', spin: false },
  error: { Icon: AlertTriangle, color: 'var(--sunday-danger)', spin: false },
}

/** Look up which category a tool belongs to. */
function findCategory(toolName) {
  for (const [categoryName, config] of Object.entries(TOOL_CATEGORIES)) {
    if (config.tools.includes(toolName)) return { categoryName, ...config }
  }
  return null
}

/** Format milliseconds to a concise human-readable duration (ms / s / m). */
function formatDuration(ms) {
  if (!Number.isFinite(ms)) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.round((ms - mins * 60_000) / 1000)
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

/**
 * Compact, summarized view of every tool call attached to a message.
 *
 * Tool calls are grouped by category, then collapsed by tool name so that
 * "Read x16, Bash x6" renders as 2 rows instead of 22. The worst status
 * across the collapsed group wins (running > error > complete).
 *
 * @param {{ toolCalls: Array<{ id: string, toolName: string, status: string, durationMs?: number }> }} props
 */
export default function ToolCallCard({ toolCalls }) {
  const grouped = groupByCategory(toolCalls)

  return (
    <div className="flex flex-col gap-1.5 pl-0.5">
      {grouped.map(group => (
        <CategoryCard key={group.categoryName} group={group} />
      ))}
    </div>
  )
}

function CategoryCard({ group }) {
  const CategoryIcon = group.icon
  const rows = collapseByTool(group.calls)
  const totalCount = group.calls.length
  const totalMs = group.calls.reduce(
    (sum, c) => sum + (typeof c.durationMs === 'number' ? c.durationMs : 0),
    0
  )

  return (
    <div
      className="sunday-fade-up overflow-hidden rounded-lg border"
      style={{
        background: 'var(--sunday-surface)',
        borderColor: 'var(--sunday-border-strong)',
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-1.5"
        style={{
          background: 'var(--sunday-surface-2)',
          borderBottom: '1px solid var(--sunday-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <CategoryIcon size={13} strokeWidth={2.2} style={{ color: group.accentColor }} />
          <span
            className="font-mono text-[10.5px] uppercase tracking-[0.12em]"
            style={{ color: group.accentColor }}
          >
            {group.categoryName}
          </span>
          <span
            className="font-mono text-[10.5px] tabular-nums"
            style={{ color: 'var(--sunday-text-faint)' }}
          >
            {totalCount}
          </span>
        </div>
        {totalMs > 0 && (
          <span
            className="font-mono text-[10.5px] tabular-nums"
            style={{ color: 'var(--sunday-text-faint)' }}
          >
            {formatDuration(totalMs)}
          </span>
        )}
      </div>
      <div className="divide-y divide-[color:var(--sunday-border)]">
        {rows.map(row => (
          <ToolRow key={row.toolName} row={row} />
        ))}
      </div>
    </div>
  )
}

function ToolRow({ row }) {
  const statusMeta = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.complete
  const StatusIcon = statusMeta.Icon

  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5">
      <StatusIcon
        size={12}
        strokeWidth={2.4}
        className={statusMeta.spin ? 'animate-spin' : ''}
        style={{ color: statusMeta.color, flexShrink: 0 }}
      />
      <span className="flex-1 text-[13px] leading-tight" style={{ color: 'var(--sunday-text)' }}>
        {row.label}
        {row.count > 1 && <span style={{ color: 'var(--sunday-text-faint)' }}> · {row.count}</span>}
      </span>
      {row.totalMs > 0 && row.status !== 'running' && (
        <span
          className="font-mono text-[10.5px] tabular-nums"
          style={{ color: 'var(--sunday-text-faint)' }}
        >
          {formatDuration(row.totalMs)}
        </span>
      )}
    </div>
  )
}

/**
 * Collapse adjacent/repeated tool calls with the same toolName into a single
 * row. Counts are accumulated, durations summed, worst status wins.
 */
function collapseByTool(calls) {
  const map = new Map()
  for (const call of calls) {
    const key = call.toolName ?? 'unknown'
    if (!map.has(key)) {
      map.set(key, {
        toolName: key,
        label: HUMAN_LABELS[key] ?? key,
        count: 0,
        totalMs: 0,
        running: 0,
        errors: 0,
      })
    }
    const entry = map.get(key)
    entry.count++
    if (typeof call.durationMs === 'number') entry.totalMs += call.durationMs
    if (call.status === 'running') entry.running++
    else if (call.status === 'error') entry.errors++
  }
  return Array.from(map.values()).map(entry => ({
    ...entry,
    status: entry.running > 0 ? 'running' : entry.errors > 0 ? 'error' : 'complete',
  }))
}

/** Groups an array of tool calls by their category. Uncategorized tools get their own group. */
function groupByCategory(toolCalls) {
  const categoryMap = new Map()

  for (const tc of toolCalls) {
    const cat = findCategory(tc.toolName)
    const key = cat?.categoryName ?? 'Other'

    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        categoryName: key,
        icon: cat?.icon ?? Globe,
        accentColor: cat?.accentColor ?? 'var(--sunday-text-muted)',
        calls: [],
      })
    }
    categoryMap.get(key).calls.push(tc)
  }

  return Array.from(categoryMap.values())
}
