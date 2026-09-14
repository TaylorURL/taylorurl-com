/**
 * Proves that what a caller reads out on the phone is true, complete, and
 * about the business they are ringing.
 *
 * Everything this catches is silent, and three of them are worse than silent
 * because the failure is read aloud to a stranger before anybody sees it.
 *
 * A SENTENCE WITH A HOLE IN IT. Every line of the opening is composed from the
 * row, and a row is allowed to be missing almost anything: no trade, no town,
 * no reviews, no median, no website. A template that interpolates `undefined`
 * into one of those produces a grammatical sentence with the word undefined in
 * the middle of it, and the first person to find out is the owner of a barber
 * shop. So every shape of row is composed and every line is read back.
 *
 * A CLAIM WITH NOTHING BEHIND IT. "We have built for your line of work already"
 * is the strongest thing said on the call and the one thing the person on the
 * phone can check while they are still on it. It is only ever said when the row
 * carries the client to name, which means it depends on a field the endpoint
 * fills in - so both ends of that field are held here. The endpoint dropping it
 * would not break anything: the script would quietly fall back to the generic
 * line on every call, forever, and the list would look exactly the same.
 *
 * A PRICE QUOTED AT ALL. A build is worked out for the job it is, so there is
 * no figure for a caller to read out and a number said down the phone is one
 * the caller invented. What the answer carries instead is how the number gets
 * settled and when they will have it, so nothing here may spell a dollar amount
 * out and the answer to what it costs has to say how it is arrived at.
 *
 * A CALL THAT ASKS FOR THE WRONG THING. The first call sells nothing and quotes
 * nothing: it asks for a yes to a free audit and a time the same day to go
 * through it, and everything about the money happens on that second call with
 * the audit in front of the owner. The handbook is the only place that strategy
 * is written down, so a line that slipped back to offering a plan by email is
 * the old call being made over and over by whoever read it last, and it would
 * look exactly like the handbook working. So the ask and the close are held to
 * naming the audit and the same day, and to promising no plan.
 *
 * A SEARCH THAT ONLY READS HEADINGS. The handbook is used one-handed with
 * somebody waiting, and the word reached for is the word that was just said -
 * "facebook", "wordpress", "locked in" - which is in the answer rather than in
 * the question. A search that matched headings alone would look like it worked
 * and would find nothing when it mattered.
 *
 *   npm run check:call-handbook
 */
import {
  CLOSING,
  FACTS,
  HANDBOOK_PARTS,
  PLACES_TO_SEND,
  PUSHBACK,
  QUESTIONS,
  handbookMatches,
  scriptFor,
} from '../../../lib/outreach/prospects/handbook.js'
import { PORTFOLIO_AVERAGES } from '../../../src/app/data/portfolio.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'
import { read } from '../../harness/files.js'

/**
 * The one screen the handbook is drawn on.
 *
 * There used to be two - a panel beside the console's call list and a page in
 * the representatives' portal - and they were two sets of headings over one
 * source, which is a second place for a search to go missing from. The console
 * draws the portal itself now, so the surface is one file and both readers open
 * the same one.
 */
const HANDBOOK = 'src/app/views/staff/parts/Handbook.jsx'

/** A business the way the console draws one, complete unless the case strips it. */
const business = (over = {}) => ({
  id: 'one',
  name: 'Righteous Barbershop',
  trade: 'barber shop',
  town: 'Dickinson',
  phone: '(713) 855-6602',
  website: 'https://righteousbarbershop.square.site/',
  site_kind: 'social',
  rating: 4.9,
  rating_count: 578,
  trade_median: 52,
  pull: 'busy',
  proof: 'trade',
  proof_work: [{ name: 'Impressiva Printing', town: 'Pasadena', url: 'impressivaprinting.com' }],
  calls: [],
  ...over,
})

/** Every collection a person reads, so a rule about all of them is written once. */
const COLLECTIONS = [
  ['the questions', QUESTIONS],
  ['the pushback', PUSHBACK],
  ['the facts', FACTS],
  ['the closing', CLOSING],
  ['the places to send', PLACES_TO_SEND],
  ['the parts', HANDBOOK_PARTS],
]

// ── A sentence with a hole in it ───────────────────────────────────────────

/**
 * Every shape of row the table actually produces.
 *
 * The website and `site_kind` pairs are the four presence readings, and the
 * stripped rows are what an unenriched listing looks like: the sweep files a
 * name and a number long before anything measures a trade.
 */
