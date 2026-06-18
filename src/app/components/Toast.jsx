import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, X, AlertCircle } from 'lucide-react'
import { ToastContext } from '@hooks/useToast'

const DEFAULT_TOAST_DURATION = 4000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // Per-instance id source and live auto-dismiss timers. Using refs (not a
  // module-level counter) keeps multiple providers / SSR renders isolated.
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

  // Clear any pending dismiss timers if the provider unmounts.
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
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              role={toast.type === 'success' ? 'status' : 'alert'}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`flex items-center gap-3 rounded-xl border px-5 py-3 shadow-lg backdrop-blur-sm ${
                toast.type === 'success'
                  ? 'border-green-200 bg-surface-overlay text-gray-900'
                  : 'border-red-200 bg-surface-overlay text-gray-900'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
              )}
              <span className="text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-2 text-gray-400 transition-colors hover:text-gray-600"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
