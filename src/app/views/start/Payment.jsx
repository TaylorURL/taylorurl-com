import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SendButton from '@components/conversion/SendButton'
import BbbSeal from '@components/reviews/BbbSeal'
import PageHero from '@components/page-bands/PageHero'
import Seo from '@components/Seo'
import { GROUNDS } from '@constants/grounds'
import { BUILD_PRICE, MONTHLY_PRICE } from '@data/checkout/pricing'
import { checkoutErrorMessage, openCheckout } from '@data/checkout/startCheckout'
import { recordStart } from '@data/leads/startLead'
import { PAY_STEP } from '@lib/leads/paths.js'
import { hasMinLength, isValidEmail } from '@utils/validation'

/**
 * The short way to pay, for a build that was agreed in person.
 *
 * `/start` is six screens because it is written for somebody who arrived on
 * the site knowing nothing: it picks a trade, shows the matching work, and
 * argues the price before it ever asks for a card. None of that applies to a
 * person who is already sitting across the table having said yes. Walking them
 * back through the configurator to reach the same Stripe session is asking
 * them to be sold something they have already bought, on a phone, while
 * somebody watches.
 *
 * So this is the same sale with the argument taken out. Three fields, the two
 * figures stated once, and the button. It is one address to read out or hand
 * over, and it opens the same checkout the pricing page opens.
 *
 * It is deliberately not a second checkout. `openCheckout` is the pricing
 * page's own sender, called with the same shape and reaching the same
 * endpoint, so the webhook, the screen a paid checkout returns to and the
 * project that comes out the other side cannot tell the two apart - which is
 * the property that stops a build sold this way from becoming a customer the
 * console handles differently.
 *
 * The name and the number ride in the brief rather than in fields of their
 * own on the endpoint. `api/checkout.js` and `api/checkout-link.js` are held
 * to sending byte-identical bodies by `scripts/checkout/check-payment-link.js`, and the
 * brief is the one difference that check is written to allow. A pair of new
 * metadata keys would have to be added to both endpoints and then excused
 * there, to carry two strings the brief already carries to the same place.
 *
 * What is typed is written down before the button is pressed, and that is the
 * difference between a lead and nothing. A person handed this address types
 * three answers and then meets a card, and the ones who stop there used to
 * leave no trace at all: the configurator has recorded its visitors since its
 * first screen, and the page written for somebody who had already said yes
 * recorded only the ones who went through with it. The same endpoint takes both
 * now, so a name and a number typed here survive the tab closing.
 *
 * It is recorded and not counted. The property and the ad accounts hear about
 * the configurator's first step because that is the step the ads point at; a
 * lead reported from an address handed over in a conversation is a conversion
 * no campaign produced, and it would be spent against as though one had.
 *
 * The page is noindex and in no menu, and it is deliberately absent from
 * `robots.txt`. The console's five paths are named there because they are a
 * section a crawler would otherwise map; this is a single unlinked URL, and
 * the file that would hide it is a public document that would be the only
 * place on the internet announcing it exists. The meta tag is what keeps it
 * out of an index, and it only works on a crawler allowed to fetch the page
 * and read it.
 */

const LABEL = 'section-label-sm mb-2 block text-paper-faint'
const FAULT = 'mt-2 text-[13px] leading-snug text-[color:var(--danger-on-paper)]'
const GROUND = GROUNDS.paper

const FIELDS = {
  name: 'payment-name',
  email: 'payment-email',
  phone: 'payment-phone',
  terms: 'payment-terms',
}

/** The shortest string that is plausibly a phone number, digits and shape aside. */
const PHONE_MIN = 7

/**
 * What each field has to hold, in the order the form reads top to bottom.
 *
 * Written as a table rather than a chain of ifs because the submit handler and
 * the blur handler ask the same question about the same field, and two copies
 * of that question drift.
 */
const RULES = {
  name: value => (hasMinLength(value, 2) ? null : 'A name is needed for the receipt.'),
  email: value => (isValidEmail(value) ? null : 'A working email address is needed.'),
  phone: value =>
    hasMinLength(value, PHONE_MIN)
      ? null
      : 'A phone number is needed to reach you about the build.',
}

const EMPTY = { name: '', email: '', phone: '' }

// How long the typing has to stop before what is in the form is written down.
// Longer than the configurator's, which waits on one address answered once;
// this is three fields filled in a single pass, and a shorter wait records the
// same person three times on the way down the form.
const SETTLE_MS = 1200

