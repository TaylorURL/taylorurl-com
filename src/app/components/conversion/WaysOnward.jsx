import { Link } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import Magnet from '@reactbits/Magnet/Magnet'
import { rise } from '@constants/animations'

/**
 * The two ways off a page that has nothing further to offer: back to the home
 * page, or to somebody who can help.
 *
 * @param {{ delay: number }} props - How long after the page mounts the pair
 *   lands, in seconds, so it takes its place in the page's own entrance.
 */
export default function WaysOnward({ delay }) {
  return (
    <m.div {...rise(delay)} className="mt-10 flex flex-wrap gap-4">
      <Magnet padding={60} magnetStrength={5}>
        <Link to="/" className="btn btn-primary group">
          Return to Home
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </Magnet>
      <Magnet padding={60} magnetStrength={5}>
        <Link to="/contact" className="btn btn-secondary">
          Get in Touch
        </Link>
      </Magnet>
    </m.div>
  )
}
