/**
 * Holds the preview funnel to what it says: of the preview sites sent, how many
 * were opened by a person, how many businesses came to look, what they did and
 * how many wrote back - by layout, by the week sent, and before and after the
 * new layouts - read the way the Call List reads a business.
 *
 * The rows are shaped like the live tables' on 2026-11-05: a letter opened
 * eight seconds after it went (a scanner), a visit 28 seconds after (a link
 * checker), the after-hours notice a pest control company's mailbox sent back, and a
 * bounce. The reader is handed a database that filters its rows the way the
 * real one does, so a bounce or a reply to another business never reaches the
 * count.
 *
 *   node scripts/outreach/previews/check-preview-funnel.js
 */

import { cases, check, finish, ok, same } from '../../harness/checks.js'
import {
  FAMILIES,
  NEW_LAYOUTS_FROM,
  buildsWords,
  doneWords,
  familyLabel,
  funnelOf,
  median,
  overallWords,
  percent,
  previewOf,
  rateWords,
  timeSaid,
  weekLabel,
  weekOf,
  weeksLine,
  weeksWords,
} from '../../../lib/outreach/funnel.js'
import { byPerson, readFunnel } from '../../../lib/outreach/funnel-rows.js'
import { renderRecap, tallyOf } from '../../../lib/outreach/daily-report.js'
import { work } from '../../../api/outreach/daily-report.js'
import { answer } from '../../../api/previews-admin.js'

const at = (base, seconds) => new Date(Date.parse(base) + seconds * 1000).toISOString()

// Thursday 2026-11-05, mid-morning in Texas.
const NOW = new Date('2026-11-05T16:00:00.000Z')
// Monday 2026-10-26 and Monday 2026-11-02, both mid-morning in Texas.
const LAST_WEEK = '2026-10-26T15:41:54.000Z'
const THIS_WEEK = '2026-11-02T14:00:00.000Z'

check('an open in the first ten minutes is the mail system, a later one is a person', () => {
  const site = { id: 's', sent_at: LAST_WEEK, industry: 'hvac' }
  const scanned = previewOf(site, {
    letters: [
      {
        sent_at: LAST_WEEK,
        opened_at: at(LAST_WEEK, 8),
        last_open_at: at(LAST_WEEK, 90),
        open_count: 4,
      },
    ],
  })
  ok(!scanned.opened, 'four fetches inside the first minutes are not a person')
  ok(scanned.openedAny, 'but they are an open of some kind')
  const read = previewOf(site, {
    letters: [
      {
        sent_at: LAST_WEEK,
        opened_at: at(LAST_WEEK, 8),
        last_open_at: at(LAST_WEEK, 7200),
        open_count: 2,
      },
    ],
  })
  ok(read.opened, 'an open two hours later is a person')
})

check('a letter from before the preview went is not one of its letters', () => {
  const site = { id: 's', sent_at: LAST_WEEK }
  const one = previewOf(site, {
    letters: [
      { sent_at: '2026-10-01T15:00:00.000Z', opened_at: '2026-10-02T15:00:00.000Z', open_count: 3 },
    ],
  })
  ok(!one.opened && !one.openedAny, 'an old letter’s opens are not the preview’s')
})

check('a visit inside two minutes of any letter is a link checker; a later one is a person', () => {
  const site = { id: 's', sent_at: LAST_WEEK, view_count: 4 }
  const followUp = '2026-10-30T22:05:45.000Z'
  const sends = [LAST_WEEK, followUp]
  const checker = { started_at: at(LAST_WEEK, 28), active_ms: 2164, max_scroll: 0 }
  const second = { started_at: at(followUp, 40), active_ms: 3000, max_scroll: 10 }
  const person = {
    started_at: at(LAST_WEEK, 29766),
    active_ms: 6473,
    max_scroll: 75,
    pages: 1,
    ctas: 1,
    claims: 1,
  }
  const machines = previewOf(site, { sends, sessions: [checker, second] })
  ok(!machines.visited, 'only link checkers came, so nobody looked, view count or not')
  const looked = previewOf(site, { sends, sessions: [checker, second, person] })
  ok(looked.visited, 'the evening visit is a person')
  ok(looked.opened, 'a business on its site opened the letter, picture or no picture')
  same(looked.seconds, 6.473, 'only the person’s time is counted')
  same(looked.scroll, 75, 'deepest scroll')
  same(looked.claims, 1, 'Make It Yours')
})

