import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { MarkFacebook, MarkLinkedIn, MarkX } from '@components/marks/brandMarks'
import { MarkLink, MarkShare } from '@components/marks/marks'
import { useToast } from '@hooks/chrome/useToast'
import { SITE_URL } from '@constants/seo'

/**
 * The share row for an article, as a row under the text or as a compact block
 * of marks in the rail beside it.
 *
 * Every target is a plain link to a published share endpoint, so nothing here
 * loads a script from Facebook, X or LinkedIn and nothing tracks a reader who
 * only scrolled past. The copy button and the phone's own share sheet are the
 * two that need JavaScript, and both fall back to the links beside them.
 */

const TARGETS = [
  {
    key: 'facebook',
    label: 'Facebook',
    Mark: MarkFacebook,
    href: ({ url }) => `https://www.facebook.com/sharer/sharer.php?u=${url}`,
  },
  {
    key: 'x',
    label: 'X',
    Mark: MarkX,
    href: ({ url, title }) => `https://x.com/intent/post?url=${url}&text=${title}`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    Mark: MarkLinkedIn,
    href: ({ url }) => `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
  },
  {
    key: 'email',
    label: 'Email',
    Mark: Mail,
    href: ({ url, title }) => `mailto:?subject=${title}&body=${url}`,
  },
]

// A share target is a chip. The rail drops the words beside the marks, so the
// box is held square there rather than collapsing to the width of a glyph.
const BUTTON = 'chip min-w-[44px] justify-center'

/**
 * @param {{ title: string, path: string, compact?: boolean }} props - The
 *   article's title and its site-relative path, which together make the address
 *   that gets shared, and whether the row is standing in a rail, where there is
 *   room for the marks but not for the words beside them.
 */
export default function ShareBar({ title, path, compact = false }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  // The phone's own share sheet reaches the apps a person actually uses, so it
  // is offered where it exists and simply absent where it does not. The check
  // waits for the browser: the prerendered HTML has no navigator, and a button
  // that appears during render would not match the markup it hydrates over.
  const [canShareNatively, setCanShareNatively] = useState(false)

  useEffect(() => {
    setCanShareNatively(typeof navigator.share === 'function')
  }, [])

  const shareUrl = `${SITE_URL}${path}`
  const encoded = { url: encodeURIComponent(shareUrl), title: encodeURIComponent(title) }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast('Link copied.', 'success')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Could not copy the link. Select the address bar instead.', 'error')
    }
  }

  const shareNatively = async () => {
    try {
      await navigator.share({ title, url: shareUrl })
    } catch {
      // A share sheet the reader closed is not a failure worth reporting.
    }
  }

  const label = compact ? 'hidden' : 'hidden sm:inline'

  return (
    <div
      className={
        compact
          ? 'flex flex-wrap gap-1.5'
          : 'border-hair-paper flex flex-wrap items-center gap-2 border-y py-5'
      }
    >
      {!compact && <span className="text-paper-faint section-label-sm mr-2">Share</span>}

      {TARGETS.map(target => (
        <a
          key={target.key}
          href={target.href(encoded)}
          target="_blank"
          rel="noopener noreferrer"
          className={BUTTON}
          aria-label={`Share on ${target.label}`}
        >
          <target.Mark className="h-3.5 w-3.5" aria-hidden="true" />
          <span className={label}>{target.label}</span>
        </a>
      ))}

      <button type="button" onClick={copyLink} className={BUTTON} aria-label="Copy link">
        <MarkLink className="h-3.5 w-3.5" />
        <span className={label}>{copied ? 'Copied' : 'Copy Link'}</span>
      </button>

      {canShareNatively && (
        <button type="button" onClick={shareNatively} className={BUTTON} aria-label="Share">
          <MarkShare className="h-3.5 w-3.5" />
          <span className={label}>More</span>
        </button>
      )}
    </div>
  )
}
