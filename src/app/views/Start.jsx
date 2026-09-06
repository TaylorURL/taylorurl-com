import { useEffect, useRef, useState } from 'react'
import Seo from '@components/Seo'
import { useToast } from '@hooks/useToast'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { isValidEmail } from '@utils/validation'
import { openCheckout, checkoutErrorMessage } from '@data/startCheckout'
import { recordStart } from '@data/startLead'
import { PRICE_OFFERS } from '@data/pricing'
import { EMAIL_PROVIDERS, toolsForTrade, tradeById } from '@data/trades'
import { PORTFOLIO_PROJECTS, portfolioProofFor } from '@data/portfolio'
import StepFlow from './start/StepFlow'
import Preamble from './start/Preamble'
import Introduction from './start/Introduction'
import TradeGrid from './start/TradeGrid'
import WorkSection from './start/WorkSection'
import { SOMETHING_DIFFERENT } from './start/DesignChoice'
import LookSection from './start/LookSection'
import { EMPTY_LOOK, FEEL_LIMIT, lookOpen, lookSummary } from './start/lib/look'
import { recalledStart, rememberStart } from './start/lib/memory'
import ContactSection from './start/ContactSection'
import EmailSection from './start/EmailSection'
import PriceSection from './start/PriceSection'
import PaySection from './start/PaySection'
import SaveSection from './start/SaveSection'

const EMPTY_BUY = { businessName: '', email: '', website: '' }

// How long the typing has to stop before the address counts as answered. Long
// enough that a name typed a character at a time is one answer rather than
// twelve, short enough that somebody who types it and reaches for the tab
// close is already recorded.
const SETTLE_MS = 700

// How long the picking has to stop before an answer changed inside a step the
// visitor has already been counted at is reported. Longer than the address,
// because a mesh of options is answered with a run of taps and each one would
// otherwise be its own report; the address is one field typed once.
const PICKING_MS = 2500

/**
 * What a step is still waiting on, as the line under its own Continue button.
 *
 * One sentence rather than a mark against each control, because the reader is
 * looking at the button that did not work and the answer to why has to be
 * where they are looking.
 */
const stillOpen = open => (open.length ? `Still to answer: ${open.join(', ')}.` : null)

/**
 * Everything a report would say, as one line, so one can be told from the next.
 *
 * The answers are in it because a visitor who goes back and takes a design off
 * the wall has told the site something new while standing at a step number it
 * has already been counted at. Held apart, that change would never be
 * recorded.
 *
 * This is what a report is checked against, and it is deliberately wider than
 * what sets one off: the notes box is in the mark and not in the print, so a
 * sentence typed there never triggers a report of its own and is still sent by
 * the one that follows it or by the tab closing.
 */
const markOf = held => `${held.email.trim().toLowerCase()}|${held.step}|${held.print}|${held.notes}`

/**
 * The steps the send-me-this panel stands under.
 *
 * Not the first, because a visitor who has picked a trade and nothing else has
 * no brief to send and would be handed a form before they had answered
 * anything. Not the last, because the payment screen carries its own way out
 * and a second form beside the card is a second decision at the worst moment
 * to be given one.
 */
const SAVEABLE = new Set([1, 2, 3])

/**
 * The design wall for a trade: the client sites built for it first, then the
 * rest of the work in portfolio order.
 */
function designOptionsFor(matches) {
  return [...matches, ...PORTFOLIO_PROJECTS.filter(project => !matches.includes(project))]
}

/** How the designs taken off the wall read in the inquiry. */
function designSummary(designs) {
  if (designs.includes(SOMETHING_DIFFERENT)) return 'None of these, drawn from scratch'
  const names = PORTFOLIO_PROJECTS.filter(project => designs.includes(project.url)).map(
    project => project.name
  )
  return names.join(', ') || 'Not chosen'
}