check('a view counted with no visit filed is still a visit', () => {
  const one = previewOf({ id: 's', sent_at: LAST_WEEK, view_count: 1 }, { sessions: [] })
  ok(one.visited && one.opened, 'the database ruled out the machines before it counted the view')
  same(one.seconds, 0, 'with no time to count')
})

const PEOPLE = [
  {
    // An after-hours notice the mailbox reader filed as a reply, word for word
    // the shape of the one on the table.
    prospect_id: 'p-pest',
    subject: 'Re: Trenton Taylor - TaylorURL',
    body_text:
      "You have reached Example Pest Co after hours!\r\n\r\nWe've received your email and we'll be back in the office during our normal\r\nbusiness hours.",
    intent: null,
    sent_at: '2026-11-02T13:06:12.000Z',
  },
  {
    prospect_id: 'p-auto',
    subject: 'Automatic reply: Trenton Taylor, TaylorURL',
    body_text: 'I am away until Monday.',
    intent: 'auto_reply',
    sent_at: '2026-11-02T13:10:00.000Z',
  },
  {
    prospect_id: 'p-yes',
    subject: 'Re: Trenton Taylor, TaylorURL',
    body_text: 'This looks great. Call me Thursday.\n\nOn Mon, Trenton wrote:\n> Hi',
    intent: null,
    sent_at: '2026-11-03T15:00:00.000Z',
  },
  {
    prospect_id: 'p-stop',
    subject: 'Re: Trenton Taylor, TaylorURL',
    body_text: 'Please remove me from your list.',
    intent: 'opt_out',
    sent_at: '2026-11-03T16:00:00.000Z',
  },
]

check('a reply is a person only where a person typed it', () => {
  same(
    PEOPLE.map(byPerson).join(','),
    'false,false,true,true',
    'after-hours notice, auto-reply, a person, a person asking to stop'
  )
})

check('a funnel lists every layout family, the new ones too, and an older one after them', () => {
  const funnel = funnelOf(
    {
      sites: [
        { id: 'a', industry: 'hvac', sent_at: LAST_WEEK },
        { id: 'b', industry: 'plumbing', sent_at: LAST_WEEK },
      ],
    },
    { now: NOW }
  )
  same(
    funnel.families.map(one => one.key).join(','),
    [...Object.keys(FAMILIES), 'plumbing'].join(','),
    'families in order'
  )
  same(funnel.families[0].label, 'Home Service', 'hvac is the home service layout')
  same(familyLabel('plumbing'), 'Plumbing', 'an older family is named off its key')
  same(funnel.families.find(one => one.key === 'outdoor').sent, 0, 'outdoor, none sent yet')
  same(rateWords(funnel.families.find(one => one.key === 'outdoor')), 'none sent yet', 'said')
})

check('a week runs Monday to Sunday in Texas', () => {
  same(weekOf('2026-11-05T16:00:00.000Z'), '2026-11-02', 'a Thursday')
  same(weekOf('2026-11-02T06:00:00.000Z'), '2026-11-02', 'Monday just after midnight in Texas')
  // Sunday at nine in the evening in Texas is already Monday in UTC.
  same(weekOf('2026-11-02T03:00:00.000Z'), '2026-10-26', 'a Sunday evening')
  same(weekLabel('2026-11-02'), 'Week of Nov 2', 'label')
})

