import { useState } from 'react'
import { Plus } from 'lucide-react'
import { GROUNDS } from '@constants/grounds'

/**
 * The questions, one open at a time.
 *
 * Every answer is in the document. Only the closed ones are marked `hidden`,
 * which takes them out of the reading order while leaving them in what a
 * crawler reads - and the same pairs are published as FAQ markup by the
 * page above, so a search result can carry an answer whether or not anybody
 * ever opens the row it sits in.
 *
 * Opening a row is what keeps the answers inside one screen. The mark turns
 * rather than swapping for a second glyph, so the control reads as one thing in
 * two states.
 *
 * @param {object} props
 * @param {{ q: string, a: string }[]} props.items - The questions, in order.
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground they sit on.
 */
export default function Questions({ items, ground = 'band' }) {
  const tone = GROUNDS[ground]
  const [open, setOpen] = useState(0)

  return (
    <div className={`border-t ${tone.rule}`}>
      {items.map((item, index) => {
        const shown = index === open
        return (
          <article key={item.q} className={`border-b ${tone.rule}`}>
            <h3>
              <button
                type="button"
                id={`question-${index}`}
                aria-expanded={shown}
                aria-controls={`answer-${index}`}
                onClick={() => setOpen(shown ? -1 : index)}
                className={`group flex w-full items-start gap-5 py-6 text-left transition-colors duration-200 ease-out-soft focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--accent)]`}
              >
                <span
                  className={`mt-1 shrink-0 font-mono text-[11px] tabular-nums tracking-tight transition-colors duration-200 ${
                    shown ? 'text-accent' : tone.meta
                  }`}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  className={`flex-1 text-[17px] font-medium tracking-tight transition-colors duration-200 sm:text-[19px] ${
                    shown ? 'text-accent' : tone.title
                  } group-hover:text-accent`}
                >
                  {item.q}
                </span>
                <Plus
                  aria-hidden="true"
                  className={`mt-0.5 h-5 w-5 shrink-0 transition-transform duration-200 ease-out-soft ${
                    shown ? 'rotate-45 text-accent' : tone.meta
                  }`}
                />
              </button>
            </h3>
            <div
              id={`answer-${index}`}
              role="region"
              aria-labelledby={`question-${index}`}
              hidden={!shown}
              className="animate-fade-in-up"
            >
              <p
                className={`max-w-3xl pb-7 pl-[2.4rem] text-[15px] leading-relaxed sm:text-[16px] ${tone.body}`}
              >
                {item.a}
              </p>
            </div>
          </article>
        )
      })}
    </div>
  )
}
