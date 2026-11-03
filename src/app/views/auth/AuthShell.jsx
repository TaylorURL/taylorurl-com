import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import ConsoleShell from '@components/account/ConsoleShell'
import { Container, Logo } from '@components/kit/Kit'
import { BUTTONS, CARD, TYPE } from '@components/kit/styles'
import { FIELD_LABEL } from '@constants/grounds'
import AuthCase from './AuthCase'
import AuthNext from './AuthNext'
import { AUTH_LINK } from './lib/styles'

/**
 * One labelled field, so the auth screens cannot drift apart in the small
 * things — label case, spacing, height, which state the error is described by.
 *
 * `id` ties the label, the input and the line under the form together, and
 * `describedBy` points the field at that line, so the rule it broke is read out
 * with it. `invalid` marks the field the refused value was typed into. Only the
 * rules a form checks for itself go there; a failure that is not about one box
 * is announced in the corner and points at no field, because pointing it at one
 * says the value in it is wrong when it is not.
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
      <label htmlFor={id} className={FIELD_LABEL}>
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
          className={`field ${isPassword ? 'pr-12' : ''}`.trim()}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 inline-flex w-12 cursor-pointer touch-manipulation items-center justify-center text-ink-mute transition-colors duration-150 hover:text-ink"
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
 * The account screens: the wordmark and the way back to the site along the top,
 * a short headline, and the form in a card - laid out the way the Start page
 * is, with what the account opens under the headline on a wide screen. On a
 * phone the form has the screen to itself.
 *
 * The status line carries the rules a form checks for itself - a password too
 * short, two that do not match, an address in the wrong shape - and nothing
 * else. `statusId` is the id the caller's fields point at, which is what puts
 * the rule on the field that broke it, and passing one is what draws the line:
 * it then holds its own height from the first render, so a rule arriving does
 * not push the button down the page under the cursor that is about to press it
 * again. A screen that checks no rules of its own passes no id and gets no
 * line. Everything else that goes wrong here - the account, the service, the
 * connection - is not about a field and is said in the corner instead.
 *
 * `alternative` is the other screen this one leads to, and it is optional: the
 * two-factor step is reached from here rather than chosen, so it offers none.
 * Its `lead` is optional too.
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
 * `bought` is the one arrival this screen closes itself around. A buyer has
 * already decided and paid, so for them the wordmark stops being a link and
 * stays a mark, the way out is not drawn, and the panel says what happens next
 * instead of why to hold an account. Nothing is hidden that they need - the
 * way in is one press away and the site is one browser button behind them.
 *
 * `framed` is a screen the site's own bar and footer stand around - the two
 * password screens, which the layout does not draw bare. The bar already
 * carries the wordmark and the way home, so the screen's own pair is left out
 * rather than drawn a second time under it.
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
  framed = false,
  children,
}) {
  const wordmark = <Logo />

  return (
    <ConsoleShell>
      <div className={`glow ${framed ? '' : 'min-h-[100dvh]'}`.trim()}>
        <Container className={`flex flex-col ${framed ? '' : 'min-h-[100dvh]'}`.trim()}>
          {/* Two ways off, because the sign-in screen is the one page on the
              site with no navigation on it. The wordmark is the brand and goes
              home; the named link says where it goes and is the one a reader
              who has decided not to sign in actually looks for. */}
          <div
            className={framed ? 'hidden' : 'flex min-h-[72px] items-center justify-between gap-4'}
          >
            {bought ? (
              <span className="auth-back">{wordmark}</span>
            ) : (
              <Link to="/" className="auth-back" aria-label="TaylorURL home">
                {wordmark}
              </Link>
            )}
            {!bought && (
              <Link to="/" className="auth-leave">
                <ArrowLeft className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>Back to the Site</span>
              </Link>
            )}
          </div>

          <div
            className={`grid flex-1 content-center gap-10 pb-16 ${framed ? 'pt-10 sm:pt-16' : 'pt-8 sm:pt-12'} lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:grid-rows-[auto_auto] lg:gap-x-16 lg:gap-y-10`}
          >
            <div>
              <h1 className={TYPE.display}>{title}</h1>
              {blurb && <p className={`${TYPE.lead} mt-5 max-w-[30rem]`}>{blurb}</p>}
            </div>

            <form
              key={formName}
              id={formName}
              name={formName}
              autoComplete={autoComplete}
              className={`${CARD} flex min-w-0 flex-col gap-5 p-6 sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center`}
              onSubmit={event => {
                event.preventDefault()
                if (!busy && onSubmit) onSubmit()
              }}
            >
              <div className="flex flex-col gap-5">{children}</div>

              {statusId && (
                <p
                  id={statusId}
                  role="status"
                  className="-mt-1 min-h-[1.25rem] text-[14px] leading-snug text-[color:var(--danger-on-paper)]"
                >
                  {error || ''}
                </p>
              )}

              {/* A step that has nothing left to submit carries no button. The
                  screen saying an email is on its way is the one of these that
                  asks for nothing, and a disabled button under it would read as
                  something the reader had failed to fill in. */}
              {submitLabel && (
                <button
                  type="submit"
                  disabled={busy}
                  className={`${BUTTONS.primary} w-full disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {busy ? busyLabel : submitLabel}
                </button>
              )}

              {alternative && (
                <p className="text-center text-[14px] text-ink-mute">
                  {alternative.lead && `${alternative.lead} `}
                  <Link to={alternative.to} className={AUTH_LINK}>
                    {alternative.label}
                  </Link>
                </p>
              )}
            </form>

            <div className="hidden lg:block">
              {bought ? <AuthNext business={business} /> : <AuthCase />}
            </div>
          </div>
        </Container>
      </div>
    </ConsoleShell>
  )
}
