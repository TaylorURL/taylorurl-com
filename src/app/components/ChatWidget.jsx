import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Mail, MessageCircle, X } from 'lucide-react'
import { SALES_EMAIL } from '@constants/navigation'

const SESSION_KEY = 'taylorurl_livechat_session_v1'
const MESSAGES_KEY = 'taylorurl_livechat_messages_v1'
const MAX_USER_MESSAGE_CHARS = 2000
const EASE = [0.22, 1, 0.36, 1]

const LIVECHAT_ENDPOINT_FALLBACK =
  'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/livechat-service'
const LIVECHAT_PUBLISHABLE_KEY_FALLBACK = 'sb_publishable_qn4ZWB2n95HGMJm0L58I0w_ClE_Qu4M'

const LIVECHAT_ENDPOINT = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (typeof url === 'string' && url.length > 0) {
    return `${url.replace(/\/$/, '')}/functions/v1/livechat-service`
  }
  return LIVECHAT_ENDPOINT_FALLBACK
})()

const LIVECHAT_PUBLISHABLE_KEY = (() => {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  return typeof key === 'string' && key.length > 0 ? key : LIVECHAT_PUBLISHABLE_KEY_FALLBACK
})()

const GREETING = {
  id: 'greeting',
  role: 'assistant',
  content:
    "Hey — I'm Trenton's AI assistant. Ask me anything about custom websites, redesigns, online booking, hosting, or how a project works. If it sounds like a fit, I'll hand you off to Trenton.",
}

function makeSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

function loadSessionId() {
  if (typeof window === 'undefined') return makeSessionId()
  try {
    const stored = window.localStorage.getItem(SESSION_KEY)
    if (stored && stored.length >= 8) return stored
    const fresh = makeSessionId()
    window.localStorage.setItem(SESSION_KEY, fresh)
    return fresh
  } catch {
    return makeSessionId()
  }
}

function loadStoredMessages() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(MESSAGES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        message =>
          message &&
          typeof message.id === 'string' &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string',
      )
      .slice(-40)
  } catch {
    return []
  }
}

