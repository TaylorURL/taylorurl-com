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
import { TYPE } from '@components/kit/styles'
import { dayIn } from '@lib/time/zone.js'
import { PUBLISHES_REVIEWS, SITE } from '../../../../lib/site/current.js'

const ITEM =
  'text-[15px] leading-[1.5] text-[color:var(--light)] transition-colors hover:text-[color:var(--signal)]'
const BASE = `${TYPE.mono} text-[color:var(--light-soft)] transition-colors hover:text-[color:var(--light)]`

/**
 * The foot of every page, on night: the number to call set large, then every
 * page on the site in four short columns, then the legal line in mono.
 *
 * It is the directory the bar no longer is. The bar names three pages; this
 * names all of them, so a reader who scrolls to the bottom looking for the FAQ
 * or the speed check finds it where a footer is expected to have it.
 */
export default function Footer() {
  const year = Number(dayIn().slice(0, 4))
  const elsewhere = [
    PUBLISHES_REVIEWS && BBB_PROFILE_URL && { href: BBB_PROFILE_URL, label: 'BBB Accredited' },
    FACEBOOK_URL && { href: FACEBOOK_URL, label: 'Facebook' },
    INSTAGRAM_URL && { href: INSTAGRAM_URL, label: 'Instagram' },
  ].filter(Boolean)

  return (
    <footer className="bg-[var(--night)] text-[color:var(--light)]">
      <div className="mx-auto w-full max-w-[1120px] px-5 pb-10 pt-16 sm:px-8 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,3fr)] lg:gap-16">
          <div>
            <Link to="/" aria-label="Home" className="inline-block">
              <Logo />
            </Link>
            <a
              href={COMPANY_PHONE_HREF}
              className="mt-7 block font-mono text-[26px] font-medium tracking-[-0.02em] text-[color:var(--light)] hover:text-[color:var(--signal)] sm:text-[28px]"
            >
              {COMPANY_PHONE}
            </a>
            <p className="mt-3 text-[15px] leading-[1.6] text-[color:var(--light-soft)]">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-[color:var(--light)]">
                {SUPPORT_EMAIL}
              </a>
              <br />
              {COMPANY_LOCATION}
            </p>
            <p className="mt-6 max-w-[22rem] text-[15px] leading-[1.6] text-[color:var(--light-soft)]">
              {SITE.footerBlurb}
            </p>
          </div>

          <nav aria-label="Every page" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {FOOTER_COLUMNS.map(column => (
              <div key={column.head}>
                <p className={`${TYPE.mono} text-[color:var(--light-soft)]`}>{column.head}</p>
                <ul className="mt-4 space-y-2.5">
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

        <div className="mt-16 flex flex-col gap-4 border-t border-[var(--night-line)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className={`${TYPE.mono} text-[color:var(--light-soft)]`}>
            © {year} {SITE.brandName}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {elsewhere.map(link => (
              <li key={link.href}>
                <a href={link.href} target="_blank" rel="noreferrer" className={BASE}>
                  {link.label}
                </a>
              </li>
            ))}
            {LEGAL_LINKS.map(link => (
              <li key={link.to}>
                <Link to={link.to} className={BASE}>
                  {link.label}
                </Link>
              </li>
            ))}
            {HAS_ACCOUNTS && (
              <li>
                <Link to="/login" className={BASE}>
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
