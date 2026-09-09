import { Link } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react'
import { MarkBbb, MarkFacebook, MarkInstagram, MarkTrustpilot } from '@components/marks/brandMarks'
import { TRUSTPILOT_PROFILE_URL } from '@data/reputation/trustpilot'
import { BBB_PROFILE_URL } from '@data/reputation/bbb'
import {
  COMPANY_LOCATION,
  COMPANY_MAILING_ADDRESS,
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
 * How many tracks the directory needs: one for every column, and a second for a
 * column long enough to split.
 *
 * Counted off the lists rather than written into the grid, because a number
 * here is a number that stops matching the day a page is added to
 * `@constants/navigation` — the one edit these columns are built to absorb.
 */
const DIRECTORY_TRACKS = DIRECTORY.reduce(
  (tracks, column) => tracks + (column.items.length > SPLIT_AT ? 2 : 1),
  0
)

/**
 * What a split column does with the second track it is given: fills the two
 * down rather than across.
 *
 * A reader scanning a sitemap reads one column to the bottom and then starts
 * the next, and row flow put the second entry at the top of the second half.
 */
const SPLIT_COLUMN = 'sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-[repeat(var(--rows),auto)]'

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
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <m.div {...fadeInUp} className="container-rail relative pb-10 pt-16 sm:pt-20">
        {/*
          The masthead: who this is on the left, and everything a reader came
          down here to click on the right.

          Two blocks rather than one row of columns, because the two answer to
          different measures. The brand runs as long as the address and the
          marks make it; the directory is a set of equal tracks that has to
          divide evenly and end on the rail. Laid out as one grid they fought:
          the columns were hand-picked fractions, the widest of them held a
          single row, the directory stopped two hundred pixels short of the
          right edge, and the call to action — a fifth child of a four-track
          grid — wrapped under the brand with the whole width of the directory
          sitting empty beside it.
        */}
        <div className="border-hair grid gap-x-8 gap-y-12 border-b pb-12 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,4fr)] xl:gap-x-10">
          <div className="max-w-sm lg:max-w-none">
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
              {/* A site that claims no area draws no row for one. The pin
                  was rendered whatever the record held, so the second site,
                  which is run from nowhere it names, opened a 44px row on an
                  icon with nothing beside it. */}
              {COMPANY_LOCATION ? (
                <div className={CONTACT_ROW}>
                  <MapPin className="h-4 w-4 flex-shrink-0 text-accent" strokeWidth={1.5} />
                  <span>{COMPANY_LOCATION}</span>
                </div>
              ) : null}
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

          {/*
            The directory. Equal tracks carrying the one gap, so every column
            line falls on the same rhythm, a row in one column sits level with
            the row beside it, and the last column ends on the rail. One track
            on a phone, two from `sm`, and one per directory column from `lg`,
            so a long column has its second track from the step there are two
            to give.

            `content-start` because the tracks are as tall as the longest of
            them and the short ones would otherwise stretch their rows apart to
            match.
          */}
          <div
            style={{ '--dir-tracks': DIRECTORY_TRACKS }}
            className="grid content-start gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-[repeat(var(--dir-tracks),minmax(0,1fr))] xl:gap-x-10"
          >
            {DIRECTORY.map(column => {
              // A column past the split takes two tracks and the gap between
              // them is the grid's own, so its halves land on the same lines its
              // neighbours are ruled by rather than a tighter set of their own.
              const split = column.items.length > SPLIT_AT
              return (
                <nav
                  key={column.head}
                  aria-label={column.head}
                  className={split ? 'sm:col-span-2' : undefined}
                  style={split ? { '--rows': Math.ceil(column.items.length / 2) } : undefined}
                >
                  <p className="section-label-sm mb-4 text-ink-faint">{column.head}</p>
                  <ul className={`grid gap-x-8 gap-y-2 xl:gap-x-10 ${split ? SPLIT_COLUMN : ''}`}>
                    {column.items.map(item => {
                      // A row naming the other site is an anchor: two origins,
                      // and the router cannot reach across. Same tab, same
                      // furniture — it is the same company one door along, not
                      // somewhere else.
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
              )
            })}

            {/*
              The one thing a reader came down here to do, on the line under
              the columns it belongs to rather than in a column of its own. It
              runs the width of the directory with the button on the rail, so
              the corner the short columns leave open is the corner it fills.
            */}
            <div className="border-hair col-span-full flex flex-col gap-5 border-t pt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
              <div>
                <p className="section-label-sm mb-2 text-ink-faint">Hire Us</p>
                {/* "A plan and a price" is what a website quote is. This site
                    quotes work whose shape has to be agreed before it can be
                    priced, and says "scope" for that everywhere else it speaks. */}
                <p className="max-w-xs text-[13px] leading-relaxed text-ink-mute">
                  {IS_SECOND_SITE
                    ? 'Tell us what you need. A scope and a price come back at no charge.'
                    : 'Tell us what you need. A plan and a price come back at no charge.'}
                </p>
              </div>
              <Magnet padding={50} magnetStrength={6}>
                <Link to={START_LINK.to} className="btn btn-secondary group">
                  {START_LINK.label}
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 ease-out-soft group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </Magnet>
            </div>
          </div>
        </div>

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

        {/*
          The mail box, on the last line of the page.

          It sits under the legal bar rather than inside it because it answers a
          different question from everything on that row. The copyright names
          who the site belongs to and the town names where the work comes from;
          this is the address the company is written to, and a reader looking
          for it is looking for the bottom of the page.

          `address` rather than a paragraph, and not italic, because the element
          is what the line is: the contact address for the document above it.
        */}
        {COMPANY_MAILING_ADDRESS ? (
          <address className="mt-6 text-[13px] not-italic leading-relaxed text-ink-faint">
            {COMPANY_MAILING_ADDRESS}
          </address>
        ) : null}
      </m.div>
    </footer>
  )
}
