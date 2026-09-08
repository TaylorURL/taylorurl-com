import { GROUND } from '../lib/ground'

/**
 * Who is on the other end, set between the question and the wall of trades it
 * is asked against.
 *
 * The configurator asks five questions of somebody who has been told nothing
 * about who the answers reach. This is the answer to the question they did not
 * get to ask, put where a byline goes: after the heading, before the work.
 *
 * The line above is what makes it belong on this step rather than on the about
 * page. A visitor who has just been told that everything after this is written
 * for the trade they pick has a fair question about who does the writing, and
 * the last step answers it four steps too late, once the message is already
 * typed. So it is answered here, where the first answer is given.
 *
 * It used to be answered with one person: a portrait hung off the left of this
 * column and a paragraph in his voice. That was true of the company once and is
 * not now, and a face on the first step of a form is a promise about who picks
 * the work up - the reader spends the next four questions addressing a person
 * rather than the team the answers actually reach. So the step names the team,
 * which is what is true and what the reader is owed before question two.
 *
 * It is not a card. The route is drawn in rules and hairlines and one flat mesh
 * of trades, and a bordered panel with a corner radius sitting on top of that
 * is the only object on the page that floats. So this is set the way the rest
 * of the page is set - a text column closed by the same hairline the step's own
 * heading closes with, and no label over it explaining what it is.
 */
export default function Introduction() {
  return (
    <div className={`flex flex-col gap-4 border-b pb-10 ${GROUND.rule}`}>
      <p className={`max-w-[54ch] text-[17px] leading-relaxed ${GROUND.title}`}>
        Your answers come to us, and we draw the first draft from them.
      </p>
      <p className={`max-w-[54ch] text-[15px] leading-relaxed ${GROUND.body}`}>
        TaylorURL is a small team of designers, developers and local-search specialists. The people
        who read this are the people who build the site, and one of them replies to you directly.
      </p>
    </div>
  )
}
