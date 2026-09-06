import {
  MarkFacebook,
  MarkGoogle,
  MarkInstagram,
  MarkLinkedIn,
  MarkX,
  MarkYelp,
} from '@components/brandMarks'
import { SOCIAL_LINKS } from '@constants/navigation'

// The glyph for each account named in the register. A brand added there without
// a drawing here is left out rather than shown under someone else's mark.
const BRAND_MARKS = {
  facebook: MarkFacebook,
  instagram: MarkInstagram,
  x: MarkX,
  linkedin: MarkLinkedIn,
  yelp: MarkYelp,
  google: MarkGoogle,
}

/**
 * The accounts this business actually posts from, drawn in their own marks.
 *
 * Each is a chip, so the row takes the edge, the height and the hover the rest
 * of the site's chips carry, and the ground it is set into decides its ink.
 *
 * @param {{ label?: string }} props - `label` is the line above the row, or
 *   nothing when the surrounding section already says it.
 */
export default function SocialLinks({ label = 'Follow' }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {label && <span className="section-label-sm text-ink-faint">{label}</span>}
      {SOCIAL_LINKS.map(({ brand, label: name, href }) => {
        const Mark = BRAND_MARKS[brand]
        if (!Mark) return null
        return (
          <a
            key={brand}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            className="chip"
          >
            <Mark className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{name}</span>
          </a>
        )
      })}
    </div>
  )
}
