import { DRAFTS, SEAMS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import { SITE } from '../../../lib/site/current.js'

/**
 * The shell the three standing documents are set in.
 *
 * These pages are read for a reason - somebody wants to know what they are
 * agreeing to, what is being collected about them, or what they own - and the
 * reason is never leisure. So this is set as a document rather than as a page
 * of marketing: a masthead stating what the document is and when it took
 * effect, a plain-English summary before the clauses, a contents list, and
 * numbered sections a reader can link somebody else straight to.
 *
 * Nothing here is revealed by script. Every one of these pages is written to
 * static HTML at build time, and the shell used to mount at zero opacity and
 * wait for a browser to fade it in, with its headline held behind an observer
 * and every clause behind another. A reader whose bundle was slow, blocked or
 * simply not running was shown a blank page and had to reload to read a term
 * they were being held to. A document that can only be read once JavaScript
 * has arrived is not a document; it is a picture of one. So the markup is the
 * whole of it, and the only motion on these pages is the one the stylesheet
 * carries for every page on the site.
 *
 * @param {object} props
 * @param {string} props.title - What the document is called.
 * @param {string} props.description - One line saying what it governs.
 * @param {string} [props.eyebrow] - The standing label over the masthead.
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

function clauseNumber(index) {
  return String(index + 1).padStart(2, '0')
}

// A clause is written as prose with blank lines in it, and blank lines in a
// template literal are paragraph breaks rather than decoration. They are set
// as paragraphs so the measure and the leading are the page's own, rather than
// held together in one block with the line breaks preserved.
function paragraphsOf(content) {
  return content
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
}

export default function LegalPage({
  title,
  description,
  eyebrow = 'Legal',
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
    number: clauseNumber(index),
  }))

  return (
    <article>
      {/* The masthead. A document says what it is, who issued it and when it
          took effect before it says anything else, because those three are
          what a reader has to have in order to know whether the rest of it
          applies to them. */}
      <header className="border-hair-paper relative overflow-hidden border-b bg-paper pb-14 pt-32 sm:pb-16 sm:pt-40">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.hatch} ${SEAMS.hero}`}
          aria-hidden="true"
        />
        <div className="container-rail relative">
          <div className="mx-auto max-w-[760px]">
            <p className="section-label text-accent">{eyebrow}</p>
            <h1 className="display-3 mt-4 font-semibold leading-[1.05] tracking-tightest text-ink-paper">
              {title}
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-paper-soft sm:text-[18px]">
              {description}
            </p>
            <dl className="border-hair-paper mt-10 grid gap-x-10 gap-y-6 border-t pt-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="section-label-sm text-paper-faint">Effective</dt>
                <dd className="mt-1.5 text-[14px] text-paper-soft">{effectiveDate}</dd>
              </div>
              <div>
                <dt className="section-label-sm text-paper-faint">Issued By</dt>
                <dd className="mt-1.5 text-[14px] text-paper-soft">
                  {SITE.brandName}
                  {SITE.location ? `, ${SITE.location}` : ''}
                </dd>
              </div>
              {appliesTo && (
                <div>
                  <dt className="section-label-sm text-paper-faint">Applies To</dt>
                  <dd className="mt-1.5 text-[14px] text-paper-soft">{appliesTo}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </header>

      <div className="section-y relative overflow-hidden bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.quiet}`}
          aria-hidden="true"
        />
        <div className="container-rail relative">
          <div className="mx-auto max-w-[760px]">
            {/* The document in a reader's own words, ahead of the document in
                its. It is a summary and says so: a reader who acts on it and
                is later held to something it left out has been misled by the
                page rather than by the clause. */}
            {summary && (
              <section aria-labelledby="in-short" className="panel-static bg-paper p-6 sm:p-8">
                <h2 id="in-short" className="section-label text-accent">
                  In Short
                </h2>
                <ul className="mt-4 space-y-3">
                  {summary.map(line => (
                    <li
                      key={line}
                      className="flex gap-3 text-[15px] leading-relaxed text-paper-soft"
                    >
                      <span aria-hidden="true" className="mt-[9px] h-px w-3 shrink-0 bg-accent" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <p className="border-hair-paper text-paper-faint mt-5 border-t pt-4 text-[13px] leading-relaxed">
                  This summary is written for speed and is not the agreement. The numbered sections
                  below are, and they govern wherever the two could be read differently.
                </p>
              </section>
            )}

            {introText && (
              <p className="mt-10 text-[17px] leading-relaxed text-paper-soft">{introText}</p>
            )}

            {children}

            {/* Every clause has an address, so a reader can send somebody the
                one line at issue rather than the whole document. */}
            <nav aria-label="Contents" className="border-hair-paper mt-12 border-t pt-8">
              <h2 className="section-label-sm text-paper-faint">Contents</h2>
              <ol className="mt-4 grid gap-x-10 gap-y-2.5 sm:grid-cols-2">
                {clauses.map(clause => (
                  <li key={clause.id} className="flex gap-3 text-[14px] leading-snug">
                    <span className="text-paper-faint shrink-0 tabular-nums">{clause.number}</span>
                    <a
                      href={`#${clause.id}`}
                      className="text-paper-soft underline decoration-[color:var(--paper-hairline)] underline-offset-4 transition-colors duration-200 hover:text-accent"
                    >
                      {clause.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="mt-14 space-y-12">
              {clauses.map(clause => (
                <section key={clause.id} id={clause.id} className="scroll-mt-28">
                  <div className="border-hair-paper flex items-baseline gap-4 border-b pb-3">
                    <span className="section-label tabular-nums text-accent">{clause.number}</span>
                    <h2 className="text-[20px] font-semibold tracking-tight text-ink-paper sm:text-[23px]">
                      {clause.title}
                    </h2>
                  </div>
                  {typeof clause.content === 'string' ? (
                    <div className="mt-4 space-y-4">
                      {paragraphsOf(clause.content).map(paragraph => (
                        <p key={paragraph} className="text-[16px] leading-relaxed text-paper-soft">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4">{clause.content}</div>
                  )}
                </section>
              ))}
            </div>

            {footer && (
              <div className="panel-static mt-16 bg-paper p-6 sm:p-8">
                <p className="section-label mb-3 text-accent">{footer.heading}</p>
                <p className="text-[15px] leading-relaxed text-paper-soft">{footer.body}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
