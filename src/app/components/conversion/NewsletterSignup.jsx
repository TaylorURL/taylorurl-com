import { useId, useState } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { submitEmailSignup, signupErrorMessage } from '@data/newsletter/collectEmail'
import { SUPPORT_EMAIL } from '@constants/navigation'
import { GROUNDS } from '@constants/grounds'
import { isValidEmail } from '@utils/validation'

const EYEBROW = 'The Newsletter'

const BLURB =
  'Getting found on Google, and turning the visitors you already have into paying customers. Monthly at most, one click to stop.'

const SHORT_BLURB =
  'Getting found on Google, and turning visitors into paying customers. Monthly at most, one click to stop.'

// The form and its fields sit on paper wherever the component lands, so a
// caller on a dark ground hands it a light panel and everything inside keeps
// the paper roles the site's other forms are drawn in.
const CARD = 'panel-static bg-paper p-8 sm:p-10'

// The card is a sheet of paper set into whatever ground it lands on, so it
// declares that ground and the roles inside it resolve against the sheet
// rather than the section. Compact has no sheet and reads the section's own.
const CARD_GROUND = GROUNDS.sheet.attrs

/** What `collect-email` answers with for an address held on `suppression`. */
const OPTED_OUT = 403

/**
 * The form that puts a reader on the mailing list, wherever they meet it.
 *
 * A submission writes a pending row and nothing more. The confirmation mail
 * that follows carries the only link that stamps `confirmed_at`, and
 * `lib/mail/audience.js` selects on that stamp, so an address reached from here
 * is unmailable until the person holding it acts. What the form says on success
 * therefore names the step still outstanding rather than calling the work done.
 *
 * Every fault is a fact about the address in the field, so each is set beneath
 * it rather than raised as a toast: the form stands at the foot of pages long
 * enough that a message at the edge of the viewport belongs to nothing the
 * reader is looking at.
 *
 * @param {object} props
 * @param {string} props.source - Recorded on the row, so the audience page can
 *   say which page an address arrived from.
 * @param {boolean} [props.compact] - Drops the card and the heading, for a
 *   caller that supplies its own surface.
 */
export default function NewsletterSignup({ source, compact = false }) {
  const fieldId = useId()
  const faultId = `${fieldId}-fault`
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [fault, setFault] = useState(null)

  const handleSubmit = async event => {
    event.preventDefault()
    if (status === 'submitting') return

    const trimmed = email.trim()
    // Measured before the request, so a mistyped address is answered here
    // rather than costing a round trip to be told the same thing.
    if (!isValidEmail(trimmed)) {
      setFault('Enter a valid email address.')
      return
    }

    setFault(null)
    setStatus('submitting')

    try {
      await submitEmailSignup({ email: trimmed, source })
      setStatus('success')
      setEmail('')
    } catch (error) {
      setStatus('idle')
      // An address that unsubscribed, bounced or reported a message is held off
      // every list, and a signup form is not the way back on. Saying so without
      // naming the way through leaves the reader at a wall.
      setFault(
        error?.status === OPTED_OUT
          ? `${signupErrorMessage(error)} Email ${SUPPORT_EMAIL} to come back on.`
          : signupErrorMessage(error)
      )
    }
  }

  if (status === 'success') {
    return (
      <div className={compact ? undefined : CARD} role="status" {...(compact ? {} : CARD_GROUND)}>
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-accent/50 bg-accent/10">
            <Check className="h-4 w-4 text-accent" strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            {/* The ink rather than the accent, so what the reader has to do
                next is legible under every theme and does not rest on a colour
                the mark beside it already carries. */}
            <p className="section-label-sm text-ink">Check Your Inbox</p>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-soft">
              Follow the link in the email to finish. Nothing is sent to you before that.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Red on a white card is a different step from red on a slab: the card is a
  // light sheet under either setting, while the compact form takes whatever
  // ground the section it was set into is standing on.
  const faultInk = compact ? 'text-[color:var(--danger)]' : 'text-[color:var(--danger-on-paper)]'

  const form = (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor={fieldId} className="section-label-sm mb-2 block text-ink-faint">
        Email address
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={fieldId}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={event => setEmail(event.target.value)}
          aria-invalid={fault ? 'true' : undefined}
          aria-describedby={fault ? faultId : undefined}
          className="field flex-1 py-3.5"
          placeholder="you@yourbusiness.com"
        />
        {/* The accent rather than the quieter key, because the field and the
            paper secondary are both drawn on --paper-field: a white button
            beside a white field reads as a second thing to type in. The accent
            is also the one colour that holds its own on either ground, so the
            card in the footer takes the same class as the card on an article. */}
        <button type="submit" disabled={status === 'submitting'} className="btn btn-primary">
          {status === 'submitting' ? 'Subscribing…' : 'Subscribe'}
        </button>
      </div>
      {/* A fault is a sentence rather than a standing label, so it is set as
          small prose and carries a mark of its own: red alone says nothing to a
          reader who cannot see it. */}
      {fault && (
        <p
          id={faultId}
          role="alert"
          className={`mt-2 flex items-start gap-2 text-[13px] leading-snug ${faultInk}`}
        >
          <AlertCircle
            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>{fault}</span>
        </p>
      )}
    </form>
  )

  if (compact) {
    return (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end lg:gap-16">
        <div>
          <p className="section-label-sm mb-3 text-accent">{EYEBROW}</p>
          <p className="max-w-md text-[15px] leading-relaxed text-ink-soft">{SHORT_BLURB}</p>
        </div>
        {form}
      </div>
    )
  }

  return (
    <div className={CARD}>
      {/* The split is decided by the room the card has rather than by the width
          of the window, because the same card stands in a full-width section on
          the blog and in a 760px reading column on an article. A breakpoint
          reads the window in both places and puts two columns inside the narrow
          one; auto-fit drops to a single column the moment two will not fit. */}
      <div className="grid items-center gap-10 [grid-template-columns:repeat(auto-fit,minmax(min(22rem,100%),1fr))]">
        <div>
          <p className="section-label mb-4 text-accent">{EYEBROW}</p>
          <h2 className="display-5 font-semibold leading-[1.08] tracking-tightest text-ink-paper [text-wrap:balance]">
            Notes for owners.
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-paper-soft">{BLURB}</p>
        </div>
        {form}
      </div>
    </div>
  )
}
