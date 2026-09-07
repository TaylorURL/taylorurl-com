import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { TRADES } from '@data/towns-and-trades/trades'
import { SERVICE_TOWNS } from '@data/towns-and-trades/serviceTowns.js'
import { assist, assistUp } from '@data/console/onboardingAssist.js'

/**
 * One written answer in a client's brief, with everything a person who does not
 * write for a living needs in order to answer it.
 *
 * Somebody filling this in has just paid for a site and is being asked to
 * describe their own business in a box. They know the answer better than
 * anybody and they are not writers, so a bare box under a label gets back one
 * line where the build needed a paragraph, and the paragraph then has to be got
 * out of them on the phone a week later.
 *
 * Four things stand around the box and only one of them is the assistant. The
 * starters give somebody a first half-sentence to argue with, which is easier
 * than starting; the checklist says what a builder would have asked on the
 * phone and ticks itself as the writing covers each point; the length reading
 * answers the only question they are actually asking, which is whether they can
 * stop. All three are worked out here from text that never leaves the browser,
 * so when the machine behind the assistant is unreachable - and it is a
 * computer in a house, so one day it will be - the rewrite buttons are not
 * drawn and nothing else about this control changes. That is the difference
 * between a writing tool that has an assistant and a writing tool that is one.
 *
 * Nothing here gates anything. The checklist is advice and the reading is a
 * reading; whether a step can be left is the step's own business, and a helper
 * that quietly becomes a validator is one people learn to write around rather
 * than read.
 */

/** Verbs a person reaches for when they say what they actually do. */
const WORK_WORDS = [
  'fix',
  'repair',
  'install',
  'replace',
  'service',
  'build',
  'cut',
  'clean',
  'serve',
  'sell',
  'haul',
  'tow',
  'wire',
  'paint',
  'mow',
  'inspect',
  'treat',
  'design',
  'print',
  'maintain',
  'remodel',
  'deliver',
  'rent',
  'teach',
  'train',
  'weld',
  'pour',
  'trim',
  'wash',
  'cook',
  'cater',
  'diagnos',
  'represent',
]

/** How somebody names their customer without ever using the word demographic. */
const PEOPLE_WORDS = [
  'homeowner',
  'home owner',
  'landlord',
  'business',
  'builder',
  'contractor',
  'famil',
  'tenant',
  'customer',
  'client',
  'shop',
  'office',
  'restaurant',
  'apartment',
  'propert',
  'driver',
  'patient',
  'neighbor',
  'owner',
  'people',
  'folks',
  'compan',
  'store',
  'school',
  'church',
]

/** How somebody says where they work, when they do not name a town. */
const PLACE_WORDS = [
  'area',
  'county',
  'counties',
  'mile',
  'radius',
  'within',
  'all over',
  'side of town',
  'region',
  'statewide',
  'neighborhood',
  'district',
  'route',
  'zip',
]

/** What a sentence carries when it is giving a reason rather than a slogan. */
const REASON_WORDS = [
  'because',
  'so that',
  'which means',
  'means',
  'instead',
  'rather than',
  'unlike',
  'difference',
  'the reason',
  'whereas',
]

/**
 * What a customer weighs up, and what dealing with somebody is actually like.
 *
 * The two are one list because they are one sentence in practice: an owner
 * saying why people stay with them says "we answer the phone" and "we clean up
 * after ourselves" far more often than they say the word quality.
 */
const CARE_WORDS = [
  'price',
  'cost',
  'cheap',
  'afford',
  'fast',
  'quick',
  'same day',
  'on time',
  'qualit',
  'honest',
  'trust',
  'reliab',
  'clean',
  'warrant',
  'guarantee',
  'schedul',
  'emergency',
  'insur',
  'licens',
  'safe',
  'answer',
  'show up',
  'call back',
  'explain',
  'polite',
  'tidy',
  'respect',
]

/** The things a site can be asked to let somebody do. */
const ACTION_WORDS = [
  'call',
  'book',
  'quote',
  'price',
  'see',
  'find',
  'order',
  'message',
  'text',
  'form',
  'phone',
  'number',
  'pay',
  'schedul',
  'request',
  'estimate',
  'map',
  'direction',
  'appointment',
]

/** Where on a page somebody wants the thing that matters most. */
const PLACEMENT_WORDS = [
  'top',
  'front page',
  'home page',
  'first thing',
  'every page',
  'above',
  'header',
  'banner',
  'straight away',
]