function persistMessages(messages) {
  if (typeof window === 'undefined') return
  try {
    const trimmed = messages.filter(message => message.id !== GREETING.id).slice(-40)
    window.sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(trimmed))
  } catch {
    /* storage full or unavailable — ignore */
  }
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-sm px-3.5 py-2.5 text-[14px] leading-relaxed ${
          isUser
            ? 'bg-accent text-white'
            : 'border border-hair-paper-strong bg-paper text-ink-paper'
        }`}
      >
        {message.content || (
          <span className="inline-flex items-center gap-1.5 text-paper-faint" aria-label="Thinking">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-paper-faint" />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-paper-faint"
              style={{ animationDelay: '120ms' }}
            />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-paper-faint"
              style={{ animationDelay: '240ms' }}
            />
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Site-wide live-chat assistant. Mounted in Layout.jsx so it floats on every
 * page. State is intentionally self-contained — the widget owns its session
 * id (localStorage), the visible transcript (sessionStorage so it survives
 * navigation within the tab), and all streaming/rendering logic. The
 * assistant is told to reply in plain text only, so we render messages with
 * `whitespace-pre-wrap` and never set raw HTML.
 */
export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState(() => {
    const stored = loadStoredMessages()
    return stored.length > 0 ? stored : [GREETING]
  })
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [errorText, setErrorText] = useState('')

  const sessionIdRef = useRef(null)
  const inputRef = useRef(null)
  const scrollRef = useRef(null)
  const abortRef = useRef(null)
  const launcherRef = useRef(null)

  if (sessionIdRef.current === null) {
    sessionIdRef.current = loadSessionId()
  }

  useEffect(() => {
    persistMessages(messages)
  }, [messages])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 60)
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
        launcherRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const canSend = useMemo(
    () => draft.trim().length > 0 && !isSending,
    [draft, isSending],
  )

  const updateAssistantMessage = useCallback((assistantId, mutator) => {
    setMessages(previous =>
      previous.map(message =>
        message.id === assistantId
          ? { ...message, content: mutator(message.content) }
          : message,
      ),
    )
  }, [])

  const handleSend = useCallback(
    async event => {
      event?.preventDefault?.()
      const trimmed = draft.trim()
      if (!trimmed || isSending) return
      if (trimmed.length > MAX_USER_MESSAGE_CHARS) {
        setErrorText(`Keep it under ${MAX_USER_MESSAGE_CHARS} characters, please.`)
        return
      }
      setErrorText('')

      const userMessageId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const assistantMessageId = `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

      setMessages(previous => [
        ...previous,
        { id: userMessageId, role: 'user', content: trimmed },
        { id: assistantMessageId, role: 'assistant', content: '' },
      ])
      setDraft('')
      setIsSending(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch(LIVECHAT_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: LIVECHAT_PUBLISHABLE_KEY,
            Authorization: `Bearer ${LIVECHAT_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            message: trimmed,
            pageUrl:
              typeof window !== 'undefined'
                ? `${window.location.pathname}${window.location.search}`
                : null,
          }),
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          let serverError = ''
          try {
            const payload = await response.json()
            serverError = typeof payload?.error === 'string' ? payload.error : ''
          } catch {
            /* ignore */
          }
          throw new Error(
            serverError || "Couldn't reach the assistant. Try again in a moment.",
          )
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          if (chunk) {
            updateAssistantMessage(assistantMessageId, previous => previous + chunk)
          }
        }
      } catch (error) {
        if (error?.name === 'AbortError') return
        const message =
          error?.message?.length && error.message.length < 200
            ? error.message
            : "Couldn't reach the assistant. Try again, or email trenton@taylorurl.com directly."
        setErrorText(message)
        setMessages(previous =>
          previous.map(item =>
            item.id === assistantMessageId && item.content === ''
              ? { ...item, content: message }
              : item,
          ),
        )
      } finally {
        setIsSending(false)
        abortRef.current = null
        setTimeout(() => inputRef.current?.focus(), 40)
      }
    },
    [draft, isSending, updateAssistantMessage],
  )

  const handleKeyDown = event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend(event)
    }
  }

  return (
    <>
      <motion.button
        ref={launcherRef}
        type="button"
        onClick={() => setIsOpen(open => !open)}
        aria-label={isOpen ? "Close Trenton's AI assistant" : "Open Trenton's AI assistant"}
        aria-expanded={isOpen}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.32, ease: EASE, delay: 0.4 }}
        className="fixed bottom-5 right-5 z-[120] inline-flex h-12 w-12 items-center justify-center rounded-sm bg-accent text-white shadow-[0_14px_36px_-12px_var(--accent-glow)] transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.96] sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18, ease: EASE }}
              className="flex"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18, ease: EASE }}
              className="flex"
            >
              <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-modal="false"
            aria-label="Live chat with Trenton's AI assistant"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="fixed bottom-20 right-3 z-[119] flex h-[calc(100vh-7rem)] max-h-[640px] w-[calc(100vw-1.5rem)] max-w-[400px] flex-col overflow-hidden rounded-sm border border-hair-paper-strong bg-paper shadow-[0_30px_80px_-30px_rgba(10,10,10,0.55)] sm:bottom-24 sm:right-6 sm:w-[400px]"
          >
            <div className="relative flex items-start justify-between gap-3 border-b border-hair-paper bg-paper px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                  // Live chat
                </p>
                <h2 className="mt-1 text-[16px] font-semibold leading-tight tracking-tight text-ink-paper">
                  Trenton&apos;s AI assistant
                </h2>
                <p className="mt-1 text-[12px] leading-snug text-paper-soft">
                  Answers about sites, redesigns, and getting started.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="rounded-sm p-2.5 text-paper-faint transition hover:bg-ink-paper/5 hover:text-ink-paper"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto bg-paper px-4 py-5"
              aria-live="polite"
            >
              {messages.map(message => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {errorText && (
                <div
                  role="alert"
                  className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700"
                >
                  {errorText}
                </div>
              )}
            </div>

            <form
              onSubmit={handleSend}
              className="border-t border-hair-paper bg-paper px-4 py-3"
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  maxLength={MAX_USER_MESSAGE_CHARS}
                  placeholder="Ask about a website, redesign, booking tool…"
                  aria-label="Message"
                  className="max-h-32 min-h-[44px] flex-1 resize-none rounded-sm border border-hair-paper-strong bg-paper px-3 py-2.5 font-sans text-[14px] text-ink-paper transition duration-200 placeholder:text-paper-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Send message"
                  className={`inline-flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-sm bg-accent text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.96] ${
                    canSend ? '' : 'cursor-not-allowed opacity-50'
                  }`}
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-faint">
                <span>AI assistant — not Trenton himself</span>
                <a
                  href={`mailto:${SALES_EMAIL}`}
                  className="inline-flex items-center gap-1 text-paper-soft transition hover:text-accent"
                >
                  <Mail className="h-3 w-3" strokeWidth={1.75} />
                  {SALES_EMAIL}
                </a>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