check('the middle of the time spent, and time said the way a person says it', () => {
  same(median([]), null, 'none')
  same(median([5, 1, 3]), 3, 'odd')
  same(median([1, 3, 5, 7]), 4, 'even')
  same(timeSaid(4.9), '5 sec', 'seconds')
  same(timeSaid(240), '4 min', 'minutes')
  same(timeSaid(3900), '1 hr 5 min', 'hours')
  same(timeSaid(null), '–', 'nothing to say')
  same(percent(2 / 15), '13%', 'a share')
  same(percent(null), '–', 'no share')
})

/** The live table's shape: three families, two weeks, a scanner, a checker and a person. */
const ROWS = {
  sites: [
    // Home service, last week: a scanner opened it and a link checker followed
    // the link, then the owner looked that evening.
    {
      id: 's-high',
      slug: 'example-machine',
      industry: 'hvac',
      prospect_id: 'p-high',
      sent_at: LAST_WEEK,
      created_at: '2026-10-25T05:00:00.000Z',
      view_count: 4,
    },
    // Home service, this week: the after-hours notice, five days on a visit.
    {
      id: 's-pest',
      slug: 'example-pest',
      industry: 'hvac',
      prospect_id: 'p-pest',
      sent_at: '2026-10-28T15:41:43.000Z',
      created_at: '2026-10-28T05:00:00.000Z',
      view_count: 1,
    },
    // Professional, this week: a person opened, came to look, and wrote back.
    {
      id: 's-yes',
      slug: 'example-law',
      industry: 'professional',
      prospect_id: 'p-yes',
      sent_at: THIS_WEEK,
      created_at: '2026-11-02T12:00:00.000Z',
      view_count: 1,
    },
    // Professional, this week: opened by a person, asked to stop.
    {
      id: 's-stop',
      slug: 'example-cpa',
      industry: 'professional',
      prospect_id: 'p-stop',
      sent_at: THIS_WEEK,
      created_at: '2026-11-02T12:00:00.000Z',
      view_count: 0,
    },
    // Roofing, built on the new layouts: sent, nobody has opened it yet.
    {
      id: 's-roof',
      slug: 'example-roof',
      industry: 'roofing',
      prospect_id: 'p-roof',
      sent_at: '2026-11-05T19:00:00.000Z',
      created_at: '2026-11-05T18:30:00.000Z',
      view_count: 0,
    },
  ],
  letters: [
    {
      prospect_id: 'p-high',
      sent_at: LAST_WEEK,
      opened_at: at(LAST_WEEK, 8),
      last_open_at: at(LAST_WEEK, 100),
      open_count: 4,
    },
    {
      prospect_id: 'p-high',
      sent_at: '2026-10-30T22:05:45.000Z',
      opened_at: '2026-10-30T22:06:03.000Z',
      last_open_at: '2026-10-30T22:07:22.000Z',
      open_count: 4,
    },
    {
      prospect_id: 'p-pest',
      sent_at: '2026-10-28T15:41:43.000Z',
      opened_at: null,
      last_open_at: null,
      open_count: 0,
    },
    {
      prospect_id: 'p-pest',
      sent_at: '2026-11-02T13:06:00.000Z',
      opened_at: null,
      last_open_at: null,
      open_count: 0,
    },
    {
      prospect_id: 'p-yes',
      sent_at: THIS_WEEK,
      opened_at: at(THIS_WEEK, 3600),
      last_open_at: at(THIS_WEEK, 3600),
      open_count: 1,
    },
    {
      prospect_id: 'p-stop',
      sent_at: THIS_WEEK,
      opened_at: at(THIS_WEEK, 7200),
      last_open_at: at(THIS_WEEK, 7200),
      open_count: 1,
    },
    {
      prospect_id: 'p-roof',
      sent_at: '2026-11-05T19:00:00.000Z',
      opened_at: null,
      last_open_at: null,
      open_count: 0,
    },
  ],
  sessions: [
    {
      id: 'v1',
      site_id: 's-high',
      started_at: at(LAST_WEEK, 28),
      last_seen_at: at(LAST_WEEK, 31),
      active_ms: 2164,
      max_scroll: 0,
      pages: 1,
    },
    {
      id: 'v2',
      site_id: 's-high',
      started_at: at(LAST_WEEK, 29766),
      last_seen_at: at(LAST_WEEK, 29772),
      active_ms: 6473,
      max_scroll: 75,
      pages: 1,
      ctas: 1,
      claims: 0,
    },
    {
      id: 'v3',
      site_id: 's-pest',
      started_at: '2026-11-02T17:13:40.000Z',
      last_seen_at: '2026-11-02T17:13:40.000Z',
      active_ms: 4917,
      max_scroll: 0,
      pages: 1,
    },
    {
      id: 'v4',
      site_id: 's-yes',
      started_at: at(THIS_WEEK, 4000),
      last_seen_at: at(THIS_WEEK, 4240),
      active_ms: 240000,
      max_scroll: 100,
      pages: 3,
      calls: 1,
      form_submits: 1,
      claims: 1,
    },
  ],
  replies: [
    { prospect_id: 'p-yes', sent_at: '2026-11-03T15:00:00.000Z', stop: false },
    { prospect_id: 'p-stop', sent_at: '2026-11-03T16:00:00.000Z', stop: true },
  ],
}

