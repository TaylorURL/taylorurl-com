import { useEffect, useState } from 'react'
import { supabase } from '@data/supabaseClient'
import { listGithubRepos } from '@data/sunday/githubReposClient'

export function useGithubRepos({ search, includeArchived } = {}) {
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    listGithubRepos({ search, includeArchived })
      .then(rows => {
        if (cancelled) return
        setRepos(rows)
        setError(null)
        const newest = rows.reduce((acc, r) => {
          const t = r.last_synced_at ? new Date(r.last_synced_at).getTime() : 0
          return t > acc ? t : acc
        }, 0)
        setLastSyncedAt(newest > 0 ? new Date(newest).toISOString() : null)
      })
      .catch(err => {
        if (!cancelled) setError(err?.message ?? String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const channel = supabase
      .channel('sunday-github-repos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sunday_github_repos' },
        () => {
          // On any change, refetch with the current filters.
          listGithubRepos({ search, includeArchived })
            .then(rows => {
              if (cancelled) return
              setRepos(rows)
            })
            .catch(() => {
              /* ignore live-tail errors */
            })
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [search, includeArchived])

  return { repos, loading, error, lastSyncedAt }
}
