import { CheckList } from '@components/kit/Kit'
import { CARD, TYPE } from '@components/kit/styles'
import { leadOf } from './boardData'

/**
 * A change asked for by text and done the same morning, drawn as the thread
 * it happened in. It is the shortest way to say what working with a one-person
 * studio is like.
 */
export function TextThread() {
  return (
    <figure className={`${CARD} flex h-full flex-col gap-3 p-6 sm:p-8`}>
      <figcaption className={TYPE.h3}>Changes, the same day</figcaption>
      <p className={`${TYPE.small} -mt-1 mb-2`}>Text me what needs to change.</p>
      <p className="mr-10 rounded-[16px] rounded-bl-[6px] bg-white/[0.07] px-4 py-3 text-[15px] leading-[1.5] text-ink">
        Closing at 3 on Friday for the holiday. Can you put that on the site?
      </p>
      <p className="ml-10 rounded-[16px] rounded-br-[6px] bg-[var(--blue)] px-4 py-3 text-[15px] leading-[1.5] text-white">
        Done. It’s on the home page, and your Google hours match.
      </p>
      <p className={`${TYPE.small} mt-auto pt-2 text-right`}>Tue 9:12 AM · Read 9:26 AM</p>
    </figure>
  )
}

/** What one monthly price covers, as a short list in a card. */
export function Monthly({ items }) {
  return (
    <div className={`${CARD} h-full p-6 sm:p-8`}>
      <h3 className={TYPE.h3}>One monthly price covers it</h3>
      <p className={`${TYPE.small} mb-6 mt-1`}>No surprise bills after launch.</p>
      <CheckList items={items} />
    </div>
  )
}

/**
 * A review, quoted as its first sentences, with who wrote it and where. A
 * network that rates out of five gets its score; one that only recommends says
 * so. The score is always the review's own.
 */
export function Quote({ review, sentences = 1, className = '' }) {
  const lead = leadOf(review.quote, sentences)
  return (
    <figure className={className}>
      <blockquote className="max-w-[30ch] text-[26px] font-medium leading-[1.3] tracking-[-0.02em] text-ink [text-wrap:pretty] sm:text-[32px]">
        “{lead}”
      </blockquote>
      <figcaption className={`${TYPE.small} mt-5`}>
        {review.name}, {review.business} ·{' '}
        {review.rating
          ? `${review.rating}/5 on ${review.network}`
          : `Recommends on ${review.network}`}
      </figcaption>
    </figure>
  )
}
