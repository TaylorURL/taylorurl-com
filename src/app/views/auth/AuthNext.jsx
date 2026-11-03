import { CheckList } from '@components/kit/Kit'
import { TYPE } from '@components/kit/styles'

/**
 * What stands under the headline for somebody who has just paid.
 *
 * The other panel makes the case for holding an account, which is the right
 * thing to say to a reader deciding whether to sign up and the wrong thing to
 * say to one who has already bought. A buyer is not choosing; they have just
 * handed a form a thousand dollars and want to know what becomes of it. So this
 * says that instead, and says it in the order it happens.
 *
 * The three asks named at the end are the three the tracker opens with, seeded
 * against every project as it is created. Naming them here means the first
 * screen after a payment and the first screen after that agree, and a buyer can
 * go and find their logo before the console has finished loading.
 */
const STEPS = [
  {
    title: 'Your payment is in',
    body: 'The build is paid for and the monthly starts today, on the same card.',
  },
  {
    title: 'Your build opens',
    body: 'Set a password from the emailed link and your console is there, with your project already on it.',
  },
  {
    title: 'Three things to start',
    body: 'Your logo, your words, and photographs of your own work if you have them.',
  },
]

export default function AuthNext({ business }) {
  return (
    <div className="max-w-[30rem]">
      <h2 className={TYPE.h3}>
        {business ? `The build for ${business} is open.` : 'Your build is open.'}
      </h2>
      <CheckList items={STEPS} className="mt-6" />
    </div>
  )
}