/**
 * What the buyer has typed, in the rows a brief carries.
 *
 * One list for both places it travels. These rows are recorded against the
 * lead as they are typed and ride to Stripe with the payment, and the whole
 * point of the second is that it says what the first said - two copies of the
 * list is how a build opens under answers the lead never gave.
 *
 * A half-filled form drops the fields it has not reached rather than storing
 * empty ones, so a brief recorded on the way down the page grows as the answers
 * arrive instead of holding a row that says nothing.
 */
function briefOf({ name, phone }) {
  return [
    { label: 'Full Name', value: name.trim() },
    { label: 'Phone', value: phone.trim() },
  ].filter(row => row.value)
}

/** Everything a report would say, as one line, so one can be told from the next. */
const markOf = ({ name, email, phone }) =>
  `${email.trim().toLowerCase()}|${name.trim()}|${phone.trim()}`

/**
 * Three fields, the price, and Stripe.
 *
 * The terms are agreed to here for the reason they are agreed to on the
 * configurator: the endpoint refuses a checkout that arrives without one, and
 * what makes the agreement a record is the server writing the time onto the
 * session it opens. Nothing on this page ticks the box on the buyer's behalf.
 *
 * The card is never typed into this site. The button opens Stripe's own page.
 */
export default function Payment() {
  const [values, setValues] = useState(EMPTY)
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState({})
  const [fault, setFault] = useState('')
  const [status, setStatus] = useState('idle')

  const sending = status === 'submitting'

  // What the last report said, so the same three answers are not sent twice,
  // and what a report would say right now, held where the listener below can
  // read it without being rebuilt on every keystroke.
  const reported = useRef('')
  const standing = useRef(values)
  standing.current = values

  // The address is what gates the report, because it is the row's identity and
  // there is nothing to record without one. It goes up a moment after the
  // typing settles rather than on every keystroke, and again each time one of
  // the answers beside it changes, so a form filled in and abandoned is a lead
  // carrying the name and the number it was abandoned with.
  useEffect(() => {
    if (!isValidEmail(values.email)) return undefined
    const mark = markOf(values)
    if (reported.current === mark) return undefined

    const timer = setTimeout(() => {
      reported.current = mark
      recordStart({ email: values.email, step: PAY_STEP, brief: briefOf(values), counted: false })
    }, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [values])

  // The one report that cannot wait for the settle. Somebody who fills the form
  // in and closes the tab in the same second is the lead this exists for, and
  // their report is still sitting in a timer when the document goes. It fires
  // on the way to Stripe too, which is what puts the answers on the row for a
  // buyer who reaches the card and does not use it.
  useEffect(() => {
    const flush = () => {
      const held = standing.current
      if (!isValidEmail(held.email)) return
      const mark = markOf(held)
      if (reported.current === mark) return
      reported.current = mark
      recordStart({ email: held.email, step: PAY_STEP, brief: briefOf(held), counted: false })
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  const change = field => event => {
    const { value } = event.target
    setValues(held => ({ ...held, [field]: value }))
    // Cleared as they type rather than re-measured on every keystroke, which
    // would mark an address wrong while somebody is halfway through typing it.
    if (errors[field]) setErrors(held => ({ ...held, [field]: null }))
  }

  const blur = field => () => setErrors(held => ({ ...held, [field]: RULES[field](values[field]) }))

  async function submit(event) {
    event.preventDefault()
    setFault('')

    const found = {}
    for (const [field, rule] of Object.entries(RULES)) {
      const problem = rule(values[field])
      if (problem) found[field] = problem
    }
    if (!agreed) found.terms = 'The terms have to be agreed to before you pay.'
    setErrors(found)
    if (Object.keys(found).length) return

    setStatus('submitting')
    try {
      const url = await openCheckout({
        email: values.email,
        // The same rows the lead already carries. A build sold this way has no
        // configurator behind it, so these are the whole of what travels.
        brief: briefOf(values),
        termsAccepted: agreed,
      })
      // Replaced rather than pushed: the back button on Stripe's page should
      // reach the site the buyer came from, not a form they have already
      // submitted and would submit again.
      window.location.assign(url)
    } catch (error) {
      setFault(checkoutErrorMessage(error))
      setStatus('idle')
    }
  }

  return (
    <div>
      <Seo
        title="Pay for Your Build"
        description="Pay for a website build and the monthly that keeps it running."
        path="/payment"
        noIndex
      />

      <PageHero
        eyebrow="Payment"
        title="Pay for your build."
        description="Three details, then Stripe's own page for the card. The build starts the moment it goes through."
      />

      <section {...GROUND.attrs} className={`section-y relative overflow-hidden ${GROUND.section}`}>
        <div className="container-rail relative">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <form onSubmit={submit} className="space-y-7" noValidate>
              <div className="border-hair-paper flex items-baseline justify-between gap-4 border-b pb-5">
                <h2 className="text-[19px] font-semibold tracking-tight text-ink-paper">
                  {BUILD_PRICE} to build it, then {MONTHLY_PRICE} a month
                </h2>
                <span className="section-label-sm text-paper-faint">Card handled by Stripe</span>
              </div>

              <div>
                <label htmlFor={FIELDS.name} className={LABEL}>
                  Full name
                </label>
                <input
                  id={FIELDS.name}
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={values.name}
                  onChange={change('name')}
                  onBlur={blur('name')}
                  disabled={sending}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? `${FIELDS.name}-error` : undefined}
                  className="field w-full py-3.5"
                  placeholder="Your name"
                />
                {errors.name && (
                  <p id={`${FIELDS.name}-error`} className={FAULT} role="alert">
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={FIELDS.email} className={LABEL}>
                  Email
                </label>
                <input
                  id={FIELDS.email}
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={change('email')}
                  onBlur={blur('email')}
                  disabled={sending}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={`${FIELDS.email}-note${errors.email ? ` ${FIELDS.email}-error` : ''}`}
                  className="field w-full py-3.5"
                  placeholder="you@yourbusiness.com"
                />
                {errors.email && (
                  <p id={`${FIELDS.email}-error`} className={FAULT} role="alert">
                    {errors.email}
                  </p>
                )}
                <p
                  id={`${FIELDS.email}-note`}
                  className="text-paper-faint mt-2 text-[13px] leading-snug"
                >
                  The receipt goes here, and your project waits under this address until you pick a
                  password.
                </p>
              </div>

              <div>
                <label htmlFor={FIELDS.phone} className={LABEL}>
                  Phone
                </label>
                <input
                  id={FIELDS.phone}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={values.phone}
                  onChange={change('phone')}
                  onBlur={blur('phone')}
                  disabled={sending}
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={errors.phone ? `${FIELDS.phone}-error` : undefined}
                  className="field w-full py-3.5"
                  placeholder="(000) 000-0000"
                />
                {errors.phone && (
                  <p id={`${FIELDS.phone}-error`} className={FAULT} role="alert">
                    {errors.phone}
                  </p>
                )}
              </div>

              <div className="border-hair-paper border-t pt-6">
                <label htmlFor={FIELDS.terms} className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    id={FIELDS.terms}
                    name="terms"
                    checked={agreed}
                    onChange={event => {
                      setAgreed(event.target.checked)
                      if (errors.terms) setErrors(held => ({ ...held, terms: null }))
                    }}
                    disabled={sending}
                    aria-invalid={errors.terms ? true : undefined}
                    aria-describedby={`${FIELDS.terms}-note${errors.terms ? ` ${FIELDS.terms}-error` : ''}`}
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
                {errors.terms && (
                  <p id={`${FIELDS.terms}-error`} className={`${FAULT} pl-7`} role="alert">
                    {errors.terms}
                  </p>
                )}
                <p
                  id={`${FIELDS.terms}-note`}
                  className="text-paper-faint mt-2 pl-7 text-[13px] leading-snug"
                >
                  The terms open in a new tab, so nothing you have filled in here is lost.
                </p>
              </div>

              {fault && (
                <p className={FAULT} role="alert">
                  {fault}
                </p>
              )}

              <div className="border-hair-paper flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
                <SendButton sending={sending} pending="Opening Checkout…">
                  {`Pay ${BUILD_PRICE} and Start`}
                </SendButton>
                <p className="section-label-sm text-paper-faint">No card is typed on this site</p>
              </div>
            </form>

            <aside className="flex flex-col gap-8">
              <div>
                <p className="section-label text-accent">What the Payment Buys</p>
                <p className="mt-5 text-[15px] leading-relaxed text-paper-soft">
                  The build is paid once, before the work begins. The monthly starts the same day,
                  goes on the same card, and stops when you say so. Everything the site needs after
                  launch is in it: hosting, changes, monitoring, and the search work.
                </p>
                <p className="mt-4 text-[15px] leading-relaxed text-paper-soft">
                  If you would rather see the work and the price laid out first,{' '}
                  <Link
                    to="/start"
                    className="text-accent underline transition-colors duration-200 hover:text-[color:var(--accent-hi)]"
                  >
                    start there instead
                  </Link>
                  .
                </p>
              </div>

              {/* The one mark on the page a third party stands behind, beside
                  the button that takes the money. */}
              <BbbSeal />
            </aside>
          </div>
        </div>
      </section>
    </div>
  )
}
