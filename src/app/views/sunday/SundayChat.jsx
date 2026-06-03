import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUp, MessageSquare, Paperclip, X } from 'lucide-react'
import BreathingBrand from '@components/sunday/BreathingBrand'
import ConversationList from '@components/sunday/ConversationList'
import LiveDot from '@components/sunday/LiveDot'
import MessageBubble from '@components/sunday/MessageBubble'
import SlashCommandPopover from '@components/sunday/SlashCommandPopover'
import ToolCallCard from '@components/sunday/ToolCallCard'
import { useAgentChat } from '@hooks/sunday/useAgentChat'

const COLLAPSE_KEY = 'sunday.chat.sidebarCollapsed'

/**
 * Present-progressive labels for each MCP tool so the chat header can say
 * what Sunday is *actually* doing right now ("Searching memories…") instead
 * of always falling back to a generic "thinking" message. Mirrors the
 * past-tense labels in ToolCallCard.jsx.
 */
const RUNNING_LABELS = {
  memory_search: 'Searching memories',
  memory_write: 'Saving to memory',
  memory_update: 'Updating memory',
  memory_delete: 'Deleting from memory',
  tasks_add: 'Adding a task',
  tasks_list: 'Reading tasks',
  tasks_complete: 'Completing task',
  tasks_snooze: 'Snoozing task',
  tasks_update: 'Updating task',
  tasks_recurring_list: 'Reading scheduled prompts',
  tasks_recurring_update: 'Updating scheduled prompt',
  tasks_recurring_run_now: 'Firing scheduled prompt',
  tasks_recurring_delete: 'Deleting scheduled prompt',
  projects_list: 'Reading projects',
  projects_get: 'Reading project',
  projects_create: 'Creating project',
  projects_update: 'Updating project',
  home_assistant_list_entities: 'Listing smart home devices',
  home_assistant_get_state: 'Checking device state',
  home_assistant_call_service: 'Calling smart home service',
  claude_code_dispatch: 'Dispatching a coding task',
  claude_code_status: 'Checking code dispatch status',
  claude_code_list_recent: 'Reading recent code runs',
  web_search: 'Searching the web',
  web_fetch: 'Fetching a web page',
  time_now: 'Checking the time',
  time_schedule_reminder: 'Scheduling a reminder',
  github_list_repos: 'Reading GitHub repos',
  github_sync: 'Syncing GitHub',
  github_track_repo: 'Tracking a GitHub repo',
  github_list_issues: 'Reading GitHub issues',
  devices_list: 'Reading connected devices',
}

function humanizeRunningTool(toolName) {
  if (!toolName) return 'Working'
  return RUNNING_LABELS[toolName] ?? `Running ${toolName.replace(/_/g, ' ')}`
}

/**
 * Inspect the recent messages for any tool calls still in flight; fall back
 * to a generic "thinking" status if the assistant is streaming but hasn't
 * triggered a tool yet. Returns null when there's nothing visibly happening.
 */
function computeActiveWork(messages, state) {
  // Walk the most recent 4 messages and surface the first running tool we find.
  for (let i = messages.length - 1; i >= Math.max(0, messages.length - 4); i--) {
    const msg = messages[i]
    if (!msg?.toolCalls?.length) continue
    const running = msg.toolCalls.filter(tc => tc.status === 'running')
    if (running.length > 0) {
      return {
        kind: 'tool',
        primary: humanizeRunningTool(running[0].toolName),
        extraCount: running.length - 1,
      }
    }
  }
  if (state === 'streaming') {
    return { kind: 'thinking', primary: 'Sunday is thinking' }
  }
  return null
}

const EXAMPLE_PROMPTS = [
  { text: "What's on my plate today?", group: 'Plan' },
  { text: 'Add a todo: review the Acme proposal Friday.', group: 'Plan' },
  { text: 'List my GitHub repos.', group: 'Code' },
  { text: 'Track my taylorurl-com repo.', group: 'Code' },
  { text: 'Remember that Charlie loves caps with bills.', group: 'Memory' },
  { text: "What time is it in CT, and what's my next scheduled prompt?", group: 'Time' },
]

function getInitialCollapsed() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(COLLAPSE_KEY) === '1'
}

