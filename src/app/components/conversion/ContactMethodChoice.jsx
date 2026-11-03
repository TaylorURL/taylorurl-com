import { FIELD_FAULT, FIELD_LABEL } from '@constants/grounds'
import { CONTACT_METHODS } from '@constants/navigation'
import { REPLY_QUESTIONS } from '@lib/enquiry/questions.js'

/**
 * How the sender wants to be answered, asked once and rendered the same way
 * wherever an inquiry is taken.
 *
 * The number is on the page, so a reader who wants to talk can already press it
 * and skip the form entirely. What is left for this control is the inquiry that
 * arrived in writing: the sender says how they want to be answered rather than
 * being answered on whichever channel they happened to arrive through.
 *
 * A number is asked for only once it has somewhere to go. Collecting one from
 * a sender who asked for email is a field they have to think about and nobody
 * will ever use.
 *
 * The control is a real radio group. The input carries the state and the focus,
 * and the tile beside it is painted from that state through `peer-`, so the
 * keyboard contract is the browser's own rather than something rebuilt on top
 * of a div.
 *
 * The two questions are read from the shared set rather than typed here, so
 * the notice that lands in the inbox reports the words the sender actually
 * saw, whichever form they saw them on.
 */
export default function ContactMethodChoice({
  value,
  phone,
  onChange,
  onBlur,
  error,
  idPrefix = 'contact',
}) {
  const wantsCall = value === 'phone' || value === 'either'
  const phoneId = `${idPrefix}-phone`

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className={FIELD_LABEL}>{REPLY_QUESTIONS.contactMethod}</legend>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {CONTACT_METHODS.map(method => (
            <label key={method.value} className="relative block cursor-pointer">
              <input
                type="radio"
                name="contactMethod"
                value={method.value}
                checked={value === method.value}
                onChange={onChange}
                className="sr-only"
              />
              <span className="choice-tile">{method.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {wantsCall && (
        <div>
          <label htmlFor={phoneId} className={FIELD_LABEL}>
            {REPLY_QUESTIONS.phone}
          </label>
          <input
            type="tel"
            id={phoneId}
            name="phone"
            autoComplete="tel"
            value={phone}
            onChange={onChange}
            onBlur={onBlur}
            className="field"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${phoneId}-error` : undefined}
          />
          {error && (
            <p id={`${phoneId}-error`} role="alert" className={FIELD_FAULT}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
