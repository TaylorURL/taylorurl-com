import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { MarkFacebook, MarkLinkedIn, MarkX } from '@components/marks/brandMarks'
import { MarkLink, MarkShare } from '@components/marks/marks'
import { useToast } from '@hooks/chrome/useToast'
import { SITE_URL } from '@constants/seo'

/**
 * The share row under an article.
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

// A share target is a small pale pill, filled rather than outlined. On a phone
// the words beside the marks are dropped, so the pill is held square there
// rather than collapsing to the width of a glyph.
const BUTTON =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-full bg-white/[0.06] px-3.5 text-[14px] font-medium text-ink-soft transition-colors duration-150 hover:bg-white/[0.11] hover:text-ink'

/**
 * @param {{ title: string, path: string }} props - The article's title and its
 *   site-relative path, which together make the address that gets shared.
 */
export default function ShareBar({ title, path }) {
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

  const label = 'hidden sm:inline'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-2 text-[14px] text-ink-mute">Share</span>

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