/** What a site can be asked to show, as against what it can be asked to do. */
const SHOW_WORDS = [
  'photo',
  'picture',
  'image',
  'video',
  'list',
  'menu',
  'review',
  'hour',
  'price',
  'map',
]

/** What has gone wrong, which is the sentence that makes somebody pick up a phone. */
const TROUBLE_WORDS = [
  'broke',
  'break',
  'leak',
  'crack',
  'stopped',
  'down',
  'out of',
  'old',
  'fail',
  'worn',
  'emergency',
  'urgent',
  'flood',
  'burst',
  'worried',
  'need',
  'stuck',
  'damage',
]

/** True where any of these opens a word in the text. */
function mentions(text, stems) {
  return stems.some(stem => new RegExp(`\\b${stem}`, 'i').test(text))
}

/** True where any of these stands as a word of its own. */
function says(text, words) {
  return words.some(word => new RegExp(`\\b${word}\\b`, 'i').test(text))
}

/** A town this studio already names, or any of the ways of saying an area. */
function namesAPlace(text) {
  return says(text, SERVICE_TOWNS) || mentions(text, PLACE_WORDS)
}

/**
 * Something specific rather than something general: a figure, or a name.
 *
 * The capital every sentence opens with is dropped before the look, because
 * otherwise the rule would tick on any sentence at all.
 */
function namesSomething(text) {
  if (/\d/.test(text)) return true
  const inner = text.replace(
    /(^|[.!?]\s+)([A-Z])/g,
    (whole, before, letter) => before + letter.toLowerCase()
  )
  return /\b[A-Z][a-z]{2,}\b/.test(inner)
}

/** How long they have been at it, however they choose to say it. */
function namesAStretch(text) {
  return /\b(19|20)\d{2}\b/.test(text) || mentions(text, ['since', 'year', 'decade', 'generation'])
}

/**
 * The written questions this control is used for.
 *
 * Each carries three things and none of them is a rule: starters that leave the
 * subject to the owner, the points a builder would otherwise have asked about,
 * and the band the answer is useful in. A question with no entry of its own
 * falls to the general set at the bottom, which is written to be true of any of
 * them - a control that threw on a key it did not know would take a whole step
 * down over a typo in a string.
 *
 * `label` is the question as a person reads it, held here as well as the key so
 * the lookup answers to either. A caller that keeps its questions by key hands
 * one; a caller that hands the control a label and nothing else - which is what
 * the assistant is told about the box in any case - would otherwise get the
 * general set on every question in the brief.
 */
