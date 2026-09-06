import { Link } from 'react-router-dom'
import { ArrowUpRight, Phone } from 'lucide-react'
import { COMPANY_PHONE, COMPANY_PHONE_HREF, START_LINK } from '@constants/navigation'

/**
 * The hero's actions. Every concept mounts this one component, so a project
 * brief and a services page are named the same way whichever hero ends up
 * shipping, and the set can only be restyled in one place.
 *
 * All of them take the site's own button set, and the quieter ones read their
 * surface and their ink off the ground they stand on, so none has to be told
 * which of the two grounds the hero showing it chose.
 *
 * The leading button is `START_LINK` rather than a written destination. The
 * studio's is the configurator at /start; the second site has no /start in its
 * route table and nothing prerenders one, so the same button written out here
 * was a link to a 404 on the first screen of that site's home page. Both sites
 * serve /services, so the second button is the same on either.
 *
 * The number is here on a phone and nowhere else. A trade owner reading this
 * on a phone is holding the thing that places the call, and the configurator
 * is five screens of picking — the wrong ask of somebody who wants to say what
 * they need out loud. On a desktop the number is a string to copy rather than
 * a control, so the pair stands as it did and the bar keeps the number.
 */
export default function HeroActions() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link to={START_LINK.to} className="btn btn-primary group">
        {START_LINK.label}
        <ArrowUpRight
          className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
      <a href={COMPANY_PHONE_HREF} className="btn btn-secondary sm:hidden">
        <Phone className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        <span>{COMPANY_PHONE}</span>
      </a>
      <Link to="/services" className="btn btn-secondary">
        See What’s Included
      </Link>
    </div>
  )
}