const SHAPES = [
  ['a booking page', business({ website: 'https://one.square.site/', site_kind: 'social' })],
  ['a social page', business({ website: 'https://facebook.com/one', site_kind: 'social' })],
  ['a directory', business({ website: 'https://yelp.com/biz/one', site_kind: 'social' })],
  ['no website at all', business({ website: null, site_kind: 'none' })],
  ['a trade nothing has measured', business({ trade_median: null, pull: 'unread' })],
  ['no reviews counted', business({ rating_count: null, trade_median: null, pull: 'unread' })],
  ['no trade and no town', business({ trade: null, town: null, pull: 'unread' })],
  ['work of ours in its town', business({ proof: 'town', proof_work: [{ name: 'A', town: 'B' }] })],
  ['no work of ours to name', business({ proof: null, proof_work: [] })],
  ['a quiet listing', business({ pull: 'quiet', rating_count: 4 })],
  [
    'a listing with no reviews on it',
    business({ pull: 'quiet', rating_count: null, business_status: 'OPERATIONAL' }),
  ],
  ['a middling listing', business({ pull: 'steady', rating_count: 51 })],
  ['a gatekeeper already met', business({ calls: [{ outcome: 'gatekeeper' }] })],
  ['nothing but an id', { id: 'bare' }],
]

