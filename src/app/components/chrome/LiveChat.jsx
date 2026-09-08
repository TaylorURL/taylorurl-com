import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { ArrowUp, Mail, MessageSquare, Phone, RotateCcw, X } from 'lucide-react'
import { BIO_NAME, BIO_TEXT, BIO_TITLE } from '@lib/mail/bio.js'
import { COMPANY_PHONE, COMPANY_PHONE_HREF, SUPPORT_EMAIL } from '@constants/navigation'
import { assistantUp, dropThread, sendTurn, threadHeld } from '@app/data/liveChat'
import { EASE } from '@constants/animations'
import { faultMessage } from '@utils/faults'

/**
 * The assistant, as a panel in the corner of every page and as a sheet on a
 * phone.
 *
 * It answers a stranger's first question at the hour they thought of it, and
 * its one job after that is to put them in front of the owner. So it opens on
 * his face and his own sentence about himself rather than on a robot greeting:
 * the thing being offered is a person, and the widget is the door.
 *
 * There are two shells around one thread. On a pointer-sized screen the panel
 * is not modal: a visitor reading a page with a half-typed question open is the
 * ordinary case, and stealing the page from them to make a chat box feel
 * important would be the wrong trade. A phone has no room for that trade -- the
 * same card at 23.5rem leaves a hand-width of reading behind it and a keyboard
 * on top of it -- so a handheld gets the screen, held still underneath, and
 * gives it back on close.
 *
 * Neither shell carries `data-ground`. A ground restates the surface and ink
 * roles for a subtree and holds them there whichever setting the reader is in,
 * which is right for a section of a page and wrong for something that floats
 * over all of them: stamping `paper` on it paints a white box in a dark
 * setting. Taking the roles from the document instead is what makes it follow
 * the theme, and the fixed position is what keeps a section's ground from
 * reaching it.
 */

const MAX_CHARS = 2000
const COMPOSER_MAX_PX = 132
const HANDHELD = '(max-width: 639px)'

/**
 * Whether the widget is on a phone, which is the only thing that decides
 * between the two shells.
 *
 * It answers from `matchMedia` while rendering rather than after an effect. The
 * shell has to be chosen before anything can open into it, and a first frame
 * that guessed would open a corner card on a phone and swap it for a sheet on
 * the next one. There is no window during the prerender, but there is no widget
 * either -- the whole component waits for the browser -- so answering false
 * there costs nothing.
 */
