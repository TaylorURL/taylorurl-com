/**
 * Proves the brief a client answers after paying is wired end to end, and that
 * the rehearsal of it cannot reach anything real.
 *
 * The flow is eight screens, a percent, a private bucket, a model on a machine
 * in a house, and a toggle that draws all of it for somebody who has not
 * bought anything. Every layer works perfectly on its own while the chain does
 * nothing, which is the failure this file is written against:
 *
 *   - a step in the register with no control drawn for its kind is a question
 *     a client is asked and cannot answer;
 *   - a percent that can reach a hundred with a required field empty is a
 *     handover control that fires on an unfinished brief;
 *   - a percent that cannot reach a hundred with every field answered is a
 *     control that never fires at all;
 *   - a database function with no caller, or a caller naming a function that
 *     is not there, is a save that fails on the first client and on nobody's
 *     machine before that;
 *   - and a preview whose project feed is the live one is an admin rehearsing
 *     on somebody's real build.
 *
 * The last is the only one here that costs more than an apology, and it is the
 * one with the least on screen to give it away, so it is asserted hardest: the
 * swap has to be the whole feed object rather than a flag each write consults,
 * because a flag is a thing a new write can forget to ask.
 *
 * The register is imported and run rather than read for its text. What matters
 * is the answer each rule gives, not the shape of the source that gives it.
 *
 *   npm run check:onboarding-flow
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FIXED_PAGES,
  STEPS,
  answeredField,
  onboardingPercent,
  optionsFor,
  pagesForTrade,
  prefill,
  stepProgress,
  stepRank,
  withAnswer,
} from '../../src/app/views/console/lib/onboarding.js'
import { cases, check, finish, report, same } from '../harness/checks.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = path => readFileSync(join(HERE, '../..', path), 'utf8')

/** Every fault a rule found, not the first, so one pass reports one pass. */

const ENDPOINT = 'api/onboarding.js'
const ASSIST = 'api/onboarding-assist.js'
const HOOK = 'src/app/hooks/console/useOnboardingFeed.js'
const FIELDS = 'src/app/views/console/intake/OnboardingFields.jsx'
const WRITING = 'src/app/views/console/intake/OnboardingWriting.jsx'
const PAGE = 'src/app/views/console/pages/health/OnboardingPage.jsx'
const FRAME = 'src/app/views/console/ConsoleFrame.jsx'
const PREVIEW = 'src/app/hooks/console/usePreviewClient.js'

/**
 * The database functions the brief is written and read through.
 *
 * Written out here rather than read off the grant for the same reason the
 * project list is: the migrations are held privately, so this list is the
 * contract between the two halves.
 */
const BRIEF_FUNCTIONS = [
  'project_onboarding_open',
  'project_onboarding_save',
  'project_onboarding_submit',
]

check('every step in the register is whole', () => {
  const faults = []
  const seen = new Set()
  for (const step of STEPS) {
    for (const part of ['id', 'label', 'eyebrow', 'title', 'description']) {
      if (!step[part]) faults.push(`the ${step.id || 'unnamed'} step has no ${part}`)
    }
    if (seen.has(step.id)) faults.push(`${step.id} is in the register twice`)
    seen.add(step.id)
    for (const field of step.fields || []) {
      if (!field.key) faults.push(`a field on ${step.id} has no key`)
      if (!field.kind) faults.push(`${field.key} names no kind`)
      if (!field.label) faults.push(`${field.key} has no label`)
      // A key is a path into the stored document, and a field on one step
      // writing into another step's object is an answer that vanishes from the
      // screen that asked for it.
      if (field.key && !field.key.startsWith(`${step.id}.`)) {
        faults.push(`${field.key} is on the ${step.id} step but writes somewhere else`)
      }
    }
  }
  report(faults)
})

check('every kind the register uses has a control drawn for it', () => {
  const drawn = read(FIELDS)
  const kinds = [...new Set(STEPS.flatMap(step => (step.fields || []).map(field => field.kind)))]
  same(kinds.length > 0, true, 'the register asks for something')

  // The map that decides which control draws which kind, read as the list it
  // is. Searching the whole file for the word would pass on a kind mentioned
  // in a comment, which is the one place a missing control is most likely to
  // be described rather than written.
  const map = drawn.slice(drawn.indexOf('const CONTROLS = {'))
  const wired = new Set(
    [...map.slice(0, map.indexOf('\n}')).matchAll(/^\s{2}(\w+):/gm)].map(match => match[1])
  )
  same(wired.size > 0, true, 'the controls are read off a map rather than a chain of branches')
  report(
    kinds.filter(kind => !wired.has(kind)).map(kind => `a ${kind} field has no control on the form`)
  )
})