check('every shape of business composes a whole script', () => {
  for (const [what, row] of SHAPES) {
    const script = scriptFor(row)
    same(script.length, 6, `${what}: the script came back a different length`)
    for (const line of script) {
      ok(line.id, `${what}: a line came back with no id`)
      ok(line.label, `${what}: a line came back with no label`)
      ok(line.say && line.say.trim().length > 20, `${what}: ${line.id} had nothing to say`)
      ok(!/undefined|null|NaN|\[object/.test(line.say), `${what}: ${line.id} reads "${line.say}"`)
      ok(!/\s{2,}/.test(line.say), `${what}: ${line.id} has a gap in it: "${line.say}"`)
    }
  }
})

check('the opening is about the business rather than about businesses', () => {
  const say = scriptFor(business())
    .map(line => line.say)
    .join(' ')
  ok(say.includes('578'), 'the reviews the row carries were not said')
  ok(say.includes('52'), 'the middle for its trade was not said')
  ok(say.includes('barber shop'), 'its trade was not said')
  ok(say.includes('Square'), 'the platform its listing points at was not named')
})

check('a listing with no reviews is told it has none, not that it cannot be measured', () => {
  // The list leads with these, so the line is read on most calls. Google
  // leaves the count off a listing nobody has reviewed, and reading that as an
  // unmeasured trade told an owner with no reviews something untrue about their
  // trade instead of the one true thing about them.
  const trade = row => scriptFor(row).find(line => line.id === 'trade').say
  const none = trade(
    business({ pull: 'quiet', rating_count: null, business_status: 'OPERATIONAL' })
  )
  ok(none.includes('no reviews'), `a listing with no reviews was told: "${none}"`)
  ok(
    !none.includes('too few'),
    `a listing with no reviews was told it could not be measured: "${none}"`
  )
  const one = trade(business({ pull: 'quiet', rating_count: 1 }))
  ok(one.includes('1 review '), `one review was said as: "${one}"`)
})

check('a listing with no website is not told about its website', () => {
  const say = scriptFor(business({ website: null, site_kind: 'none' })).find(
    line => line.id === 'reason'
  ).say
  ok(!/your .* page/.test(say), `a business with no site was told about its page: "${say}"`)
})

// ── A line too long to say ─────────────────────────────────────────────────

/**
 * Everything a caller reads out loud, from every part of the handbook.
 *
 * The script is composed, so it is taken off a real row rather than off the
 * module - a length rule that never sees the interpolated version is a rule
 * about the template rather than about the sentence somebody says.
 */
const SPOKEN = () => [
  ...scriptFor(business()).map(one => [one.label, one.say]),
  ...QUESTIONS.map(one => [one.ask, one.say]),
  ...PUSHBACK.map(one => [one.said, one.say]),
  ...CLOSING.map(one => [one.label, one.say]),
]

/** Sentences, counted the way a person reads them off a screen. */
const sentences = text => (String(text).match(/[.?!](\s|$)/g) ?? []).length || 1

/**
 * Nothing said down a phone runs past three sentences, and most of it stops at
 * two.
 *
 * A caller reads these while somebody waits on the other end, and a paragraph
 * is the one shape that cannot be read that way: they lose the line, start
 * paraphrasing, and the handbook is worth nothing from there on. The ceiling is
 * absolute and the average is a floor under the habit, because a set where
 * every answer sits at exactly three has drifted even though no single answer
 * broke a rule.
 */
check('nothing a caller says runs past three sentences', () => {
  for (const [what, say] of SPOKEN()) {
    const run = sentences(say)
    ok(run <= 3, `"${what}" is ${run} sentences: ${say}`)
  }
})

check('most of what a caller says is one or two sentences', () => {
  const spoken = SPOKEN()
  const brief = spoken.filter(([, say]) => sentences(say) <= 2).length
  ok(brief * 2 > spoken.length, `only ${brief} of ${spoken.length} replies stop at two sentences`)
})

/**
 * No dash stands in for a clause in anything read aloud.
 *
 * A dash is a pause a writer hears and a reader has to work out, and the whole
 * of the site's own customer-facing copy is written without them. A caller
 * reading one aloud either swallows it or stops in the middle of a sentence.
 */
check('nothing a caller says leans on a dash', () => {
  for (const [what, say] of SPOKEN()) {
    ok(!/[—–]/.test(say), `"${what}" carries a dash: ${say}`)
  }
})

// ── A claim with nothing behind it ─────────────────────────────────────────

check('work of ours is only named where there is work to name', () => {
  const named = scriptFor(business()).find(line => line.id === 'proof').say
  ok(named.includes('Impressiva Printing'), 'the client in their trade was not named')

  // The endpoint says trade and hands back nothing. The claim has to fall away
  // with the name, or the caller invites somebody to look up a client that was
  // never said.
  const empty = scriptFor(business({ proof: 'trade', proof_work: [] })).find(
    line => line.id === 'proof'
  ).say
  ok(
    !/your line of work already/.test(empty),
    `a trade claim was made with no work behind it: "${empty}"`
  )
  ok(
    empty.includes(String(PORTFOLIO_AVERAGES.mobile)),
    'the fallback dropped the one figure it can prove'
  )
})

check('both ends of the field the claim rides on still name it', () => {
  const endpoint = read('api/calls-admin.js')
  const handbook = read('lib/outreach/prospects/handbook.js')
  ok(endpoint.includes('proof_work:'), 'the endpoint stopped drawing proof_work onto the row')
  ok(handbook.includes('proof_work'), 'the handbook stopped reading proof_work')
})

// ── A price quoted at all ──────────────────────────────────────────────────

check('nothing a caller says down the phone carries a figure', () => {
  const said = [...QUESTIONS, ...PUSHBACK, ...CLOSING].map(one => one.say).join(' ')
  const typed = said.match(/\$[0-9][0-9,.]*/g)
  ok(!typed, `a caller reads a figure out: ${typed}`)
})

check('what it costs is answered with how the number is arrived at', () => {
  const cost = QUESTIONS.find(one => one.id === 'cost')
  ok(cost, 'the question somebody asks first is not in the handbook')
  ok(/your job|what the site has to do/.test(cost.say), `the cost answer reads: "${cost.say}"`)
  ok(/written|writing/.test(cost.say), 'the cost answer does not say the figure comes in writing')
  // And what settles it, which is the audit. Without this the answer reads as a
  // figure that will arrive somehow, and the caller is back to promising one.
  ok(
    /audit/i.test(cost.say),
    `the cost answer does not name what works the number out: "${cost.say}"`
  )
  for (const id of ['build', 'monthly']) {
    ok(
      /per project/i.test(FACTS.find(fact => fact.id === id)?.value ?? ''),
      `the reference card still prints a ${id} figure a caller can read out`
    )
  }
})

check('no money is written down in the handbook itself', () => {
  const source = read('lib/outreach/prospects/handbook.js')
  const typed = source.match(/\$[0-9]/g)
  ok(
    !typed,
    `a dollar figure is spelled out here rather than read from the pricing module: ${typed}`
  )
})

check('the measured scores are read rather than remembered', () => {
  const said = QUESTIONS.map(one => one.say).join(' ')
  ok(
    said.includes(String(PORTFOLIO_AVERAGES.mobile)),
    'the mobile average quoted is not the measured one'
  )
  ok(
    said.includes(String(PORTFOLIO_AVERAGES.desktop)),
    'the desktop average quoted is not the measured one'
  )
})

// ── A call that asks for the wrong thing ───────────────────────────────────

/** Everything a caller reads out, as one body of text, for a rule about all of it. */
const ALL_SPOKEN = () =>
  SPOKEN()
    .map(([, say]) => say)
    .join(' ')

check('the ask is for a free audit and a time the same day', () => {
  const ask = scriptFor(business()).find(line => line.id === 'ask').say
  ok(/audit/i.test(ask), `the ask does not name the audit: "${ask}"`)
  ok(/free/i.test(ask), `the ask does not say the audit costs them nothing: "${ask}"`)
  ok(/today/i.test(ask), `the ask does not ask for a time the same day: "${ask}"`)
})

check('nothing a caller says offers a plan instead of an audit', () => {
  // The call this replaced asked for ten minutes and promised a written plan
  // and a price by email, and the whole strategy turns on it no longer doing
  // that: nobody quotes on a first call, because the audit is what works the
  // number out. One line slipping back is the old call being made by whoever
  // read it last, and nothing else on the screen would look any different.
  for (const [what, say] of SPOKEN()) {
    ok(!/\bplan\b/i.test(say), `"${what}" offers a plan rather than an audit: ${say}`)
  }
  ok(!/by email/i.test(ALL_SPOKEN()), 'something a caller says still promises to send it instead')
})

check('the close books the audit for the same day and files it as one', () => {
  const close = CLOSING.map(one => `${one.label} ${one.say}`).join(' ')
  ok(/audit/i.test(close), 'the close never mentions the audit the call was for')
  ok(/today/i.test(close), 'the close does not put the call back on the same day')
  ok(/morning/i.test(close), 'the close does not say how late the call back may ever go')
  ok(/Audit Booked/.test(close), 'the close does not say what the call is recorded as')
  // The two things a yes gets filed as by mistake, and both are worth saying
  // out loud: a yes with no time is not a booking, and a booking is not a job.
  ok(/Call Back/.test(close), 'the close does not say what an untimed yes is filed as instead')
  ok(/Booked The Work/.test(close), 'the close does not say what a signed job is filed as')
})

check('the close says how the audit is emailed, and that the address is read back twice', () => {
  const named = one => `${one.label} ${one.say}`
  const button = CLOSING.find(one => /Email Client This Audit/.test(named(one)))
  ok(button, 'the close says nothing about the button that emails a business its audit')
  ok(/twice/i.test(named(button)), 'the close does not say the address is confirmed twice')
  ok(
    /on file/i.test(named(button)),
    'the close does not say the button only works where there is an audit to send'
  )
  // The message closes on the time the caller booked, so the entry has to say
  // the callback is logged before the button is pressed, or a caller reads
  // the refusal on the screen with the owner already off the line.
  ok(
    /log the callback first/i.test(named(button)),
    'the close does not say the callback is logged before the audit is emailed'
  )
})

/**
 * The six things said to a caller asking for an audit rather than a sale.
 *
 * Each of them is about the audit itself rather than about a website - the
 * address, the screen, the day, the thirty seconds - so none of them was in the
 * handbook before the call changed, and each is now among the most common
 * things a caller hears. An objection with no answer written down is the one a
 * caller improvises, which is how two callers come to say two different things
 * about how an owner's email is used.
 */
const AUDIT_OBJECTIONS = ['how-much', 'email', 'no-email', 'no-computer', 'today-no-good', 'busy']

check('every objection the audit call runs into is answered', () => {
  for (const id of AUDIT_OBJECTIONS) {
    const held = PUSHBACK.find(one => one.id === id)
    ok(held, `nothing answers the "${id}" objection`)
    ok(held.said.includes('“'), `${id} does not say what was said down the phone`)
    ok(sentences(held.say) <= 3, `${id} is answered in ${sentences(held.say)} sentences`)
    ok(!/[—–]/.test(held.say), `${id} is answered with a dash in it`)
    ok(held.after, `${id} is answered and the caller is left with nothing to do`)
  }
})

// ── A search that only reads headings ──────────────────────────────────────

check('a search reads the answer and not only the question', () => {
  const facebook = PUSHBACK.filter(one => handbookMatches(one, 'follow'))
  same(facebook.length, 1, 'a word that is only in an answer found nothing')

  const owner = QUESTIONS.filter(one => handbookMatches(one, 'domain'))
  ok(owner.length >= 1, 'a word that is only in an answer found no question')
})

check('a search ignores case and surrounding space', () => {
  for (const typed of ['WordPress', '  wordpress  ', 'WORDPRESS']) {
    ok(
      QUESTIONS.some(one => handbookMatches(one, typed)),
      `"${typed}" found nothing`
    )
  }
})

check('an empty search hides nothing', () => {
  for (const [what, entries] of COLLECTIONS) {
    for (const typed of ['', '   ', null, undefined]) {
      same(
        entries.filter(one => handbookMatches(one, typed)).length,
        entries.length,
        `${what}: an empty search dropped entries`
      )
    }
  }
})

check('a search nothing answers answers nothing', () => {
  const found = [...QUESTIONS, ...PUSHBACK, ...FACTS, ...CLOSING].filter(one =>
    handbookMatches(one, 'zqx')
  )
  same(found.length, 0, 'a word in none of it matched something')
})

check('the script is searched the same way the rest of it is', () => {
  const script = scriptFor(business())
  ok(
    script.some(line => handbookMatches(line, 'owner')),
    'a word in the script found nothing'
  )
  same(
    script.filter(line => handbookMatches(line, '')).length,
    script.length,
    'an empty search dropped script lines'
  )
})

// ── Nothing half written ───────────────────────────────────────────────────

check('every entry carries everything it is drawn with', () => {
  for (const one of QUESTIONS) {
    ok(one.id && one.ask && one.say, `a question is half written: ${JSON.stringify(one)}`)
    ok(one.ask.endsWith('?'), `"${one.ask}" is not a question`)
  }
  for (const one of PUSHBACK) {
    ok(one.id && one.said && one.say && one.after, `a pushback is half written: ${one.id}`)
  }
  for (const one of FACTS) {
    ok(one.id && one.label && one.value && one.note, `a fact is half written: ${one.id}`)
  }
  for (const one of CLOSING) {
    ok(one.id && one.label && one.say, `a closing step is half written: ${one.id}`)
  }
  for (const one of PLACES_TO_SEND) {
    ok(one.id && one.label && one.note, `a place to send is half written: ${one.id}`)
    ok(one.href?.startsWith('https://'), `${one.id} is not somewhere a person can be sent`)
  }
})

check('nothing is listed twice', () => {
  for (const [what, entries] of COLLECTIONS) {
    const ids = entries.map(one => one.id)
    same(new Set(ids).size, ids.length, `${what}: two entries share an id`)
  }
  const script = scriptFor(business()).map(line => line.id)
  same(new Set(script).size, script.length, 'two script lines share an id')
})

check('the parts named are the parts drawn', () => {
  const drawn = read(HANDBOOK)
  // The labels are read out of the catalogue rather than typed onto the screen,
  // so what is held to the catalogue is the id each heading is drawn from: a
  // part added to `HANDBOOK_PARTS` and never drawn fails here, and a label
  // reworded in one place cannot disagree with itself in the other.
  for (const part of HANDBOOK_PARTS) {
    ok(drawn.includes(`partLabel('${part.id}')`), `${part.label} is named but never drawn`)
  }
})

// ── Where it is read from ──────────────────────────────────────────────────

check('the handbook is one press from the call, and the lines are on the call', () => {
  const nav = read('src/app/views/staff/lib/nav.js')
  const screen = read('src/app/views/console/pages/studio/PortalScreen.jsx')
  const desk = read('src/app/views/staff/parts/CallDesk.jsx')

  // The two halves of what a caller says, and they are not the same thing. The
  // script is composed against the business on the phone and is drawn on the
  // call screen itself; the handbook is the reference somebody jumps into
  // mid-call, and it is a surface of the portal rather than a page away from
  // it. Losing either is silent: the call screen still draws, the portal still
  // opens, and the caller has nothing to read.
  ok(/key: 'resources'/.test(nav), 'the handbook stopped being a surface of the portal')
  ok(
    screen.includes("PORTAL_SURFACES.filter(one => one.key !== 'portal')"),
    'the tab row no longer draws every surface but the front, so one of them cannot be reached'
  )
  ok(desk.includes('scriptFor('), 'the call screen stopped composing the script')
  ok(/staff-script/.test(desk), 'the script is no longer drawn beside the business')
})

// ── The word that was just said ────────────────────────────────────────────

/** Everything a search runs over, which is the whole handbook bar the script. */
const EVERYTHING = () => [...QUESTIONS, ...PUSHBACK, ...FACTS, ...CLOSING]

check('the words said down the phone reach the answer for them', () => {
  // Not synonyms in general: each of these is a word somebody says out loud
  // whose answer is written in different words, which is the one case a
  // search over the visible text cannot cover. "That is too much" is what the
  // objection is headed and "expensive" is what gets said.
  const said = [
    'expensive',
    'afford',
    'price',
    'pricing',
    'deposit',
    'wix',
    'squarespace',
    'godaddy',
    'instagram',
    'social media',
    'manager',
    'edit',
    'pictures',
    'free',
    // The words the audit call brought with it. Every one of them is about the
    // asking rather than about a website, which is why none of them was here
    // before: a caller is now told "just send me an email", "not today", "I am
    // not near a computer", and the word they reach for is the one the owner
    // used.
    'how much',
    'send me',
    'later',
    'tomorrow',
    'next week',
    'text',
    'phone',
    'computer',
    'spam',
    'busy',
  ]
  for (const word of said) {
    ok(
      EVERYTHING().some(entry => handbookMatches(entry, word)),
      `somebody who was told "${word}" is shown nothing`
    )
  }
})

check('a word searched under an entry is not already written in it', () => {
  for (const entry of EVERYTHING()) {
    for (const word of entry.also ?? []) {
      const shown = [
        entry.ask,
        entry.said,
        entry.say,
        entry.label,
        entry.value,
        entry.note,
        entry.after,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      ok(
        !shown.includes(word),
        `${entry.id} is searched under "${word}", which its own words already carry`
      )
    }
  }
})

check('a word searched under an entry is never read out', () => {
  const drawn = read(HANDBOOK)
  ok(!/\.also\b/.test(drawn), 'the words that are only searched reached the screen')
})

// ── Whose name is said ─────────────────────────────────────────────────────

check('the caller says their own name where the console knows it', () => {
  const said = who => scriptFor(business(), who).find(line => line.id === 'opener').say

  ok(
    said('Trenton Taylor').includes('This is Trenton with'),
    `a name went unsaid: "${said('Trenton Taylor')}"`
  )
  ok(!said('Trenton Taylor').includes('['), 'the slot was left in beside the name that fills it')
  // Settings takes any string, and what is in it on a given day may be an
  // address, an initial, or nothing at all. A caller reads this line without
  // looking at it after the first day, so anything that is not plainly a name
  // stays the blank they already know to fill rather than something they say.
  for (const junk of [undefined, '', '   ', 'T', 'trenton@taylorurl.com', '42']) {
    ok(
      said(junk).includes('[your name]'),
      `${JSON.stringify(junk)} was said down the phone as a name: "${said(junk)}"`
    )
  }
})

// ── The way through it ─────────────────────────────────────────────────────

check('every folded answer can be opened and shut without twenty presses', () => {
  const drawn = read(HANDBOOK)

  // Twenty answers fold, and the two things done with all of them at once are
  // opening them to read down and shutting them to scan headings again. One
  // control does both, and which it is is decided by what is already open, so
  // both labels have to be in the file and both have to be reachable.
  ok(drawn.includes("'Expand All'"), 'there is no way to open every answer at once')
  ok(drawn.includes("'Collapse All'"), 'there is no way to shut every answer at once')
  ok(/allOut \? SHUT : new Set\(folded\)/.test(drawn), 'the control no longer moves every fold')

  // Whether a row is open belongs to the page rather than to the row. A fold
  // left to hold its own state cannot be moved by the control above it or by a
  // search, and both of those are how this is actually read - so the set lives
  // on the page and every fold is drawn open from it.
  ok(
    drawn.includes('const [opened, setOpened] = useState(SHUT)'),
    'the page stopped holding which answers are open'
  )
  ok(
    /open=\{opened\.has\(foldKey\(/.test(drawn),
    'a fold went back to holding its own state, so nothing above it can move it'
  )

  // The ids are only unique inside their own list. A question and an objection
  // sharing one would open and shut together, which is silent and looks like a
  // bug in the fold rather than in the key.
  ok(drawn.includes('`${part}:${id}`'), 'the two lists no longer fold under separate keys')
})

// ── Run them ────────────────────────────────────────────────────────────

await finish()

console.log(`call handbook: ${cases.length} checks passed`)