function useHandheld() {
  const [small, setSmall] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(HANDHELD).matches
  )

  useEffect(() => {
    const query = window.matchMedia(HANDHELD)
    const sync = () => setSmall(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return small
}

/**
 * The rectangle a phone is actually showing, while `active`.
 *
 * A fixed element is placed against the layout viewport, and the on-screen
 * keyboard does not change that viewport: it covers the bottom of it, taking
 * the composer with it, and `dvh` cannot help because the layout viewport is
 * still the whole screen. The visual viewport is what is left over. Placing the
 * sheet against that, top and height both, is what keeps the box being typed
 * into above the keys -- and it has to follow the visual viewport's own scroll
 * as well, because a phone moves it out from under a focused field rather than
 * resizing it again.
 *
 * Returns null where the browser reports no visual viewport, and the sheet
 * falls back to the layout viewport.
 *
 * @param {boolean} active whether the sheet is on screen and worth measuring
 * @returns {{ top: number, height: number }|null}
 */
function useVisibleViewport(active) {
  const [box, setBox] = useState(null)

  useEffect(() => {
    if (!active) return undefined
    const view = window.visualViewport
    if (!view) return undefined

    const sync = () => setBox({ top: view.offsetTop, height: view.height })
    sync()
    view.addEventListener('resize', sync)
    view.addEventListener('scroll', sync)
    return () => {
      view.removeEventListener('resize', sync)
      view.removeEventListener('scroll', sync)
    }
  }, [active])

  return active ? box : null
}

/**
 * Whether there is an assistant to talk to, as the three states the widget
 * needs: null while nobody has asked, and then the answer.
 *
 * Nothing is drawn until this says yes, so the first probe is what decides
 * whether the visitor ever sees a launcher. A no is asked again when the tab
 * comes back to the front, because the ordinary no is a moment of the
 * visitor's own connection rather than an outage, and believing one of those
 * for the rest of a visit costs the widget on every page of it. A yes is not
 * asked again: an assistant that stops answering mid-thread is caught by the
 * turn that was sent to it.
 *
 * @returns {[boolean|null, () => void]} the answer, and the way to record one
 *   the widget learned from a turn instead
 */
function useAssistant() {
  const [up, setUp] = useState(null)
  const answer = useRef(null)

  const ask = useCallback(signal => {
    assistantUp({ signal })
      .then(said => {
        answer.current = said
        setUp(said)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    // The probe goes out on mount, which on a first page load is while the
    // reader is still deciding whether to stay. Leaving before it answers
    // cancels it, and the one aborted here is the one the page meant to drop.
    const leaving = new AbortController()
    ask(leaving.signal)
    const back = () => {
      if (document.visibilityState === 'visible' && answer.current === false) ask(leaving.signal)
    }
    document.addEventListener('visibilitychange', back)
    return () => {
      leaving.abort()
      document.removeEventListener('visibilitychange', back)
    }
  }, [ask])

  const down = useCallback(() => {
    answer.current = false
    setUp(false)
  }, [])

  return [up, down]
}

/** What the assistant leads with, given where the visitor opened it. */
function openerFor(pathname) {
  const path = pathname || '/'
  if (path.startsWith('/pricing') || path.startsWith('/start')) {
    return 'Happy to talk through what a site would involve. What does the business do?'
  }
  if (path.startsWith('/work') || path.startsWith('/portfolio')) {
    return 'Ask me anything about the work on this page, or about a site for your own shop.'
  }
  if (path.startsWith('/contact')) {
    return 'Every message that comes through here gets read. Anything I can answer while you write it?'
  }
  if (path.startsWith('/blog') || path.startsWith('/articles')) {
    return 'Ask me anything about this, or about a site for your own business.'
  }
  return 'Ask me anything about the work, and I will pass you to the team when you need a person.'
}

/** Openings a visitor can press instead of writing one. */
const PROMPTS = [
  'What would a site for my shop involve?',
  'Can you redo the one I already have?',
  'What is included after it launches?',
]

const now = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/** The three dots, while a turn is out. */
function Typing() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1" aria-hidden="true">
      {[0, 1, 2].map(index => (
        <m.span
          key={index}
          className="block h-1.5 w-1.5 rounded-full bg-[color:var(--paper-ink-mute)]"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: EASE, delay: index * 0.16 }}
        />
      ))}
    </div>
  )
}

/**
 * One message, as paragraphs of plain text and nothing else.
 *
 * `roomy` is the sheet: a phone is held further from the face than a monitor
 * and read one-handed, so the type goes up rather than the bubble getting
 * wider.
 */
