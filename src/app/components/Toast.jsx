import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { AlertCircle, Check, X } from 'lucide-react'
import { EASE } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'
import { ToastContext } from '@hooks/useToast'

const DEFAULT_TOAST_DURATION = 4000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextIdRef = useRef(0)
  const timersRef = useRef(new Map())

  const removeToast = useCallback(id => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const addToast = useCallback(
    (message, type = 'success', duration = DEFAULT_TOAST_DURATION) => {
      const id = (nextIdRef.current += 1)
      setToasts(prev => [...prev, { id, message, type }])
      timersRef.current.set(
        id,
        setTimeout(() => removeToast(id), duration)
      )
    },
    [removeToast]
  )

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      {/* The bottom-right corner belongs to the assistant's launcher, and on a
          phone a full-width notice runs straight across it. So a handheld
          stacks the notices one rail up, clear of the launcher and on the
          page's own gutter; a pointer-sized screen has the middle of the
          bottom edge to itself. */}
      <div
        className="fixed bottom-24 left-6 right-6 z-[var(--z-toast)] flex flex-col items-center gap-2 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map(toast => {
            const isError = toast.type === 'error'
            return (
              <m.div
                key={toast.id}
                role={isError ? 'alert' : 'status'}
                initial={{ opacity: 0, transform: 'translateY(18px)' }}
                animate={{ opacity: 1, transform: 'translateY(0px)' }}
                exit={{ opacity: 0, transform: 'translateY(-12px)' }}
                transition={{ duration: 0.2, ease: EASE }}
                {...GROUNDS.dark.attrs}
                className={`flex items-center gap-3 rounded-[var(--r-card)] border bg-bg px-5 py-3 text-ink shadow-[var(--lift)] ${
                  isError ? 'border-[color:var(--danger-edge)]' : 'border-hair-strong'
                }`}
              >
                {isError ? (
                  <AlertCircle
                    className="h-4 w-4 flex-shrink-0 text-[color:var(--danger)]"
                    strokeWidth={2}
                  />
                ) : (
                  <Check className="h-4 w-4 flex-shrink-0 text-accent" strokeWidth={2} />
                )}
                <span className="text-[14px] font-medium tracking-tight">{toast.message}</span>
                <button
                  className="-mr-1 ml-1 flex h-8 w-8 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-[var(--r-tiny)] text-ink-faint transition-colors duration-150 ease-out-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  aria-label="Dismiss Notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </m.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
