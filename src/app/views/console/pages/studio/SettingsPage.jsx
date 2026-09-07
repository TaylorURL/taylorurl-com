import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, ShieldCheck } from 'lucide-react'
import { supabase } from '@data/supabase/supabaseClient'
import { useSession } from '@hooks/session/useSession'
import { useMfa } from '@hooks/session/useMfa'
import { useToast } from '@hooks/chrome/useToast'
import ThemePicker from '@components/navigation/ThemePicker'
import { isValidEmail } from '@utils/validation'
import {
  Area,
  Badge,
  Board,
  ConsolePage,
  Metric,
  Panel,
  PanelBody,
  PanelFoot,
  SkeletonBar,
  ViewNav,
} from '../../ui'
import { useView } from '../../lib/views'
import { BUTTON, CONTROL_H, FIELD, MONO_LABEL, QUIET } from '../../lib/tokens'
import { ZONE } from '@lib/time/zone.js'

/**
 * The account itself, rather than the figures inside it.
 *
 * Every other section answers a question about a site. This one answers
 * questions about the person reading them: what they are called, what they sign
 * in with, what stands between a stolen password and their figures, which
 * palette the site draws in, and how to leave.
 *
 * Each view lays its cards out across the room rather than down it, and the
 * account's own facts stand level with the forms that change them rather than
 * under them, so a fact is still on screen while the field beside it is being
 * filled in.
 *
 * Each panel owns one change and says so in its own heading, because a settings
 * page that saves everything at once makes a reader who came to change one
 * thing responsible for six. The change a panel owns closes it, so a reader
 * who has filled the fields in finds the control where the card ends rather
 * than somewhere in the middle of the page.
 *
 * Nothing that cannot be undone happens on a single press: removing a factor,
 * ending every session, and closing the account each ask again, and the last of
 * the three asks for the address typed out.
 */

// Supabase refuses anything shorter, and finding that out from the server after
// filling the form in is a worse way to learn it.
const MIN_PASSWORD = 6

const DANGER = `${MONO_LABEL} ${CONTROL_H} inline-flex cursor-pointer touch-manipulation items-center justify-center rounded-[var(--console-radius-sm)] border border-[color:var(--danger-hairline)] px-3.5 text-[color:var(--danger-on-paper)] transition-colors duration-150 hover:bg-[color:var(--danger-wash)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40`
// A line of prose and a single value each have a width past which they stop
// being easy to read: the eye loses the start of the next line, and a label
// ends up a hand's width from the box it names. The card fills the column the
// way every other section's does, and these hold their own measure inside it.
const HINT = 'max-w-[34rem] text-[13px] leading-relaxed text-paper-soft'
const BODY = 'flex flex-col gap-4 px-5 py-4'

// A form is the height its fields make it and no taller. A row stretched to
// the room stands a card's control a hand's width under the field it acts on,
// so every row here is the height its cards ask for and the room left over
// stays under them. The floor of nought is what lets a card give height back
// when the screen has less than the form wants: its body scrolls inside it
// rather than the page cutting it off.
const ROW = 'minmax(0,max-content)'
const TWO_ROWS = `${ROW} ${ROW}`
const HALVES = 'minmax(0,1fr) minmax(0,1fr)'
// The two-factor card stands a code to scan beside the secret it carries,
// which is wider than a field, so it takes the larger share of its row: at a
// laptop's width an equal share drops the secret and the six-digit field
// under the code, and the card past the room it has.
const SIGNIN_COLS = 'minmax(0,1fr) minmax(0,1fr) minmax(0,1.6fr)'

/** One labelled control, at the measure a single value is read and typed at. */
function TextField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  placeholder,
  invalid,
  // A field is as wide as what goes in it. An address takes the full measure;
  // six digits from an authenticator app would leave most of one empty.
  measure = 'w-full max-w-[30rem]',
}) {
  // A field that is only wrong in red is a field a colour-blind reader and every
  // screen reader is told nothing about, so the state is on the element as well
  // as in the ink, and the message it names is read out with it.
  const noteId = invalid ? `${id}-note` : undefined
  return (
    <div className={measure}>
      <label htmlFor={id} className={`${MONO_LABEL} text-paper-faint`}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={noteId}
        onChange={event => onChange(event.target.value)}
        className={`${FIELD} mt-1.5`}
      />
      {invalid && (
        <p id={noteId} className="mt-1.5 text-[12px] text-[color:var(--danger-on-paper)]">
          {invalid}
        </p>
      )}
    </div>
  )
}