function Bubble({ turn, index, roomy }) {
  const mine = turn.role === 'visitor'

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE, delay: Math.min(index, 1) * 0.04 }}
      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[88%] space-y-2 px-3.5 py-2.5 leading-relaxed ${
          roomy ? 'text-[15px]' : 'text-[14px]'
        } ${
          mine
            ? 'bg-[color:var(--accent-fill)] text-[color:var(--on-accent)]'
            : 'bg-[color:var(--surface-2)] text-[color:var(--paper-ink)]'
        }`}
        style={{
          borderRadius: 'var(--r-card)',
          borderBottomRightRadius: mine ? 'var(--r-tiny)' : undefined,
          borderBottomLeftRadius: mine ? undefined : 'var(--r-tiny)',
        }}
      >
        {String(turn.body)
          .split(/\n{2,}/)
          .map((line, part) => (
            <p key={part}>{line}</p>
          ))}
      </div>
    </m.div>
  )
}

/**
 * Everything inside either shell: who is answering, the thread, the box.
 *
 * The two shells differ in where they sit and what they cover and in nothing
 * else, so this body is written once and told which shell holds it. `roomy` is
 * the sheet, and it buys three things a phone needs and a pointer does not:
 * touch-sized controls, type that survives arm's length, and a composer at
 * sixteen pixels, which is the size below which mobile Safari zooms the page to
 * meet a focused field and leaves the reader in a viewport nobody chose.
 */
function Conversation({
  roomy,
  turns,
  sending,
  fault,
  draft,
  pathname,
  composerRef,
  streamRef,
  onSay,
  onGrow,
  onKeyed,
  onRestart,
  onClose,
}) {
  const empty = turns.length === 0
  const control = roomy ? 'h-11 w-11' : 'h-8 w-8'

  return (
    <>
      <header
        className={`flex shrink-0 items-center gap-3 border-b border-[color:var(--paper-hairline)] px-4 ${
          roomy ? 'py-2.5' : 'py-3.5'
        }`}
      >
        <img
          src="/images/trenton-taylor.webp"
          srcSet="/images/trenton-taylor.webp 1x, /images/trenton-taylor@2x.webp 2x"
          alt=""
          width="40"
          height="40"
          className="border-hair-paper-strong h-10 w-10 shrink-0 rounded-md border object-cover"
          loading="lazy"
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold leading-tight text-[color:var(--paper-ink)]">
            {BIO_NAME}
          </span>
          <span className="block truncate text-[12px] leading-tight text-[color:var(--paper-ink-mute)]">
            {BIO_TITLE}
          </span>
        </span>

        {!empty && (
          <button
            type="button"
            onClick={onRestart}
            className={`flex ${control} shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-[var(--r-tiny)] text-[color:var(--paper-ink-mute)] transition-colors duration-150 hover:bg-[color:var(--surface-2)] hover:text-[color:var(--paper-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
            aria-label="Start Over"
            title="Start Over"
          >
            <RotateCcw className={roomy ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={1.5} />
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className={`flex ${control} shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-[var(--r-tiny)] text-[color:var(--paper-ink-mute)] transition-colors duration-150 hover:bg-[color:var(--surface-2)] hover:text-[color:var(--paper-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
          aria-label="Close Chat"
        >
          <X className={roomy ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={1.5} />
        </button>
      </header>

      <div
        ref={streamRef}
        className={`flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 ${
          roomy ? 'py-5' : 'py-4'
        }`}
      >
        {empty && (
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: EASE }}
            className="space-y-4"
          >
            <p
              className={`leading-relaxed text-paper-soft ${roomy ? 'text-[15px]' : 'text-[14px]'}`}
            >
              {BIO_TEXT}
            </p>
            <p
              className={`leading-relaxed text-[color:var(--paper-ink)] ${
                roomy ? 'text-[15px]' : 'text-[14px]'
              }`}
            >
              {openerFor(pathname)}
            </p>

            <ul className="space-y-2 pt-1">
              {PROMPTS.map((prompt, index) => (
                <m.li
                  key={prompt}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE, delay: 0.08 + index * 0.06 }}
                >
                  <button
                    type="button"
                    onClick={() => onSay(prompt)}
                    className={`w-full cursor-pointer touch-manipulation rounded-[var(--r-control)] text-left leading-snug text-[color:var(--paper-ink)] ring-1 ring-[color:var(--paper-hairline-strong)] transition-colors duration-150 hover:bg-[color:var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      roomy ? 'px-4 py-3 text-[15px]' : 'px-3 py-2 text-[13px]'
                    }`}
                  >
                    {prompt}
                  </button>
                </m.li>
              ))}
            </ul>
          </m.div>
        )}

        {turns.map((turn, index) => (
          <Bubble key={turn.id} turn={turn} index={index} roomy={roomy} />
        ))}

        {sending && <Typing />}

        {fault && (
          <p role="alert" className="text-[13px] leading-snug text-[color:var(--danger-on-paper)]">
            {fault}
          </p>
        )}

        <div aria-live="polite" className="sr-only">
          {sending ? 'Thinking' : turns.at(-1)?.role === 'assistant' ? turns.at(-1).body : ''}
        </div>
      </div>

      <div className="shrink-0 border-t border-[color:var(--paper-hairline)] px-3 py-3">
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="live-chat-message">
            Your message
          </label>
          <textarea
            id="live-chat-message"
            ref={composerRef}
            rows={1}
            value={draft}
            onChange={onGrow}
            onKeyDown={onKeyed}
            disabled={sending}
            placeholder="Ask a question"
            maxLength={MAX_CHARS}
            style={{ maxHeight: `${COMPOSER_MAX_PX}px` }}
            className={`field flex-1 resize-none py-2.5 leading-snug disabled:opacity-60 ${
              roomy ? 'text-[16px]' : ''
            }`}
          />
          <button
            type="button"
            onClick={() => onSay(draft)}
            disabled={sending || !draft.trim()}
            className={`flex shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-[var(--r-control)] bg-[color:var(--accent-fill)] text-[color:var(--on-accent)] transition-[background-color,opacity,transform] duration-150 hover:bg-[color:var(--accent-fill-hi)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 ${
              roomy ? 'h-12 w-12' : 'h-11 w-11'
            }`}
            aria-label="Send"
          >
            <ArrowUp className={roomy ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={2} />
          </button>
        </div>

        {/* A phone is the thing the number is for. Reaching the team is one
            press there rather than a hairline link inside a sentence, and the
            sentence keeps the part that has to be said either way. */}
        {roomy ? (
          <div className="pt-2.5">
            <p className="px-1 pb-2 text-[12px] leading-snug text-[color:var(--paper-ink-faint)]">
              An assistant, not the team.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex h-11 touch-manipulation items-center justify-center gap-2 rounded-[var(--r-control)] text-[14px] font-medium text-[color:var(--paper-ink)] ring-1 ring-[color:var(--paper-hairline-strong)] transition-colors duration-150 active:bg-[color:var(--surface-2)]"
              >
                <Mail className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                Email the Team
              </a>
              <a
                href={COMPANY_PHONE_HREF}
                className="flex h-11 touch-manipulation items-center justify-center gap-2 rounded-[var(--r-control)] text-[14px] font-medium text-[color:var(--paper-ink)] ring-1 ring-[color:var(--paper-hairline-strong)] transition-colors duration-150 active:bg-[color:var(--surface-2)]"
              >
                <Phone className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                Call the Team
              </a>
            </div>
          </div>
        ) : (
          <p className="px-1 pt-2 text-[12px] leading-snug text-[color:var(--paper-ink-faint)]">
            An assistant, not the team. Reach them at{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="underline underline-offset-2 hover:text-[color:var(--paper-ink-mute)]"
            >
              {SUPPORT_EMAIL}
            </a>{' '}
            or{' '}
            <a
              href={COMPANY_PHONE_HREF}
              className="underline underline-offset-2 hover:text-[color:var(--paper-ink-mute)]"
            >
              {COMPANY_PHONE}
            </a>
            .
          </p>
        )}
      </div>
    </>
  )
}

export default function LiveChat({ startOpen = false }) {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [fault, setFault] = useState(null)

  const launcher = useRef(null)
  const sheet = useRef(null)
  const composer = useRef(null)
  const stream = useRef(null)
  const greeted = useRef(false)
  const leaving = useRef(null)

  const handheld = useHandheld()
  const reducedMotion = useReducedMotion()
  const visible = useVisibleViewport(open && handheld)
  const [up, wentDown] = useAssistant()

  // The Live page opens the panel on arrival, and only where the panel is a
  // panel. Doing it on a phone puts the sheet over the page that exists to
  // explain the sheet, and the visitor meets the chat instead of the reason
  // for it. Either way it waits for an assistant to open onto.
  useEffect(() => {
    if (up !== true || greeted.current) return
    greeted.current = true
    if (startOpen && !handheld) setOpen(true)
  }, [up, startOpen, handheld])

  // A turn can be in flight for several seconds, which is long enough for the
  // reader to close the tab on it. Dropping it here says the page cancelled
  // the send, rather than leaving a request the browser tore down looking like
  // an assistant that could not be reached.
  useEffect(() => {
    const controller = new AbortController()
    leaving.current = controller
    return () => controller.abort()
  }, [])

  const pathname = typeof window === 'undefined' ? '/' : window.location.pathname

  const say = useCallback(
    async body => {
      const asked = body.trim()
      if (!asked || sending) return

      const mine = now()
      setFault(null)
      setDraft('')
      setTurns(held => [...held, { id: mine, role: 'visitor', body: asked }])
      setSending(true)

      try {
        const { reply, offline } = await sendTurn({
          message: asked,
          path: pathname,
          signal: leaving.current?.signal,
        })
        setTurns(held => [...held, { id: now(), role: 'assistant', body: reply }])
        if (offline) wentDown()
      } catch (cause) {
        // A send cancelled with the page has nobody left to answer to.
        if (cause.name === 'AbortError') return
        // Nothing reached the assistant, so the thread keeps no record of a
        // turn that was never taken and the words go back in the box they were
        // written in. Retyping a question to ask it a second time is the part
        // of a failed send a visitor should not have to pay for.
        setTurns(held => held.filter(turn => turn.id !== mine))
        setDraft(asked)
        // The sentence stands in the thread rather than in the corner. A phone
        // holds the whole conversation over the page on a layer above the one
        // the corner is drawn on, so a send that failed there would fail
        // silently; here it sits where the turn would have gone, beside the
        // words waiting to go again. Whatever it says is written for the
        // visitor first: a stranger who came here to ask a question is the last
        // person on the site who should be handed a connection's own words.
        setFault(faultMessage(cause, 'That message did not reach the assistant. Send it again.'))
      } finally {
        setSending(false)
      }
    },
    [pathname, sending, wentDown]
  )

  // A new message belongs at the bottom of the view the moment it exists,
  // including the one that is still only three dots. The keyboard counts as a
  // new bottom: it takes half the sheet, and a turn that was in view before it
  // arrived is above the fold afterwards.
  useEffect(() => {
    if (!open) return
    const box = stream.current
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' })
  }, [turns, sending, open, visible?.height])

  // The panel takes the caret because a pointer is already at the keyboard.
  // The sheet takes only its own frame: focusing a field on a phone raises the
  // keyboard over the opener and the three questions it offers, which is the
  // whole of what there is to read before deciding what to ask. It still has to
  // take something, because a sheet that covers the page while the focus is
  // left on the launcher underneath reads from the page it covered.
  useEffect(() => {
    if (!open) return undefined
    if (handheld) {
      sheet.current?.focus({ preventScroll: true })
      return undefined
    }
    const timer = setTimeout(() => composer.current?.focus(), 260)
    return () => clearTimeout(timer)
  }, [open, handheld])

  useEffect(() => {
    if (!open) return
    const close = event => {
      if (event.key !== 'Escape') return
      setOpen(false)
      launcher.current?.focus()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  // A sheet over the whole screen holds the page still under it, the way the
  // site menu does, and hands back the place it was opened from. The root is
  // what scrolls here, so the root is what is held; releasing it without
  // putting the offset back drops the reader wherever the clamp left them,
  // which is a jump nobody asked for on the way out of a chat.
  useEffect(() => {
    if (!open || !handheld) return undefined
    const held = window.scrollY
    const root = document.documentElement
    const heldOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      root.style.overflow = heldOverflow
      document.body.style.overflow = ''
      window.scrollTo({ top: held, behavior: 'instant' })
    }
  }, [open, handheld])

  // The box is measured off what it holds rather than off the keystroke that
  // changed it, so it is the same height for a line typed in, a line put back
  // after a send that failed, and the empty box a sent turn leaves behind.
  useEffect(() => {
    const box = composer.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, COMPOSER_MAX_PX)}px`
  }, [draft, open])

  const grow = event => setDraft(event.target.value.slice(0, MAX_CHARS))

  // Enter sends on a keyboard, where Shift is there to hold the line. A phone's
  // return key is a return key: the turn goes from the button beside the box,
  // which is where a thumb already is.
  const keyed = event => {
    if (handheld || event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    say(draft)
  }

  const restart = () => {
    dropThread()
    setTurns([])
    setFault(null)
    if (!handheld) composer.current?.focus()
  }

  const dismiss = () => {
    setOpen(false)
    launcher.current?.focus()
  }

  // Nothing is drawn until the assistant has answered for itself, which also
  // keeps the widget out of the static markup every route is built to: there
  // is no browser there to ask, so the answer is never yes.
  //
  // One that goes quiet mid-thread keeps its panel until the visitor closes
  // it. What it said carries the address and the number, and taking that off
  // the screen while it is being read would be worse than the outage. The
  // launcher goes with the close, and nothing offers to open again.
  if (up !== true && !open) return null

  const resumed = Boolean(threadHeld())

  const body = (
    <Conversation
      roomy={handheld}
      turns={turns}
      sending={sending}
      fault={fault}
      draft={draft}
      pathname={pathname}
      composerRef={composer}
      streamRef={stream}
      onSay={say}
      onGrow={grow}
      onKeyed={keyed}
      onRestart={restart}
      onClose={dismiss}
    />
  )

  return (
    <>
      <AnimatePresence>
        {open &&
          (handheld ? (
            <m.div
              key="sheet"
              ref={sheet}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Chat with the TaylorURL assistant"
              initial={reducedMotion ? { opacity: 0 } : { transform: 'translateY(100%)' }}
              animate={reducedMotion ? { opacity: 1 } : { transform: 'translateY(0%)' }}
              exit={reducedMotion ? { opacity: 0 } : { transform: 'translateY(100%)' }}
              transition={{ duration: reducedMotion ? 0 : 0.34, ease: EASE }}
              /* Measured against the visual viewport wherever the browser
                 reports one, so the composer sits on top of the keyboard rather
                 than under it. The layout viewport is the fallback. The layer is
                 above the launcher's because the sheet covers the launcher. */
              style={visible ? { top: visible.top, height: visible.height } : undefined}
              className="fixed inset-x-0 top-0 z-[var(--z-modal)] flex h-[100dvh] flex-col overflow-hidden bg-[color:var(--surface-1)] focus:outline-none"
            >
              {body}
            </m.div>
          ) : (
            <m.div
              key="panel"
              role="dialog"
              aria-label="Chat with the TaylorURL assistant"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.3, ease: EASE }}
              style={{ transformOrigin: 'bottom right', borderRadius: 'var(--r-feature)' }}
              /* The corner is a rail, read from the bottom up: the launcher,
                 the way back to the top of the page, and then this. Standing it
                 on the launcher alone puts it over the button above the
                 launcher, which is a control taken off the screen rather than
                 covered by something a reader opened onto it. */
              className="fixed bottom-40 right-6 z-[var(--z-drawer)] flex max-h-[min(34rem,calc(100dvh-12rem))] w-[min(23.5rem,calc(100vw-3rem))] flex-col overflow-hidden bg-[color:var(--surface-1)] shadow-[var(--lift)] ring-1 ring-[color:var(--paper-hairline)]"
            >
              {body}
            </m.div>
          ))}
      </AnimatePresence>

      <m.button
        ref={launcher}
        type="button"
        onClick={() => setOpen(was => !was)}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.34, ease: EASE, delay: 0.4 }}
        whileTap={{ scale: 0.94 }}
        aria-expanded={open}
        aria-label={open ? 'Close Chat' : 'Chat with the Assistant'}
        className="fixed bottom-6 right-4 z-[var(--z-drawer)] flex h-14 w-14 cursor-pointer touch-manipulation items-center justify-center rounded-full bg-[color:var(--accent-fill)] text-[color:var(--on-accent)] shadow-[var(--lift)] transition-colors duration-200 hover:bg-[color:var(--accent-fill-hi)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:right-6"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <m.span
              key="close"
              initial={{ opacity: 0, rotate: -60 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 60 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </m.span>
          ) : (
            <m.span
              key="open"
              initial={{ opacity: 0, rotate: 60 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -60 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              <MessageSquare className="h-5 w-5" strokeWidth={2} />
            </m.span>
          )}
        </AnimatePresence>

        {/* A thread left half-finished is worth a mark. It says something true
            and it says it once, rather than inventing an unread count. */}
        {!open && resumed && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 block h-3 w-3 rounded-full bg-[color:var(--good-fill)] ring-2 ring-[color:var(--paper)]"
          />
        )}
      </m.button>
    </>
  )
}