/**
 * The configurator.
 *
 * One route, one frame. Five steps run through it in place: the trade and the
 * address to reach the business on, the work and the designs that go with it,
 * the look a first draft is drawn from, the price, and the payment that starts
 * the build. The frame holds its position while they cross it, so a visitor
 * answering the last question is looking where they answered the first.
 *
 * The first step is a gate rather than a question. Four screens of picking
 * used to be given away before the site knew who was doing the picking, so
 * everyone who left before the card was a brief with nobody attached to it.
 * The trade and a working address open the rest, and the address then rides
 * through the flow into the send-me-this panel and the payment form, so it is
 * answered once at the cheapest moment rather than at the most expensive one.
 *
 * Each answer rewrites what follows it. A different trade means different
 * work, different software, and designs picked off the shop before it, so
 * those come off with the trade rather than travelling to a business they were
 * never picked for. The look belongs to the business rather than to its trade,
 * so it survives the change.
 *
 * The route is prerendered, so the opening step renders without a browser and
 * the steps behind it come from state that starts empty. What has been picked
 * is written down as it is picked and read back on the next mount, so a reload
 * or a mistaken back gesture costs the place in the flow rather than the whole
 * configuration. Nothing typed into the payment form is written down; the
 * address the form opens with was answered four steps earlier and is held as
 * the answer it is.
 *
 * The payment carries the configuration. Every answer travels to Stripe as the
 * brief, so nothing chosen with a control has to be typed again, and the build
 * opens under the address the card was used with rather than waiting on a
 * conversation to reach it.
 */
