import { useEffect, useState } from 'react'
import { REVIEW_SOURCES } from '@data/reputation/reviews'
import { committedStanding } from '@data/reputation/review-standings'

const RATING_ENDPOINT = '/api/trustpilot'

/** The one network whose standing is read live rather than written down. */
const LIVE = 'trustpilot'

/**
 * The standing of every network this business is reviewed on, in registry
 * order, ready for the badge.
 *
 * One of them is live and the rest are not, and the difference is invisible by
 * the time it leaves here. Trustpilot answers `/api/trustpilot`, which is the
 * only one of these that answers a program at all; the other four were read off
 * their own profiles by a person and committed. Both arrive in the same shape,
 * so nothing downstream has to know which is which.
 *
 * Three outcomes are kept apart for the live one rather than folded into one
 * absence: the reading has not arrived, which holds its place with a
 * placeholder; it arrived, which is a badge; and there is nothing to show,
 * which is one fewer badge on the rail. Collapsing the first into the third is
 * what makes a badge appear out of nowhere and shove the row along as it does.
 *
 * The endpoint decides which of those it is and answers a body every time. A
 * profile with no reviews on it comes back as a count of zero, and a profile
 * that could not be read comes back as a 503 the endpoint has already reported.
 *
 * @returns {object[]} The showable standings, each carrying the key of the
 *   network it belongs to. The live one carries `pending` instead while it is
 *   still on its way.
 */
export default function useReviewStandings() {
  const [live, setLive] = useState(null)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(RATING_ENDPOINT, { signal: controller.signal })
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        if (data?.reviewCount > 0 && data?.rating > 0) {
          setLive({
            key: LIVE,
            rating: data.rating,
            // Trustpilot draws a score to the nearest half tile and publishes
            // its own number for that, which is the one the profile shows.
            stars: data.stars > 0 ? data.stars : data.rating,
            reviewCount: data.reviewCount,
            verdict: data.label,
          })
        }
        setSettled(true)
      })
      .catch(error => {
        if (error?.name !== 'AbortError') setSettled(true)
      })
    return () => controller.abort()
  }, [])

  return REVIEW_SOURCES.map(source => {
    if (source.key === LIVE) {
      if (live) return live
      return settled ? null : { key: LIVE, pending: true }
    }
    return committedStanding(source.key)
  }).filter(Boolean)
}
