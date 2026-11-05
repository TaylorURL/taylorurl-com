import {
  CallToAction,
  CheckList,
  PageIntro,
  Section,
  SectionHead,
  StatPanel,
  Steps,
} from '@components/kit/Kit'
import { CARD, TYPE } from '@components/kit/styles'
import Seo from '@components/Seo'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { ABOUT } from '@data/pages/about'
import { BIO_NAME, BIO_TEXT, BIO_TITLE } from '@lib/mail/bio.js'
import { retryable } from '@utils/retryImage'

/** The widths the photograph is saved at in `public/images`. */
const PHOTO_WIDTHS = [360, 720, 1440]

/** A heading written as a first line and the rest of it, read as one sentence. */
const sentence = (...parts) => `${parts.join(' ').trim().replace(/\.$/, '')}.`

/** The values split across two columns, the longer half first. */
const VALUES = ABOUT.values.map(item => ({ title: item.title, body: item.description }))
const HALF = Math.ceil(VALUES.length / 2)

/**
 * The one face on the site, beside the page's headline, with who is in it
 * underneath.
 *
 * The photograph is of Trenton and his wife, Whitney, and the line under it
 * says so, so the frame shows the pair rather than being cut down to him: a
 * caption naming somebody the crop leaves out reads as a mistake. It is cut to
 * three by two about the middle, which keeps both faces and trims only the car
 * windows at either edge. It is above the fold, so it is fetched with the
 * document, and it is on the retry ladder because an `<img>` that fails never
 * asks again: an about page introducing a founder beside an empty box is worse
 * than one with no photograph at all.
 */
function Photo() {
  const { alt, caption } = ABOUT.photo ?? {}
  return (
    <figure>
      <img
        src={`/images/trenton-taylor-photo-${PHOTO_WIDTHS[1]}.webp`}
        srcSet={PHOTO_WIDTHS.map(
          width => `/images/trenton-taylor-photo-${width}.webp ${width}w`
        ).join(', ')}
        sizes="(min-width: 1024px) 600px, 100vw"
        alt={alt ?? BIO_NAME}
        width="1440"
        height="786"
        loading="eager"
        decoding="async"
        fetchPriority="high"
        className="block aspect-[3/2] h-auto w-full rounded-[16px] bg-[var(--card)] object-cover object-center"
        {...retryable()}
      />
      {caption && <figcaption className={`${TYPE.small} mt-3`}>{caption}</figcaption>}
    </figure>
  )
}

/**
 * The about page, for both sites.
 *
 * Who answers, in his own words and beside his photograph; then the story of
 * why the studio exists, who he is and where the work happens; the build as
 * four steps; and why owners stay, under the figures that back it up. Every
 * sentence is read from `@data/pages/about`, which holds one body of copy per
 * site, so the second site renders this same page with its own words.
 */
export default function About() {
  return (
    <>
      <Seo
        title={ABOUT.seo.title}
        description={ABOUT.seo.description}
        path="/about"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'About', path: '/about' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            url: `${SITE_URL}/about`,
            mainEntity: { '@id': BUSINESS_ID },
            about: {
              '@type': 'Person',
              '@id': `${SITE_URL}/#trenton`,
              name: 'Trenton Taylor',
              jobTitle: BIO_TITLE,
              worksFor: { '@id': BUSINESS_ID },
              url: `${SITE_URL}/about`,
            },
          },
        ]}
      />

      <PageIntro title={ABOUT.hero.title} lead={ABOUT.hero.description} media={<Photo />} />

      <Section label="My story" className="!pt-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16">
          <div className="max-w-[640px]">
            <h2 className={TYPE.h2}>{ABOUT.story.heading}</h2>
            <div className={`${TYPE.body} mt-5 space-y-4 text-[17px]`}>
              {ABOUT.story.paragraphs.map(paragraph => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>

          <aside className={`${CARD} self-start p-6 sm:p-8`}>
            <h3 className={TYPE.h3}>{BIO_NAME}</h3>
            <p className={`${TYPE.small} mt-0.5`}>{BIO_TITLE}</p>
            <p className={`${TYPE.body} mt-4`}>{BIO_TEXT}</p>
            <h3 className={`${TYPE.h3} mt-8`}>{ABOUT.place.label}</h3>
            <p className={`${TYPE.body} mt-2`}>{ABOUT.place.body}</p>
          </aside>
        </div>
      </Section>

      <Section label="How a project runs">
        <SectionHead
          title={sentence(ABOUT.processIntro.headingLine, ABOUT.processIntro.accentText)}
        />
        <Steps items={ABOUT.process.map(step => ({ title: step.title, body: step.description }))} />
      </Section>

      <Section label={sentence(ABOUT.work.headingLine, ABOUT.work.accentText)}>
        <SectionHead title={sentence(ABOUT.work.headingLine, ABOUT.work.accentText)} />
        <StatPanel items={ABOUT.stats} />
        <div className="mt-10 grid gap-x-12 gap-y-3.5 md:grid-cols-2">
          <CheckList items={VALUES.slice(0, HALF)} />
          <CheckList items={VALUES.slice(HALF)} />
        </div>
      </Section>

      <CallToAction title={sentence(ABOUT.closing.heading, ABOUT.closing.accentText)} />
    </>
  )
}
