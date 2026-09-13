import { MarkBbb } from '@components/marks/brandMarks'
import { BBB_PROFILE_URL, bbbAccredited } from '@data/reputation/bbb'

/**
 * The BBB accreditation, wherever the site says so.
 *
 * One component rather than markup repeated per surface, because the claim is
 * licensed rather than decoration: BBB issues its seal on the condition it is
 * shown against the profile it was granted for, and a rule that has to be
 * re-obeyed in five files is a rule that eventually is not. The whole of the
 * obligation is held here, so a page asks for the accreditation and gets a
 * compliant one.
 *
 * What is drawn is the torch and the claim in words, not the seal. The seal
 * BBB issues is a lockup with its own white panel and its own box, made to
 * stand on somebody else\'s page, and on this one it read as a sticker: a
 * white rectangle in the quietest line of the footer, a second blue or a black
 * chip under the closing ask. The torch is drawn the way every other network\'s
 * mark on the site is drawn, on the same box and in the network\'s own ink,
 * and the words beside it say what the seal said. The seal itself is still
 * held, in `@data/reputation/bbb`, and holding it is what licenses the words.
 *
 * It links to the profile the accreditation was issued against, which is the
 * whole of what the claim is for: the one mark on a page whose job is being
 * checkable. Nothing draws unless the artwork BBB issued is held, so no
 * surface can ship a claim the source refuses.
 *
 * @param {object} props
 * @param {string} [props.className] - Classes for the link, for a caller that
 *   has to place it in its own layout.
 */
export default function BbbSeal({ className = '' }) {
  if (!bbbAccredited()) return null

  return (
    <a
      href={BBB_PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-[44px] touch-manipulation items-center gap-2 text-[13px] font-medium text-ink-paper transition-colors duration-200 hover:text-[color:var(--bbb-blue)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] active:scale-[0.97] ${className}`.trimEnd()}
    >
      <MarkBbb
        className="h-[18px] w-[18px] shrink-0"
        style={{ color: 'var(--bbb-blue)' }}
        aria-hidden="true"
      />
      BBB Accredited Business
    </a>
  )
}
