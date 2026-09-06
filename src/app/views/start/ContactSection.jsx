import { useState } from 'react'
import { isValidEmail } from '@utils/validation'
import BlockHead from './BlockHead'
import { FIELD_FAULT, FIELD_LABEL, GROUND } from './lib/ground'

/**
 * The address the configuration belongs to, asked on the first step.
 *
 * It used to be asked on the last one, beside the card, which meant every
 * answer given between the two was held by a browser and belonged to nobody.
 * A visitor who picked a trade, four designs and a look and then closed the tab
 * left behind a brief with no one attached to it.
 *
 * Asked here, the address is the one thing the rest of the flow is written
 * against: the send-me-this panel opens with it filled in, and so does the
 * payment form at the end, so the field is answered once rather than at the
 * moment it is most expensive to be asked.
 *
 * The refusal is only ever about the shape of what was typed, and it waits for
 * the field to be left rather than firing on the third character of an address
 * somebody is still writing. An empty field says nothing at all: not having
 * typed yet is not a mistake.
 *
 * @param {{ email: string, onChange: (event: Event) => void }} props
 */
export default function ContactSection({ email, onChange }) {
  const [left, setLeft] = useState(false)
  const wrong = left && email.trim().length > 0 && !isValidEmail(email)

  return (
    <div>
      <BlockHead label="Where to Reach You" meta="Needed to continue" />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
        <div>
          <label htmlFor="start-email" className={FIELD_LABEL}>
            Email
          </label>
          <input
            type="email"
            id="start-email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={onChange}
            onBlur={() => setLeft(true)}
            aria-invalid={wrong ? true : undefined}
            aria-describedby={wrong ? 'start-email-fault start-email-note' : 'start-email-note'}
            className="field py-3.5"
            placeholder="you@yourbusiness.com"
          />
          {wrong && (
            <p id="start-email-fault" className={FIELD_FAULT} role="alert">
              That email address does not look right.
            </p>
          )}
          <p id="start-email-note" className={`mt-2 text-[13px] leading-snug ${GROUND.meta}`}>
            The steps after this one carry it, so it is asked once.
          </p>
        </div>
        <p className={`text-[15px] leading-relaxed ${GROUND.body}`}>
          This is the address the build opens under and the receipt goes to. It is never passed on
          to anyone else.
        </p>
      </div>
    </div>
  )
}
