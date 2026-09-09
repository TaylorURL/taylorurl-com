import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BUILD_PRICE, MONTHLY_PRICE } from '@data/checkout/pricing'
import BbbSeal from '@components/reviews/BbbSeal'
import { FIELD_FAULT, FIELD_LABEL, GROUND, PANEL_EYEBROW, PANEL_TITLE } from '../lib/ground'

/**
 * What the payment starts, in the order it happens.
 *
 * The card is the last control on the site and the first thing on the project,
 * so the four moves after it are stated beside the button rather than waiting
 * on the receipt. A buyer deciding whether to pay is deciding what happens
 * next, and a page that shows only a price and a field leaves them to guess at
 * it.
 */
const ONBOARDING = [
  {
    title: 'Your Build Opens',
    body: 'The receipt lands and the build opens on the address you paid with, with you already signed in.',
  },
  {
    title: 'We Reach Out',
    body: 'A message from us on that address, usually within the hour, to go through what you picked.',
  },
  {
    title: 'The First Draft',
    body: 'The site drawn from your answers, sent as real pages you can change as much as you like.',
  },
  {
    title: 'Live',
    body: 'Checked page by page together, then put live on the day you say go.',
  },
]

/** A step's number, written the way the trail above the frame writes it. */
const ordinal = index => String(index + 1).padStart(2, '0')

/**
 * The end of the funnel: the build is paid for, and the work starts.
 *
 * Three fields and a button on the right, and what the payment sets off on the
 * left. Everything else about the project has been picked over the steps
 * behind this one, so it rides on the payment rather than being asked for
 * again; the rows under the fields are what the build starts from, shown here
 * because this is the last screen before they travel.
 *
 * The card is never typed into this site. The button opens Stripe's own page,
 * which is also what keeps this section free of anything that could hold a
 * card number long enough to lose one.
 *
 * The address given here is the address the project waits under afterwards.
 * That is worth saying on the form rather than after it, because it is the one
 * field somebody would otherwise fill in with whichever mailbox was open.
 *
 * The terms are agreed to here rather than assumed. What is being bought is a
 * build and a monthly that runs until somebody stops it, and both are written
 * down on one page; a buyer who has not been given the chance to read that page
 * has not agreed to anything. The link opens in a tab of its own, because
 * reading the terms must not cost somebody the form they have just filled in.
 *
 * @param {{ buy: object, status: string, agreed: boolean,
 *   fault: { field: string, fault: string } | null,
 *   summary: Array<{ label: string, value: string }>, onChange: Function,
 *   onAgree: Function, onSubmit: Function }} props
 */
