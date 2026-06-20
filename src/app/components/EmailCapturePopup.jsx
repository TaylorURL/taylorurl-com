import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Check, X } from 'lucide-react'
import { INPUT } from '@constants/ui'

const STORAGE_KEY = 'taylorurl_email_popup_v1'
const SHOW_AFTER_MS = 6000
const SUCCESS_AUTO_CLOSE_MS = 2400
const ENDPOINT = 'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/collect-email'
const PUBLISHABLE_KEY = 'sb_publishable_qn4ZWB2n95HGMJm0L58I0w_ClE_Qu4M'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'

const hasSeenPopup = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return true
  }
}

const markPopupSeen = reason => {
  try {
    window.localStorage.setItem(STORAGE_KEY, reason)
  } catch {
    /* storage unavailable — fine, popup just may reappear next visit */
  }
}

/**
 * Site-wide email capture modal: appears ~6s after mount on first visit,
 * collects name + email, posts to the `collect-email` edge function, and
 * remembers (via localStorage) once a visitor has submitted or dismissed so
 * it never nags again. Self-contained — no provider/context needed.
 */
export default function EmailCapturePopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [status, setStatus] = useState('idle')
  const [serverError, setServerError] = useState('')

  const dialogRef = useRef(null)
  const emailInputRef = useRef(null)
  const previouslyFocusedRef = useRef(null)
  const successCloseTimerRef = useRef(null)

  const close = useCallback(reason => {
    markPopupSeen(reason)
    setIsOpen(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (hasSeenPopup()) return
    const timer = setTimeout(() => setIsOpen(true), SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    previouslyFocusedRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = setTimeout(() => emailInputRef.current?.focus(), 50)

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close('dismissed')
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusables = dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocusedRef.current?.focus?.()
    }
  }, [isOpen, close])

  useEffect(() => {
    if (status !== 'success') return
    successCloseTimerRef.current = setTimeout(() => close('submitted'), SUCCESS_AUTO_CLOSE_MS)
    return () => clearTimeout(successCloseTimerRef.current)
  }, [status, close])

  const handleEmailChange = event => {
    setEmail(event.target.value)
    if (emailError) setEmailError('')
    if (serverError) setServerError('')
  }

  const handleSubmit = async event => {
    event.preventDefault()
    if (status === 'submitting') return

    const trimmedEmail = email.trim()
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.')
      emailInputRef.current?.focus()
      return
    }

    setStatus('submitting')
    setServerError('')

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: trimmedEmail,
          source: 'taylorurl',
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'Something went wrong. Please try again.')
      }

      setStatus('success')
    } catch (error) {
      setStatus('error')
      setServerError(
        error?.message?.length && error.message.length < 200
          ? error.message
          : "Couldn't sign you up just now. Please try again."
      )
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-end justify-center px-4 py-6 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close email signup"
            onClick={() => close('dismissed')}
            className="absolute inset-0 cursor-default bg-bg/70 backdrop-blur-sm"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-popup-title"
            aria-describedby="email-popup-description"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-sm border border-hair-paper-strong bg-paper p-7 sm:p-9"
          >
            <span
              aria-hidden
              className="absolute -top-px left-7 bg-paper px-2 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint"
            >
              // Newsletter
            </span>
            <button
              type="button"
              onClick={() => close('dismissed')}
              aria-label="Close email signup"
              className="absolute right-4 top-4 rounded-sm p-1.5 text-paper-faint transition hover:bg-ink-paper/5 hover:text-ink-paper"
            >
              <X className="h-4 w-4" />
            </button>

            {status === 'success' ? (
              <div className="py-6 text-center">
                <div className="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-sm border border-accent/30 bg-accent/5">
                  <Check className="h-5 w-5 text-accent" strokeWidth={2} />
                </div>
                <h2
                  id="email-popup-title"
                  className="mb-3 text-2xl font-semibold tracking-tightest text-ink-paper"
                >
                  You&apos;re in.
                </h2>
                <p id="email-popup-description" className="text-[15px] text-paper-soft">
                  Thanks. Keep an eye on your inbox.
                </p>
              </div>
            ) : (
              <>
                <h2
                  id="email-popup-title"
                  className="mb-3 text-3xl font-semibold leading-[1.05] tracking-tightest text-ink-paper"
                >
                  Notes for owners.{' '}
                  <span className="text-accent">From me to you.</span>
                </h2>
                <p
                  id="email-popup-description"
                  className="mb-7 text-[15px] leading-relaxed text-paper-soft"
                >
                  Short, useful field notes on getting found online and turning visitors into
                  customers. Sent only when there&apos;s something worth saying.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="email-popup-name"
                      className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint"
                    >
                      Name <span className="text-paper-faint">— optional</span>
                    </label>
                    <input
                      id="email-popup-name"
                      name="name"
                      type="text"
                      autoComplete="given-name"
                      value={name}
                      onChange={event => setName(event.target.value)}
                      placeholder="Your name"
                      className={INPUT}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email-popup-email"
                      className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint"
                    >
                      Email
                    </label>
                    <input
                      ref={emailInputRef}
                      id="email-popup-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={handleEmailChange}
                      placeholder="you@example.com"
                      className={INPUT}
                      aria-invalid={emailError ? true : undefined}
                      aria-describedby={emailError ? 'email-popup-email-error' : undefined}
                    />
                    {emailError && (
                      <p
                        id="email-popup-email-error"
                        className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-red-600"
                      >
                        {emailError}
                      </p>
                    )}
                  </div>

                  {serverError && (
                    <p
                      role="alert"
                      className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-700"
                    >
                      {serverError}
                    </p>
                  )}

                  <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => close('dismissed')}
                      className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper-faint transition hover:text-ink-paper"
                    >
                      No thanks
                    </button>
                    <button
                      type="submit"
                      disabled={status === 'submitting'}
                      className={`group inline-flex items-center justify-center gap-2.5 rounded-sm bg-accent px-6 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98] ${status === 'submitting' ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                      {status === 'submitting' ? 'Signing you up…' : 'Join the list'}
                      {status !== 'submitting' && (
                        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