check('the funnel counts businesses: sent, opened by a person, came to look, wrote back', () => {
  const funnel = funnelOf(ROWS, { now: NOW })
  const all = funnel.overall
  same(
    [all.sent, all.opened, all.openedAny, all.visited, all.replied, all.stopped].join(','),
    '5,4,4,3,1,1',
    'sent, opened, opened at all, looked, replied, asked to stop'
  )
  same(all.visitedPerOpened, 3 / 4, 'visited per opened')
  same(all.medianSeconds, 6.473, 'the middle visitor’s time')
  same(Math.round(all.totalSeconds), 251, 'every visitor’s time together')
  same(all.deepestScroll, 100, 'one read to the bottom')
  same([all.calls, all.emails, all.forms, all.claims].join(','), '1,0,1,1', 'taps')

  const home = funnel.families.find(one => one.key === 'hvac')
  same([home.sent, home.opened, home.visited, home.replied].join(','), '2,2,2,0', 'home service')
  same(home.openedAny, 2, 'the visit stands in for the picture that never loaded')
  const pro = funnel.families.find(one => one.key === 'professional')
  same([pro.sent, pro.opened, pro.visited, pro.replied, pro.stopped].join(','), '2,2,1,1,1', 'pro')
  const roof = funnel.families.find(one => one.key === 'roofing')
  same(roof.visitedPerOpened, null, 'nobody opened a roofing preview yet')
  same(rateWords(roof), 'nobody has opened one yet', 'said so')
})

check('the weeks run newest first, by the week each preview was sent', () => {
  const funnel = funnelOf(ROWS, { now: NOW })
  same(funnel.weeks.map(one => one.key).join(','), '2026-11-02,2026-10-26', 'weeks')
  same(funnel.thisWeek.sent, 3, 'this week')
  same(funnel.lastWeek.sent, 2, 'last week')
  same(funnel.lastWeek.visitedPerOpened, 1, 'both of last week’s openers looked')
  same(
    weeksLine(funnel),
    'Preview sites visited per opened: 1 of 2 this week (50%), 2 of 2 last week (100%).',
    'the recap’s line'
  )
  same(
    weeksWords(funnel),
    'This week: 1 of 2 who opened came to look (50%). Last week: 2 of 2 (100%).',
    'the page’s line'
  )
  const quiet = funnelOf({ sites: [] }, { now: NOW })
  same(quiet.weeks.length, 2, 'this week and last are there with nothing in them')
  same(weeksLine(quiet), null, 'and the recap carries no line of noughts')
})