const ASKS = {
  'ideas.in_words': {
    label: 'What You Do',
    starters: [
      'Most of our work is ',
      'People call us when ',
      'We have been doing this ',
      'The jobs we do most weeks are ',
      'We work in ',
    ],
    cover: [
      {
        point: 'the work itself',
        held: (text, trade) => mentions(text, WORK_WORDS) || mentions(text, trade.words),
      },
      { point: 'who it is for', held: text => mentions(text, PEOPLE_WORDS) },
      { point: 'where you work', held: namesAPlace },
      { point: 'how long you have been at it', held: namesAStretch },
    ],
    band: { floorChars: 120, floorSentences: 2, ceilingChars: 900, ceilingSentences: 8 },
  },

  'ideas.edge': {
    label: 'Why People Pick You',
    starters: [
      'People stay with us because ',
      'What we do differently is ',
      'The last place they tried ',
      'We are the ones who ',
    ],
    cover: [
      { point: 'a reason rather than a slogan', held: text => mentions(text, REASON_WORDS) },
      { point: 'something a competitor could not say', held: namesSomething },
      { point: 'what it is like to deal with you', held: text => mentions(text, CARE_WORDS) },
    ],
    band: { floorChars: 80, floorSentences: 1, ceilingChars: 600, ceilingSentences: 6 },
  },

  'ideas.must_have': {
    label: 'What the Site Has to Do',
    starters: ['Somebody should be able to ', 'The first thing on the page should be '],
    // The trade's own lines are starters here and nowhere else. They were
    // written as what a site for this trade has to do, which is the question,
    // so they go in as they stand rather than being reworded into a prompt.
    seeded: 'needs',
    cover: [
      {
        point: 'one thing a visitor should be able to do',
        held: text => mentions(text, ACTION_WORDS),
      },
      { point: 'where on the page it belongs', held: text => mentions(text, PLACEMENT_WORDS) },
      { point: 'what has to be on it', held: text => mentions(text, SHOW_WORDS) },
    ],
    band: { floorChars: 60, floorSentences: 1, ceilingChars: 600, ceilingSentences: 6 },
  },

  'ideas.avoid': {
    label: 'What to Leave Off',
    starters: ['We do not want ', 'Nothing on the site should ', 'Other sites in our trade '],
    cover: [
      {
        point: 'what you do not want on it',
        held: text =>
          says(text, ['no', 'not', 'none']) ||
          mentions(text, [
            'never',
            'without',
            'avoid',
            'hate',
            'dislike',
            'rather not',
            'stay away',
            'leave out',
          ]),
      },
      { point: 'something you have seen elsewhere', held: namesSomething },
    ],
    band: { floorChars: 40, floorSentences: 1, ceilingChars: 500, ceilingSentences: 5 },
  },

  'brand.tagline': {
    label: 'One Line Under the Name',
    starters: ['The people you call for ', 'Since ', 'Across '],
    seeded: 'trade',
    cover: [
      {
        point: 'what you do',
        held: (text, trade) => mentions(text, WORK_WORDS) || mentions(text, trade.words),
      },
      { point: 'where you do it', held: namesAPlace },
      {
        point: 'short enough to read in one glance',
        held: text => text.trim().split(/\s+/).filter(Boolean).length <= 12,
      },
    ],
    band: { floorChars: 20, floorSentences: 1, ceilingChars: 90, ceilingSentences: 1 },
  },

  'customers.who': {
    label: 'Your Best Customer',
    starters: [
      'The customer we want more of is ',
      'They usually call because ',
      'They are usually ',
      'What they care about most is ',
    ],
    cover: [
      { point: 'what they own or run', held: text => mentions(text, PEOPLE_WORDS) },
      { point: 'what has gone wrong for them', held: text => mentions(text, TROUBLE_WORDS) },
      { point: 'where they are', held: namesAPlace },
      { point: 'what they weigh up before they call', held: text => mentions(text, CARE_WORDS) },
    ],
    band: { floorChars: 110, floorSentences: 1, ceilingChars: 800, ceilingSentences: 7 },
  },
}

/** The same questions, under the name a person reads them by. */
const BY_LABEL = new Map(Object.values(ASKS).map(entry => [entry.label, entry]))

/** What a question with no entry of its own is given. */
const GENERAL = {
  label: null,
  starters: ['The short version is ', 'What matters most here is ', 'For example, '],
  cover: [
    {
      point: 'what you mean, in a whole sentence',
      held: text => text.trim().split(/\s+/).filter(Boolean).length >= 8,
    },
    { point: 'something specific rather than something general', held: namesSomething },
  ],
  band: { floorChars: 60, floorSentences: 1, ceilingChars: 600, ceilingSentences: 6 },
}

/**
 * The trade, with the words that belong to it.
 *
 * `words` is taken from the trade's own name rather than from its `needs`
 * lines, and the difference matters to the checklist: a name is two or three
 * words that are always about the work, where a line about photographs and
 * service areas would tick "the work itself" beside a sentence that described
 * neither. `something-else` carries no words at all, because the two in its
 * name belong to the control that offered it rather than to anybody's business.
 *
 * Prepared once per trade and kept, since every box on every step asks for the
 * same one and the answer cannot change inside a visit.
 */
const PREPARED = new Map()

function tradeFor(id) {
  if (PREPARED.has(id)) return PREPARED.get(id)
  const held = TRADES.find(row => row.id === id || row.name === id) || null
  const prepared = {
    name: held?.name || '',
    needs: held?.needs || [],
    words:
      held && held.id !== 'something-else'
        ? held.name
            .toLowerCase()
            .split(/[^a-z]+/)
            .filter(word => word.length > 2)
        : [],
  }
  PREPARED.set(id, prepared)
  return prepared
}

/** Sentences, counted the way somebody reading them would count them. */
function sentencesIn(text) {
  return text
    .split(/[.!?\n]+/)
    .map(part => part.trim())
    .filter(Boolean)
}

/**
 * Whether there is enough here yet, said as an answer rather than as a figure.
 *
 * No count is ever shown. A word counter turns a description of somebody's own
 * shop into homework, and an owner who has written forty good words is not
 * helped by being told they are sixty short. The four readings answer the
 * question they are actually asking, which is whether they can move on.
 */
