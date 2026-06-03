import { useEffect, useState } from 'react'
import { getLatestSynthesis, getSynthesisForDate } from '@data/sunday/synthesesClient'

export function useLatestSynthesis() {
  const [synthesis, setSynthesis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getLatestSynthesis()
      .then(row => {
        if (!cancelled) {
          setSynthesis(row)
          setError(null)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { synthesis, loading, error }
}

export function useSynthesisForDate(date) {
  const [synthesis, setSynthesis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!date) {
      setSynthesis(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getSynthesisForDate(date)
      .then(row => {
        if (!cancelled) {
          setSynthesis(row)
          setError(null)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [date])

  return { synthesis, loading, error }
}