export default function PaySection({
  buy,
  status,
  agreed,
  fault,
  summary,
  onChange,
  onAgree,
  onSubmit,
}) {
  const sending = status === 'submitting'

  return (
    <div className="edge grid gap-px overflow-hidden bg-[color:var(--paper-hairline)] lg:grid-cols-[1fr_1.4fr]">
      <aside className="flex flex-col gap-10 bg-paper p-8 sm:p-12">
        <div>
          <p className={PANEL_EYEBROW}>What Happens Next</p>
          <h3 className={PANEL_TITLE}>The payment is the start of the build.</h3>
          <p className="mt-5 text-[15px] leading-relaxed text-paper-soft">
            Nothing else is asked of you today. The four moves below are what the money sets off,
            and the first of them happens the moment the card goes through.
          </p>
        </div>

        <ol className={`flex flex-col gap-6 border-t pt-8 ${GROUND.rule}`}>
          {ONBOARDING.map((move, index) => (
            <li key={move.title} className="flex gap-5">
              <span
                className="section-label-sm mt-0.5 flex-shrink-0 text-accent"
                aria-hidden="true"
              >
                {ordinal(index)}
              </span>
              <div>
                <p className="text-[16px] font-semibold tracking-tight text-ink-paper">
                  {move.title}
                </p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-paper-soft">{move.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* The last thing beside the card field. Whoever is about to pay a
            business they found on the internet is owed one mark on the page
            that a third party stands behind, and this is the only one there
            is. */}
        <BbbSeal />
      </aside>

      <div className="bg-paper p-8 sm:p-12">
        <div className="border-hair-paper mb-8 flex items-baseline justify-between gap-4 border-b pb-5">
          <h3 className="text-[19px] font-semibold tracking-tight text-ink-paper">
            {BUILD_PRICE} to build it, then {MONTHLY_PRICE} a month
          </h3>
          <span className="section-label-sm text-paper-faint">Card handled by Stripe</span>
        </div>

        <p className="mb-8 max-w-2xl text-[15px] leading-relaxed text-paper-soft">
          The build is paid once, before the work begins. The monthly starts the same day, goes on
          the same card, and stops when you say so.
        </p>

        <form onSubmit={onSubmit} className="space-y-7">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="start-business" className={FIELD_LABEL}>
                Business name
              </label>
              <input
                type="text"
                id="start-business"
                name="businessName"
                autoComplete="organization"
                required
                value={buy.businessName}
                onChange={onChange}
                className="field py-3.5"
                placeholder="What the sign says"
              />
            </div>
            <div>
              <label htmlFor="start-buy-email" className={FIELD_LABEL}>
                Email
              </label>
              <input
                type="email"
                id="start-buy-email"
                name="email"
                autoComplete="email"
                required
                value={buy.email}
                onChange={onChange}
                aria-invalid={fault?.field === 'email' ? true : undefined}
                aria-describedby={
                  fault?.field === 'email'
                    ? 'start-buy-email-fault start-buy-email-note'
                    : 'start-buy-email-note'
                }
                className="field py-3.5"
                placeholder="you@yourbusiness.com"
              />
              {fault?.field === 'email' && (
                <p id="start-buy-email-fault" className={FIELD_FAULT} role="alert">
                  {fault.fault}
                </p>
              )}
              <p
                id="start-buy-email-note"
                className="text-paper-faint mt-2 text-[13px] leading-snug"
              >
                The receipt goes here, your project opens under this address, and it is where we
                reach you.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="start-website" className={FIELD_LABEL}>
              Current website
            </label>
            <input
              type="text"
              id="start-website"
              name="website"
              autoComplete="url"
              value={buy.website}
              onChange={onChange}
              className="field py-3.5"
              placeholder="yourbusiness.com, or leave it empty"
            />
          </div>

          <div className="border-hair-paper border-t pt-6">
            <p className="section-label-sm text-accent">What the Build Starts From</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {summary.map(row => (
                <div key={row.label}>
                  <dt className="section-label-sm text-paper-faint">{row.label}</dt>
                  <dd className="mt-1 break-words text-[14px] leading-snug text-ink-paper">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border-hair-paper border-t pt-6">
            <label htmlFor="start-terms" className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                id="start-terms"
                name="terms"
                checked={agreed}
                onChange={onAgree}
                aria-invalid={fault?.field === 'terms' ? true : undefined}
                aria-describedby={
                  fault?.field === 'terms'
                    ? 'start-terms-fault start-terms-note'
                    : 'start-terms-note'
                }
                className="mt-1 h-4 w-4 flex-shrink-0 accent-[color:var(--accent-fill)]"
              />
              <span className="text-[15px] leading-relaxed text-ink-paper">
                I have read and agree to the{' '}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline transition-colors duration-200 hover:text-[color:var(--accent-hi)]"
                >
                  Terms of Service
                </Link>
                , including the monthly fee that keeps the site published.
              </span>
            </label>
            {fault?.field === 'terms' && (
              <p id="start-terms-fault" className={`${FIELD_FAULT} pl-7`} role="alert">
                {fault.fault}
              </p>
            )}
            <p
              id="start-terms-note"
              className="text-paper-faint mt-2 pl-7 text-[13px] leading-snug"
            >
              The terms open in a new tab, so nothing you have filled in here is lost.
            </p>
          </div>

          <div className="border-hair-paper flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="submit" disabled={sending} className="btn btn-primary group">
                {sending ? 'Opening Checkout…' : `Pay ${BUILD_PRICE} and Start`}
                {!sending && (
                  <ArrowUpRight
                    className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                )}
              </button>
              {/* The answers travel with the visitor rather than being left
                  behind on a page they are walking away from. Five steps of
                  picking, and the contact form used to open empty: the one
                  visitor who had told the site the most about their business
                  arrived at the enquiry with none of it, and either typed it
                  again or did not write in. */}
              <Link to="/contact" state={{ brief: summary }} className="btn btn-secondary">
                Talk It Through First
              </Link>
            </div>
            <p className="section-label-sm text-paper-faint">Everything above travels with it</p>
          </div>
        </form>
      </div>
    </div>
  )
}