function readingOf(text, band) {
  const clean = text.trim()
  if (!clean) return null
  const chars = clean.length
  const sentences = sentencesIn(clean).length
  if (chars < band.floorChars || sentences < band.floorSentences) {
    return { line: 'Keep going.', over: false }
  }
  if (chars > band.ceilingChars || sentences > band.ceilingSentences) {
    return { line: 'Longer than it needs to be.', over: true }
  }
  if (chars < band.floorChars * 2) return { line: 'That is enough to work from.', over: false }
  return { line: 'Good length.', over: false }
}

/** The four rewrites, in the order they are drawn and never in another. */
const TOOLS = [
  { action: 'start', label: 'Write a First Sentence' },
  { action: 'expand', label: 'Make It Fuller' },
  { action: 'tighten', label: 'Tighten It' },
  { action: 'plain', label: 'Plain English' },
]

const CHIP =
  'border-hair-paper rounded-full border bg-[color:var(--paper-field)] px-3 py-1 text-left text-[12px] leading-snug text-paper-soft transition-colors duration-150 ease-out-soft hover:border-hair-paper-strong hover:text-accent disabled:cursor-not-allowed disabled:opacity-50'

const TOOL_BUTTON =
  'border-hair-paper rounded-[var(--r-tiny)] border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ease-out-soft hover:border-hair-paper-strong hover:text-accent disabled:cursor-not-allowed disabled:opacity-50'

const HEADING = 'text-[12px] font-semibold text-ink-paper'

/**
 * The starters, as things to press.
 *
 * Pressing one puts it where the cursor is rather than at the end, so two
 * presses leave the shape of two sentences to fill in rather than a run-on. It
 * never replaces what is already there: a starter is worth nothing if reaching
 * for it costs somebody the line they had.
 */
