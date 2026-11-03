import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import Seo from '@components/Seo'
import { Button, Container, PhoneButton } from '@components/kit/Kit'
import { BUTTONS, CARD, TYPE } from '@components/kit/styles'
import { useAnnounceGround } from '@hooks/theme/useOnDarkBackground'
import { billingWord, money, PROPOSAL_KEY, totals } from '@data/checkout/proposal'
import { payProposal, readProposal } from '@data/checkout/pay'

/** A date the profile holds as `2026-12-02`, as a person reads it. */
function longDate(iso) {
  const [year, month, day] = String(iso || '')
    .split('-')
    .map(Number)
  if (!year || !month || !day) return ''
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** One line of the sheet: its name, how it is billed, and its price. */
function Line({ line, control }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 py-4">
      <div className="flex min-w-0 items-baseline gap-3">
        {control}
        <div className="min-w-0">
          <p className="text-[16px] font-medium leading-[1.4] text-ink">{line.name}</p>
          <p className={`${TYPE.small} mt-0.5`}>
            {billingWord(line)}
            {line.extra ? ` · ${line.extra}` : ''}
          </p>
        </div>
      </div>
      <p className="text-right text-[16px] font-medium tabular-nums text-ink">
        {money(line.cents)}
      </p>
    </div>
  )
}

/** The frame every state but the sheet itself reports into. */
function Notice({ heading, body }) {
  return (
    <section data-ground="dark" className="glow">
      <Container narrow className="flex min-h-[calc(100dvh-80px)] items-center py-12 sm:py-20">
        <div className={`${CARD} w-full p-6 sm:p-10`}>
          <h1 className={TYPE.h2}>{heading}</h1>
          {body && <p className={`${TYPE.body} mt-3 max-w-xl`}>{body}</p>}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PhoneButton className="w-full sm:w-auto" place="pay" />
            <Button to="/" variant="secondary" className="w-full sm:w-auto">
              Return to Home
            </Button>
          </div>
        </div>
      </Container>
    </section>
  )
}

/**
 * The page a proposal's QR code opens.
 *
 * The sheet handed across the table carries a QR code and a link, and both
 * land here with the profile's private key in the query string. The page draws
 * the sheet as it stands now - the services and the Monthly Fee, always
 * included, then the add-ons as boxes to tick - and keeps the totals in step
 * with what is ticked: what is due today, then the sheet's own first-year and
 * each-year-after figures. Pay sends the ticked names and nothing else; the
 * prices are read off the profile at the other end.
 *
 * The key lives in the query string because nothing here rewrites an unknown
 * path to the app, so the page has to be one address that is built ahead of
 * time. The figures arrive in the browser, which is also why the page is
 * built showing that it is reading.
 */
