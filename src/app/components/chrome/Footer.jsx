import { DRAFTS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import { Link } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react'
import { MarkBbb, MarkFacebook, MarkInstagram, MarkTrustpilot } from '@components/marks/brandMarks'
import { TRUSTPILOT_PROFILE_URL } from '@data/reputation/trustpilot'
import { BBB_PROFILE_URL } from '@data/reputation/bbb'
import {
  COMPANY_LOCATION,
  COMPANY_PHONE,
  COMPANY_PHONE_HREF,
  FACEBOOK_URL,
  INSTAGRAM_URL,
  LEGAL_LINKS,
  PRIMARY_LINKS,
  SIBLING_LINKS,
  START_LINK,
  SUPPORT_EMAIL,
  serves,
} from '@constants/navigation'
import { fadeInUp } from '@constants/animations'
import { SERVICE_TOWNS } from '@data/towns-and-trades/serviceTowns'
import BbbSeal from '@components/reviews/BbbSeal'
import NewsletterSignup from '@components/conversion/NewsletterSignup'
import ThemePicker from '@components/navigation/ThemePicker'
import Magnet from '@reactbits/Magnet/Magnet'
import ShinyText from '@reactbits/ShinyText/ShinyText'
import { dayIn } from '@lib/time/zone.js'
import { IS_SECOND_SITE, PUBLISHES_REVIEWS, SITE } from '../../../../lib/site/current.js'

/**
 * The headed lists the directory draws, built from the same data the rest of
 * the site navigates by.
 *
 * System Status is folded into Legal here rather than written as a row of its
 * own, because a column that is half data and half hand-written markup is a
 * column where the two halves drift apart. Every entry now takes the same
 * shape, so adding a page is a line in `@constants/navigation` and nothing
 * here has to move.
 */
const STATUS_LINK = { to: '/console/status', label: 'System Status' }

const DIRECTORY = [
  { head: 'Pages', items: PRIMARY_LINKS },
  // The status board is a console route, and the second site has no console.
  // Asked of the route table rather than written out, for the reason the note
  // above `serves` in `@constants/navigation` gives.
  { head: 'Legal', items: serves(STATUS_LINK.to) ? [...LEGAL_LINKS, STATUS_LINK] : LEGAL_LINKS },
  // The other site. One company runs both, and until now neither said so
  // anywhere a reader could click: the only trace of taylor.website on
  // taylorurl.com was a build constant, and the only trace of taylorurl.com on
  // taylor.website was an unlinked sentence in a privacy clause and a mailto.
  //
  // The head is what it is rather than the sibling's name, because the column is
  // the claim: these are ours too.
  { head: 'Also Ours', items: SIBLING_LINKS },
]

/**
 * The length at which a column stops running down the page and splits in two.
 *
 * The sitemap is fourteen entries and growing, and a footer that answers a new
 * page by getting taller is a footer that eventually costs more screen than the
 * page above it. Past this count the column widens instead.
 */
const SPLIT_AT = 6

/**
 * Everywhere this business can be found off its own site, as a row of marks.
 *
 * Two kinds of address sit in the one row on purpose. Facebook, Trustpilot and
 * BBB are where the work is vouched for by somebody else; Instagram is where it
 * is posted as it happens. A reader who came down here to check a company and
 * one who came down here to follow it are looking in the same place, and
 * splitting the row into two would make each of them read both.
 *
 * An entry with no address is dropped rather than drawn, which is the rule the
 * menu and the reviews already answer to: BBB is off the row for exactly as
 * long as `@data/bbb` publishes no profile, and back on it the day it does,
 * with nothing here to change. The same one line adds Google or Yelp.
 *
 * Marks rather than named rows, because five networks written out is five rows
 * of a column that is already the tallest thing down here, and the row says the
 * one thing the names do not: that this business is spread across places this
 * site does not own.
 */
// The Trustpilot profile and the BBB listing are the studio's standing, earned
// under its name, so a site that publishes no reviews does not show them. Built
// inside the branch rather than filtered afterwards: a filter still names the two
// entries, and naming them is what carries their URLs and their marks into the
// other site's bundle. The social profiles are the company's own and belong on
// either of its sites.
const LISTINGS = (
  PUBLISHES_REVIEWS
    ? [
        { key: 'facebook', href: FACEBOOK_URL, label: 'Facebook', Mark: MarkFacebook },
        { key: 'instagram', href: INSTAGRAM_URL, label: 'Instagram', Mark: MarkInstagram },
        {
          key: 'trustpilot',
          href: TRUSTPILOT_PROFILE_URL,
          label: 'Trustpilot',
          Mark: MarkTrustpilot,
        },
        { key: 'bbb', href: BBB_PROFILE_URL, label: 'BBB Business Profile', Mark: MarkBbb },
      ]
    : [
        { key: 'facebook', href: FACEBOOK_URL, label: 'Facebook', Mark: MarkFacebook },
        { key: 'instagram', href: INSTAGRAM_URL, label: 'Instagram', Mark: MarkInstagram },
      ]
).filter(listing => listing.href)

// One row of the directory, and one row of the contact block. Both are drawn
// several times and both carry a 44px target inside a 20px line, so the class
// is named once rather than copied down the file.
const DIRECTORY_LINK =
  'group -my-3 inline-flex min-h-[44px] items-center gap-1.5 py-3 text-[14px] text-ink-soft transition-colors hover:text-ink'

const CONTACT_ROW =
  '-my-3 flex min-h-[44px] items-center gap-3 py-3 text-[13px] text-ink-mute transition-colors hover:text-accent'

export default function Footer() {
  // The studio's year rather than the reader's. East of Texas the two differ
  // for the last hours of December, and the line this sits on names a company
  // that is still in the old one.
  const currentYear = Number(dayIn().slice(0, 4))

  // The foot of every page stands on the ground the setting chose rather than
  // on a slab of its own. It names no ground, so --bg, --ink and the hairlines
  // resolve against the document: every role below follows light and dark
  // without either palette being restated here.
  //
  // A slab would pin the one surface the setting has to be legible on. The
  // control that changes the setting lives down here, and a slab holds its own
  // palette against whatever the reader presses — on a phone, where the foot of
  // the page is the whole screen, that is a press with nothing to show for it.
  return (
    <footer className="border-hair relative overflow-hidden border-t bg-bg text-ink">
      {/* The colophon is the same object on every page, so it is the one band
          that does not take the page's module. It holds a fixed station field
          at a fixed pitch, which is what stops a closing call butting an
          identical grid straight into it - the site's most repeated seam. */}
      <div
        className={`absolute inset-0 ${GROUNDS.dark.grid} ${DRAFTS.node}`}
        style={{ '--sig-tile': '128px' }}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <m.div {...fadeInUp} className="container-rail relative pb-10 pt-16 sm:pt-20">
        {/*
          The masthead: who this is, where the rest of the site is, and the one
          thing a reader came down here to do. Four tracks at full width and two
          below it, with the brand and the button each taking the whole row on a
          narrow screen — a name and a call to action are the two things that
          read badly in half a column.
        */}
        <div className="border-hair grid gap-x-8 gap-y-12 border-b pb-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.3fr)_minmax(0,0.62fr)_minmax(0,1.15fr)] lg:gap-x-12">
          <div className="max-w-sm sm:col-span-2 lg:col-span-1">
            {/*
              The wordmark through a window, the way the bar already reads it.
              The file is a 384-unit square carrying 328x98 of lettering in the
              middle of it, so a surface that draws the whole square spends
              three quarters of its height on nothing: the foot of the page was
              holding a 144px box open for a 37px name. The zoom and the offset
              are what put the lettering in the window and the empty bands
              outside it.
            */}
            <Link
              to="/"
              className="footer-mark relative block overflow-hidden opacity-100 transition-opacity duration-200 hover:opacity-80"
            >
              <img
                src="/images/TaylorURL-Logo.webp"
                alt={SITE.logoAlt}
                width="384"
                height="384"
                loading="lazy"
                decoding="async"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[300%] w-auto max-w-none select-none"
                style={{
                  transform: 'translate(-50%, -53.5%)',
                  filter: 'brightness(0) invert(var(--mark-invert))',
                }}
                draggable={false}
              />
            </Link>
            <p className="mt-6 text-[14px] leading-relaxed text-ink-soft">{SITE.footerBlurb}</p>
            <div className="mt-6 space-y-1">
              <div className={CONTACT_ROW}>
                <MapPin className="h-4 w-4 flex-shrink-0 text-accent" strokeWidth={1.5} />
                <span>{COMPANY_LOCATION}</span>
              </div>
              <a href={COMPANY_PHONE_HREF} className={CONTACT_ROW}>
                <Phone className="h-4 w-4 flex-shrink-0 text-accent" strokeWidth={1.5} />
                <span>{COMPANY_PHONE}</span>
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className={CONTACT_ROW}>
                <Mail className="h-4 w-4 flex-shrink-0 text-accent" strokeWidth={1.5} />
                <span>{SUPPORT_EMAIL}</span>
              </a>
            </div>
            {LISTINGS.length > 0 && (
              <ul className="mt-5 flex flex-wrap items-center gap-2">
                {LISTINGS.map(listing => (
                  <li key={listing.key}>
                    <a
                      href={listing.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={listing.label}
                      title={listing.label}
                      className="border-hair inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-control)] border text-ink-mute transition-colors duration-200 hover:border-accent/40 hover:text-accent"
                    >
                      <listing.Mark className="h-[18px] w-[18px]" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {DIRECTORY.map(column => (
            <nav key={column.head} aria-label={column.head}>
              <p className="section-label-sm mb-4 text-ink-faint">{column.head}</p>
              <ul
                className={`grid gap-x-6 gap-y-2 ${
                  column.items.length > SPLIT_AT ? 'grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {column.items.map(item => {
                  // A row naming the other site is an anchor: two origins, and
                  // the router cannot reach across. Same tab, same furniture —
                  // it is the same company one door along, not somewhere else.
                  const Row = item.href ? 'a' : Link
                  const link = item.href ? { href: item.href } : { to: item.to }
                  return (
                    <li key={item.to ?? item.href}>
                      <Row {...link} className={DIRECTORY_LINK}>
                        {item.label}
                        <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Row>
                    </li>
                  )
                })}
              </ul>
            </nav>
          ))}

          <div className="sm:col-span-2 lg:col-span-1">
            <p className="section-label-sm mb-4 text-ink-faint">Hire Me</p>
            <Magnet padding={50} magnetStrength={6}>
              <Link to={START_LINK.to} className="btn btn-secondary group">
                {START_LINK.label}
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 ease-out-soft group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </Magnet>
            {/* "A plan and a price" is what a website quote is. This site
                quotes work whose shape has to be agreed before it can be
                priced, and says "scope" for that everywhere else it speaks. */}
            <p className="mt-4 text-[13px] leading-relaxed text-ink-mute">
              {IS_SECOND_SITE
                ? 'Tell me what you need. A scope and a price come back at no charge.'
                : 'Tell me what you need. A plan and a price come back at no charge.'}
            </p>
          </div>
        </div>

        {/*
          The list, on the bar's own ground rather than a sheet set into it. A
          card pinned to one palette is the one thing down here that would not
          follow the setting the control beside it changes.
        */}
        {/*
          The list belongs to the site that writes the articles. It is the
          studio's newsletter, about getting found on Google and turning
          visitors into customers, and the address it collects goes onto the
          studio's audience - so a second domain standing this up is collecting
          for a list whose subject it does not write about and whose readers
          never asked that site for anything. Gated on the same flag as the
          feed, because they are the same publication.
        */}
        {SITE.blog ? (
          <div className="border-hair border-b py-10">
            <NewsletterSignup source="taylorurl-footer" compact />
          </div>
        ) : null}

        {/*
          The service area, rendered twice. Interpuncts and a wrapped run of
          names read as punctuation noise aloud, so the display list is hidden
          from assistive technology and the sr-only sentence carries the same
          cities as one readable line.
        */}
        {SITE.localSeo ? (
          <div className="py-10">
            <p className="section-label-sm mb-3 text-ink-faint">Working with businesses in</p>
            <div
              aria-hidden="true"
              className="text-ink-ghost watermark-set select-none whitespace-pre-wrap font-semibold leading-[0.95] tracking-tightest"
            >
              {SERVICE_TOWNS.map((c, i) => (
                <span key={c}>
                  {c}
                  {i < SERVICE_TOWNS.length - 1 && <span className="text-accent"> · </span>}
                </span>
              ))}
            </div>
            <p className="sr-only">Serving {SERVICE_TOWNS.join(', ')}.</p>
          </div>
        ) : null}

        {/*
          The legal bar. The seal, where there is one, stands with the company
          name rather than up in a column of links: it is a statement about who
          this business is, which is the question the line beside it answers.
          `@components/BbbSeal` holds what the artwork is owed.
        */}
        <div className="border-hair flex flex-col gap-5 border-t pt-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-4 text-[13px] text-ink-faint">
            <span>
              © {currentYear} {SITE.brandName}
            </span>
            {SITE.locationShort ? (
              <>
                <span className="hidden sm:inline">·</span>
                <span>{SITE.locationShort}</span>
              </>
            ) : null}
            {PUBLISHES_REVIEWS ? <BbbSeal /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
            <ThemePicker />
            {serves(STATUS_LINK.to) ? (
              <Link
                to={STATUS_LINK.to}
                className="group -my-4 inline-flex min-h-[44px] items-center gap-2.5 py-4 text-[13px] font-medium text-ink-mute transition-colors hover:text-ink"
              >
                <span className="h-2 w-2 flex-shrink-0 rounded bg-accent" />
                <ShinyText
                  text="Check Site Status"
                  color="var(--ink-mute)"
                  shineColor="var(--shine-sweep)"
                  speed={4}
                />
              </Link>
            ) : null}
          </div>
        </div>
      </m.div>
    </footer>
  )
}