function Starters({ starters, disabled, onDrop }) {
  if (!starters.length) return null
  return (
    <div className="flex flex-col gap-1.5">
      <p className={HEADING}>Starters</p>
      <p className="text-paper-faint text-[12px] leading-relaxed">
        Press one to drop it in where the cursor is. They are places to start, not answers.
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {starters.map(starter => (
          <li key={starter}>
            <button
              type="button"
              className={CHIP}
              disabled={disabled}
              onClick={() => onDrop(starter)}
            >
              {starter.trim()}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * What the answer is worth covering, ticking itself as it is covered.
 *
 * The matching is deliberately forgiving. A point that ticks when it should not
 * costs nothing; a point sitting unticked beside a sentence that plainly
 * covered it nags somebody who has already done the work, and after that they
 * stop believing the list. So the unticked points carry the weight and the
 * ticked ones fade back: what is left to read is a short list of what is still
 * worth saying, which is the only reading of it that helps anybody.
 */
function Cover({ points, text, trade }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className={HEADING}>What to Cover</p>
      <ul className="flex flex-col gap-1">
        {points.map(point => {
          const held = Boolean(text.trim()) && point.held(text, trade)
          return (
            <li
              key={point.point}
              className={`flex items-start gap-2 text-[12px] leading-relaxed ${
                held ? 'text-paper-faint' : 'text-paper-soft'
              }`}
            >
              {held ? (
                <Check
                  className="mt-[3px] h-3 w-3 flex-shrink-0 text-accent"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="border-hair-paper-strong mt-[5px] h-2 w-2 flex-shrink-0 rounded-full border"
                  aria-hidden="true"
                />
              )}
              <span>{point.point}</span>
            </li>
          )
        })}
      </ul>
      <p className="text-paper-faint text-[12px] leading-relaxed">
        Nothing here is required. It is what somebody building the site would ask you on the phone.
      </p>
    </div>
  )
}

/**
 * @param {object} props
 * @param {string} [props.id] - The box's own id, where the caller wants to
 *   point a label of its own at it.
 * @param {string} [props.ask] - The path the answer is stored under, which is
 *   what the starters and the checklist are chosen by.
 * @param {string} props.field - The question as a person reads it. It is what
 *   the assistant is told about the box, and it stands in for `ask` where the
 *   caller keeps its questions by label.
 * @param {string} [props.label] - Drawn over the box. Left out where the caller
 *   draws the label itself, which is the usual arrangement inside a form.
 * @param {string} [props.help] - The sentence under that label.
 * @param {string} props.value - The answer as it was last saved.
 * @param {(next: string) => void} props.onChange - Told every change, including
 *   the ones a starter and a rewrite make, so the caller writes them down the
 *   same way it writes down typing.
 * @param {string} [props.trade] - The client's trade, by id or by name.
 * @param {string} [props.token] - The session the assistant is asked on. With
 *   none, the probe is refused and the rewrite buttons are never drawn.
 * @param {number} [props.rows] - How tall the box starts.
 * @param {boolean} [props.disabled] - The whole control, while the brief is
 *   busy or closed.
 */
export default function OnboardingWriting({
  id,
  ask,
  field,
  label,
  help,
  value,
  onChange,
  trade = null,
  token = null,
  rows = 5,
  disabled = false,
}) {
  const question = field || label || ''
  const shape = ASKS[ask] || BY_LABEL.get(question) || GENERAL
  const held = tradeFor(trade)

  const [draft, setDraft] = useState(value || '')
  const [before, setBefore] = useState(null)
  const [working, setWorking] = useState(null)
  const [note, setNote] = useState(null)
  const [up, setUp] = useState(null)
  const [settled, setSettled] = useState(value || '')

  const box = useRef(null)
  const caret = useRef(null)
  const landed = useRef(value || '')
  const latest = useRef(value || '')

  // The box holds its own draft, the way `WrittenAsk` does in `ProjectAsks`,
  // and for the same reason: the brief is read back on a timer and written on a
  // debounce, and a read landing between two keystrokes would take the sentence
  // back to whatever the last write held. What is saved flows down again only
  // when it differs from what this control last sent up, which is what happens
  // when the same account writes the brief from a second tab.
  useEffect(() => {
    const saved = value || ''
    if (saved === landed.current) return
    landed.current = saved
    latest.current = saved
    setDraft(saved)
  }, [value])

  // The readings are worked out on a pause rather than on a keystroke, so a
  // point does not tick and untick in the middle of the word that is about to
  // satisfy it. Nothing here leaves the browser, so the pause is for the
  // reader's eyes rather than for anybody's budget.
  useEffect(() => {
    const timer = setTimeout(() => setSettled(draft), 400)
    return () => clearTimeout(timer)
  }, [draft])

  // The buttons are drawn on the probe and on nothing else, and the answer is
  // remembered for every control on the step, so four boxes cost one request.
  // It is asked again when the tab comes back into view, which is what lets a
  // machine restarted in the middle of a brief come back without a reload.
  useEffect(() => {
    let alive = true
    const knock = () => {
      assistUp(token).then(answer => {
        if (alive) setUp(answer)
      })
    }
    knock()
    const wake = () => {
      if (document.visibilityState === 'visible') knock()
    }
    document.addEventListener('visibilitychange', wake)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', wake)
    }
  }, [token])

  // A starter is dropped in at the cursor, so the cursor has to be put back
  // where the text now ends rather than left where the browser puts it after a
  // value changes underneath it.
  useEffect(() => {
    if (caret.current === null || !box.current) return
    box.current.focus()
    box.current.setSelectionRange(caret.current, caret.current)
    caret.current = null
  })

  /**
   * What the person typed.
   *
   * The way back to the version before the last rewrite goes with the first
   * keystroke. Once somebody has written over a rewrite, putting the older
   * version back would take their own words with it, and a control that does
   * that is worse than one with no undo at all.
   */
  const typed = useCallback(
    next => {
      landed.current = next
      latest.current = next
      setDraft(next)
      setBefore(null)
      setNote(null)
      onChange(next)
    },
    [onChange]
  )

  /** What a rewrite or an undo put there, with the way back recorded. */
  const swap = useCallback(
    (next, previous) => {
      landed.current = next
      latest.current = next
      setDraft(next)
      setBefore(previous)
      onChange(next)
    },
    [onChange]
  )

  /**
   * Puts a starter where the cursor is.
   *
   * A box nobody has clicked into reports a cursor at the very start, which
   * would push the starter in front of whatever is already written. So a box
   * that is not the focused element is treated as one with the cursor at the
   * end, which is where somebody reaching for a second starter expects it to
   * land.
   */
  const drop = starter => {
    const element = box.current
    const inside = element && document.activeElement === element
    const at = inside ? element.selectionStart : draft.length
    const to = inside ? element.selectionEnd : draft.length
    const front = draft.slice(0, at)
    const back = draft.slice(to)
    const spaced = front && !/\s$/.test(front) ? `${front} ` : front
    caret.current = spaced.length + starter.length
    typed(`${spaced}${starter}${back}`)
  }

  const run = async action => {
    if (working || up !== true) return
    const sent = draft
    setWorking(action)
    setNote(null)
    const answer = await assist({ token, action, field: question, trade: held.name, text: sent })
    setWorking(null)
    setNote(answer.note)

    // An answer that came back to a box somebody kept writing in is dropped.
    // The words on the screen are newer than the words the rewrite was made
    // from, and pasting the older ones over them is the one way this control
    // could take a sentence off anybody.
    if (answer.assisted && latest.current !== sent) {
      setNote('You kept writing while that came back, so your own words were left alone.')
      return
    }

    if (answer.assisted) swap(answer.text, sent)
    // A request that found nothing behind the endpoint has already told the
    // module so, and asking again is answered out of that memory rather than
    // over the network. It is what takes the buttons away from every box on the
    // step rather than from this one alone.
    if (answer.offline) setUp(await assistUp(token))
  }

  const starters = useMemo(() => {
    if (shape.seeded === 'needs' && held.needs.length) {
      return [...held.needs.slice(0, 4), ...shape.starters]
    }
    if (shape.seeded === 'trade' && held.name) return [`${held.name} in `, ...shape.starters]
    return shape.starters
  }, [shape, held])

  const reading = readingOf(settled, shape.band)
  const empty = !draft.trim()

  return (
    <div className="flex flex-col gap-3">
      {label ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-[14px] font-semibold leading-snug text-ink-paper">
            {label}
          </label>
          {help ? (
            <p
              id={id ? `${id}-help` : undefined}
              className="text-paper-mute text-[13px] leading-relaxed"
            >
              {help}
            </p>
          ) : null}
        </div>
      ) : null}

      <textarea
        id={id}
        ref={box}
        rows={rows}
        className="field console-ask-text w-full"
        value={draft}
        disabled={disabled}
        aria-label={label ? undefined : question || undefined}
        aria-describedby={id && help ? `${id}-help` : undefined}
        onChange={event => typed(event.target.value)}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
        {reading ? (
          <span className={`text-[12px] ${reading.over ? 'text-accent' : 'text-paper-faint'}`}>
            {reading.line}
          </span>
        ) : null}
        {working ? (
          <span role="status" className="text-paper-faint text-[12px]">
            Reading what you wrote.
          </span>
        ) : null}
        {note ? <span className="text-[12px] leading-relaxed text-paper-soft">{note}</span> : null}
      </div>

      {/* The way back stands outside the rewrite row, and outside the test that
          draws it. A rewrite that lands and then finds the assistant gone would
          otherwise take the undo with the buttons, at the one moment somebody
          most needs their own paragraph back. */}
      {before !== null ? (
        <div>
          <button
            type="button"
            className={`${TOOL_BUTTON} text-paper-soft`}
            disabled={disabled}
            onClick={() => swap(before, null)}
            title="Puts back what was in the box before the last change."
          >
            <RotateCcw className="mr-1.5 inline-block h-3 w-3" strokeWidth={2} aria-hidden="true" />
            Undo
          </button>
        </div>
      ) : null}

      {/* The rewrite row arrives a moment after the box, once the probe has
          answered, and is absent rather than disabled when the answer is no. A
          client who never saw a button has had nothing explained to them about
          a machine in somebody's house, where a row of dead controls under an
          apology is an outage put in front of the one person it cannot help. */}
      {up === true ? (
        <div className="flex flex-col gap-1.5">
          <p className={HEADING}>Writing Help</p>
          <div className="flex flex-wrap gap-1.5">
            {TOOLS.map(tool => {
              const wants = tool.action === 'start' ? empty : !empty
              const why =
                tool.action === 'start'
                  ? 'The box already has something in it.'
                  : 'Write a line first, however rough.'
              return (
                <button
                  key={tool.action}
                  type="button"
                  className={`${TOOL_BUTTON} ${
                    reading?.over && tool.action === 'tighten' ? 'text-accent' : 'text-paper-soft'
                  }`}
                  disabled={disabled || Boolean(working) || !wants}
                  title={wants ? undefined : why}
                  onClick={() => run(tool.action)}
                >
                  {working === tool.action ? 'Working' : tool.label}
                </button>
              )
            })}
          </div>
          <p className="text-paper-faint text-[12px] leading-relaxed">
            What comes back is a draft in your own words, tidied. Keep it, change it, or put yours
            back.
          </p>
        </div>
      ) : null}

      <Starters starters={starters} disabled={disabled} onDrop={drop} />

      <Cover points={shape.cover} text={settled} trade={held} />
    </div>
  )
}
