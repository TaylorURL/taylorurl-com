import { Link } from 'react-router-dom'
import {
  COMPANY_LOCATION,
  COMPANY_PHONE,
  COMPANY_PHONE_HREF,
  FACEBOOK_URL,
  FOOTER_COLUMNS,
  INSTAGRAM_URL,
  LEGAL_LINKS,
  SUPPORT_EMAIL,
} from '@constants/navigation'
import { HAS_ACCOUNTS } from '@constants/routes'
import { BBB_PROFILE_URL } from '@data/reputation/bbb'
import { Logo } from '@components/kit/Kit'
import { dayIn } from '@lib/time/zone.js'
import { PUBLISHES_REVIEWS, SITE } from '../../../../lib/site/current.js'

const ITEM = 'text-[15px] leading-[1.5] text-ink-soft transition-colors hover:text-ink'

/**
 * The foot of every page: who this is and how to reach him on the left, then
 * every page on the site in a few short columns, then the legal line.
 *
 * It is the directory the bar no longer is. The bar names three pages; this
 * names all of them, so a reader who scrolls to the bottom looking for the FAQ
 * or the speed check finds it in the one place a footer is expected to have it.
 */
export default function Footer() {
  const year = Number(dayIn().slice(0, 4))
  const elsewhere = [
    PUBLISHES_REVIEWS && BBB_PROFILE_URL && { href: BBB_PROFILE_URL, label: 'BBB Accredited' },
    FACEBOOK_URL && { href: FACEBOOK_URL, label: 'Facebook' },
    INSTAGRAM_URL && { href: INSTAGRAM_URL, label: 'Instagram' },
  ].filter(Boolean)

  return (
    <footer className="border-t border-[var(--line)] bg-[var(--band)] text-ink">
      <div className="mx-auto w-full max-w-[1120px] px-5 pb-10 pt-14 sm:px-8 sm:pt-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,3fr)] lg:gap-16">
          <div className="max-w-[320px]">
            <Link to="/" aria-label="Home" className="inline-block rounded-[6px]">
              <Logo />
            </Link>
            <p className="mt-4 text-[15px] leading-[1.55] text-ink-soft">{SITE.footerBlurb}</p>
            <ul className="mt-5 space-y-1.5 text-[15px]">
              <li>
                <a href={COMPANY_PHONE_HREF} className="font-medium text-ink hover:text-accent">
                  {COMPANY_PHONE}
                </a>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-ink hover:text-accent">
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li className="text-ink-soft">{COMPANY_LOCATION}</li>
            </ul>
          </div>

          <nav aria-label="Every page" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {FOOTER_COLUMNS.map(column => (
              <div key={column.head}>
                <p className="text-[14px] font-medium text-ink">{column.head}</p>
                <ul className="mt-3 space-y-2.5">
                  {column.items.map(item => (
                    <li key={item.to}>
                      <Link to={item.to} className={ITEM}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[var(--line)] pt-6 text-[14px] text-ink-mute sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {SITE.brandName}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {elsewhere.map(link => (
              <li key={link.href}>
                <a href={link.href} target="_blank" rel="noreferrer" className="hover:text-ink">
                  {link.label}
                </a>
              </li>
            ))}
            {LEGAL_LINKS.map(link => (
              <li key={link.to}>
                <Link to={link.to} className="hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
            {HAS_ACCOUNTS && (
              <li>
                <Link to="/login" className="hover:text-ink">
                  Client sign in
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </footer>
  )
}
