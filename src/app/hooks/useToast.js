import { createContext, useContext } from 'react'

/** Context carrying the `addToast` dispatcher provided by <ToastProvider>. */
export const ToastContext = createContext(null)

/**
 * Access the toast dispatcher.
 *
 * @returns {(message: string, type?: 'success' | 'error', duration?: number) => void}
 *   the `addToast` function. Must be called within a <ToastProvider>.
 */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
