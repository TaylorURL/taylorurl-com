import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronsLeft,
  ChevronsRight,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useConversations } from '@hooks/sunday/useConversations'
import { formatShortDate } from '@utils/sundayTime'

/**
 * Chat's left rail. Two modes:
 *  - collapsed: thin 60px rail with toggle + new chat + count
 *  - expanded: 296px panel with search + grouped conversation list
 *
 * Collapse state is owned by SundayChat (persisted in localStorage).
 */
export default function ConversationList({
  activeId,
  onSelect,
  onNew,
  collapsed,
  onToggle,
  onActiveTitleChange,
}) {
  const { conversations, loading, error, removeConversation, renameConversation } =
    useConversations()

  // Broadcast the active conversation's title up to the parent so the chat
  // header can show it without needing a duplicate useConversations call
  // (which would clash on the same Supabase Realtime channel name).
  useEffect(() => {
    if (!onActiveTitleChange) return
    const active = conversations.find(c => c.id === activeId)
    onActiveTitleChange(active?.title ?? null)
  }, [activeId, conversations, onActiveTitleChange])
  const [renamingId, setRenamingId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations
    const needle = search.toLowerCase()
    return conversations.filter(
      c => (c.title || '').toLowerCase().includes(needle) || c.id.startsWith(needle)
    )
  }, [conversations, search])

  const grouped = useMemo(() => groupByAge(filtered), [filtered])

  function startRename(conv) {
    setRenamingId(conv.id)
    setRenameDraft(conv.title ?? '')
  }
  function cancelRename() {
    setRenamingId(null)
    setRenameDraft('')
  }
  async function commitRename(id) {
    const next = renameDraft.trim()
    if (next) await renameConversation(id, next)
    cancelRename()
  }
  async function handleDelete(conv) {
    const ok = window.confirm(
      conv.title
        ? `Delete "${truncate(conv.title, 60)}"? Messages cannot be recovered.`
        : 'Delete this conversation? Messages cannot be recovered.'
    )
    if (!ok) return
    await removeConversation(conv.id)
    if (activeId === conv.id) onNew?.()
  }

  if (collapsed) {
    return (
      <CollapsedRail
        onToggle={onToggle}
        onNew={onNew}
        hasActive={!!activeId}
        count={conversations.length}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3"
        style={{ borderColor: 'var(--sunday-border)' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MessageCircle size={14} strokeWidth={2} style={{ color: 'var(--sunday-text-muted)' }} />
          <span
            className="truncate text-[13px] font-semibold tracking-tight"
            style={{ color: 'var(--sunday-text)' }}
          >
            Conversations
          </span>
          {conversations.length > 0 && (
            <span
              className="font-mono text-[10.5px] tabular-nums"
              style={{ color: 'var(--sunday-text-faint)' }}
            >
              {conversations.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNew}
            aria-label="New conversation"
            title="New conversation"
            className="sunday-press inline-flex h-7 w-7 items-center justify-center rounded-md"
            style={{
              background: 'var(--sunday-accent)',
              color: 'var(--sunday-on-accent)',
              border: '1px solid var(--sunday-accent)',
            }}
          >
            <Plus size={13} strokeWidth={2.6} />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            title="Collapse"
            className="sunday-press inline-flex h-7 w-7 items-center justify-center rounded-md border"
            style={{
              background: 'var(--sunday-surface)',
              borderColor: 'var(--sunday-border-strong)',
              color: 'var(--sunday-text-muted)',
              transition: 'color 140ms var(--sunday-ease-out)',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--sunday-text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--sunday-text-muted)')}
          >
            <ChevronsLeft size={13} />
          </button>
        </div>
      </header>

      <div className="border-b px-3 py-2.5" style={{ borderColor: 'var(--sunday-border)' }}>
        <div className="relative">
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--sunday-text-faint)' }}
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="block w-full rounded-md border py-1.5 pl-7 pr-2 text-[12.5px] outline-none placeholder:opacity-60"
            style={{
              borderColor: 'var(--sunday-border-input)',
              background: 'var(--sunday-surface-2)',
              color: 'var(--sunday-text)',
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading && conversations.length === 0 ? (
          <p className="px-2 py-3 text-[12px]" style={{ color: 'var(--sunday-text-muted)' }}>
            Loading…
          </p>
        ) : filtered.length === 0 ? (
          <p
            className="px-2 py-3 text-[12px] leading-relaxed"
            style={{ color: 'var(--sunday-text-muted)' }}
          >
            {search
              ? 'No conversations match.'
              : 'No conversations yet. Send a message to start one.'}
          </p>
        ) : (
          grouped.map(group => (
            <section key={group.key} className="mb-3 last:mb-0">
              <h3 className="sunday-eyebrow mb-1 px-2">{group.label}</h3>
              <ul className="space-y-px">
                {group.items.map(conv => (
                  <li key={conv.id}>
                    <ConvRow
                      conv={conv}
                      active={conv.id === activeId}
                      isRenaming={renamingId === conv.id}
                      renameDraft={renameDraft}
                      onRenameDraft={setRenameDraft}
                      onStartRename={startRename}
                      onCancelRename={cancelRename}
                      onCommitRename={commitRename}
                      onSelect={() => onSelect(conv.id)}
                      onDelete={() => handleDelete(conv)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
        {error && (
          <p
            className="mx-2 mt-2 rounded border px-2 py-1.5 text-[11px]"
            style={{
              background: 'rgba(248,113,113,0.08)',
              borderColor: 'rgba(248,113,113,0.30)',
              color: 'var(--sunday-danger)',
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

// ---------- collapsed rail ----------

function CollapsedRail({ onToggle, onNew, hasActive, count }) {
  return (
    <div className="flex h-full flex-col items-center gap-2 px-2 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Expand conversations"
        title="Expand"
        className="sunday-press inline-flex h-9 w-9 items-center justify-center rounded-md border"
        style={{
          background: 'var(--sunday-surface)',
          borderColor: 'var(--sunday-border-strong)',
          color: 'var(--sunday-text-muted)',
          transition:
            'color 140ms var(--sunday-ease-out), border-color 140ms var(--sunday-ease-out)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'var(--sunday-text)'
          e.currentTarget.style.borderColor = 'var(--sunday-border-hover)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'var(--sunday-text-muted)'
          e.currentTarget.style.borderColor = 'var(--sunday-border-strong)'
        }}
      >
        <ChevronsRight size={14} />
      </button>
      <button
        type="button"
        onClick={onNew}
        aria-label="New conversation"
        title="New conversation"
        className="sunday-press inline-flex h-9 w-9 items-center justify-center rounded-md"
        style={{
          background: 'var(--sunday-accent)',
          color: 'var(--sunday-on-accent)',
          border: '1px solid var(--sunday-accent)',
        }}
      >
        <Plus size={14} strokeWidth={2.4} />
      </button>
      {count > 0 && (
        <div className="mt-1 flex flex-col items-center gap-1.5">
          <span
            className="font-mono text-[10.5px] tabular-nums"
            style={{ color: 'var(--sunday-text-faint)' }}
            title={`${count} conversations`}
          >
            {count}
          </span>
          {hasActive && (
            <span
              className="sunday-live-dot inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--sunday-accent)' }}
              title="Active conversation"
              aria-hidden
            />
          )}
        </div>
      )}
    </div>
  )
}

// ---------- conversation row ----------

function ConvRow({
  conv,
  active,
  isRenaming,
  renameDraft,
  onRenameDraft,
  onStartRename,
  onCancelRename,
  onCommitRename,
  onSelect,
  onDelete,
}) {
  return (
    <div
      className="group relative flex items-center gap-2 rounded-md px-2 py-1.5"
      style={{
        background: active ? 'var(--sunday-surface-2)' : 'transparent',
        transition: 'background 140ms var(--sunday-ease-out)',
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.background = 'var(--sunday-surface)'
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r"
          style={{
            background: 'var(--sunday-accent)',
            boxShadow: '0 0 10px var(--sunday-accent-glow)',
          }}
        />
      )}
      {isRenaming ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            onCommitRename(conv.id)
          }}
          className="flex min-w-0 flex-1 items-center gap-1"
        >
          <input
            autoFocus
            value={renameDraft}
            onChange={e => onRenameDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onCancelRename()
            }}
            className="min-w-0 flex-1 rounded border px-1.5 py-0.5 text-[12.5px] outline-none"
            style={{
              background: 'var(--sunday-bg)',
              borderColor: 'var(--sunday-border-input)',
              color: 'var(--sunday-text)',
            }}
          />
          <button
            type="submit"
            aria-label="Save title"
            className="inline-flex h-5 w-5 items-center justify-center"
            style={{ color: 'var(--sunday-positive)' }}
          >
            <Check size={12} />
          </button>
          <button
            type="button"
            onClick={onCancelRename}
            aria-label="Cancel rename"
            className="inline-flex h-5 w-5 items-center justify-center"
            style={{ color: 'var(--sunday-text-faint)' }}
          >
            <X size={12} />
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={onSelect}
            className="min-w-0 flex-1 truncate text-left text-[12.5px]"
            style={{
              color: active ? 'var(--sunday-text)' : 'var(--sunday-text-muted)',
              fontWeight: active ? 500 : 400,
            }}
          >
            {conv.title || untitledLabel(conv)}
          </button>
          <div className="flex shrink-0 items-center gap-0.5">
            <time
              className="font-mono text-[10px] tabular-nums group-hover:hidden"
              style={{ color: 'var(--sunday-text-faint)' }}
            >
              {relativeShort(conv.last_message_at ?? conv.started_at)}
            </time>
            <div className="hidden items-center gap-0.5 group-hover:flex">
              <button
                type="button"
                onClick={() => onStartRename(conv)}
                aria-label="Rename conversation"
                className="sunday-press inline-flex h-5 w-5 items-center justify-center rounded"
                style={{
                  color: 'var(--sunday-text-faint)',
                  transition: 'color 140ms var(--sunday-ease-out)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--sunday-text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--sunday-text-faint)')}
              >
                <Pencil size={11} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete conversation"
                className="sunday-press inline-flex h-5 w-5 items-center justify-center rounded"
                style={{
                  color: 'var(--sunday-text-faint)',
                  transition: 'color 140ms var(--sunday-ease-out)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--sunday-danger)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--sunday-text-faint)')}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------- helpers ----------

function groupByAge(conversations) {
  const now = Date.now()
  const buckets = { today: [], yesterday: [], week: [], older: [] }
  for (const conv of conversations) {
    const ts = new Date(conv.last_message_at ?? conv.started_at).getTime()
    const daysAgo = (now - ts) / 86_400_000
    if (daysAgo < 1) buckets.today.push(conv)
    else if (daysAgo < 2) buckets.yesterday.push(conv)
    else if (daysAgo < 7) buckets.week.push(conv)
    else buckets.older.push(conv)
  }
  return [
    { key: 'today', label: 'Today', items: buckets.today },
    { key: 'yesterday', label: 'Yesterday', items: buckets.yesterday },
    { key: 'week', label: 'Earlier this week', items: buckets.week },
    { key: 'older', label: 'Older', items: buckets.older },
  ].filter(g => g.items.length > 0)
}

function relativeShort(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const now = Date.now()
  const minutes = Math.round((now - then) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d`
  return formatShortDate(iso)
}

function untitledLabel(conv) {
  return `Conversation ${conv.id.slice(0, 6)}`
}

function truncate(value, n) {
  if (!value) return ''
  return value.length <= n ? value : `${value.slice(0, n - 1)}…`
}
