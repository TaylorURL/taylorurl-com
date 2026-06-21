import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Check, X } from 'lucide-react'
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
      timersRef.current.set(id, setTimeout(() => removeToast(id), duration))
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
      <div
        className="fixed bottom-6 left-4 right-4 z-[100] flex flex-col items-center gap-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map(toast => {
            const isError = toast.type === 'error'
            return (
              <motion.div
                key={toast.id}
                role={isError ? 'alert' : 'status'}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className={`flex items-center gap-3 rounded-sm border bg-bg px-5 py-3 text-ink shadow-[0_18px_48px_-12px_rgba(0,0,0,0.5)] ${
                  isError ? 'border-red-500/60' : 'border-hair-strong'
                }`}
              >
                {isError ? (
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400" strokeWidth={2} />
                ) : (
                  <Check className="h-4 w-4 flex-shrink-0 text-accent" strokeWidth={2} />
                )}
                <span className="text-[14px] font-medium tracking-tight">{toast.message}</span>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="ml-2 text-ink-faint transition-colors hover:text-ink"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
