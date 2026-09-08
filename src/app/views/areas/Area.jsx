import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import PageHero from '@components/page-bands/PageHero'
import CtaSection from '@components/conversion/CtaSection'
import RuledSection from '@components/page-bands/RuledSection'
import Mesh from '@components/mesh/Mesh'
import TradeMesh from '@components/mesh/TradeMesh'
import WorkMesh from '@components/mesh/WorkMesh'
import Seo from '@components/Seo'
import NotFound from '@views/NotFound'
import { areaBySlug, workInTown } from '@data/towns-and-trades/areas'
import { LOCAL_PORTFOLIO } from '@data/portfolio'
import { TRADES } from '@data/towns-and-trades/trades'
import { SERVICE_LINES } from '@data/pages/services'
import { GROUNDS } from '@constants/grounds'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'

// How many client sites the work block holds before it stops reading as proof
// and starts reading as a directory.
const WORK_LIMIT = 3

// The four ways the work starts sit two to a row from the first breakpoint
// with room for the pair, and four divides that exactly. The local band names
// four things about a town, so it takes the same pair.
const PAIR_COLUMNS = { base: 1, sm: 2 }

// The bands alternate grounds down the page, so a town carrying a local band
// takes a different arrangement from a town without one and the closing panel
// follows whichever ground the last band left.
const groundAt = index => (index % 2 === 0 ? 'paper' : 'band')

/**
 * One town's page: the client work live there, what is true of the place, the
 * trades it most often calls for, and what a site includes.
 *
 * A town whose profile names a client leads with that work and carries a band
 * of its own; a town without one shows the nearest work and the copy every town
 * shares. A slug no town answers to renders the not-found state rather than a
 * page about nowhere.
 */
export default function Area() {
  const { slug } = useParams()
  const area = areaBySlug(slug)

  if (!area) return <NotFound />

  const profile = area.profile
  const local = workInTown(area.name)
  const work = (local.length ? local : LOCAL_PORTFOLIO).slice(0, WORK_LIMIT)
  const trades = area.trades.map(id => TRADES.find(trade => trade.id === id)).filter(Boolean)
  const description =
    profile?.search ||
    `Custom websites for small businesses in ${area.name}, Texas. Design, build, hosting, and getting found on Google, from a small team in Baytown.`

  const bands = profile ? ['work', 'notes', 'trades', 'services'] : ['work', 'trades', 'services']
  const groundFor = band => groundAt(bands.indexOf(band))
  const notesGround = groundFor('notes')
  const tradesGround = groundFor('trades')
  const servicesGround = groundFor('services')
  const notesTone = GROUNDS[notesGround]
  const servicesTone = GROUNDS[servicesGround]

  return (
    <div>
      <Seo
        title={`Web Design in ${area.name}, TX`}
        description={description}
        path={`/areas/${area.slug}`}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Service Areas', path: '/areas' },
            { name: area.name, path: `/areas/${area.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            serviceType: 'Web design',
            name: `Website design in ${area.name}, Texas`,
            description,
            url: `${SITE_URL}/areas/${area.slug}`,
            provider: { '@id': BUSINESS_ID },
            areaServed: {
              '@type': 'City',
              name: area.name,
              containedInPlace: { '@type': 'State', name: 'Texas' },
            },
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name: `Website services in ${area.name}`,
              itemListElement: SERVICE_LINES.map(line => ({
                '@type': 'Offer',
                itemOffered: { '@type': 'Service', name: line.name, description: line.summary },
              })),
            },
          },
        ]}
      />

      <PageHero
        draft="node"
        eyebrow={`Service Area · ${area.name}`}
        title={`Websites for ${area.name} businesses.`}
        description={
          profile?.lede ||
          `Custom sites for the shops, trades, restaurants, and independent pros working in ${area.name}, built and looked after by a small team.`
        }
      />

      <RuledSection
        id="area-work"
        ground={groundFor('work')}
        draft="iso"
        eyebrow="Live Work"
        title={
          profile?.work.title ||
          (local.length ? `Work already live in ${area.name}.` : 'Work already live nearby.')
        }
        description={
          profile?.work.description ||
          'Client sites running now, each one built, hosted, and looked after from Baytown.'
        }
        meta={local.length ? `${area.name}, Texas` : 'Southeast Texas'}
      >
        <WorkMesh projects={work} ground={groundFor('work')} />
      </RuledSection>

      {profile && (
        <RuledSection
          id="area-local"
          ground={notesGround}
          draft="ledger"
          eyebrow="On the Ground"
          title={`What decides the search in ${area.name}.`}
          description="Who is looking, what they type, and what a site has to do here to be the one they call."
          meta={`${area.name}, Texas`}
        >
          <Mesh items={profile.notes} ground={notesGround} columns={PAIR_COLUMNS}>
            {(note, index, cell) => (
              <div
                key={note.title}
                className={`flex h-full flex-col gap-4 p-6 ${cell} ${notesTone.surface}`}
              >
                <span className="section-label-sm text-accent">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className={`text-[19px] font-semibold leading-tight ${notesTone.title}`}>
                  {note.title}
                </h3>
                <p className={`text-[14px] leading-relaxed ${notesTone.body}`}>{note.body}</p>
              </div>
            )}
          </Mesh>
        </RuledSection>
      )}

      <RuledSection
        id="area-trades"
        ground={tradesGround}
        draft="plan"
        eyebrow="Trades"
        title={`Common work around ${area.name}.`}
        description="Each trade has a page of its own covering what the site has to do and the software it runs beside."
        meta={`${trades.length} trades`}
      >
        <TradeMesh trades={trades} ground={tradesGround} />
      </RuledSection>

      <RuledSection
        id="area-services"
        ground={servicesGround}
        draft="iso"
        eyebrow="What Gets Built"
        title="Four ways the work usually starts."
        description="A new site, a rebuild of the one you have, the tools that sit behind it, or looking after what is already running."
        meta="Baytown, Texas"
      >
        <Mesh items={SERVICE_LINES} ground={servicesGround} columns={PAIR_COLUMNS}>
          {(line, index, cell) => (
            <Link
              key={line.slug}
              to={`/services#${line.slug}`}
              className={`group flex h-full flex-col gap-4 p-6 transition duration-200 ease-out-soft focus-visible:-outline-offset-2 ${cell} ${servicesTone.surface} ${servicesTone.wash}`}
            >
              <span className="flex items-baseline justify-between gap-4">
                <span className="section-label-sm text-accent">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <ArrowUpRight
                  className={`h-4 w-4 ${servicesTone.meta} transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5`}
                  aria-hidden="true"
                />
              </span>
              <span className={`text-[19px] font-semibold leading-tight ${servicesTone.title}`}>
                {line.name}
              </span>
              <span className={`text-[14px] leading-relaxed ${servicesTone.body}`}>
                {line.summary}
              </span>
            </Link>
          )}
        </Mesh>
      </RuledSection>

      <CtaSection
        draft="column"
        ground={servicesGround === 'paper' ? 'dark' : 'paper'}
        eyebrow="Start"
        title={
          <>
            Start a site for <span className="text-accent">{area.name}</span>.
          </>
        }
        description={
          profile?.close ||
          `Tell us what your ${area.name} business needs and you get a plan and a price back. Most sites are live in two to four weeks.`
        }
      />
    </div>
  )
}
