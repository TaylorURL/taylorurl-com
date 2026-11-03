import Seo from '@components/Seo'
import { CallToAction, Grid, LinkCard, PageIntro, Section, SectionHead } from '@components/kit/Kit'
import { TOOLS_INDEX } from '@data/pages/tools'
import { NAV_GROUPS } from '@constants/navigation'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'

const DESCRIPTION =
  'Free tools for running a business online: check what Google sees on your site, clear the background off a logo, and make a QR code. No account, no fee.'

// The speed check, as the navigation already names it. It is not in the tools
// registry because the registry decides which `/tools/` routes exist and this
// one lives at its own address, so its name and its line are read from the
// menu row rather than written a second time here.
const SPEED_CHECK = NAV_GROUPS.find(group => group.key === 'tools')?.columns[0].items.find(
  item => item.to === '/speed-check'
)

// The four cards, the speed check first: it is the one most people arrive for,
// and the one every other reading on the site is measured the same way as.
const CARDS = [
  SPEED_CHECK && { to: SPEED_CHECK.to, title: SPEED_CHECK.label, body: SPEED_CHECK.summary },
  ...TOOLS_INDEX.map(tool => ({ to: tool.path, title: tool.name, body: tool.summary })),
].filter(Boolean)

/**
 * The free tools.
 *
 * The point first - they are free, and nothing has to be signed up for - then
 * the four as cards, the one built to order as a link under them, and the ask.
 */
export default function Tools() {
  return (
    <div>
      <Seo
        title="Free Tools for Local Businesses"
        description={DESCRIPTION}
        path="/tools"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Tools', path: '/tools' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Free tools',
            url: `${SITE_URL}/tools`,
            description: DESCRIPTION,
            about: { '@id': BUSINESS_ID },
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: TOOLS_INDEX.map((tool, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: tool.name,
                url: `${SITE_URL}${tool.path}`,
              })),
            },
          },
        ]}
      />

      <PageIntro
        title="Run one, get your answer, leave."
        lead="No account, no fee, nothing to install."
        actions={false}
      />

      <Section label="The tools" className="!pt-0">
        <Grid cols={4}>
          {CARDS.map(card => (
            <LinkCard key={card.to} to={card.to} title={card.title} body={card.body} />
          ))}
        </Grid>
      </Section>

      <Section tight label="Built to order" className="!pt-0">
        <SectionHead
          title="When the free one is not the one you need."
          link={{ to: '/services/automation', label: 'What a Custom Tool Covers' }}
          className="!mb-0"
        />
      </Section>

      <CallToAction title="Tell me about your business." />
    </div>
  )
}