check('the register opens and closes on a screen with nothing to answer', () => {
  // A form that opens on a question is a form somebody is answering before
  // they know how long it is, and one that ends on a question is one nobody is
  // shown back before they hand it over.
  same(STEPS[0].fields?.length ?? 0, 0, 'the first screen asks nothing')
  same(STEPS[STEPS.length - 1].fields?.length ?? 0, 0, 'the last screen asks nothing')
  same(stepRank(STEPS[0].id), 1, 'the first step ranks first')
  same(stepRank('nonsense'), 0, 'a step nothing uses ranks below every real one')
})

/** The register's own required fields, answered with something that counts. */
function answeredWhole() {
  let answers = {}
  for (const step of STEPS) {
    for (const field of step.fields || []) {
      if (!field.required) continue
      answers = withAnswer(answers, field.key, sampleFor(field))
    }
  }
  return answers
}

/** Something a field of that kind would accept, in the shape it is stored in. */
function sampleFor(field) {
  switch (field.kind) {
    case 'longtext':
      return 'We fit and repair gas lines across Baytown and Highlands, and we answer the phone ourselves.'
    case 'choice':
      // A choice with no list of its own takes whatever is on in the field it
      // is derived from, which for the one field in that shape is a page.
      return field.options?.[0]?.id ?? pagesForTrade(null)[0].id
    case 'multichoice': {
      const wanted = Math.max(1, field.min || 1)
      // A field whose options are the trade's own candidate set carries none of
      // its own, and is answered from the same list the form would draw.
      const from = field.options || pagesForTrade(null)
      return from.slice(0, wanted).map(option => option.id)
    }
    case 'chips':
      return ['Baytown']
    case 'files':
      return [{ file_id: 'a', path: 'sample/logo.png', name: 'logo.png' }]
    case 'address':
      return { none: false, line1: '1 Main St', city: 'Baytown', state: 'TX', postal: '77520' }
    case 'phone':
      return '(281) 862-8687'
    case 'email':
      return 'owner@example.com'
    case 'url':
      return 'https://example.com'
    case 'list':
      // A list with a fixed shape carries its own opening rows, and those rows
      // are the answer. Anything else takes one row with a first column in it.
      return field.seed ?? [{ name: 'Drain clearing', title: 'Drain clearing' }]
    default:
      return 'Bellview Plumbing'
  }
}

check('a hundred means every required field is answered, and nothing less does', () => {
  const whole = answeredWhole()
  same(onboardingPercent(whole), 100, 'a wholly answered brief reads a hundred')

  // One field at a time, taken back out. Every one of them has to be able to
  // stop the figure on its own, or a client is offered the handover control
  // with a question unanswered behind it.
  const faults = []
  for (const step of STEPS) {
    for (const field of step.fields || []) {
      if (!field.required) continue
      const short = withAnswer(whole, field.key, undefined)
      if (onboardingPercent(short) === 100) {
        faults.push(`${field.key} can be empty and the bar still reads a hundred`)
      }
    }
  }
  report(faults)
})

check('an empty brief reads zero', () => {
  same(onboardingPercent({}), 0, 'nothing answered is nothing')
})

check('the figure only ever rises as answers go in', () => {
  let answers = {}
  let last = onboardingPercent(answers)
  const faults = []
  for (const step of STEPS) {
    for (const field of step.fields || []) {
      if (!field.required) continue
      answers = withAnswer(answers, field.key, sampleFor(field))
      const now = onboardingPercent(answers)
      if (now < last) faults.push(`answering ${field.key} pulled the bar from ${last} to ${now}`)
      last = now
    }
  }
  same(last, 100, 'the walk ends at a hundred')
  report(faults)
})

check('an optional field moves nothing', () => {
  const whole = answeredWhole()
  const faults = []
  for (const step of STEPS) {
    for (const field of step.fields || []) {
      if (field.required) continue
      const more = withAnswer(whole, field.key, sampleFor(field))
      if (onboardingPercent(more) !== 100) {
        faults.push(`${field.key} is optional and answering it moved the bar`)
      }
    }
  }
  report(faults)
})

check('a step reports its own share honestly', () => {
  const whole = answeredWhole()
  const faults = []
  for (const step of STEPS) {
    const empty = stepProgress(step, {})
    const full = stepProgress(step, whole)
    if (empty.required !== full.required) {
      faults.push(`${step.id} asks for a different number of things depending on the answers`)
    }
    if (empty.answered !== 0 && (step.fields || []).some(field => field.required)) {
      faults.push(`${step.id} counts an answer nobody gave`)
    }
    if (full.answered !== full.required) {
      faults.push(`${step.id} is wholly answered and does not say so`)
    }
  }
  report(faults)
})

