/**
 * Holds the hand-added business to the same rules as one the sweep found.
 *
 * Everything else reaches `outreach_prospects` through a map search, which
 * carries a key nobody types and a shape nobody chooses. A form carries
 * neither, so three things have to be true of it that the sweep gets for free:
 * a business already on file is not filed a second time, a row already past
 * 'found' is not walked back to it, and an address that asked to be left alone
 * does not come back through a text field. The fourth is that a name arriving
 * this way is still a name nothing has read yet - no verdict on its mailbox,
 * no score on its site - so the columns those jobs write are the columns this
 * leaves empty.
 *
 * The action is driven directly rather than over HTTP. What is being checked
 * is which rows it reads, what it writes and what it refuses, and a request
 * around it would only add a session to stub.
 *
 * Nothing here opens a socket or reaches a database. The client is a plan of
 * answers keyed on the operation and the table, the same stand-in the outreach
 * write checks are driven against.
 */

const { addProspect } = await import('../../../api/outreach-admin.js')
const { SOURCE: PLACES, prospect: placeRow } = await import('../../../api/outreach/source.js')

const cases = []
const check = (name, run) => cases.push([name, run])

const same = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: got ${got}, wanted ${want}`)
}

const ok = (condition, what) => {
  if (!condition) throw new Error(what)
}

// ── The database stand-in ────────────────────────────────────────────────

/**
 * A client that answers every query from a plan, and records what was asked.
 *
 * The plan is keyed on the operation and the table, and a value may be a
 * single answer or a list of them, which is how the three reads this action
 * makes against one table are told apart. A plan naming fewer answers than
 * there are reads holds its last one, so a case that cares about the first
 * read alone says only that.
 *
 * The operation is fixed by the first mutating call in a chain rather than by
 * the last, so the `.select()` an insert takes to read its own row back leaves
 * that insert an insert.
 */
function stubDb(plan) {
  const asked = []
  const writes = []
  const filters = []
  const pending = new Map()

  const answerFor = key => {
    const planned = plan[key]
    if (planned === undefined) return { data: [], error: null, count: 0 }
    if (!Array.isArray(planned)) return planned
    const at = pending.get(key) ?? 0
    pending.set(key, at + 1)
    return planned[Math.min(at, planned.length - 1)]
  }

  const from = table => {
    const state = { table, op: 'select', payload: null, where: [] }
    const chain = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'then') {
            const key = `${state.op}:${state.table}`
            asked.push(key)
            filters.push({ key, where: state.where })
            if (state.op !== 'select') writes.push({ key, payload: state.payload })
            const answer = answerFor(key)
            return (resolve, reject) => Promise.resolve(answer).then(resolve, reject)
          }
          return (...args) => {
            if (state.op === 'select' && ['insert', 'update', 'upsert', 'delete'].includes(prop)) {
              state.op = prop
              state.payload = args[0] ?? null
            }
            if (['eq', 'ilike', 'in', 'neq'].includes(prop)) {
              state.where.push({ how: prop, column: args[0], value: args[1] })
            }
            return chain
          }
        },
      }
    )
    return chain
  }

  return { db: { from }, asked, writes, filters }
}

/** A refusal shaped the way a Supabase client reports one. */
const refused = what => ({ data: null, error: { message: what } })

/** The row the insert reads back, which is the shape the console files away. */
const filed = over => ({
  data: {
    id: 'p1',
    name: 'Harbour Plumbing',
    town: 'Baytown',
    trade: 'plumber',
    stage: 'found',
    audit_score: null,
    website: null,
    site_kind: null,
    contacted_at: null,
    replied_at: null,
    ...over,
  },
  error: null,
})

/** A business as somebody would type it in. */
const TYPED = {
  name: 'Harbour Plumbing',
  town: 'Baytown',
  trade: 'plumber',
  website: 'harbourplumbing.example',
  address: '1 Example Street, Baytown, TX 77520',
  phone: '(281) 555-0100',
}

/** A row the table already holds, in the shape the duplicate reads select. */
const onFile = over => ({
  id: 'p9',
  name: 'Harbour Plumbing',
  town: 'Baytown',
  website: 'https://harbourplumbing.example',
  stage: 'found',
  ...over,
})

/** The write an added business made, or nothing where it made none. */
const inserted = writes => writes.find(write => write.key === 'insert:outreach_prospects')

// ── What a new business is filed as ──────────────────────────────────────

check('a new business is filed at the found stage', async () => {
  const { db, writes } = stubDb({ 'insert:outreach_prospects': filed() })

  const answer = await addProspect(db, { action: 'add', ...TYPED })

  same(answer.status, 200, 'the status')
  same(answer.body.prospect.id, 'p1', 'the prospect answered with')
  const write = inserted(writes)
  ok(write, 'nothing was written to outreach_prospects')
  same(write.payload.stage, 'found', 'the stage it was filed at')
  same(write.payload.name, 'Harbour Plumbing', 'the name')
  same(write.payload.town, 'Baytown', 'the town')
  same(write.payload.trade, 'plumber', 'the trade')
  same(write.payload.phone, '(281) 555-0100', 'the phone')
  same(write.payload.address, '1 Example Street, Baytown, TX 77520', 'the postal address')
})

check('a bare host is filed as a website the pipeline can fetch', async () => {
  const { db, writes } = stubDb({ 'insert:outreach_prospects': filed() })

  await addProspect(db, { ...TYPED, website: 'harbourplumbing.example' })

  same(inserted(writes).payload.website, 'https://harbourplumbing.example', 'the website')
})

check('a website written in full is filed as it was written', async () => {
  const { db, writes } = stubDb({ 'insert:outreach_prospects': filed() })

  await addProspect(db, { ...TYPED, website: 'http://harbourplumbing.example/contact' })

  same(inserted(writes).payload.website, 'http://harbourplumbing.example/contact', 'the website')
})

check('nothing is invented for the readings no job has taken', async () => {
  const { db, writes } = stubDb({ 'insert:outreach_prospects': filed() })

  await addProspect(db, TYPED)

  // Each of these is a job's answer about the business. A value here would be
  // this form answering for a job that has not run, and the address check in
  // particular refuses to run again on a verdict already recorded - so a
  // verdict written here is a message sent to an address nothing verified.
  const write = inserted(writes)
  for (const column of [
    'place_id',
    'site_kind',
    'audit_score',
    'audit_at',
    'email_verdict',
    'email_check_reason',
    'email_checked_at',
    'contacted_at',
    'skip_reason',
  ]) {
    ok(!(column in write.payload), `the write filed a ${column} no job has read`)
  }
})

check('a business with no name is refused before anything is read', async () => {
  const { db, asked } = stubDb({})

  const answer = await addProspect(db, { ...TYPED, name: '   ' })

  same(answer.status, 400, 'the status')
  same(asked.length, 0, 'reads made for a business with no name')
})

check('a website no host can be read out of is refused', async () => {
  const { db, writes } = stubDb({ 'insert:outreach_prospects': filed() })

  const answer = await addProspect(db, { ...TYPED, website: 'not a website' })

  same(answer.status, 400, 'the status')
  same(inserted(writes), undefined, 'a row was filed for a website that will not resolve')
})

check('a contact address that is not one is refused', async () => {
  const { db, writes } = stubDb({ 'insert:outreach_prospects': filed() })

  const answer = await addProspect(db, { ...TYPED, email: 'owner at example.com' })

  same(answer.status, 400, 'the status')
  same(inserted(writes), undefined, 'a row was filed for an address nothing can be sent to')
})

// ── A business already on file ───────────────────────────────────────────

/**
 * A plan whose duplicate reads answer with one row and whose insert would
 * succeed.
 *
 * The insert is left workable on purpose: a case asserting that nothing was
 * written has to be one where writing was possible, or it passes on the
 * strength of the stub rather than on the strength of the action.
 */
const duplicatePlan = row => ({
  'select:outreach_prospects': { data: [row], error: null },
  'insert:outreach_prospects': filed(),
})

for (const stage of [
  'found',
  'enriched',
  'audited',
  'contacted',
  'replied',
  'skipped',
  'bounced',
]) {
  check(`a business already at the ${stage} stage is not filed twice`, async () => {
    const { db, writes } = stubDb(duplicatePlan(onFile({ stage })))

    const answer = await addProspect(db, TYPED)

    same(answer.status, 409, 'the status')
    same(answer.body.prospect.id, 'p9', 'the row it was already on file as')
    same(answer.body.prospect.stage, stage, 'the stage that row is at')
    same(inserted(writes), undefined, `a second row was filed for a business at ${stage}`)
  })
}

check('a business taken out of the pipeline is not walked back to found', async () => {
  const { db, writes } = stubDb(duplicatePlan(onFile({ stage: 'skipped' })))

  await addProspect(db, TYPED)

  // Neither a second row nor a rewrite of the first. A skipped business was
  // ruled out by a job or by a person, and a form with a name in it is not an
  // account of why that reading was wrong.
  ok(!writes.length, `the add wrote: ${writes.map(write => write.key).join(', ')}`)
})

check('a business that asked for no further contact is not walked back either', async () => {
  const { db, writes } = stubDb(duplicatePlan(onFile({ stage: 'unsubscribed' })))

  const answer = await addProspect(db, TYPED)

  same(answer.status, 409, 'the status')
  ok(!writes.length, 'the add wrote to a business that asked to be left alone')
})

for (const stored of ['harbour  plumbing', 'Harbour-Plumbing', 'Harbour Plumbing, L.L.C.']) {
  check(`'${stored}' is the business that was typed in`, async () => {
    const { db, writes } = stubDb(duplicatePlan(onFile({ name: stored })))

    const answer = await addProspect(db, { ...TYPED, website: '' })

    same(answer.status, 409, 'the status')
    same(inserted(writes), undefined, `a second row was filed alongside '${stored}'`)
  })
}

check('a name is not shortened into another business on its way to a match', async () => {
  // A registered ending is read as the whole of the difference between two
  // names rather than trimmed off either, so the two letters that would make
  // this one match stay where they are.
  const { db, writes } = stubDb(duplicatePlan(onFile({ name: 'Baytown Toba', website: null })))

  const answer = await addProspect(db, { ...TYPED, name: 'Baytown Tobacco', website: '' })

  same(answer.status, 200, 'the status')
  ok(inserted(writes), 'two different businesses were read as one')
})

check('a business is recognised by its site whatever it is called', async () => {
  const { db, writes } = stubDb({
    'select:outreach_prospects': { data: [onFile({ name: 'Harbour Plumbing Co' })], error: null },
    'insert:outreach_prospects': filed(),
  })

  const answer = await addProspect(db, { ...TYPED, name: 'Harbour Plumbing Co' })

  same(answer.status, 409, 'the status')
  same(inserted(writes), undefined, 'a second row was filed for a business at the same site')
})

check('the same site behind www is the same site', async () => {
  const { db, writes } = stubDb({
    'select:outreach_prospects': {
      data: [onFile({ name: 'Somebody Else', website: 'https://www.harbourplumbing.example/' })],
      error: null,
    },
    'insert:outreach_prospects': filed(),
  })

  const answer = await addProspect(db, { ...TYPED, name: 'Somebody Else' })

  same(answer.status, 409, 'the status')
  same(inserted(writes), undefined, 'a second row was filed for the same site behind www')
})

check('a business in another town is not the one on file', async () => {
  const { db, writes } = stubDb({
    'select:outreach_prospects': {
      data: [onFile({ town: 'Dayton', website: null })],
      error: null,
    },
    'insert:outreach_prospects': filed(),
  })

  const answer = await addProspect(db, { ...TYPED, website: '' })

  same(answer.status, 200, 'the status')
  ok(inserted(writes), 'a business in another town was read as one already on file')
})

check('a name is never handed to the filter as a pattern of its own', async () => {
  const { db, filters } = stubDb({ 'insert:outreach_prospects': filed() })

  await addProspect(db, { ...TYPED, name: '100% Plumbing_Co', website: '' })

  // PostgREST reads * and % in an ilike value as wildcards, so a name is
  // narrowed on by its leading letters and digits and matched here. A pattern
  // carrying either would select rows this business has nothing to do with,
  // and the first of them would come back as the business already on file.
  for (const { how, value } of filters.flatMap(read => read.where)) {
    if (how !== 'ilike') continue
    const typed = String(value).replace(/%$/, '')
    ok(!/[%*_]/.test(typed), `an ilike filter carried a pattern character: ${value}`)
  }
})

check('a name of nothing but punctuation is not looked up against the whole table', async () => {
  const { db, filters, writes } = stubDb({ 'insert:outreach_prospects': filed() })

  await addProspect(db, { name: '&&&', website: '', town: '', trade: '' })

  // No prefix to narrow on and no town to fall back to. The name read is not
  // made at all rather than made against everything.
  const reads = filters.filter(read => read.key === 'select:outreach_prospects')
  ok(!reads.length, `an unnarrowed read was made: ${reads.length} of them`)
  ok(inserted(writes), 'the business was not filed')
})

// ── The suppression list ─────────────────────────────────────────────────

check('an address that asked to be left alone cannot come back through the form', async () => {
  const { db, writes } = stubDb({
    'select:suppression': { data: [{ email: 'owner@example.com' }], error: null },
    'select:outreach_prospects': { data: [], error: null },
    'insert:outreach_prospects': filed(),
  })

  const answer = await addProspect(db, { ...TYPED, email: 'Owner@Example.com' })

  same(answer.status, 409, 'the status')
  same(inserted(writes), undefined, 'a suppressed address was filed as a live prospect')
})

check('the suppression list is read before the business is looked for', async () => {
  const { db, asked } = stubDb({
    'select:suppression': { data: [{ email: 'owner@example.com' }], error: null },
    'insert:outreach_prospects': filed(),
  })

  await addProspect(db, { ...TYPED, email: 'owner@example.com' })

  // A suppressed address is a refusal whatever else is true of the business,
  // so it is settled first and the reads behind it are never made.
  same(asked[0], 'select:suppression', 'the first read')
  ok(!asked.includes('select:outreach_prospects'), 'the table was read past a refusal')
})

check('an address not on the list is filed with the business', async () => {
  const { db, writes } = stubDb({
    'select:suppression': { data: [], error: null },
    'select:outreach_prospects': { data: [], error: null },
    'insert:outreach_prospects': filed(),
  })

  const answer = await addProspect(db, { ...TYPED, email: 'Owner@Example.com' })

  same(answer.status, 200, 'the status')
  same(inserted(writes).payload.email, 'owner@example.com', 'the address it was filed under')
})

check('a business with no address given reads the suppression list for nothing', async () => {
  const { db, asked } = stubDb({ 'insert:outreach_prospects': filed() })

  await addProspect(db, TYPED)

  ok(!asked.includes('select:suppression'), 'the suppression list was read with nothing to look up')
})

// ── Identity without a place id ──────────────────────────────────────────

check(
  'a business added by hand is filed under the console as its source, with no key',
  async () => {
    const { db, writes } = stubDb({ 'insert:outreach_prospects': filed() })

    await addProspect(db, TYPED)

    const { payload } = inserted(writes)
    same(payload.source, 'console', 'the source it was filed under')
    ok(!('place_id' in payload), 'a place id was invented for a business off no map')
    ok(!('source_ref' in payload), 'a reference was invented for a business nothing referred')
  }
)

check('a place off the map is filed under places, with its id as the reference', () => {
  const row = placeRow(
    {
      id: 'ChIJ-example',
      displayName: { text: ' Harbour Plumbing ' },
      websiteUri: 'https://x.com',
    },
    'Baytown',
    'plumber'
  )
  same(row.source, PLACES, 'the source')
  same(row.source, 'places', 'what the source is called')
  same(row.source_ref, 'ChIJ-example', 'the reference')
  same(row.place_id, 'ChIJ-example', 'the place id the sweep still upserts on')
  same(row.name, 'Harbour Plumbing', 'the name')
  same(
    placeRow({ displayName: { text: 'No Id' } }, 'Baytown', 'plumber'),
    null,
    'a place with no id'
  )
})

// A row filed without a place id is one the sweep never saw. It has to stand
// on the same footing as a row the sweep filed: found the same three ways,
// left where it stands once it has moved on, and kept off the list an address
// asked to be kept off.
const BY_HAND = { place_id: null, source: 'console', source_ref: null }

check('a row with no place id is still recognised as the business typed in', async () => {
  for (const found of [
    { ...TYPED, website: '' },
    { ...TYPED, name: 'Something Else', website: 'harbourplumbing.example' },
  ]) {
    const { db, writes } = stubDb(duplicatePlan(onFile(BY_HAND)))

    const answer = await addProspect(db, found)

    same(answer.status, 409, 'the status')
    same(answer.body.prospect.id, 'p9', 'the row it was already on file as')
    same(inserted(writes), undefined, 'a second row was filed beside one with no place id')
  }
})

check('a row with no place id is not walked back past found either', async () => {
  for (const stage of ['enriched', 'audited', 'contacted', 'skipped', 'unsubscribed']) {
    const { db, writes } = stubDb(duplicatePlan(onFile({ ...BY_HAND, stage })))

    const answer = await addProspect(db, TYPED)

    same(answer.status, 409, `the status at ${stage}`)
    same(answer.body.prospect.stage, stage, 'the stage that row is at')
    ok(!writes.length, `the add wrote to a row with no place id at ${stage}`)
  }
})

check('a row with no place id honours the suppression list like any other', async () => {
  const { db, writes } = stubDb({
    'select:suppression': { data: [{ email: 'owner@example.com' }], error: null },
    'select:outreach_prospects': {
      data: [onFile({ ...BY_HAND, email: 'owner@example.com' })],
      error: null,
    },
    'insert:outreach_prospects': filed(),
  })

  const answer = await addProspect(db, { ...TYPED, email: 'owner@example.com' })

  same(answer.status, 409, 'the status')
  ok(!writes.length, 'a suppressed address was written to a row with no place id')
})

// ── Nothing here sends ───────────────────────────────────────────────────

check('adding a business writes to one table and sends nothing', async () => {
  const { db, writes, asked } = stubDb({
    'select:suppression': { data: [], error: null },
    'select:outreach_prospects': { data: [], error: null },
    'insert:outreach_prospects': filed(),
  })

  await addProspect(db, { ...TYPED, email: 'owner@example.com' })

  // `subscribers` is the mailing list, and a business added here never asked
  // to be on it. `outreach_messages` is the record of a message, and a
  // business at the found stage has not been written to.
  for (const table of ['subscribers', 'outreach_messages', 'suppression']) {
    const touched = writes.filter(write => write.key.endsWith(`:${table}`))
    ok(!touched.length, `the add wrote to ${table}: ${touched.map(w => w.key).join(', ')}`)
  }
  same(writes.length, 1, 'tables written to')
  ok(!asked.some(call => call.endsWith(':outreach_runs')), 'the add opened a run of its own')
})

// ── A refusal from the database ──────────────────────────────────────────

check('a refused insert is answered rather than reported as filed', async () => {
  const { db } = stubDb({
    'select:outreach_prospects': { data: [], error: null },
    'insert:outreach_prospects': refused('insert refused'),
  })

  const answer = await addProspect(db, TYPED)

  same(answer.status, 500, 'the status')
  same(answer.body.error, 'insert refused', 'the reason given')
})

check('a table that is not there names itself', async () => {
  const { db } = stubDb({
    'select:outreach_prospects': {
      data: null,
      error: { code: '42P01', message: 'relation "outreach_prospects" does not exist' },
    },
  })

  const answer = await addProspect(db, TYPED)

  same(answer.status, 503, 'the status')
  ok(answer.body.error.includes('outreach migration'), `the reason given: ${answer.body.error}`)
})

// ── Run them ────────────────────────────────────────────────────────────

const failures = []
for (const [name, run] of cases) {
  try {
    await run()
  } catch (cause) {
    failures.push(`${name}: ${cause.message}`)
  }
}

if (failures.length) {
  for (const failure of failures) console.error(failure)
  console.error(`\n${failures.length} of ${cases.length} hand-added prospect checks failed`)
  process.exit(1)
}

console.log(`outreach add: ${cases.length} checks passed`)