export default function Start() {
  const toast = useToast()
  const [tradeId, setTradeId] = useState(null)
  const [email, setEmail] = useState('')
  const [designs, setDesigns] = useState([])
  const [look, setLook] = useState(EMPTY_LOOK)
  const [chosenTools, setChosenTools] = useState([])
  const [provider, setProvider] = useState(null)
  const [buy, setBuy] = useState(EMPTY_BUY)
  const [agreed, setAgreed] = useState(false)
  const [buyStatus, setBuyStatus] = useState('idle')
  const [buyFault, setBuyFault] = useState(null)
  const [step, setStep] = useState(0)
  const [resumeAt, setResumeAt] = useState(null)
  const restored = useRef(false)

  // Whether the payment form's own address has been typed into. Until it has,
  // it follows the address given on the first step, because they are the same
  // address and asking for it twice is how one buyer ends up with a receipt at
  // one and a project at the other. Once it has been edited it stops following:
  // a buyer paying on a billing address knows which one they meant.
  const buyEmailEdited = useRef(false)

  // The configuration a previous visit left behind. It is read after the first
  // paint rather than into the initial state, because the route is prerendered
  // and the markup the browser is handed was drawn without a store to read.
  useEffect(() => {
    const held = recalledStart()
    if (held) {
      setTradeId(held.tradeId)
      setEmail(held.email)
      setBuy(current => ({ ...current, email: held.email }))
      setDesigns(held.designs)
      // The limit holds on the way back in too. What comes out of a store is
      // whatever was put in it, and the rule is the state's rather than the
      // step's.
      setLook({ ...held.look, feels: held.look.feels.slice(0, FEEL_LIMIT) })
      setChosenTools(held.chosenTools)
      setProvider(held.provider)
      // The place is taken here as well as handed to the frame, so the first
      // write back does not record a step of zero in the moment between the
      // answers landing and the frame moving to meet them.
      setStep(held.step)
      if (held.step > 0) setResumeAt(held.step)
    }
    restored.current = true
  }, [])

  // Written down as it is made, and never before the restore has had its turn:
  // an empty first render reaching the store would erase what it was about to
  // read back.
  useEffect(() => {
    if (!restored.current) return
    rememberStart({ tradeId, email, designs, look, chosenTools, provider, step })
  }, [tradeId, email, designs, look, chosenTools, provider, step])

  const trade = tradeById(tradeId)
  const tools = toolsForTrade(trade)
  const matches = portfolioProofFor(tradeId)
  const chosenToolNames = tools.filter(tool => chosenTools.includes(tool.id)).map(tool => tool.name)
  const providerName = EMAIL_PROVIDERS.find(option => option.id === provider)?.name

  const summary = [
    { label: 'Business Type', value: trade?.name || 'Not chosen' },
    { label: 'Designs You Like', value: designSummary(designs) },
    ...lookSummary(look),
    { label: 'Tools in Use', value: chosenToolNames.join(', ') || 'None checked' },
    { label: 'Business Email', value: providerName || 'Not chosen' },
  ]

  // What sets a report off, as one line. Everything a control sets is in it and
  // the notes box is not: a sentence typed a word at a time would otherwise be
  // a report per pause. The mark the report is checked against is wider, so
  // what is typed there is still carried by the next report and by the tab
  // closing.
  const briefPrint = [
    tradeId,
    designs.join(','),
    look.feels.join(','),
    look.brand,
    look.photos,
    look.voice,
    chosenTools.join(','),
    provider,
  ].join('~')

  // What the last report said, so the same answer is not sent twice, and the
  // step it said it at, so a change made without moving can be told from a
  // move.
  const reported = useRef({ mark: '', step: -1 })
  // What a report would say right now, held where a listener can read it
  // without being rebuilt every keystroke.
  const standing = useRef(null)
  standing.current = {
    email,
    trade: trade?.name || null,
    step,
    // The same rows the payment and the enquiry carry, so a lead that stops
    // halfway is read in the words a finished one is read in.
    brief: summary,
    print: briefPrint,
    notes: look.notes,
  }

  // The address goes up once it is an address, a moment after the typing
  // settles rather than on every keystroke, and again each time the visitor
  // reaches a further step or changes what they picked. A configuration
  // abandoned on the fourth screen is then a lead carrying the brief it was
  // abandoned with, rather than an address and a number.
  useEffect(() => {
    if (!isValidEmail(email)) return undefined
    const mark = markOf(standing.current)
    if (reported.current.mark === mark) return undefined

    const settle = reported.current.step === step ? PICKING_MS : SETTLE_MS
    const timer = setTimeout(() => {
      reported.current = { mark, step }
      recordStart(standing.current)
    }, settle)
    return () => clearTimeout(timer)
  }, [email, step, briefPrint])

  // The one report that cannot wait for the settle. Somebody who answers a
  // screen and closes the tab in the same second is the visitor this exists
  // for, and their report is still sitting in a timer when the document goes.
  useEffect(() => {
    const flush = () => {
      const held = standing.current
      if (!held || !isValidEmail(held.email)) return
      const mark = markOf(held)
      if (reported.current.mark === mark) return
      reported.current = { mark, step: held.step }
      recordStart(held)
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  // A trade change rewrites the work on offer, so the designs picked off the
  // old trade's wall and the software ticked for the old shop both come off
  // rather than travelling to a business that never ran them.
  const handleTrade = id => {
    setTradeId(id)
    setDesigns([])
    setChosenTools([])
  }

  // The address is one answer held in two places, so the payment form is kept
  // level with it until somebody there says otherwise. It is mirrored rather
  // than shared, because a single value would put a half-deleted address on the
  // payment screen back through the first step's gate and throw the buyer four
  // steps backwards mid-edit.
  const handleEmailChange = event => {
    const { value } = event.target
    setEmail(value)
    if (!buyEmailEdited.current) setBuy(current => ({ ...current, email: value }))
  }

  // Wanting none of the wall and wanting several of it are different answers,
  // so each clears the other.
  const handleToggleDesign = value => {
    setDesigns(current => {
      if (value === SOMETHING_DIFFERENT) return current.includes(value) ? [] : [value]
      const picks = current.filter(held => held !== SOMETHING_DIFFERENT)
      return picks.includes(value) ? picks.filter(held => held !== value) : [...picks, value]
    })
  }

  // The limit is held here as well as drawn in the step, so the answer a
  // fourth tap would carry is refused at the state rather than only in the UI.
  const handleToggleFeel = id => {
    setLook(current => {
      if (current.feels.includes(id)) {
        return { ...current, feels: current.feels.filter(held => held !== id) }
      }
      if (current.feels.length >= FEEL_LIMIT) return current
      return { ...current, feels: [...current.feels, id] }
    })
  }

  const handleLookChoice = (key, id) => setLook(current => ({ ...current, [key]: id }))

  const handleNotesChange = event => {
    const { value } = event.target
    setLook(current => ({ ...current, notes: value }))
  }

  const handleToggleTool = id => {
    setChosenTools(current =>
      current.includes(id) ? current.filter(held => held !== id) : [...current, id]
    )
  }

  // A field being worked on is no longer the field that was refused, so the
  // fault comes off as soon as it is being answered rather than waiting for the
  // next send to say so.
  const handleBuyChange = event => {
    const { name, value } = event.target
    if (name === 'email') buyEmailEdited.current = true
    setBuy(current => ({ ...current, [name]: value }))
    setBuyFault(current => (current?.field === name ? null : current))
  }

  // The agreement is a fresh act every time, which is why it is state here and
  // not in the store the answers are kept in. A tick recalled from a previous
  // visit is a box the site ticked for somebody, and that is not agreement.
  const handleAgree = event => {
    setAgreed(event.target.checked)
    setBuyFault(current => (current?.field === 'terms' ? null : current))
  }

  /**
   * Hands the buyer to Stripe.
   *
   * The status is not put back on success, because success is the page being
   * replaced: clearing it would light the button up again for the moment the
   * browser takes to leave, which reads as the payment having failed.
   *
   * Nothing opens without the terms being agreed to. The button is left live
   * rather than disabled, because a control that does nothing and says nothing
   * is a page a buyer decides is broken; refusing it names the reason and puts
   * the focus on the box that answers it. The endpoint refuses the same
   * request, so the agreement is a condition of the sale rather than a
   * courtesy of this screen.
   */
  const handleBuySubmit = async event => {
    event.preventDefault()
    if (buyStatus === 'submitting') return

    if (!isValidEmail(buy.email)) {
      const fault = { field: 'email', fault: 'That email address does not look right.' }
      setBuyFault(fault)
      toast(fault.fault, 'error')
      document.getElementById('start-buy-email')?.focus()
      return
    }

    if (!agreed) {
      const fault = { field: 'terms', fault: 'The terms have to be agreed to before you pay.' }
      setBuyFault(fault)
      toast(fault.fault, 'error')
      document.getElementById('start-terms')?.focus()
      return
    }

    setBuyFault(null)
    setBuyStatus('submitting')

    try {
      const page = await openCheckout({
        email: buy.email,
        businessName: buy.businessName,
        website: buy.website,
        // The same rows the enquiry path has always carried. A buyer who pays
        // answered every one of these screens too, and used to arrive at the
        // build with nothing but an address and a business name.
        brief: summary,
        termsAccepted: agreed,
      })
      window.location.assign(page)
    } catch (error) {
      setBuyStatus('idle')
      toast(checkoutErrorMessage(error), 'error')
    }
  }

  // What each step is still waiting on. A step opens the next one when its list
  // is empty, so the conditions and the sentence that explains them are the
  // same thing rather than two statements that can drift apart.
  //
  // Every question named here changes what comes after it, which is what makes
  // it worth stopping for. What is not named is not asked twice: the software
  // a trade runs is a list some businesses answer with none, the notes box
  // holds what the options cannot, and a current website is a thing plenty of
  // buyers do not have.
  const tradeStillOpen = [
    ...(trade ? [] : ['your business type']),
    ...(isValidEmail(email) ? [] : ['your email address']),
  ]
  const workStillOpen = designs.length ? [] : ['at least one design you like']
  const lookStillOpen = lookOpen(look)
  const priceStillOpen = provider ? [] : ['where your email lives now']

  const steps = [
    {
      id: 'trade',
      label: 'Business Type',
      eyebrow: 'Your Trade',
      title: 'What type of business do you have?',
      description:
        'Pick the closest one and leave an address. Everything after it is written for the trade and held against the address.',
      answered: tradeStillOpen.length === 0,
      missing: stillOpen(tradeStillOpen),
      content: (
        <div className="flex flex-col gap-10">
          <Introduction />
          <TradeGrid selected={tradeId} labelledBy="trade-title" onSelect={handleTrade} />
          <ContactSection email={email} onChange={handleEmailChange} />
        </div>
      ),
    },
    {
      id: 'work',
      label: 'The Work',
      eyebrow: 'The Work',
      title: 'Work already live. Yours starts from what you pick.',
      description: 'Pick every design you like. What they have in common is where yours starts.',
      meta: trade ? <span className="chip chip-accent">{trade.name}</span> : null,
      answered: workStillOpen.length === 0,
      missing: stillOpen(workStillOpen),
      content: trade ? (
        <WorkSection
          trade={trade}
          lead={matches[0] || null}
          designOptions={designOptionsFor(matches)}
          designs={designs}
          onToggleDesign={handleToggleDesign}
          tools={tools}
          chosenTools={chosenTools}
          onToggleTool={handleToggleTool}
        />
      ) : null,
    },
    {
      id: 'look',
      label: 'The Look',
      eyebrow: 'The Look',
      title: 'How yours should look and read.',
      description:
        'The first draft is drawn from these answers. None of it is locked, and all of it can change once we talk.',
      answered: lookStillOpen.length === 0,
      missing: stillOpen(lookStillOpen),
      content: (
        <LookSection
          look={look}
          onToggleFeel={handleToggleFeel}
          onChoose={handleLookChoice}
          onNotesChange={handleNotesChange}
        />
      ),
    },
    {
      id: 'price',
      label: 'What It Costs',
      eyebrow: 'The Price',
      title: 'One price to build it. One price to run it.',
      description:
        'You pay for the build once. The monthly covers everything the site needs after that.',
      answered: priceStillOpen.length === 0,
      missing: stillOpen(priceStillOpen),
      content: (
        <div className="flex flex-col gap-16">
          <PriceSection />
          <EmailSection provider={provider} onSelect={setProvider} />
        </div>
      ),
    },
    {
      id: 'pay',
      label: 'Start the Build',
      eyebrow: 'Payment',
      title: 'Pay for the build and the work starts.',
      description:
        'Everything you have picked comes with the payment, so the only fields left are the ones a receipt needs.',
      answered: true,
      content: (
        <PaySection
          buy={buy}
          status={buyStatus}
          agreed={agreed}
          fault={buyFault}
          summary={summary}
          onChange={handleBuyChange}
          onAgree={handleAgree}
          onSubmit={handleBuySubmit}
        />
      ),
    },
  ]

  return (
    <div>
      <Seo
        title="Start Your Small Business Website"
        description="Pick your trade and see the work already live, the software the site runs beside, business email, and the price: from $1,000 up front and $99 a month."
        path="/start"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Start', path: '/start' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            '@id': `${SITE_URL}/start#offer`,
            serviceType: 'Web design, hosting, and maintenance',
            name: 'Small business website, built and looked after',
            provider: { '@id': BUSINESS_ID },
            offers: PRICE_OFFERS,
          },
        ]}
      />

      {/* The configurator is the page. A hero above it said what the steps
          were about to say and put a screen of type between the reader and the
          one control they came to use, so what stands over the first step is a
          heading, a sentence, and the names of the services it is for, rather
          than a screen. */}
      <StepFlow
        steps={steps}
        atTop
        draft="column"
        head={<Preamble />}
        resumeAt={resumeAt}
        onStep={setStep}
        aside={
          SAVEABLE.has(step) ? (
            <SaveSection summary={summary} tradeName={trade?.name || ''} email={email} />
          ) : null
        }
      />
    </div>
  )
}
