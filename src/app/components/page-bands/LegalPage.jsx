import { CheckList, FactList, PageIntro, Prose, Section } from '@components/kit/Kit'
import { CARD, TYPE } from '@components/kit/styles'
import { SITE } from '../../../../lib/site/current.js'

/**
 * The shell the three standing documents are set in.
 *
 * These pages are read for a reason - somebody wants to know what they are
 * agreeing to, what is being collected about them, or what they own - and the
 * reason is never leisure. So this is set as a document rather than as a page
 * of marketing: what the document is and when it took effect, a plain-English
 * summary before the clauses, a contents list, and numbered sections a reader
 * can link somebody else straight to. There is no ask at the foot of it.
 *
 * Nothing here is revealed by script. Every one of these pages is written to
 * static HTML at build time, and a document that can only be read once
 * JavaScript has arrived is not a document; it is a picture of one.
 *
 * @param {object} props
 * @param {string} props.title - What the document is called.
 * @param {string} props.description - One line saying what it governs.
 * @param {string} props.effectiveDate - The day this version took effect.
 * @param {string} [props.appliesTo] - Who the document is addressed to.
 * @param {string[]} [props.summary] - The document in plain English, one line
 *   per point, set above the clauses. It summarises and never replaces them.
 * @param {string} [props.introText] - An opening paragraph before the clauses.
 * @param {Array<{title: string, content: string | React.ReactNode}>} props.sections -
 *   The clauses, in the order they are to be read.
 * @param {{heading: string, body: React.ReactNode}} [props.footer] - The card
 *   at the foot saying where to write about this document.
 * @param {React.ReactNode} [props.children] - Anything the page carries ahead
 *   of its clauses.
 */

// A clause's own address. Written from its heading so a section cannot be
// numbered into a link that changes the next time one is inserted above it.
function anchorFor(title) {
  return title
    .toLowerCase()
    .replace(/^\d+\.\s*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// A clause is written as prose with blank lines in it, and blank lines in a
// template literal are paragraph breaks rather than decoration. They are set
// as paragraphs so the measure and the leading are the page's own.
function paragraphsOf(content) {
  return content
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
}

export default function LegalPage({
  title,
  description,
  effectiveDate,
  appliesTo,
  summary,
  introText,
  sections,
  footer,
  children,
}) {
  const clauses = sections.map((section, index) => ({
    ...section,
    id: anchorFor(section.title),
    number: index + 1,
  }))

  // What a reader has to have to know whether the rest applies to them: when
  // it took effect, who issued it, and who it is addressed to.
  const facts = [
    { label: 'Effective', value: effectiveDate },
    {
      label: 'Issued by',
      value: `${SITE.brandName}${SITE.location ? `, ${SITE.location}` : ''}`,
    },
    appliesTo && { label: 'Applies to', value: appliesTo },
  ].filter(Boolean)

  return (
    <article>
      <PageIntro
        title={title}
        lead={description}
        actions={false}
        media={<FactList items={facts} className="lg:ml-auto lg:max-w-[420px]" />}
      />

      {/* The reading column is the narrow measure, centred in the page so the
          right of a wide screen is not left empty. */}
      <Section className="!pt-2" inner="[&>*]:mx-auto [&>*]:max-w-[720px]">
        {/* The document in a reader's own words, ahead of the document in
            its. It is a summary and says so: a reader who acts on it and is
            later held to something it left out has been misled by the page
            rather than by the clause. */}
        {summary && (
          <section aria-labelledby="in-short" className={`${CARD} p-6 sm:p-8`}>
            <h2 id="in-short" className={TYPE.h3}>
              In short
            </h2>
            <CheckList items={summary} className="mt-5" />
            <p className={`${TYPE.small} mt-6`}>
              This summary is written for speed and is not the agreement. The numbered sections
              below are, and they govern wherever the two could be read differently.
            </p>
          </section>
        )}

        {introText && (
          <Prose className="mt-10">
            <p>{introText}</p>
          </Prose>
        )}

        {children}

        {/* Every clause has an address, so a reader can send somebody the one
            line at issue rather than the whole document. */}
        <nav aria-label="Contents" className="mt-12">
          <h2 className={TYPE.h3}>Contents</h2>
          <ol className="mt-4 grid gap-x-10 gap-y-2.5 sm:grid-cols-2">
            {clauses.map(clause => (
              <li key={clause.id} className="flex gap-3 text-[15px] leading-snug">
                <span className="w-5 shrink-0 tabular-nums text-ink-mute">{clause.number}</span>
                <a
                  href={`#${clause.id}`}
                  className="text-[color:var(--link)] transition-colors duration-150 hover:text-ink"
                >
                  {clause.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Prose className="mt-4">
          {clauses.map(clause => (
            <section key={clause.id} id={clause.id} className="scroll-mt-28">
              <h2>
                <span className="mr-3 tabular-nums text-ink-mute">{clause.number}</span>
                {clause.title}
              </h2>
              {typeof clause.content === 'string'
                ? paragraphsOf(clause.content).map(paragraph => <p key={paragraph}>{paragraph}</p>)
                : clause.content}
            </section>
          ))}
        </Prose>

        {footer && (
          <div className={`${CARD} mt-16 p-6 sm:p-8`}>
            <h2 className={TYPE.h3}>{footer.heading}</h2>
            <p className={`${TYPE.body} mt-2`}>{footer.body}</p>
          </div>
        )}
      </Section>
    </article>
  )
}
