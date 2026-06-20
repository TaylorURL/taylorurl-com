import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'

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
 * Renders the live Trustpilot rating for the site. Fetches the cached
 * `/api/trustpilot` endpoint and gracefully returns `null` if the score is
 * unavailable (no reviews yet, fetch failure, or parse failure) so the
 * surrounding section can lay out without an empty hole. Styled to read as a
 * monochrome credibility chip — the accent dot makes it part of the same
 * visual language as the rest of the site.
 */
export default function TrustpilotBadge({ profileUrl, variant = 'paper' }) {
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
  const onDark = variant === 'dark'

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-4 rounded-sm border px-5 py-3 transition duration-200 ease-out ${
        onDark
          ? 'border-hair-strong bg-bg text-ink hover:border-accent/60'
          : 'border-hair-paper-strong bg-paper text-ink-paper hover:border-accent/60'
      }`}
      aria-label={`${label} — ${ratingValue} out of 5 based on ${reviewCount} Trustpilot reviews`}
    >
      <div className="flex gap-0.5" role="img" aria-label={`Rated ${ratingValue} out of 5`}>
        {Array.from({ length: 5 }).map((_, index) => {
          const filled = index + 1 <= Math.round(ratingValue)
          return (
            <Star
              key={index}
              className={`h-4 w-4 ${filled ? 'fill-accent text-accent' : onDark ? 'text-ink-faint' : 'text-paper-faint'}`}
              strokeWidth={1.5}
            />
          )
        })}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          {label} · {ratingValue.toFixed(1)} / 5
        </span>
        <span className={`text-[12px] ${onDark ? 'text-ink-soft' : 'text-paper-soft'}`}>
          {reviewCount.toLocaleString()} review{reviewCount === 1 ? '' : 's'} on Trustpilot
        </span>
      </div>
    </a>
  )
}