check('the old layouts and the new are told apart by when the site was built', () => {
  const funnel = funnelOf(ROWS, { now: NOW })
  const [old, fresh] = funnel.builds
  same(`${old.key}:${old.sent},${fresh.key}:${fresh.sent}`, 'old:4,new:1', 'split')
  ok(
    Date.parse(NEW_LAYOUTS_FROM) > Date.parse('2026-11-05T14:37:00.000Z'),
    'after the morning batch'
  )
  same(buildsWords(funnel), 'New layouts: nobody has opened one yet.', 'new layouts sent, unopened')
  same(
    buildsWords(funnelOf({ sites: ROWS.sites.slice(0, 2) }, { now: NOW })),
    'New layouts (built from Nov 5): none sent yet.',
    'none sent'
  )
})

check('the funnel is said in plain words', () => {
  const funnel = funnelOf(ROWS, { now: NOW })
  same(
    overallWords(funnel),
    'Of 5 preview sites sent, 4 were opened by a person and 3 of those businesses came to look (75%). 1 business has written back.',
    'overall'
  )
  same(
    doneWords(funnel.families.find(one => one.key === 'professional')),
    'median 4 min, 4 min in all · read to the bottom · 1 call tapped · 1 form sent · Make It Yours tapped once',
    'what the visitors did'
  )
  same(doneWords(funnel.families.find(one => one.key === 'roofing')), null, 'nobody looked')
  same(overallWords(funnelOf({}, { now: NOW })), 'No preview site has been sent yet.', 'empty')
})

/** A table that filters its rows by the calls a query makes, and pages like PostgREST. */
function tableOf(rows, asked) {
  const filters = []
  const query = {
    select: () => query,
    eq: (column, value) => (filters.push(row => row[column] === value), query),
    in: (column, values) => (
      asked?.push(values.length),
      filters.push(row => values.includes(row[column])),
      query
    ),
    not: (column, operator, value) => (filters.push(row => row[column] !== value), query),
    gte: (column, value) => (filters.push(row => row[column] >= value), query),
    lt: (column, value) => (filters.push(row => row[column] < value), query),
    order: () => query,
    range: (from, to) => {
      const data = rows.filter(row => filters.every(keep => keep(row)))
      return Promise.resolve({ data: data.slice(from, to + 1), error: null, count: data.length })
    },
  }
  return query
}

const TABLES = {
  preview_sites: [
    ...ROWS.sites.map(site => ({ ...site, channel: 'email' })),
    // Built and never sent, and a preview for a call rather than an email.
    { id: 's-draft', industry: 'hvac', prospect_id: 'p-draft', sent_at: null, channel: 'email' },
    { id: 's-call', industry: 'hvac', prospect_id: 'p-call', sent_at: LAST_WEEK, channel: 'call' },
  ],
  outreach_messages: [
    ...ROWS.letters.map((letter, index) => ({
      id: `m${index}`,
      direction: 'outbound',
      status: 'sent',
      ...letter,
    })),
    {
      id: 'm-failed',
      prospect_id: 'p-roof',
      direction: 'outbound',
      status: 'failed',
      sent_at: null,
      opened_at: null,
    },
    ...PEOPLE.map((reply, index) => ({
      id: `r${index}`,
      direction: 'inbound',
      status: 'received',
      ...reply,
    })),
    {
      id: 'r-bounce',
      prospect_id: 'p-yes',
      direction: 'inbound',
      status: 'bounced',
      subject: 'Delivery Status Notification (Failure)',
      body_text: 'Status: 5.1.1',
      sent_at: '2026-11-03T15:30:00.000Z',
    },
  ],
  // The table holds no taps of its own; those are events, read beside it.
  preview_sessions: ROWS.sessions.map(visit => {
    const held = { ...visit }
    delete held.claims
    return held
  }),
  preview_events: [
    { id: 1, session_id: 'v4', type: 'click', kind: 'claim' },
    { id: 2, session_id: 'v4', type: 'click', kind: 'call' },
    { id: 3, session_id: 'v2', type: 'scroll', kind: 'claim' },
  ],
}

const dbOf = (tables, asked) => ({ from: name => tableOf(tables[name] ?? [], asked) })

