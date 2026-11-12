import {
  CallToAction,
  CheckList,
  DeviceShowcase,
  FactList,
  Grid,
  LinkCard,
  PageIntro,
  Questions,
  Section,
  SectionHead,
  Steps,
  TextLink,
} from '@components/kit/Kit'
import { CARD, TYPE } from '@components/kit/styles'
import { CLIENT_PROJECTS } from '@data/portfolio'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

/** A list of ticks in one card, in two columns on a wide screen. */
export function CoverList({ items, className = '' }) {
  const half = Math.ceil(items.length / 2)
  return (
    <div
      className={`${CARD} grid gap-x-12 gap-y-3.5 p-6 sm:p-8 md:grid-cols-2 ${className}`.trim()}
    >
      <CheckList items={items.slice(0, half)} />
      <CheckList items={items.slice(half)} />
    </div>
  )
}

/** Short headed facts, a card each, as many across as there are. */
export function FactCards({ items }) {
  const cols = items.length >= 4 ? 4 : Math.max(items.length, 2)
  return (
    <Grid cols={cols}>
      {items.map(item => (
        <div key={item.title} className={`${CARD} p-6`}>
          <h3 className={TYPE.h3}>{item.title}</h3>
          <p className={`${TYPE.body} mt-2`}>{item.body}</p>
        </div>
      ))}
    </Grid>
  )
}

/**
 * A list of names - towns, products - set in columns inside one card. A name
 * can carry the vendor's own mark before it, and one that names a kind of
 * thing rather than a company is set quieter.
 *
 * @param {{ items: (string | { name: string, mark?: Function, quiet?: boolean })[] }} props
 */
export function NameList({ items, className = '' }) {
  return (
    <ul
      className={`${CARD} grid grid-cols-2 gap-x-6 gap-y-3.5 p-6 sm:grid-cols-3 sm:p-8 lg:grid-cols-5 ${className}`.trim()}
    >
      {items.map(item => {
        const { name, mark: Mark, quiet } = typeof item === 'string' ? { name: item } : item
        return (
          <li
            key={name}
            className={`flex items-center gap-2.5 text-[16px] leading-snug ${quiet ? 'text-ink-mute' : 'text-ink'}`}
          >
            {Mark && <Mark className="h-[18px] w-[18px] shrink-0 text-ink-soft" />}
            {name}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The answer to a question whose answer is a few headed facts: a sentence, if
 * there is one, then each fact under its own short heading.
 */
export function ItemAnswer({ lede, items }) {
  return (
    <>
      {lede && <p>{lede}</p>}
      {items.map(item => (
        <p key={item.title}>
          <span className="block font-medium text-ink">{item.title}</span>
          {item.body}
        </p>
      ))}
    </>
  )
}

/**
 * One client site that shows the work, on a laptop and a phone, with a line on
 * what it shows and the way to its case study.
 *
 * The site is looked up by the hostname the portfolio files it under, so a
 * client renamed there is renamed here. The subsidiary has no portfolio, and
 * the comparison folds at build time so the list never reaches its bundle.
 */
function Example({ example }) {
  const project = IS_SECOND_SITE
    ? null
    : CLIENT_PROJECTS.find(entry => entry.displayUrl === example.host)
  if (!project) return null
  return (
    <Section label={`Example: ${project.name}`}>
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div className="min-w-0">
          <h2 className={TYPE.h2}>{project.name}</h2>
          <p className={`${TYPE.body} mt-3`}>{example.line}</p>
          <div className="mt-6">
            {project.hasStudy ? (
              <TextLink to={`/portfolio/${project.slug}`} label="Read the Case Study" />
            ) : (
              <TextLink to="/portfolio" label="See All Work" />
            )}
          </div>
        </div>
        <DeviceShowcase project={project} />
      </div>
    </Section>
  )
}

/**
 * The page every service is drawn on.
 *
 * The point first: what it is, in a line, beside how long it takes and what it
 * costs. Then what the work covers, the one or two things the service needs
 * said beyond that, a client site that shows it, the questions that hold the
 * longer answers, three services next to it, and the ask.
 *
 * @param {object} props
 * @param {string} props.title - The headline, a short sentence.
 * @param {string} [props.lead] - The sentence under it.
 * @param {{ label: string, value: string }[]} [props.facts] - Beside the headline.
 * @param {(string | { title: string, body?: string })[]} props.covers - What the work includes.
 * @param {string} [props.coversTitle] - The heading over it.
 * @param {object[]} [props.sections] - `{ id, title, lede?, as?, items?, content? }`,
 *   drawn as cards, as numbered `steps`, or as the `content` given.
 * @param {{ host: string, line: string }} [props.example] - A client site that shows the work.
 * @param {{ q: string, a: import('react').ReactNode }[]} [props.questions]
 * @param {object[]} [props.related] - Service pages to point on to.
 * @param {string} [props.cta] - The closing panel's title.
 */
export default function ServiceLanding({
  title,
  lead,
  facts,
  covers,
  coversTitle = 'What you get',
  sections = [],
  example,
  questions = [],
  related = [],
  cta,
}) {
  return (
    <>
      <PageIntro
        title={title}
        lead={lead}
        media={
          facts?.length > 0 && <FactList items={facts} className="lg:ml-auto lg:max-w-[420px]" />
        }
      />

      <Section id="covers" label={coversTitle} className="!pt-4 sm:!pt-6">
        <SectionHead title={coversTitle} />
        <CoverList items={covers} />
      </Section>

      {sections.map(section => (
        <Section key={section.id} id={section.id} label={section.title}>
          <SectionHead title={section.title} />
          {section.content ??
            (section.as === 'steps' ? (
              <Steps items={section.items} />
            ) : (
              <FactCards items={section.items} />
            ))}
        </Section>
      ))}

      {example && <Example example={example} />}

      {questions.length > 0 && (
        <Section id="questions" label="Questions">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-14">
            <h2 className={TYPE.h2}>Questions</h2>
            <Questions items={questions} />
          </div>
        </Section>
      )}

      {related.length > 0 && (
        <Section label="More services">
          <SectionHead title="More services" link={{ to: '/services', label: 'All Services' }} />
          <Grid cols={related.length === 2 ? 2 : 3}>
            {related.map(page => (
              <LinkCard key={page.slug} to={page.path} title={page.name} body={page.summary} />
            ))}
          </Grid>
        </Section>
      )}

      <CallToAction title={cta} />
    </>
  )
}
