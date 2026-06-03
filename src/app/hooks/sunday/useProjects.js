import { useEffect, useState } from 'react'
import { getProject, listProjects } from '@data/sunday/projectsClient'

export function useProjects({ status } = {}) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listProjects({ status })
      .then(rows => {
        if (!cancelled) {
          setProjects(rows)
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
  }, [status])

  return { projects, loading, error }
}

export function useProject(id) {
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) {
      setProject(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getProject(id)
      .then(row => {
        if (!cancelled) {
          setProject(row)
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
  }, [id])

  return { project, loading, error }
}
