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

// whatsapp.com's footer links: 16/22 on a phone and 18/25 on a wide screen,
// with the same growing underline the bar's links have.
const ITEM = 'wa-foot-link text-[16px] leading-[22px] text-ink lg:text-[18px] lg:leading-[25px]'
const BASE = 'text-[12px] text-ink transition-colors hover:text-[color:var(--blue-hi)]'

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
    <ul className={`flex gap-3 ${className}`.trim()} aria-label="Follow along">
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
              className="wa-social"
            >
              <Mark className="h-[17px] w-[17px]" />
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The foot of every page, after whatsapp.com's: a dark slab with the wordmark
 * at the left and every page on the site in four columns under small headings,
 * then a hairline, and under it the year, the legal links, the social icons in
 * outlined circles and the phone number.
 *
 * It is the directory the bar is not. The bar names the main pages; this names
 * all of them, so a reader who scrolls to the bottom looking for the FAQ or the
 * speed check finds it where a footer is expected to have it.
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
    <footer data-wa-footer>
      <div className="mx-auto w-full max-w-[1128px] px-6 pb-11 pt-14 lg:pt-[96px]">
        <div className="grid gap-14 lg:grid-cols-[277px_minmax(0,1fr)] lg:gap-0">
          <div className="max-w-[240px]">
            <Link to="/" aria-label="Home" className="inline-block rounded-md">
              <Logo />
            </Link>
            <p className={`${TYPE.small} mt-6`}>{SITE.footerBlurb}</p>
            <ul className="mt-6 space-y-2 text-[15px]">
              <li>
                <a
                  href={COMPANY_PHONE_HREF}
                  className="font-medium text-ink hover:text-[color:var(--blue-hi)]"
                >
                  {COMPANY_PHONE}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-ink-soft hover:text-[color:var(--blue-hi)]"
                >
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li className="text-ink-mute">{COMPANY_LOCATION}</li>
            </ul>
          </div>

          <nav
            aria-label="Every page"
            className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-4 lg:gap-x-8"
          >
            {FOOTER_COLUMNS.map(column => (
              <div key={column.head}>
                <p className="text-[12px] text-ink-mute">{column.head}</p>
                <ul className="mt-[34px] space-y-4 lg:space-y-[18px]">
                  {column.items.map(item => (
                    <li key={item.to}>
                      <Link to={item.to} className={ITEM}>
                        <span className="wa-u">{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-8 border-t border-white/[0.14] pt-8 lg:mt-[72px] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-10">
            <p className="text-[12px] text-ink">
              {year} © {SITE.brandName}
            </p>
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 leading-[1.5]">
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
          <div className="flex items-center gap-6">
            <SocialIcons />
            <a
              href={COMPANY_PHONE_HREF}
              className="text-[15px] font-medium text-ink hover:text-[color:var(--blue-hi)]"
            >
              {COMPANY_PHONE}
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