/**
 * A change that cannot be taken back, holding still until it is asked for twice.
 *
 * It takes the geometry of the block a card closes on rather than sitting inside
 * the body as a box of its own, because it stands in the place the panel's own
 * control was a moment ago and a reader should find the answer where they left
 * the question.
 */
function Confirm({ prompt, label, onConfirm, onCancel, busy, held }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-[color:var(--danger-hairline)] bg-[color:var(--danger-wash)] px-5 py-3">
      <p className="max-w-[30rem] text-[13px] leading-relaxed text-[color:var(--danger-ink-on-wash)]">
        {prompt}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={DANGER} onClick={onConfirm} disabled={busy || held}>
          {label}
        </button>
        <button type="button" className={QUIET} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/** A stamp as a date, or nothing when there is no stamp or it does not parse. */
function at(stamp) {
  if (!stamp) return null
  const when = typeof stamp === 'number' ? new Date(stamp * 1000) : new Date(stamp)
  return Number.isNaN(when.getTime()) ? null : when
}

/** A moment as the studio reads it, which is the zone the studio keeps. */
function moment(stamp) {
  const when = at(stamp)
  if (!when) return '—'
  return when.toLocaleString(undefined, {
    timeZone: ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** A day alone, for a fact that is a date rather than a moment. */
function day(stamp) {
  const when = at(stamp)
  if (!when) return '—'
  return when.toLocaleDateString(undefined, { timeZone: ZONE, dateStyle: 'medium' })
}

/** The browser this page is open in, named the way its own string names it. */
function thisDevice() {
  if (typeof navigator === 'undefined') return '—'
  return navigator.userAgent
}

/** The account in four views: who it is, how it signs in, where it is signed in, and closing it. */
const SETTINGS_VIEWS = [
  { key: 'profile', label: 'Profile' },
  { key: 'signin', label: 'Sign-In' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'close', label: 'Close Account' },
]

export default function SettingsPage() {
  const { session, email, userId, signOut, signOutEverywhere } = useSession()
  const mfa = useMfa({ userId })
  const toast = useToast()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [nextEmail, setNextEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [enrolCode, setEnrolCode] = useState('')
  const [typedAddress, setTypedAddress] = useState('')
  const [asking, setAsking] = useState(null)
  const [busy, setBusy] = useState(false)

  const storedName = session?.user?.user_metadata?.full_name ?? ''
  useEffect(() => setName(storedName), [storedName])
  useEffect(() => setNextEmail(email ?? ''), [email])

  const enrolled = mfa.factors.length > 0

  const saveName = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast('Enter the name to show on the account.', 'error')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed } })
    if (error) toast(error.message, 'error')
    else {
      // The profile row is what the console's own reads join against, so the
      // two carry the same name rather than one of them carrying the old one.
      if (userId) await supabase.from('profiles').update({ full_name: trimmed }).eq('id', userId)
      toast('Your name is saved.')
    }
    setBusy(false)
  }, [name, toast, userId])

  const saveEmail = useCallback(async () => {
    const address = nextEmail.trim()
    if (!isValidEmail(address)) {
      toast('Enter an email address in the form name@example.com.', 'error')
      return
    }
    if (address.toLowerCase() === (email ?? '').toLowerCase()) {
      toast('That is already the address on the account.', 'error')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ email: address })
    if (error) toast(error.message, 'error')
    else toast(`A confirmation link is on its way to ${address}.`)
    setBusy(false)
  }, [email, nextEmail, toast])

  const savePassword = useCallback(async () => {
    if (password.length < MIN_PASSWORD) {
      toast(`Use at least ${MIN_PASSWORD} characters for the password.`, 'error')
      return
    }
    if (password !== confirmPassword) {
      toast('The two passwords are different. Type the same one in both fields.', 'error')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) toast(error.message, 'error')
    else {
      setPassword('')
      setConfirmPassword('')
      toast('Your password is changed.')
    }
    setBusy(false)
  }, [confirmPassword, password, toast])

  const copyCodes = useCallback(async () => {
    if (!mfa.codes) return
    try {
      await navigator.clipboard.writeText(mfa.codes.join('\n'))
      toast('The codes are on your clipboard.')
    } catch {
      toast('This browser refused the clipboard. Select the codes and copy them by hand.', 'error')
    }
  }, [mfa.codes, toast])

  const endEverySession = useCallback(async () => {
    setBusy(true)
    const cause = await signOutEverywhere()
    setBusy(false)
    setAsking(null)
    if (cause) toast(cause, 'error')
    else navigate('/login', { replace: true })
  }, [navigate, signOutEverywhere, toast])

  const closeAccount = useCallback(async () => {
    const token = session?.access_token
    if (!token) return
    setBusy(true)
    try {
      const response = await fetch('/api/account-delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast(payload.error || 'The account was not deleted. Try again shortly.', 'error')
        setBusy(false)
        return
      }
      await signOut()
      navigate('/', { replace: true })
    } catch {
      toast('The account service did not answer. Try again shortly.', 'error')
      setBusy(false)
    }
  }, [navigate, session, signOut, toast])

  const armed = typedAddress.trim().toLowerCase() === (email ?? '').toLowerCase() && Boolean(email)
  const [view, go] = useView(SETTINGS_VIEWS)

  return (
    <ConsolePage areas={['nav', 'board']} rows="auto minmax(0,1fr)">
      <Area area="nav">
        <ViewNav views={SETTINGS_VIEWS} current={view} onPick={go} label="Account views" />
      </Area>

      {view === 'profile' ? (
        /* The palette control is three named states in a row, which is wider
           than a third of the room at the narrowest desk, so the name and the
           palette stand one over the other and the facts take the half beside
           them. */
        <Board
          area="board"
          areas={['profile account', 'appearance account']}
          cols={HALVES}
          rows={TWO_ROWS}
        >
          <Panel title="Profile" aside="The name shown on this account" area="profile">
            <PanelBody className={BODY}>
              <TextField
                id="settings-name"
                label="Display Name"
                value={name}
                onChange={setName}
                autoComplete="name"
              />
            </PanelBody>
            <PanelFoot>
              <button type="button" className={BUTTON} onClick={saveName} disabled={busy}>
                Save Name
              </button>
            </PanelFoot>
          </Panel>

          <Panel title="Account" area="account">
            <PanelBody>
              <dl>
                <Metric label="Email Address" value={email || '—'} />
                <Metric
                  label="Two-Factor Authentication"
                  value={
                    <Badge tone={enrolled ? 'good' : 'plain'}>{enrolled ? 'On' : 'Off'}</Badge>
                  }
                  loading={mfa.loading}
                />
                <Metric label="Member Since" value={day(session?.user?.created_at)} />
                <Metric label="Last Signed In" value={moment(session?.user?.last_sign_in_at)} />
              </dl>
            </PanelBody>
          </Panel>

          <Panel title="Appearance" area="appearance">
            <PanelBody className={BODY}>
              <ThemePicker variant="panel" />
              <p className={HINT}>
                System follows the setting on this device and changes with it. The choice is kept in
                this browser and applies across the site, the console included.
              </p>
            </PanelBody>
          </Panel>
        </Board>
      ) : null}

      {view === 'signin' ? (
        <Board area="board" areas={['email password twofactor']} cols={SIGNIN_COLS} rows={ROW}>
          <Panel title="Email Address" aside="The address this account signs in with" area="email">
            <PanelBody className={BODY}>
              <p className={HINT}>
                A change is confirmed from both addresses before it takes effect. Sign-in keeps
                working on the old one until then.
              </p>
              <TextField
                id="settings-email"
                label="Email Address"
                type="email"
                value={nextEmail}
                onChange={setNextEmail}
                autoComplete="email"
              />
            </PanelBody>
            <PanelFoot>
              <button type="button" className={BUTTON} onClick={saveEmail} disabled={busy}>
                Change Email
              </button>
            </PanelFoot>
          </Panel>

          <Panel title="Password" aside="What this account signs in with" area="password">
            {/* The two fields are one answer typed twice, so they sit level with
            each other wherever there is room for two at a typing width, rather
            than one under the other, where the second reads as a second
            question. */}
            <PanelBody className={BODY}>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
                <TextField
                  id="settings-password"
                  label="New Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                />
                <TextField
                  id="settings-password-confirm"
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                />
              </div>
            </PanelBody>
            <PanelFoot>
              <button type="button" className={BUTTON} onClick={savePassword} disabled={busy}>
                Change Password
              </button>
            </PanelFoot>
          </Panel>

          <Panel
            title="Two-Factor Authentication"
            aside={enrolled ? 'On' : 'Off'}
            busy={mfa.busy}
            loading={mfa.loading}
            area="twofactor"
          >
            <PanelBody className={BODY}>
              {mfa.error && (
                <p className="text-[13px] text-[color:var(--danger-on-paper)]" role="status">
                  {mfa.error}
                </p>
              )}

              {mfa.codes && (
                <div className="border-hair-paper-strong max-w-[34rem] rounded-[var(--console-radius-sm)] border px-4 py-4">
                  <p className={`${MONO_LABEL} text-paper-faint`}>Recovery Codes</p>
                  <p className={`${HINT} mt-2`}>
                    Each of these signs in once if the authenticator is out of reach. Keep them
                    somewhere other than the phone the codes protect. They are shown here and
                    nowhere else.
                  </p>
                  <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[13px] text-ink-paper">
                    {mfa.codes.map(code => (
                      <li key={code} className="tabular-nums tracking-[0.08em]">
                        {code}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {mfa.enrolment ? (
                <>
                  <p className={HINT}>
                    Scan this with an authenticator app, then type the six-digit code it shows to
                    finish turning two-factor authentication on.
                  </p>
                  {/* The secret and the code it is answered with stand beside
                      the picture of it, where there is room for them; where
                      there is not, they drop under it rather than squeezing
                      the six digits into a sliver. */}
                  <div className="flex max-w-[34rem] flex-wrap items-start gap-5">
                    <img
                      src={mfa.enrolment.qr}
                      alt="QR code carrying the two-factor secret"
                      width="180"
                      height="180"
                      className="console-qr border-hair-paper-strong rounded-[var(--console-radius-sm)] border p-2"
                    />
                    <div className="min-w-[9rem] flex-1">
                      <p className={`${MONO_LABEL} text-paper-faint`}>Secret</p>
                      <p className="mt-1.5 break-all font-mono text-[13px] tracking-[0.08em] text-ink-paper">
                        {mfa.enrolment.secret}
                      </p>
                      <p className={`${HINT} mt-2`}>
                        Type this into the app by hand where a camera is not an option.
                      </p>
                      <div className="mt-3">
                        <TextField
                          id="settings-enrol-code"
                          label="Authentication Code"
                          value={enrolCode}
                          onChange={setEnrolCode}
                          autoComplete="one-time-code"
                          placeholder="000000"
                          measure="w-full max-w-[10rem]"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : mfa.loading ? (
                <p className={HINT}>
                  <SkeletonBar className="w-full max-w-[34rem]" />
                </p>
              ) : enrolled ? (
                <p className={`${HINT} flex items-start gap-2`}>
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span>
                    Signing in asks for a code from the authenticator app after the password.
                  </span>
                </p>
              ) : (
                <p className={HINT}>
                  A code from an authenticator app, asked for after the password, so a stolen
                  password is not enough on its own. Ten single-use recovery codes come with it.
                </p>
              )}
            </PanelBody>

            {/* The codes are the one thing on the card while they are up, so
                the controls that act on them take the foot, and the factor's
                own come back once the codes are put away. */}
            {mfa.loading ? null : mfa.codes ? (
              <PanelFoot>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={QUIET} onClick={copyCodes}>
                    <Copy className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Copy Codes
                  </button>
                  <button type="button" className={BUTTON} onClick={mfa.dismissCodes}>
                    I Saved These
                  </button>
                </div>
              </PanelFoot>
            ) : mfa.enrolment ? (
              <PanelFoot>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={mfa.busy || !enrolCode.trim()}
                    onClick={() =>
                      mfa.confirm(enrolCode).then(ok => {
                        if (!ok) return
                        setEnrolCode('')
                        toast('Two-factor authentication is on.')
                      })
                    }
                  >
                    Turn On
                  </button>
                  <button
                    type="button"
                    className={QUIET}
                    disabled={mfa.busy}
                    onClick={() => {
                      setEnrolCode('')
                      mfa.cancel()
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </PanelFoot>
            ) : enrolled ? (
              asking === 'mfa' ? (
                <Confirm
                  prompt="Removing the factor leaves the password as the only thing guarding this account, and the recovery codes stop working."
                  label="Remove It"
                  busy={mfa.busy}
                  onCancel={() => setAsking(null)}
                  onConfirm={() =>
                    mfa.remove(mfa.factors[0].id).then(ok => {
                      setAsking(null)
                      if (ok) toast('Two-factor authentication is off.')
                    })
                  }
                />
              ) : (
                <PanelFoot>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={QUIET}
                      disabled={mfa.busy}
                      onClick={() =>
                        mfa.regenerate().then(ok => {
                          if (ok) toast('A new set of recovery codes is ready.')
                        })
                      }
                    >
                      New Recovery Codes
                    </button>
                    <button
                      type="button"
                      className={DANGER}
                      disabled={mfa.busy}
                      onClick={() => setAsking('mfa')}
                    >
                      Remove
                    </button>
                  </div>
                </PanelFoot>
              )
            ) : (
              <PanelFoot>
                <button type="button" className={BUTTON} onClick={mfa.begin} disabled={mfa.busy}>
                  Turn On
                </button>
              </PanelFoot>
            )}
          </Panel>
        </Board>
      ) : null}

      {view === 'sessions' ? (
        <Board area="board" areas={['device everywhere']} cols={HALVES} rows={ROW}>
          <Panel title="This Session" aside="Signed in on this device" area="device">
            <PanelBody>
              <dl>
                <Metric label="Signed In" value={moment(session?.user?.last_sign_in_at)} />
                <Metric label="Expires" value={moment(session?.expires_at)} />
              </dl>
              <div className="border-hair-paper border-t px-5 py-4">
                <p className={`${MONO_LABEL} text-paper-faint`}>This Device</p>
                <p className="mt-1.5 break-words text-[13px] text-paper-soft">{thisDevice()}</p>
              </div>
            </PanelBody>
          </Panel>

          <Panel
            title="All Sessions"
            aside="Every device signed in as this account"
            area="everywhere"
          >
            <PanelBody className={BODY}>
              <p className={HINT}>
                Signing out everywhere ends every session this account holds, on every device,
                including this one.
              </p>
            </PanelBody>
            {asking === 'sessions' ? (
              <Confirm
                prompt="Every device signed in as this account is signed out, and each one has to sign in again."
                label="Sign Out Everywhere"
                busy={busy}
                onCancel={() => setAsking(null)}
                onConfirm={endEverySession}
              />
            ) : (
              <PanelFoot>
                <button
                  type="button"
                  className={DANGER}
                  onClick={() => setAsking('sessions')}
                  disabled={busy}
                >
                  Sign Out Everywhere
                </button>
              </PanelFoot>
            )}
          </Panel>
        </Board>
      ) : null}

      {view === 'close' ? (
        <Board area="board" areas={['close']} rows={ROW}>
          <Panel title="Delete Account" aside="Permanent" area="close">
            <PanelBody className={BODY}>
              <p className={HINT}>
                Deleting the account removes the sign-in, the name on it, its two-factor factor, and
                its access to every site. The sites themselves and their figures stay. Nothing here
                can be undone.
              </p>
              {asking === 'delete' && (
                <>
                  <p className={HINT}>
                    Type <span className="font-mono text-ink-paper">{email}</span> below to confirm.
                  </p>
                  <TextField
                    id="settings-delete-confirm"
                    label="Email Address"
                    value={typedAddress}
                    onChange={setTypedAddress}
                    autoComplete="off"
                  />
                </>
              )}
            </PanelBody>
            {asking === 'delete' ? (
              <Confirm
                prompt="This closes the account and cannot be reversed."
                label="Delete Account"
                busy={busy}
                held={!armed}
                onCancel={() => {
                  setAsking(null)
                  setTypedAddress('')
                }}
                onConfirm={closeAccount}
              />
            ) : (
              <PanelFoot>
                <button
                  type="button"
                  className={DANGER}
                  onClick={() => setAsking('delete')}
                  disabled={busy}
                >
                  Delete Account
                </button>
              </PanelFoot>
            )}
          </Panel>
        </Board>
      ) : null}
    </ConsolePage>
  )
}