check(
  'the reader gathers the sent sites, their letters, their visits and the people who wrote',
  async () => {
    const rows = await readFunnel(dbOf(TABLES))
    same(
      rows.sites.map(site => site.id).join(','),
      ROWS.sites.map(site => site.id).join(','),
      'sites'
    )
    same(rows.letters.length, ROWS.letters.length, 'sent letters only')
    same(rows.sessions.find(visit => visit.id === 'v4').claims, 1, 'one tap on Make It Yours')
    same(rows.sessions.find(visit => visit.id === 'v2').claims, 0, 'a scroll is not a tap')
    same(
      rows.replies.map(reply => `${reply.prospect_id}:${reply.stop}`).join(','),
      'p-yes:false,p-stop:true',
      'the people, the bounce and the machines left out'
    )
    ok(rows.complete, 'every row read')
    const funnel = funnelOf(rows, { now: NOW })
    same(funnel.overall.replied, 1, 'one business wrote back')
    same(funnel.overall.visited, 3, 'three businesses looked')
  }
)

check('the reader asks for a hundred businesses at a time', async () => {
  const sites = Array.from({ length: 230 }, (_, index) => ({
    id: `s${index}`,
    industry: 'hvac',
    prospect_id: `p${index}`,
    sent_at: LAST_WEEK,
    channel: 'email',
  }))
  const asked = []
  const rows = await readFunnel(dbOf({ preview_sites: sites }, asked))
  same(rows.sites.length, 230, 'every site')
  ok(
    asked.every(size => size <= 100),
    `an in filter was handed ${Math.max(...asked)} ids`
  )
})

check('the endpoint answers the funnel and whether it read every row', async () => {
  const body = await answer(dbOf(TABLES), NOW)
  same(body.overall.sent, 5, 'sent')
  same(body.families.length, Object.keys(FAMILIES).length, 'the six families, none older sent')
  same(body.complete, true, 'complete')
  same(body.newLayoutsFrom, NEW_LAYOUTS_FROM, 'where the new layouts start')
})

check(
  'the recap carries the preview line under the day’s count, and none when there is none',
  () => {
    const line = weeksLine(funnelOf(ROWS, { now: NOW }))
    const recap = renderRecap('2026-11-05', tallyOf({}), { previews: line })
    ok(recap.text.includes(line), 'the plain half')
    ok(
      recap.html.includes('Preview sites visited per opened: 1 of 2 this week (50%)'),
      'the HTML half'
    )
    const bare = renderRecap('2026-11-05', tallyOf({}))
    ok(!bare.text.includes('Preview sites'), 'no line where none was given')
  }
)

check('the five o’clock run puts this week’s and last week’s rates in the recap', async () => {
  const sent = []
  await work(
    { db: dbOf(TABLES), counts: {}, now: new Date('2026-11-05T23:00:00.000Z') },
    async recap => {
      sent.push(recap)
      return 'id'
    }
  )
  same(sent.length, 1, 'one recap, on the letters sent today')
  ok(
    sent[0].text.includes(
      'Preview sites visited per opened: 1 of 2 this week (50%), 2 of 2 last week (100%).'
    ),
    sent[0].text.split('\n').slice(0, 6).join(' / ')
  )
})

check('a preview read that fails costs the recap its line and nothing else', async () => {
  const broken = {
    from: name =>
      name === 'preview_sites'
        ? {
            select: () => {
              throw new Error('preview_sites is down')
            },
          }
        : tableOf(TABLES[name] ?? []),
  }
  const sent = []
  const held = console.error
  console.error = () => {}
  try {
    await work(
      { db: broken, counts: {}, now: new Date('2026-11-05T23:00:00.000Z') },
      async recap => {
        sent.push(recap)
        return 'id'
      }
    )
  } finally {
    console.error = held
  }
  same(sent.length, 1, 'the recap still went')
  ok(!sent[0].text.includes('Preview sites'), 'without the line')
})

await finish({ hint: 'lib/outreach/funnel.js, lib/outreach/funnel-rows.js' })

console.log(`preview funnel: ${cases.length} checks passed`)
