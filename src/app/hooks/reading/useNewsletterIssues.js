import { useEffect, useState } from 'react'
import { fetchIssue, fetchIssues } from '@data/newsletter/newsletterIssues'
import { usePrerenderData } from '@hooks/usePrerenderData'

/**
 * The archive of sent issues.
 *
 * Starts from the build's seed where there is one, so the prerendered page
 * carries the list rather than a shell, and refreshes from the table on mount
 * so an open browser shows what is there now. A failed read leaves `error`
 * set and the seeded list standing, since a list that is a few minutes old
 * reads better than an empty page.
 *
 * @returns {{issues: Array<object>|null, error: Error|null, loading: boolean}}
 */
export function useNewsletterIssues() {
  const seeded = usePrerenderData()?.issues ?? null
  const [issues, setIssues] = useState(seeded)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchIssues({ signal: controller.signal })
      .then(rows => {
        setIssues(rows)
        setError(null)
      })
      .catch(cause => {
        if (cause.name !== 'AbortError') setError(cause)
      })
    return () => controller.abort()
  }, [])

  return { issues, error, loading: issues === null && !error }
}

/**
 * One issue by slug.
 *
 * `status` separates the three answers a page has to draw differently: still
 * reading, here it is, and there is no such issue. A slug the table does not
 * carry resolves to `missing`, never to a throw, so the prerender pass and the
 * browser both render the not-found panel instead of falling over.
 *
 * @param {string} slug
 * @returns {{issue: object|null, status: 'loading'|'ready'|'missing'|'error'}}
 */
export function useNewsletterIssue(slug) {
  const seeded = usePrerenderData()?.issue ?? null
  const seedMatches = seeded?.slug === slug
  const [issue, setIssue] = useState(seedMatches ? seeded : null)
  const [status, setStatus] = useState(seedMatches ? 'ready' : 'loading')

  useEffect(() => {
    const controller = new AbortController()
    fetchIssue(slug, { signal: controller.signal })
      .then(row => {
        setIssue(row)
        setStatus(row ? 'ready' : 'missing')
      })
      .catch(cause => {
        if (cause.name !== 'AbortError') setStatus('error')
      })
    return () => controller.abort()
  }, [slug])

  return { issue, status }
}
