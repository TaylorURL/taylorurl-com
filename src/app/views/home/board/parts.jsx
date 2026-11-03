import { Kicker, SquareList } from '@components/kit/Kit'
import { TYPE } from '@components/kit/styles'
import { leadOf } from './boardData'

/**
 * The three steps from first call to launch, each under a heavy rule with its
 * number in blue. Read across on a wide screen, down on a phone.
 */
export function Steps({ steps }) {
  return (
    <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
      {steps.map((step, index) => (
        <li key={step.title} className="border-t-2 border-ink pt-6">
          <span className={`${TYPE.mono} text-[color:var(--signal)]`}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className={`${TYPE.h3} mt-4`}>{step.title}</h3>
          <p className={`${TYPE.body} mt-3`}>{step.body}</p>
        </li>
      ))}
    </ol>
  )
}

/**
 * A change asked for by text and done the same morning, drawn as the thread
 * it happened in. It is the shortest way to say what working with a one-person
 * studio is like.
 */
export function TextThread() {
  return (
    <figure className="flex h-full flex-col gap-4 bg-[var(--night)] p-7 text-[color:var(--light)] sm:p-9">
      <Kicker tone="night" as="figcaption">
        Changes, same day
      </Kicker>
      <p className="mr-10 border border-[var(--night-line)] bg-[var(--night-2)] px-5 py-4 text-[17px] leading-[1.5]">
        Closing at 3 on Friday for the holiday. Can you put that on the site?
      </p>
      <p className="ml-10 bg-[var(--signal)] px-5 py-4 text-[17px] leading-[1.5] text-white">
        Done. It’s on the home page, and your Google hours match.
      </p>
      <Kicker tone="night" className="mt-auto pt-2">
        Tue 9:12 AM → Read 9:26 AM
      </Kicker>
    </figure>
  )
}

/** What one monthly price covers, as a short list on paper. */
export function Monthly({ items }) {
  return (
    <div className="flex h-full flex-col gap-6 border border-[var(--line)] bg-white p-7 sm:p-9">
      <Kicker>One monthly price</Kicker>
      <p className="text-[30px] font-semibold leading-[1.12] tracking-[-0.03em] text-ink sm:text-[34px]">
        Hosting, care and changes. All of it.
      </p>
      <SquareList items={items} />
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
      <blockquote className="max-w-[24ch] text-[32px] font-medium leading-[1.15] tracking-[-0.03em] text-ink sm:text-[44px] [text-wrap:pretty]">
        “{lead}”
      </blockquote>
      <figcaption className={`${TYPE.mono} mt-8 text-ink-mute`}>
        {review.name} / {review.business} /{' '}
        {review.rating
          ? `${review.rating}/5 on ${review.network}`
          : `Recommends on ${review.network}`}
      </figcaption>
    </figure>
  )
}
