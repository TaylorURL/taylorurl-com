import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  COMPANY_LOCATION,
  COMPANY_PHONE,
  COMPANY_PHONE_HREF,
  FOOTER_COLUMNS,
  LEGAL_LINKS,
  SOCIAL_LINKS,
  SUPPORT_EMAIL,
} from '@constants/navigation'
import { HAS_ACCOUNTS } from '@constants/routes'
import { BBB_PROFILE_URL } from '@data/reputation/bbb'
import { Logo } from '@components/kit/Kit'
import { MarkBbb, MarkFacebook, MarkInstagram } from '@components/marks/brandMarks'
import { TYPE } from '@components/kit/styles'
import { BUILT_YEAR } from '@lib/time/built.js'
import { dayIn } from '@lib/time/zone.js'
import { PUBLISHES_REVIEWS, SITE } from '../../../../lib/site/current.js'

const ITEM = 'text-[14px] leading-[1.5] text-ink-soft transition-colors hover:text-ink'
const BASE = 'text-[13px] text-ink-mute transition-colors hover:text-ink'

/**
 * The glyph each account in `SOCIAL_LINKS` is drawn with, by its `brand`. An
 * account with no glyph here is left out rather than drawn as a bare word in a
 * row of icons.
 */
const SOCIAL_MARKS = { facebook: MarkFacebook, instagram: MarkInstagram }

/**
 * The accounts the business can be followed on, as their own icons.
 *
 * A row of network names in the legal line read as more small print, and the
 * icon is what a reader scanning a footer looks for. Each sits on a round tile
 * the size a thumb needs, in the muted ink the rest of the footer is set in,
 * and takes its own network's colour when pointed at - the colour each mark
 * names for itself through `data-mark`. The name is in the label, so a reader
 * who is listening still hears where the link goes.
 */
function SocialIcons({ className = '' }) {
  const accounts = SOCIAL_LINKS.filter(link => link.href && SOCIAL_MARKS[link.brand])
  if (accounts.length === 0) return null
  return (
    <ul className={`flex gap-2 ${className}`.trim()} aria-label="Follow along">
      {accounts.map(link => {
        const Mark = SOCIAL_MARKS[link.brand]
        return (
          <li key={link.brand}>
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`${SITE.shortName} on ${link.label}`}
              title={link.label}
              className="group flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.06] text-ink-soft transition-colors duration-150 hover:bg-ink/10"
            >
              <Mark className="h-[18px] w-[18px] transition-colors duration-150 group-hover:text-[color:var(--mark-brand)]" />
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The foot of every page: who this is and how to reach him on the left, every
 * page on the site in four short columns, and the legal line under a hairline.
 *
 * It is the directory the bar no longer is. The bar names three pages; this
 * names all of them, so a reader who scrolls to the bottom looking for the FAQ
 * or the speed check finds it where a footer is expected to have it.
 */
export default function Footer() {
  // The year the markup carries, held through the render that adopts it and
  // given back to a clock once the page is live. The build decided the string
  // so that both renders write the same one - see `@lib/time/built.js` - and
  // this is the one moment the two are allowed to differ, so that a tab left
  // open across New Year's midnight turns the line over without a reload.
  const [year, setYear] = useState(BUILT_YEAR)
  useEffect(() => setYear(Number(dayIn().slice(0, 4))), [])

  const showsBbb = PUBLISHES_REVIEWS && BBB_PROFILE_URL

  return (
    <footer className="bg-[var(--card)]">
      <div className="mx-auto w-full max-w-[1160px] px-5 pb-10 pt-14 sm:px-8 sm:pt-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,3fr)] lg:gap-16">
          <div className="max-w-[320px]">
            <Link to="/" aria-label="Home" className="inline-block rounded-md">
              <Logo />
            </Link>
            <p className={`${TYPE.small} mt-5`}>{SITE.footerBlurb}</p>
            <ul className="mt-5 space-y-1.5 text-[14px]">
              <li>
                <a
                  href={COMPANY_PHONE_HREF}
                  className="font-medium text-ink hover:text-[color:var(--link)]"
                >
                  {COMPANY_PHONE}
                </a>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-ink-soft hover:text-ink">
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li className="text-ink-mute">{COMPANY_LOCATION}</li>
            </ul>
            <SocialIcons className="mt-6" />
          </div>

          <nav aria-label="Every page" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {FOOTER_COLUMNS.map(column => (
              <div key={column.head}>
                <p className="text-[13px] font-medium text-ink">{column.head}</p>
                <ul className="mt-3.5 space-y-2.5">
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

        <div className="mt-14 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-ink-mute">
            © {year} {SITE.brandName}
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] leading-[1.5]">
            {showsBbb && (
              <li>
                <a
                  href={BBB_PROFILE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={`${BASE} inline-flex items-center gap-1.5`}
                >
                  <MarkBbb className="h-3.5 w-3.5" style={{ color: 'var(--bbb-blue)' }} />
                  BBB Accredited
                </a>
              </li>
            )}
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
                  Client Sign In
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </footer>
  )
}
