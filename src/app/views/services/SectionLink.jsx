import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { GROUNDS } from '@constants/grounds'

/**
 * The one link a section carries under its content, drawn as a ruled label
 * rather than a second button, so it never competes with the page's own call to
 * action.
 *
 * @param {object} props
 * @param {string} props.to - Where the link goes.
 * @param {string} props.label - The link's label.
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground the link sits on.
 */
export default function SectionLink({ to, label, ground = 'paper' }) {
  const tone = GROUNDS[ground]

  return (
    <Link
      to={to}
      className={`section-label group inline-flex min-h-[44px] items-center gap-2.5 border-b py-2 transition duration-200 ease-out-soft hover:text-accent ${tone.ruleStrong} ${tone.title}`}
    >
      {label}
      <ArrowUpRight
        className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  )
}
