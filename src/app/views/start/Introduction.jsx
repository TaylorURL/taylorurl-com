import { BIO_NAME, BIO_TEXT, BIO_TITLE } from '@lib/mail/bio.js'
import { GROUND } from './lib/ground'

/**
 * Who is on the other end, set between the question and the wall of trades it
 * is asked against.
 *
 * The configurator asks five questions of somebody who has been told nothing
 * about the person the answers reach. This is the answer to the question they
 * did not get to ask, put where a byline goes: after the heading, before the
 * work.
 *
 * The line above the bio is what makes the bio belong on this step rather than
 * on the about page. A visitor who has just been told that everything after
 * this is written for the trade they pick has a fair question about who does
 * the writing, and the last step answers it four steps too late, once the
 * message is already typed. So it is answered here, where the first answer is
 * given, and the bio underneath is then read as the person the sentence names
 * rather than as a paragraph about somebody.
 *
 * It is not a card. The route is drawn in rules and hairlines and one flat mesh
 * of trades, and a bordered panel with a corner radius sitting on top of that
 * is the only object on the page that floats. So this is set the way the rest
 * of the page is set - a portrait hung off the left of a text column, the whole
 * thing closed by the same hairline the step's own heading closes with, and no
 * label over it explaining what it is.
 *
 * The bio itself is the studio's one bio, drawn from the module the mail and the
 * home and contact pages all read, so the sentences here cannot drift from the
 * sentences a reply arrives with.
 */
export default function Introduction() {
  return (
    <div className={`flex flex-col gap-6 border-b pb-10 sm:flex-row sm:gap-8 ${GROUND.rule}`}>
      <img
        src="/images/trenton-taylor.webp"
        srcSet="/images/trenton-taylor.webp 1x, /images/trenton-taylor@2x.webp 2x"
        alt=""
        width="80"
        height="80"
        decoding="async"
        className="border-hair-paper-strong h-20 w-20 shrink-0 rounded-[var(--r-control)] border object-cover"
      />
      <div className="max-w-[54ch]">
        <p className={`text-[15px] font-semibold leading-snug ${GROUND.title}`}>
          {BIO_NAME} <span className={`font-normal ${GROUND.meta}`}>· {BIO_TITLE}</span>
        </p>
        <p className={`mt-4 text-[17px] leading-relaxed ${GROUND.title}`}>
          Your answers come to me, and I draw the first draft from them.
        </p>
        <p className={`mt-3 text-[15px] leading-relaxed ${GROUND.body}`}>{BIO_TEXT}</p>
      </div>
    </div>
  )
}