check('the pay form fills the brief in rather than the brief asking twice', () => {
  const brief = [
    { label: 'Business Type', value: 'Plumbing' },
    { label: 'How It Should Feel', value: 'Hard-wearing and practical, Clean and simple' },
    { label: 'How It Reads', value: 'Plain and friendly' },
    { label: 'Photographs', value: 'A few photos' },
  ]
  const project = { business_name: 'Bellview Plumbing', email: 'owner@bellview.example' }
  const filled = prefill({}, { project, brief: [{ answers: brief }] })

  same(onboardingPercent(filled) > 0, true, 'a paid brief opens the form part answered')
  same(onboardingPercent(filled) < 100, true, 'and never all of it')

  // What a client typed is never overwritten by what they picked before they
  // paid. A prefill that argues with an answer is a form that undoes somebody's
  // correction under their cursor.
  const theirs = withAnswer(filled, 'brand.name_as_written', 'Bellview Plumbing LLC')
  const again = prefill(theirs, { project, brief: [{ answers: brief }] })
  same(
    JSON.stringify(again),
    JSON.stringify(theirs),
    'a second prefill over an answered form changes nothing'
  )

  // A build with no brief behind it is every project opened before the rows
  // existed and every checkout whose brief write failed. It has to give a
  // blank form rather than an error.
  same(
    JSON.stringify(prefill({}, { project: null, brief: null })),
    JSON.stringify(prefill({}, {})),
    'a build with no brief prefills nothing and does not throw'
  )
})

check('the pages step opens with a list the trade would recognize', () => {
  const faults = []
  const common = pagesForTrade(null)
  if (common.filter(page => page.on).length < 3) {
    faults.push('a trade nobody recognizes opens with fewer than three pages picked')
  }
  for (const trade of ['plumbing', 'restaurant', 'barber-shop', 'law-firm', 'not-a-trade']) {
    const offered = pagesForTrade(trade)
    if (!offered.length) faults.push(`${trade} is offered no pages at all`)
    const ids = offered.map(page => page.id)
    if (new Set(ids).size !== ids.length) faults.push(`${trade} is offered the same page twice`)
    if (offered.filter(page => page.on).length < 3) {
      faults.push(`${trade} opens with fewer than three pages picked`)
    }
  }
  report(faults)
})

check('the two fields with no list of their own are given one to draw', () => {
  // These are the failure this rule exists for: a chooser whose options are
  // resolved somewhere other than the field draws nothing, and drawing nothing
  // is not an error. The pages step is a heading, a blank space and a control
  // that cannot be pressed, and the client's only reading of that is that the
  // form is broken. `answeredField` reads both fields without their lists, so
  // nothing else in the flow notices.
  const faults = []
  const fields = STEPS.find(step => step.id === 'pages').fields
  const switches = fields.find(field => field.key === 'pages.chosen')
  const hero = fields.find(field => field.key === 'pages.hero_page')

  for (const trade of ['plumbing', 'restaurant', 'law-firm', 'not-a-trade', null]) {
    const offered = optionsFor(switches, {}, trade)
    if (!Array.isArray(offered) || offered.length < 3) {
      faults.push(`${trade} is offered fewer than three page switches`)
      continue
    }
    if (offered.some(option => !option.id || !option.name)) {
      faults.push(`${trade} is offered a page switch with no id or no name`)
    }
    // The three that are always built carry no switch, so offering one offers
    // a decision that does not exist.
    if (offered.some(option => FIXED_PAGES.includes(option.id))) {
      faults.push(`${trade} is offered a switch beside a page that is always built`)
    }
  }

  // The page that matters most is picked out of the site the client just
  // described, so a page they turned off must not be on the list and a row
  // they typed in themselves must be.
  const answers = {
    pages: { chosen: ['services', 'emergency'], extra: [{ title: 'Our Trucks' }] },
  }
  const picks = optionsFor(hero, answers, 'plumbing').map(option => option.id)
  if (!picks.includes('home')) faults.push('the home page cannot be picked as the one that matters')
  if (!picks.includes('services')) faults.push('a page that is on cannot be picked')
  if (!picks.includes('Our Trucks')) faults.push('a page the client added cannot be picked')
  if (picks.includes('about')) faults.push('a page that is off can still be picked')

  // Every other field carries its own list and has to come back holding it.
  for (const step of STEPS) {
    for (const field of step.fields) {
      if (field.key === 'pages.chosen' || field.key === 'pages.hero_page') continue
      if (optionsFor(field, {}, 'plumbing') !== (field.options ?? null)) {
        faults.push(`${field.key} is handed back a list that is not its own`)
      }
    }
  }

  // And the page has to actually ask, or none of the above is drawn.
  const page = read(PAGE)
  if (!page.includes('optionsFor(field, answers, trade)')) {
    faults.push('the page draws its fields without resolving the two lists')
  }

  report(faults)
})

