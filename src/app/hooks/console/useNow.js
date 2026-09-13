import { useEffect, useState } from 'react'

/** A clock that ticks, so "3 min ago" does not sit there saying "just now". */
export function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/** How long ago, in the coarsest unit that still says something useful. */
export function ago(value, now) {
  if (!value) return null
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000))
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