export default function Pay() {
  useAnnounceGround()
  const [params] = useSearchParams()
  const key = params.get('p') || ''
  const [sheet, setSheet] = useState(null)
  const [state, setState] = useState('reading')
  const [failure, setFailure] = useState('')
  const [ticked, setTicked] = useState(() => new Set())
  const [paying, setPaying] = useState(false)
  const [payFailure, setPayFailure] = useState('')
  const asked = useRef(null)

  useEffect(() => {
    if (asked.current === key) return
    asked.current = key
    if (!PROPOSAL_KEY.test(key)) {
      setState('missing')
      return
    }
    setState('reading')
    readProposal(key)
      .then(read => {
        setSheet(read)
        setState(read ? read.state : 'missing')
      })
      .catch(cause => {
        setFailure(cause.message)
        setState('failed')
      })
  }, [key])

  const chosen = useMemo(
    () => (sheet ? sheet.addons.filter(addon => ticked.has(addon.name)) : []),
    [sheet, ticked]
  )
  const sums = useMemo(() => (sheet ? totals([...sheet.items, ...chosen]) : null), [sheet, chosen])

  const toggle = name =>
    setTicked(held => {
      const next = new Set(held)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const pay = async () => {
    setPaying(true)
    setPayFailure('')
    try {
      window.location.assign(await payProposal(key, [...ticked]))
    } catch (cause) {
      setPayFailure(cause.message)
      setPaying(false)
    }
  }

  const seo = (
    <Seo
      title="Your Proposal"
      description="Choose add-ons and pay for a TaylorURL proposal."
      path="/pay"
      noIndex
    />
  )

  if (state === 'missing') {
    return (
      <>
        {seo}
        <Notice
          heading="This link doesn’t open a proposal."
          body="Scan the code on the sheet again, or call and I’ll send the link."
        />
      </>
    )
  }
  if (state === 'failed') {
    return (
      <>
        {seo}
        <Notice heading="This proposal couldn’t be opened." body={failure} />
      </>
    )
  }
  if (state === 'paid') {
    return (
      <>
        {seo}
        <Notice
          heading="This proposal is paid. Thank you."
          body={`Everything for ${sheet.client} is underway. Call with anything you need.`}
        />
      </>
    )
  }
  if (state === 'expired') {
    return (
      <>
        {seo}
        <Notice
          heading="These prices have run out."
          body={`They were good until ${longDate(sheet.goodUntil)}. Call and I’ll send a fresh proposal.`}
        />
      </>
    )
  }

  const reading = state === 'reading' || !sheet
  const longer = chosen.some(addon => addon.per === 'quarter' || addon.per === 'year')

  return (
    <>
      {seo}
      <section data-ground="dark" className="glow pb-16 pt-10 sm:pb-24 sm:pt-16">
        <Container narrow>
          <p className={TYPE.label}>Proposal</p>
          <h1 className={`${TYPE.display} mt-3`}>
            {reading ? 'Opening your proposal…' : sheet.client}
          </h1>
          {!reading && (
            <p className={`${TYPE.lead} mt-4`}>
              Prices good until {longDate(sheet.goodUntil)}. Tick any add-ons you want, then pay
              securely with Stripe.
            </p>
          )}

          {!reading && (
            <>
              <div className={`${CARD} mt-10 px-5 py-2 sm:px-8`}>
                <p className={`${TYPE.label} pt-4`}>Included</p>
                <div className="divide-y divide-[color:var(--line)]">
                  {sheet.items.map(line => (
                    <Line key={line.name} line={line} />
                  ))}
                </div>
              </div>

              {sheet.addons.length > 0 && (
                <fieldset className={`${CARD} mt-4 px-5 py-2 sm:px-8`}>
                  <legend className="sr-only">Optional add-ons</legend>
                  <p className={`${TYPE.label} pt-4`} aria-hidden="true">
                    Optional add-ons
                  </p>
                  <div className="divide-y divide-[color:var(--line)]">
                    {sheet.addons.map(addon => {
                      const id = `addon-${addon.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
                      const on = ticked.has(addon.name)
                      return (
                        <label key={addon.name} htmlFor={id} className="block cursor-pointer">
                          <Line
                            line={addon}
                            control={
                              <span className="relative top-[3px] shrink-0">
                                <input
                                  id={id}
                                  type="checkbox"
                                  className="peer sr-only"
                                  aria-label={`${addon.name}, ${billingWord(addon).toLowerCase()}, ${money(addon.cents)}`}
                                  checked={on}
                                  onChange={() => toggle(addon.name)}
                                />
                                <span
                                  aria-hidden="true"
                                  className={`flex h-[22px] w-[22px] items-center justify-center rounded-[7px] transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--accent)] ${
                                    on ? 'bg-[var(--blue)] text-white' : 'bg-white/[0.1]'
                                  }`}
                                >
                                  {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                                </span>
                              </span>
                            }
                          />
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              )}

              <div className={`${CARD} mt-4 p-5 sm:p-8`} aria-live="polite">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-[17px] font-medium text-ink">Due today</p>
                  <p className="text-[32px] font-semibold tabular-nums leading-none tracking-[-0.03em] text-ink">
                    {money(sums.today)}
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  {sums.rows.map(([label, cents]) => (
                    <div key={label} className="flex items-baseline justify-between gap-4">
                      <p className={TYPE.small}>{label}</p>
                      <p className="text-[15px] tabular-nums text-ink-soft">{money(cents)}</p>
                    </div>
                  ))}
                </div>
                <p className={`${TYPE.small} mt-5`}>
                  Today covers every one-time item and the first period of everything recurring. The
                  Monthly Fee and monthly add-ons renew each month
                  {longer ? '; quarterly and yearly add-ons renew on their own schedule' : ''}.
                  Sales tax, if any, is added at checkout.
                </p>
                <button
                  type="button"
                  onClick={pay}
                  disabled={paying}
                  className={`${BUTTONS.primary} mt-6 w-full disabled:cursor-wait disabled:opacity-70`}
                >
                  {paying ? 'Opening checkout…' : `Pay ${money(sums.today)}`}
                </button>
                {payFailure && (
                  <p className="mt-3 text-[14px] text-[color:var(--danger)]" role="alert">
                    {payFailure}
                  </p>
                )}
              </div>
            </>
          )}
        </Container>
      </section>
    </>
  )
}