check('what counts as answered is not merely what is present', () => {
  const longtext = { kind: 'longtext', required: true }
  same(answeredField(longtext, ''), false, 'an empty box is not an answer')
  same(answeredField(longtext, '   '), false, 'and neither is a space')
  same(answeredField(longtext, 'yes'), false, 'a single word is not something to build from')
  same(
    answeredField(longtext, 'We fit and repair gas lines across Baytown, and we answer the phone.'),
    true,
    'a sentence is'
  )

  const phone = { kind: 'phone', required: true }
  same(answeredField(phone, '281'), false, 'three digits is not a phone number')
  same(answeredField(phone, '(281) 862-8687'), true, 'ten is')

  const email = { kind: 'email', required: true }
  same(answeredField(email, 'owner@'), false, 'half an address is not one')
  same(answeredField(email, 'owner@example.com'), true, 'a whole one is')

  const url = { kind: 'url', required: true }
  same(answeredField(url, 'example'), false, 'a word is not a web address')
  same(answeredField(url, 'https://example.com'), true, 'a web address is')

  const chips = { kind: 'chips', required: true }
  same(answeredField(chips, []), false, 'an empty list is not an answer')
  same(answeredField(chips, ['   ']), false, 'and neither is a list of nothing')
  same(answeredField(chips, ['Baytown']), true, 'a town is')
})