export default function SundayChat() {
  const chat = useAgentChat()
  const [text, setText] = useState('')
  const [activeConvTitle, setActiveConvTitle] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)
  const scrollerRef = useRef(null)
  const composerRef = useRef(null)

  // Persist collapse state across reloads
  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  // Accept ?prompt= for deep-linked composer prefills (e.g., "Track this repo").
  useEffect(() => {
    const incoming = searchParams.get('prompt')
    if (incoming) {
      setText(incoming)
      const next = new URLSearchParams(searchParams)
      next.delete('prompt')
      setSearchParams(next, { replace: true })
      composerRef.current?.focus()
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
    }
  }, [chat.messages, chat.conversationId])

  useEffect(() => {
    composerRef.current?.focus()
  }, [chat.conversationId])

  function send(e) {
    e?.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || chat.state === 'streaming') return
    setText('')
    chat.sendMessage(trimmed)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function quickFill(prompt) {
    setText(prompt)
    composerRef.current?.focus()
  }

  const isStreaming = chat.state === 'streaming'
  const conversationTitle = activeConvTitle?.trim() || null
  const activeWork = useMemo(
    () => computeActiveWork(chat.messages, chat.state),
    [chat.messages, chat.state]
  )

  return (
    <div className="flex h-full min-h-0">
      <aside
        className="shrink-0 border-r"
        style={{
          width: collapsed ? 60 : 296,
          background: 'var(--sunday-bg-elevated)',
          borderColor: 'var(--sunday-border)',
          transition: 'width 240ms var(--sunday-ease-out)',
        }}
      >
        <ConversationList
          collapsed={collapsed}
          onToggle={() => setCollapsed(v => !v)}
          activeId={chat.conversationId}
          onSelect={chat.selectConversation}
          onNew={chat.startNew}
          onActiveTitleChange={setActiveConvTitle}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          title={conversationTitle}
          conversationId={chat.conversationId}
          activeWork={activeWork}
          messageCount={chat.messages.length}
        />

        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto w-full max-w-3xl space-y-5">
            {chat.messages.length === 0 && <EmptyChat onPick={quickFill} />}
            {chat.messages.map(message => (
              <div key={message.id} className="space-y-1.5">
                <MessageBubble
                  role={message.role}
                  content={message.content}
                  createdAt={message.createdAt}
                  streaming={message.pending}
                />
                {message.toolCalls?.length > 0 && <ToolCallCard toolCalls={message.toolCalls} />}
                {message.error && (
                  <p
                    className="rounded border px-2.5 py-1.5 text-[11.5px]"
                    style={{
                      background: 'rgba(248,113,113,0.08)',
                      borderColor: 'rgba(248,113,113,0.30)',
                      color: 'var(--sunday-danger)',
                    }}
                  >
                    {message.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <ChatComposer
          text={text}
          setText={setText}
          composerRef={composerRef}
          isStreaming={isStreaming}
          error={chat.error}
          onSend={send}
          onKeyDown={handleKey}
        />
      </div>
    </div>
  )
}

// ---------- header ----------

function ChatHeader({ title, conversationId, activeWork, messageCount }) {
  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-6"
      style={{ borderColor: 'var(--sunday-border)' }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <MessageSquare size={15} strokeWidth={2} style={{ color: 'var(--sunday-text-muted)' }} />
        <div className="min-w-0">
          <h1
            className="truncate text-[14.5px] font-semibold leading-tight tracking-tight"
            style={{ color: 'var(--sunday-text)' }}
          >
            {title || (conversationId ? 'Untitled conversation' : 'New conversation')}
          </h1>
          {messageCount > 0 && (
            <p
              className="text-[11.5px] leading-tight"
              style={{ color: 'var(--sunday-text-faint)' }}
            >
              {messageCount} message{messageCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </div>
      {activeWork ? <ActiveWorkBadge work={activeWork} /> : null}
    </header>
  )
}

/**
 * Animated status pill that reflects what Sunday is doing *right now*.
 *
 *   "Sunday is thinking…"          — assistant is streaming but no tool yet
 *   "Searching memories…"          — one tool call in flight
 *   "Searching memories +2…"       — multiple tool calls in flight
 *
 * Renders a pulsing aura ring + the thinking-dot animation, which together
 * make it impossible to miss that Sunday is still working even if no
 * assistant text is currently arriving.
 */
function ActiveWorkBadge({ work }) {
  return (
    <div
      className="sunday-fade-up flex items-center gap-2.5 rounded-full border px-3 py-1.5"
      style={{
        background: 'var(--sunday-accent-softer)',
        borderColor: 'var(--sunday-accent-soft)',
      }}
    >
      <LiveDot tone="accent" />
      <span
        className="text-[12.5px] font-medium leading-none"
        style={{ color: 'var(--sunday-accent-bright)' }}
      >
        {work.primary}
        {work.kind === 'tool' && work.extraCount > 0 && (
          <span style={{ color: 'var(--sunday-text-muted)' }}> +{work.extraCount}</span>
        )}
        <span style={{ color: 'var(--sunday-text-faint)' }}>…</span>
      </span>
      <span aria-hidden className="inline-flex items-center gap-0.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="sunday-thinking-dot inline-block h-1 w-1 rounded-full"
            style={{
              background: 'var(--sunday-accent-bright)',
              animationDelay: `${i * 160}ms`,
            }}
          />
        ))}
      </span>
    </div>
  )
}

// ---------- empty state ----------

function EmptyChat({ onPick }) {
  return (
    <div className="sunday-fade-up flex flex-col items-center gap-7 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <BreathingBrand size={56} />
        <div className="space-y-1.5">
          <h2
            className="text-[22px] font-semibold tracking-tight"
            style={{ color: 'var(--sunday-text)' }}
          >
            What should we do?
          </h2>
          <p
            className="max-w-md text-[13.5px] leading-relaxed"
            style={{ color: 'var(--sunday-text-muted)' }}
          >
            Sunday remembers across turns and has tools for your todos, scheduled prompts, GitHub,
            memory, time, and Home Assistant. Type below or pick a starter.
          </p>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {EXAMPLE_PROMPTS.map((prompt, i) => (
          <button
            key={prompt.text}
            type="button"
            onClick={() => onPick(prompt.text)}
            className="sunday-card-alive sunday-fade-up rounded-lg border px-3.5 py-3 text-left"
            style={{
              background: 'var(--sunday-surface)',
              borderColor: 'var(--sunday-border-strong)',
              animationDelay: `${i * 50}ms`,
            }}
          >
            <p className="sunday-eyebrow mb-1" style={{ color: 'var(--sunday-accent-bright)' }}>
              {prompt.group}
            </p>
            <p className="text-[13.5px] leading-snug" style={{ color: 'var(--sunday-text)' }}>
              {prompt.text}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- composer ----------

function ChatComposer({ text, setText, composerRef, isStreaming, error, onSend, onKeyDown }) {
  const [attachments, setAttachments] = useState([])
  const [isFocused, setIsFocused] = useState(false)
  const [slashDismissed, setSlashDismissed] = useState(false)
  const fileInputRef = useRef(null)
  const slashPopoverRef = useRef(null)

  const showSlashPopover = text.startsWith('/') && !slashDismissed

  const handleSlashSelect = useCallback(
    fillText => {
      if (fillText === null) {
        setSlashDismissed(true)
        return
      }
      setText(fillText)
      composerRef.current?.focus()
    },
    [setText, composerRef]
  )

  const handleComposerKeyDown = useCallback(
    e => {
      if (showSlashPopover && slashPopoverRef.current?.handleKeyDown(e)) return
      onKeyDown(e)
    },
    [showSlashPopover, onKeyDown]
  )

  const handleTextChange = useCallback(
    e => {
      const nextValue = e.target.value
      setText(nextValue)
      if (slashDismissed && !nextValue.startsWith('/')) setSlashDismissed(false)
    },
    [setText, slashDismissed]
  )

  const canSend = text.trim().length > 0 && !isStreaming

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(e => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setAttachments(prev => [
      ...prev,
      ...files.map(file => ({
        id: `${file.name}-${file.size}-${Date.now()}`,
        file,
        name: file.name,
        size: file.size,
      })),
    ])
    e.target.value = ''
  }, [])

  const removeAttachment = useCallback(id => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }, [])

  const formatFileSize = bytes => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <footer className="px-4 pb-4 pt-2 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <form onSubmit={onSend} className="relative">
          <SlashCommandPopover
            ref={slashPopoverRef}
            text={text}
            onSelect={handleSlashSelect}
            visible={showSlashPopover}
          />
          <div
            className="sunday-composer overflow-hidden rounded-xl border"
            style={{
              background: 'var(--sunday-surface)',
              borderColor: isFocused ? 'var(--sunday-accent)' : 'var(--sunday-border-input)',
              boxShadow: isFocused
                ? '0 0 0 3px var(--sunday-accent-soft), 0 4px 24px rgba(0,0,0,0.32)'
                : '0 1px 3px rgba(0,0,0,0.18)',
              transition:
                'border-color 200ms var(--sunday-ease-out), box-shadow 200ms var(--sunday-ease-out)',
            }}
          >
            {attachments.length > 0 && (
              <div
                className="flex flex-wrap gap-1.5 border-b px-3 py-2"
                style={{ borderColor: 'var(--sunday-border)' }}
              >
                {attachments.map(attachment => (
                  <span
                    key={attachment.id}
                    className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px]"
                    style={{
                      background: 'var(--sunday-surface-2)',
                      borderColor: 'var(--sunday-border-strong)',
                      color: 'var(--sunday-text-muted)',
                    }}
                  >
                    <Paperclip size={11} style={{ color: 'var(--sunday-text-faint)' }} />
                    <span className="max-w-[120px] truncate">{attachment.name}</span>
                    <span style={{ color: 'var(--sunday-text-faint)' }}>
                      {formatFileSize(attachment.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="sunday-press -mr-0.5 rounded p-0.5"
                      style={{ color: 'var(--sunday-text-faint)' }}
                      aria-label={`Remove ${attachment.name}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-end gap-1 px-3.5 py-3">
              <textarea
                ref={composerRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleComposerKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Message Sunday…"
                rows={1}
                className="max-h-48 min-h-[24px] flex-1 resize-none bg-transparent text-[14.5px] leading-[1.55] outline-none"
                style={{
                  color: 'var(--sunday-text)',
                  caretColor: 'var(--sunday-accent-bright)',
                }}
              />
            </div>

            <div
              className="flex items-center justify-between border-t px-2.5 py-1.5"
              style={{ borderColor: 'var(--sunday-border)' }}
            >
              <div className="flex items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  tabIndex={-1}
                />
                <button
                  type="button"
                  onClick={handleAttach}
                  className="sunday-press inline-flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{
                    color: 'var(--sunday-text-faint)',
                    transition:
                      'color 140ms var(--sunday-ease-out), background 140ms var(--sunday-ease-out)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = 'var(--sunday-text-muted)'
                    e.currentTarget.style.background = 'var(--sunday-surface-2)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'var(--sunday-text-faint)'
                    e.currentTarget.style.background = 'transparent'
                  }}
                  aria-label="Attach file"
                >
                  <Paperclip size={15} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {error && (
                  <span
                    className="max-w-[200px] truncate text-[11.5px]"
                    style={{ color: 'var(--sunday-danger)' }}
                  >
                    {error}
                  </span>
                )}
                <span
                  className="hidden text-[10.5px] sm:inline-block"
                  style={{ color: 'var(--sunday-text-faint)' }}
                >
                  <kbd
                    className="rounded border px-1 py-0.5 font-mono"
                    style={{
                      background: 'var(--sunday-surface-2)',
                      borderColor: 'var(--sunday-border-strong)',
                    }}
                  >
                    ↵
                  </kbd>{' '}
                  send ·{' '}
                  <kbd
                    className="rounded border px-1 py-0.5 font-mono"
                    style={{
                      background: 'var(--sunday-surface-2)',
                      borderColor: 'var(--sunday-border-strong)',
                    }}
                  >
                    ⇧↵
                  </kbd>{' '}
                  newline
                </span>
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Send message"
                  className="sunday-press inline-flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{
                    background: canSend ? 'var(--sunday-accent)' : 'var(--sunday-surface-2)',
                    color: canSend ? 'var(--sunday-on-accent)' : 'var(--sunday-text-faint)',
                    cursor: canSend ? 'pointer' : 'not-allowed',
                    transition:
                      'background 160ms var(--sunday-ease-out), color 160ms var(--sunday-ease-out), transform 100ms var(--sunday-ease-out)',
                  }}
                >
                  {isStreaming ? (
                    <span
                      className="sunday-live-dot inline-block h-2 w-2 rounded-full"
                      style={{ background: 'currentColor' }}
                    />
                  ) : (
                    <ArrowUp size={15} strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </footer>
  )
}
