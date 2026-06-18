import { useEffect, useState } from 'react'

const TRUSTPILOT_GREEN = '#00b67a'
const RATING_ENDPOINT = '/api/trustpilot'
const TRUSTSCORE_LABELS = [
  { min: 4.3, label: 'Excellent' },
  { min: 3.5, label: 'Great' },
  { min: 2.7, label: 'Average' },
  { min: 1.9, label: 'Poor' },
  { min: 0, label: 'Bad' },
]

function trustScoreLabel(rating) {
  return TRUSTSCORE_LABELS.find(({ min }) => rating >= min)?.label ?? ''
}

/**
 * A single Trustpilot-style star — green square with a white star inside.
 * The `fill` prop is 0–1 and clips the green fill so half-stars render
 * correctly at any rating value.
 */
function TrustStar({ fill }) {
  const clipWidth = `${Math.max(0, Math.min(1, fill)) * 100}%`
  return (
    <span className="relative inline-block h-6 w-6 overflow-hidden rounded-sm bg-gray-200">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0"
        style={{ width: clipWidth, backgroundColor: TRUSTPILOT_GREEN }}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="absolute inset-0 h-full w-full"
      >
        <polygon
          points="12,3 14.7,9.6 21.8,10.1 16.3,14.6 18.1,21.5 12,17.7 5.9,21.5 7.7,14.6 2.2,10.1 9.3,9.6"
          fill="#ffffff"
        />
      </svg>
    </span>
  )
}

function StarRow({ rating }) {
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`Rated ${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <TrustStar key={index} fill={rating - index} />
      ))}
    </div>
  )
}

/**
 * Renders the live Trustpilot rating for the site. Fetches the cached
 * `/api/trustpilot` endpoint and gracefully returns `null` if the score is
 * unavailable (no reviews yet, fetch failure, or parse failure) so the
 * surrounding section can lay out without an empty hole.
 */
export default function TrustpilotBadge({ profileUrl }) {
  const [rating, setRating] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(RATING_ENDPOINT, { signal: controller.signal })
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        if (data?.rating && data?.reviewCount) setRating(data)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  if (!rating) return null

  const { rating: ratingValue, reviewCount } = rating
  const label = trustScoreLabel(ratingValue)

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-3 rounded-xl border border-gray-200 bg-surface-overlay px-4 py-3 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
      aria-label={`${label} — ${ratingValue} out of 5 based on ${reviewCount} Trustpilot reviews`}
    >
      <StarRow rating={ratingValue} />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-gray-900">
          {label}
          <span className="ml-1.5 font-normal text-gray-500">· {ratingValue.toFixed(1)} / 5</span>
        </span>
        <span className="text-xs text-gray-500">
          Based on {reviewCount.toLocaleString()} review{reviewCount === 1 ? '' : 's'} on{' '}
          <span className="font-semibold text-gray-700">Trustpilot</span>
        </span>
      </div>
    </a>
  )
}