check('every database function the brief uses has a caller, and every call one', () => {
  const endpoint = read(ENDPOINT)
  const faults = BRIEF_FUNCTIONS.filter(name => !endpoint.includes(name)).map(
    name => `${name} exists in the database and is called from nowhere`
  )
  // And the other way round, which is the failure that reaches a client: a
  // name typed here that the database has never heard of answers with a
  // Postgres error on the first save anybody makes.
  for (const [, name] of endpoint.matchAll(/rpc\('(\w+)'/g)) {
    if (!BRIEF_FUNCTIONS.includes(name)) faults.push(`${name} is called and is not in the contract`)
  }
  for (const [, name] of endpoint.matchAll(/name: '(\w+)'/g)) {
    if (!BRIEF_FUNCTIONS.includes(name)) faults.push(`${name} is called and is not in the contract`)
  }
  report(faults)
})

check('every write the endpoint answers is posted by the hook', () => {
  const endpoint = read(ENDPOINT)
  const hook = read(HOOK)
  // Read off the endpoint rather than listed again, so an action added there
  // and never wired up fails here instead of waiting to be noticed.
  const offered = [...endpoint.matchAll(/^\s{4}(\w+): \(\) => \{$/gm)].map(match => match[1])
  same(offered.length > 0, true, 'the endpoint reads its writes off a table')
  report(
    offered
      .filter(action => !hook.includes(`action: '${action}'`))
      .map(action => `nothing posts { action: '${action}' }`)
  )
})

check('both endpoints ask whether this deployment serves them, first', () => {
  const faults = []
  for (const path of [ENDPOINT, ASSIST]) {
    const source = read(path)
    const entry = source.match(
      /export default (?:async )?function handler\((\w+), (\w+)\) \{\n([^\n]*)\n/
    )
    if (!entry) {
      faults.push(`${path} has no recognisable handler entry`)
      continue
    }
    if (!entry[3].includes('servedHereOr404')) {
      faults.push(`${path} asks late: its first line is "${entry[3].trim()}"`)
    }
  }
  report(faults)
})

check('the writing help is a door in front of the model, not a hole through it', () => {
  const assist = read(ASSIST)
  const faults = []
  // Every one of these is the difference between a control a client presses
  // and an open relay to a machine in a house.
  if (!assist.includes('authorizeAccount'))
    faults.push('the assist endpoint does not ask who is asking')
  if (!assist.includes('callerWindow')) faults.push('nothing counts what one caller may spend')
  if (!assist.includes('screen(')) faults.push('nothing reads what is being sent upstream')
  if (!assist.includes('LIVE_AGENT_SECRET'))
    faults.push('the upstream is reached without a credential')
  // The task is a key the endpoint looks up, never a sentence from the browser.
  // A sentence would make the field a direct line to the model's instructions,
  // which is the whole of what the secret and the body cap exist to prevent.
  if (/body\.(task|instruction|prompt|system)[^\n]*\|\|\s*'/.test(assist)) {
    faults.push('an instruction from the browser reaches the model')
  }
  report(faults)
})

check('the writing help still helps with the assistant unreachable', () => {
  const assist = read(ASSIST)
  const writing = read(WRITING)
  const faults = []
  // A client mid-sentence in a form must never be handed a 500. Their place in
  // the box is worth more than the rewrite they asked for.
  if (!/up:\s*(false|Boolean|reachable|up)/.test(assist) && !assist.includes('json({ up')) {
    faults.push('the endpoint does not answer whether the assistant is reachable')
  }
  // The framing tools are the half that owes nothing to a model, and they are
  // what the owner asked for as much as the rewriting is.
  for (const [what, mark] of [
    ['sentence starters', /starter/i],
    ['a what-to-cover reading', /cover/i],
    ['a length reading', /enough|length/i],
  ]) {
    if (!mark.test(writing)) faults.push(`the box offers no ${what}`)
  }
  report(faults)
})

check('a preview swaps the whole feed rather than asking a flag per write', () => {
  const frame = read(FRAME)
  const faults = []
  if (!frame.includes('useSampleProjectFeed')) faults.push('the frame builds no sample feed')
  // The object, not the request. Everything the console can do to a build
  // reaches an endpoint through this one value, so replacing it is what makes
  // a preview unable to write; a flag each write consults is a flag the next
  // write can forget to ask.
  if (!/const projectFeed = preview\s*\?/.test(frame)) {
    faults.push('the project feed is not replaced wholesale under a preview')
  }
  // Drawn as a client, and the real role kept apart from the drawn one so the
  // way out is still offered to the person who can take it.
  if (!/const role = preview \? 'client' : signedInRole/.test(frame)) {
    faults.push('a preview does not draw the client role')
  }
  if (!frame.includes("canPreview={signedInRole === 'admin'}")) {
    faults.push('the preview is offered on the drawn role rather than the real one')
  }
  if (!frame.includes('PreviewStrip')) faults.push('nothing tells an admin they are previewing')
  report(faults)
})

check('nothing written during a preview can reach the network or outlive the tab', () => {
  const preview = read(PREVIEW)
  const hook = read(HOOK)
  const faults = []
  if (preview.includes('fetch(')) faults.push('the preview module reaches the network')
  if (!preview.includes('sessionStorage')) faults.push('the preview is not held per tab')
  if (preview.includes('localStorage')) {
    faults.push('the preview is held in a store that outlives the sitting')
  }
  // The feed's preview path answers from the store and returns before any of
  // the request-building below it.
  if (!/if \(preview\) \{/.test(hook)) faults.push('the brief feed has no preview path at all')
  report(faults)
})

check('the brief asks for no password, in any of the words for one', () => {
  // The same rule check-project-intake.js keeps over the tracker. A build asks
  // a client where their web address is registered, and a box that took the
  // login to it would put a password in a table beside their photographs.
  const forbidden = /password|passphrase|\blogin\b|credential|secret|api[ _-]?key/i
  const faults = []
  for (const step of STEPS) {
    for (const field of step.fields || []) {
      const written = `${field.key} ${field.label} ${field.help || ''} ${field.placeholder || ''}`
      // The helper on the registrar question says in as many words that we
      // never ask for the login, which is the one place the word belongs.
      if (forbidden.test(field.key) || forbidden.test(field.label)) {
        faults.push(`${field.key} asks for something nobody should be typing into a form`)
      }
      if (field.kind === 'text' && forbidden.test(written) && !/never ask/i.test(written)) {
        faults.push(`${field.key} takes a value it should not be collecting`)
      }
    }
  }
  report(faults)
})

check('the logo goes where the build already asks for one', () => {
  const page = read(PAGE)
  const faults = []
  // A second route for the same file would be a second bucket path, a second
  // function and a second place the studio has to look, and the two would
  // disagree the first time one of them was changed.
  if (!page.includes('projectFeed.send')) faults.push('the picker sends through no feed at all')
  if (!/kind === 'files' &&\s*task\.required/.test(page.replace(/\s+/g, ' '))) {
    faults.push('the item the picker writes to is not found by what it is')
  }
  report(faults)
})

const passed = await finish({ listed: true })
console.log(`\n${passed}/${cases.length} passed`)
