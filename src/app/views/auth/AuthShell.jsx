import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { m } from 'framer-motion'
import ConsoleShell from '@components/ConsoleShell'
import { fadeInUpMount } from '@constants/animations'
import AuthCase from './AuthCase'
import AuthNext from './AuthNext'

// A form is read rather than scanned, so its labels sit at reading size in
// sentence case and in the page's own ink. The faint caption size the rest of
// the site sets above a section is a caption; a label naming the box a person
// is about to type their password into is not one.
const LABEL = 'block text-[14px] font-medium text-ink-paper'
// Sixteen pixels rather than the field's own fifteen, because a smaller input
// is what makes mobile Safari zoom the page in the moment it takes focus.
const FIELD = 'field mt-1.5 min-h-[44px] py-2 text-[16px]'

/**
 * One labelled field, so the two auth screens cannot drift apart in the small
 * things — label case, spacing, height, which state the error is described by.
 *
 * `id` ties the label, the input and the error text together, and `describedBy`
 * points the field at the form's one status line, so a refusal is announced
 * once wherever focus happens to be. `invalid` marks the field a refused
 * attempt was typed into.
 *
 * A password field carries a reveal, because the alternative to seeing what was
 * typed is typing it again.
 */
export function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  autoFocus,
  invalid,
  describedBy,
}) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const Reveal = revealed ? EyeOff : Eye

  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          value={value}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={event => onChange(event.target.value)}
          className={`${FIELD} ${isPassword ? 'pr-12' : ''}`}
        />
        {isPassword && (
          <button
            type="button"
            className="text-paper-faint absolute bottom-0 right-0 top-1.5 inline-flex w-11 cursor-pointer touch-manipulation items-center justify-center transition-colors duration-200 hover:text-ink-paper active:scale-[0.98]"
            onClick={() => setRevealed(current => !current)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
          >
            <Reveal className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * The two auth screens: the form on the left, and what it opens on the right.
 *
 * A sign-in box centred on an empty page says nothing about what is behind it,
 * and the account is worth having only because of what the console holds. So
 * the screen is a split: one column carries the form at a comfortable measure,
 * the other carries the case for making one, and the case reads the same public
 * status feed the board does rather than a picture of one.
 *
 * The right column is furniture, not content, so it goes at the first width
 * where two columns would squeeze the form. On a phone the form has the screen
 * to itself.
 *
 * The status line is always in the layout rather than appearing on failure, so
 * a refused attempt does not push the button down the page under the cursor
 * that is about to press it again. `statusId` is the id the caller's fields
 * point at, which is what puts the refusal on the field that was typed into.
 *
 * `alternative` is the other screen this one leads to, and it is optional: the
 * two-factor step is reached from here rather than chosen, so it offers none.
 *
 * `formName` is what makes each screen its own form rather than the same one
 * with different fields in it. A browser remembers the password field a form
 * carried, and a second step submitted through that same form is read as the
 * first one being completed - which is how a password manager comes to offer
 * to save a six-digit code as somebody's password. A name of its own gives the
 * step a form of its own, carrying no password and asking to save nothing.
 *
 * `autoComplete` is the form's own, for a step that is not a sign-in and has
 * nothing worth filling in from a saved entry.
 *
 * `bought` is the one arrival this screen closes itself around. Every other
 * reader here is deciding, and the two ways out and the panel arguing the case
 * are what a person deciding is owed. A buyer has already decided and paid, and
 * the same furniture becomes three doors out of a purchase that is not finished
 * being claimed: the wordmark, the way back to the site, and a panel selling
 * what they hold a receipt for. So for them the wordmark stops being a link and
 * stays a mark, the way out is not drawn, and the panel says what happens next
 * instead of why to sign up. Nothing is hidden that they need - the account is
 * two fields away and the site is one browser button behind them.
 */
export default function AuthShell({
  title,
  blurb,
  formName,
  autoComplete,
  statusId,
  error,
  busy,
  submitLabel,
  busyLabel,
  onSubmit,
  alternative,
  bought,
  business,
  children,
}) {
  return (
    <ConsoleShell>
      <div className="auth-frame">
        <section className="auth-pane">
          <div className="auth-pane-inner">
            {/* Two ways off, because the sign-in screen is the one page on the
                site with no navigation on it and an arrow beside a wordmark is
                read as a logo rather than as a door. The wordmark is the brand
                and goes home; the named link says where it goes and is the one
                a reader who has decided not to sign in actually looks for. */}
            <div className="auth-head">
              {bought ? (
                <span className="auth-back">
                  <img
                    src="/images/taylorurl-wordmark.png"
                    alt="TaylorURL"
                    width="874"
                    height="262"
                    className="auth-back-logo"
                    draggable={false}
                  />
                </span>
              ) : (
                <Link to="/" className="auth-back" aria-label="TaylorURL home">
                  <img
                    src="/images/taylorurl-wordmark.png"
                    alt="TaylorURL"
                    width="874"
                    height="262"
                    className="auth-back-logo"
                    draggable={false}
                  />
                </Link>
              )}
              {!bought && (
                <Link to="/" className="auth-leave">
                  <ArrowLeft className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>Back to the Site</span>
                </Link>
              )}
            </div>

            {/* Arrives on mount rather than on being scrolled to. The form
                opens at the top of its own page and is never scrolled into
                view, so a reveal waiting on that fires only when something
                else moves the page - which is a screen that has already
                arrived appearing a second time. */}
            <m.form
              key={formName}
              id={formName}
              name={formName}
              autoComplete={autoComplete}
              {...fadeInUpMount}
              className="auth-form"
              onSubmit={event => {
                event.preventDefault()
                if (!busy && onSubmit) onSubmit()
              }}
            >
              <div>
                <h1 className="auth-title">{title}</h1>
                <p className="auth-blurb">{blurb}</p>
              </div>

              <div className="auth-fields">{children}</div>

              <p id={statusId} role="status" className="auth-status">
                {error || ''}
              </p>

              {/* A step that has nothing left to submit carries no button. The
                  screen saying an email is on its way is the one of these that
                  asks for nothing, and a disabled button under it would read as
                  something the reader had failed to fill in. */}
              {submitLabel && (
                <button type="submit" disabled={busy} className="auth-submit">
                  {busy ? busyLabel : submitLabel}
                </button>
              )}

              {alternative && (
                <p className="auth-alt">
                  {alternative.lead}{' '}
                  <Link to={alternative.to} className="auth-alt-link">
                    {alternative.label}
                  </Link>
                </p>
              )}
            </m.form>
          </div>
        </section>

        {bought ? <AuthNext business={business} /> : <AuthCase />}
      </div>
    </ConsoleShell>
  )
}
