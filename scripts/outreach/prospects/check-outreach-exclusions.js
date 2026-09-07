/**
 * Holds the outreach pipeline to writing to people at businesses that can buy
 * from it, and to never writing to a domain that has been held off.
 *
 * Three things are asserted. A held domain is refused everywhere an address
 * is read: by the shape check the queue and the transport share, and by the
 * row rule the enricher and its sweep share, against the site and the address
 * both. A business too large to buy is caught off its name, off its host, and
 * off the signs its own pages carry, while the ordinary shops those signals
 * could be mistaken for are not. And an address is read for who it reaches,
 * so a person's name is taken first and the shop's open inbox where the site
 * prints no name, never a department's, and the queue shows none of what the
 * sender would refuse.
 *
 * Nothing here fetches a page or reaches the database. Every page is a string
 * and every row is a literal.
 */

import {
  HELD_REASON,
  STUDIO_REASON,
  corporateReason,
  corporateSignsIn,
  heldDomainOf,
  heldReasonOf,
  hostOf,
  oversizedReason,
  rowRuleOf,
} from '../../../lib/outreach/prospects/exclusions.js'
import { PORTFOLIO_PROJECTS } from '../../../src/app/data/portfolio.js'
import { mailboxKind, shapeOf } from '../../../lib/outreach/prospects/address.js'
import { contactIn } from '../../../api/outreach/enrich.js'
import { queueFor } from '../../../lib/outreach/sending/queue.js'
import { HELD_FIXTURE, installFixtureHeldDomains } from '../held-domains-fixture.js'

installFixtureHeldDomains()

const cases = []
const check = (name, run) => cases.push([name, run])

const same = (got, want, what) => {
  if (got !== want)
    throw new Error(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)
}

const ok = (condition, what) => {
  if (!condition) throw new Error(what)
}

// -- the held list, which a person wrote by hand ----------------------------

check('a held domain is read with its www and everything underneath it', () => {
  for (const host of [
    'readymixyard.example',
    'www.readymixyard.example',
    'mail.readymixyard.example',
  ]) {
    same(heldDomainOf(host), 'readymixyard.example', host)
  }
  same(heldDomainOf('notreadymixyard.example'), null, 'a longer name that ends the same way')
  same(heldDomainOf(null), null, 'no host')
})

check(
  'an address at a held domain fails the shape, which the queue and the transport share',
  () => {
    same(shapeOf('owner@readymixyard.example')?.reason, 'held_domain', 'held address')
    same(shapeOf('anybody@mail.readymixyard.example')?.reason, 'held_domain', 'held subdomain')
  }
)

check('a row is held off its site and off its address alike', () => {
  same(
    rowRuleOf({
      name: 'RMY Concrete',
      trade: 'concrete contractor',
      website: 'https://www.readymixyard.example/',
      email: null,
    }),
    HELD_REASON,
    'by site'
  )
  same(
    rowRuleOf({
      name: 'A Concrete Yard',
      trade: 'concrete contractor',
      website: null,
      email: 'yard@readymixyard.example',
    }),
    HELD_REASON,
    'by address'
  )
})

check('every site the studio owns or built is held, by site and by address', () => {
  // The one the whole list is for: a client trades in the towns the sourcing
  // job searches, under a trade it searches for, so it reaches the queue like
  // any other business and the letter it gets is signed by the person it pays.
  for (const project of PORTFOLIO_PROJECTS) {
    const host = hostOf(project.displayUrl)
    ok(heldDomainOf(host), `${project.name} is free to write to`)
    same(heldReasonOf(host), STUDIO_REASON, `${project.name} by site`)
    same(
      rowRuleOf({ name: project.name, trade: null, website: project.url, email: null }),
      STUDIO_REASON,
      `${project.name} as a row`
    )
    same(shapeOf(`somebody@${host}`)?.reason, 'held_domain', `${project.name} as an address`)
  }
  for (const own of ['taylorurl.com', 'baytownwebdevelopment.com']) {
    same(heldReasonOf(own), STUDIO_REASON, own)
  }
})

check('a domain held by request holds every other mailbox at it', () => {
  // What the address list on its own cannot do. One person answered a cold
  // letter with 'stop contacting', and the address they wrote from is
  // suppressed; the enricher would otherwise lift a second off the same site
  // next week and open the conversation again.
  same(heldReasonOf('fencecraft.example'), HELD_REASON, 'the domain')
  same(shapeOf('owner@fencecraft.example')?.reason, 'held_domain', 'the address that answered')
  same(shapeOf('info@fencecraft.example')?.reason, 'held_domain', 'a second mailbox at it')
  same(
    rowRuleOf({
      name: 'Fencecraft Customs',
      trade: 'fencing contractor',
      website: 'https://www.fencecraft.example/',
      email: null,
    }),
    HELD_REASON,
    'the row'
  )
  same(heldDomainOf('notfencecraft.example'), null, 'a longer name that ends the same way')
})

check('every business that asked to stop is held across its whole domain', () => {
  // The address each of these said it from is on the suppression list already.
  // A domain beside it is what keeps the enricher from reading a second mailbox
  // off the same site and opening the conversation again under a new address.
  for (const domain of HELD_FIXTURE) {
    same(heldReasonOf(domain), HELD_REASON, domain)
    same(shapeOf(`anybody@${domain}`)?.reason, 'held_domain', `a fresh mailbox at ${domain}`)
  }
})

check('a held domain records why it was held, and the two reasons do not read alike', () => {
  ok(HELD_REASON !== STUDIO_REASON, 'the two reasons are the same words')
  same(heldReasonOf('readymixyard.example'), HELD_REASON, 'by request')
  same(heldReasonOf('baytowngokarts.com'), STUDIO_REASON, 'a site the studio built')
  same(heldReasonOf('someoneelse.com'), null, 'a domain nothing holds')
})

check('the chains the sender wrote to before are caught by name', () => {
  // Every one of these received a cold message. A storage REIT, a restaurant
  // group and a salon franchise each have their marketing settled somewhere
  // else, and a letter offering to build them a website reaches somebody who
  // could not buy one if they wanted to.
  for (const [name, trade] of [
    ["Bubba's 33", 'restaurant'],
    ['Storage King USA', 'storage'],
    ['Devon Self Storage Pasadena, Texas', 'storage'],
    ['Right Move Storage', 'storage'],
    ['Anytime Storage', 'storage'],
    ['Lineage', 'storage'],
    ['My Salon Suite', 'hair salon'],
    ['Airrosti', 'chiropractor'],
  ]) {
    const reason = rowRuleOf({ name, trade, website: null, email: null })
    ok(reason?.startsWith('national chain:'), `${name} was written to: ${reason}`)
  }
})

check('a business the map reports shut for good is caught, and one shut for now is not', () => {
  const row = status => ({
    name: 'Gentle Care Dental',
    trade: 'dentist',
    website: 'https://gentlecaredental.example',
    email: null,
    business_status: status,
  })

  ok(
    rowRuleOf(row('CLOSED_PERMANENTLY'))?.startsWith('closed:'),
    'a permanently closed business was written to'
  )

  // A temporary closure is a refit or a move, which reopens. A listing with no
  // status at all is every row filed before the status was asked for, and it
  // must read as unknown rather than as shut.
  for (const status of ['CLOSED_TEMPORARILY', 'OPERATIONAL', null, undefined]) {
    same(rowRuleOf(row(status)), null, `a business was stopped on a status of ${status}`)
  }
})

check('a business that names a parent company in its own name is caught', () => {
  for (const name of [
    'Harbor Materials (a Continental Company)',
    'Gulf Supply (an Acme Group)',
    'Baytown Ready Supply, a division of Continental',
    'Channel Services, a subsidiary of Gulf Holdings',
  ]) {
    const reason = rowRuleOf({ name, trade: 'industrial contractor', website: null, email: null })
    ok(reason?.startsWith('too large:'), `${name} was not caught: ${reason}`)
  }
})

check('an owner-run business is not read as somebody else’s', () => {
  for (const [name, trade, host] of [
    ['Harbor Point Pest Control', 'pest control', 'harborpointpest.example'],
    ['Gentle Care Dental', 'dentist', 'gentlecaredental.example'],
    ['Parkside Landscaping', 'landscaping', 'parksidelandscaping.example'],
    ['Secure Spots Storage', 'storage', 'securespots.example'],
  ]) {
    same(
      rowRuleOf({ name, trade, website: `https://${host}`, email: null }),
      null,
      `${name} was stopped`
    )
  }

  // Two of the studio's own clients carry the exact words the size rule hunts
  // for - 'Industrial', 'Services', a number where a franchise would put one -
  // which is what made them the sharpest fixtures here. Their own domains are
  // held as studio work now and asserted as such above, so the names are read
  // against a domain nothing holds and the guard they were here for stands.
  for (const [name, trade] of [
    ['Compound Industrial Scale Services', 'industrial contractor'],
    ['Speedway 146', 'entertainment'],
  ]) {
    same(
      rowRuleOf({ name, trade, website: 'https://an-unheld-domain.com', email: null }),
      null,
      `${name} was stopped on its name`
    )
  }
})

// -- size, read off the name and the host -----------------------------------

check('a name that says the company is too large is caught', () => {
  for (const name of [
    'Gulf Coast Ready Mix',
    'Baytown Chemicals',
    'Channel Logistics LLC',
    'Acme Holdings',
    'Bayport Terminal',
    'Texas Gulf Manufacturing',
    'Coastal Industries',
  ]) {
    ok(oversizedReason(name, 'example.com')?.startsWith('too large:'), `${name} was not caught`)
  }
})

check('a host that says the same is caught when the name does not', () => {
  const reason = oversizedReason("Cowboy's Services, Inc.", 'cowboysreadymix.com')
  same(reason, 'too large: readymix in the domain', 'host reason')
})

check('an ordinary shop is not read as too large', () => {
  for (const [name, host] of [
    ['Synergy Plumbing', 'synergyplumbing.com'],
    ['Pipeline Plumbing LLC', 'pipelineplumbing.com'],
    ['Johnson Enterprises', 'johnsonenterprises.com'],
    ['Brooks Concrete Inc', 'brooksconcreteinc.com'],
    ['Texas Energy Electric', 'texasenergyelectric.com'],
    ['A&G Welding Specialty LLC', 'agweldingllc.com'],
  ]) {
    same(oversizedReason(name, host), null, `${name} was caught`)
  }
})

check('the row rule reads size after the rules that came before it', () => {
  const reason = rowRuleOf({
    name: 'Stonebridge Aggregates',
    trade: 'concrete contractor',
    website: 'https://stonebridgeaggregates.example/',
    email: null,
  })
  same(reason, 'too large: aggregates', 'oversized row')
  same(
    rowRuleOf({
      name: 'Parkside Landscaping',
      trade: 'landscaping',
      website: 'http://parksidelandscaping.example/',
      email: 'owner@parksidelandscaping.example',
    }),
    null,
    'an ordinary row'
  )
})

// -- size, read off the site ------------------------------------------------

const SHOP = `<html><body><nav><a href="/">Home</a><a href="/services">Services</a>
<a href="/contact">Contact</a></nav><p>Family owned since 1998. Call us today.</p>
<footer><a href="/privacy">Privacy Policy</a></footer></body></html>`

check('a careers page handed to a hiring system is one sign on its own', () => {
  const html = `${SHOP}<a href="https://acme.wd5.myworkdayjobs.com/en-US/careers">Careers</a>`
  const signs = corporateSignsIn(html)
  same(signs[0], 'hiring through myworkdayjobs.com', 'the sign')
  same(corporateReason(signs), 'too large: site carries hiring through myworkdayjobs.com', 'reason')
})

check('a relative careers link is not read as a host', () => {
  same(corporateSignsIn(`${SHOP}<a href="/careers">Careers</a>`).length, 0, 'signs')
})

check('an investor relations page is one sign on its own', () => {
  const signs = corporateSignsIn(`${SHOP}<a href="/investors">Investor Relations</a>`)
  same(signs.length, 1, 'signs')
  same(signs[0], 'investor relations', 'the sign')
})

check('an enterprise content system is read off the markup', () => {
  ok(corporateSignsIn(`${SHOP}<img src="/content/dam/site/logo.png">`).length, 'AEM path')
  ok(
    corporateSignsIn(`${SHOP}<script src="/-/media/sitecore/base.js"></script>`).length,
    'Sitecore'
  )
})

check('one hint settles nothing and two together do', () => {
  same(corporateSignsIn(`${SHOP}<a href="/careers">Careers</a>`).length, 0, 'careers alone')
  const two = corporateSignsIn(
    `${SHOP}<a href="/careers">Careers</a><a href="/locations">Our Locations</a>`
  )
  same(two.length, 2, 'two hints')
})

check("a shop's page carries no sign at all", () => {
  same(corporateSignsIn(SHOP).length, 0, 'signs')
  same(corporateSignsIn('').length, 0, 'empty page')
})

// -- who a mailbox reaches --------------------------------------------------

check('a department is read whole, by its parts and by its opening', () => {
  for (const box of [
    'sales',
    'support',
    'admin',
    'marketing',
    'newsletter',
    'customercare',
    'serviceusa',
    'dispatch.corpuschristi',
    'csi-customer-service',
    'ap',
    'hr',
    'frontdesk',
    'quotes',
    'team',
    'patientservices',
    'sales_team',
    'Support2',
  ]) {
    same(mailboxKind(box), 'department', box)
  }
})

check("the business's open inbox is general", () => {
  for (const box of ['info', 'hello', 'contact', 'office', 'mail', 'info.pasadena', 'Info']) {
    same(mailboxKind(box), 'general', box)
  }
})

check('a name is a person', () => {
  for (const box of ['jane', 'jsmith', 'jane.doe', 'drcordova', 'bhammack', 'marco', 'j-smith']) {
    same(mailboxKind(box), 'person', box)
  }
})

check('a machine is neither', () => {
  same(mailboxKind('noreply'), 'unreachable', 'noreply')
})

check('every box a person opens passes the shape, and a machine does not', () => {
  // A desk is written to. At this size of business sales@ and the owner are
  // usually the same person, and refusing it discarded most of the trade sites
  // on the map. Which box is preferred where a site prints several is the
  // enricher's ranking, below, and not a refusal here.
  same(shapeOf('sales@realbusiness.com'), null, 'sales')
  same(shapeOf('admin@realbusiness.com'), null, 'admin')
  same(shapeOf('csi-customer-service@realbusiness.com'), null, 'compound')
  same(shapeOf('info@realbusiness.com'), null, 'info')
  same(shapeOf('office@realbusiness.com'), null, 'office')
  same(shapeOf('jane@realbusiness.com'), null, 'jane')
  same(shapeOf('noreply@realbusiness.com')?.reason, 'role_box', 'noreply')
  same(shapeOf('postmaster@realbusiness.com')?.reason, 'role_box', 'postmaster')
})

// -- which address a page gives up -------------------------------------------

const page = (...addresses) =>
  `<html><body>${addresses.map(a => `<a href="mailto:${a}">${a}</a>`).join(' ')}</body></html>`

check('a person is taken past the open inbox printed before them', () => {
  const best = contactIn(page('info@shop.com', 'jane@shop.com'), 'www.shop.com', 1)
  same(best?.email, 'jane@shop.com', 'address')
  same(best?.score, 100, 'score')
})

check('a page printing nothing but departments gives up a department', () => {
  // It is the only address the site prints, and a business with one inbox is
  // the ordinary case rather than a business with no address.
  const best = contactIn(page('sales@shop.com', 'support@shop.com'), 'shop.com', 2)
  same(best?.email, 'sales@shop.com', 'address')
  same(best?.score, 2, 'score')
})

check('a page printing nothing but a machine still gives up nothing', () => {
  same(contactIn(page('noreply@shop.com', 'postmaster@shop.com'), 'shop.com', 2), null, 'machines')
})

check('the open inbox is taken over a desk, and a name over both', () => {
  // An order of magnitude apart, so the kind decides before the page does.
  const overDesk = contactIn(page('sales@shop.com', 'info@shop.com'), 'shop.com', 1)
  same(overDesk?.email, 'info@shop.com', 'the open inbox beat the desk')
  same(overDesk?.score, 10, 'score')

  const overBoth = contactIn(
    page('sales@shop.com', 'info@shop.com', 'jane@shop.com'),
    'shop.com',
    1
  )
  same(overBoth?.email, 'jane@shop.com', 'the name beat both')
})

check("a person at somebody else's domain is not the shop's address", () => {
  same(contactIn(page('bob@example.com'), 'shop.com', 1), null, 'other domain')
})

check('the contact page outranks the footer', () => {
  same(contactIn(page('jane@shop.com'), 'shop.com', 2)?.score, 200, 'person on the contact page')
  same(contactIn(page('jane@shop.com'), 'shop.com', 1)?.score, 100, 'person on the home page')
})

check('the page only settles ties inside one kind', () => {
  // A desk on the contact page does not beat a name in a footer, which is what
  // keeps the ranking about who reads the inbox rather than where it was found.
  const desk = contactIn(page('sales@shop.com'), 'shop.com', 2)?.score ?? 0
  const name = contactIn(page('jane@shop.com'), 'shop.com', 1)?.score ?? 0
  ok(name > desk, 'a desk on a better page beat a name on a worse one')
})

// -- the queue, which is what the console shows as about to go out ----------

check('the queue shows nothing the rules would stop', () => {
  const rows = [
    {
      id: 'a',
      name: 'Alfa Plumbing',
      website: 'https://alfa.com',
      trade: 'plumber',
      email: 'tom@alfa.com',
      stage: 'audited',
      audit_score: 40,
    },
    {
      id: 'b',
      name: 'RMY Concrete',
      website: 'https://www.readymixyard.example/',
      trade: 'concrete contractor',
      email: 'owner@readymixyard.example',
      stage: 'audited',
      audit_score: 10,
    },
    {
      id: 'c',
      name: 'One Van Pest',
      website: 'https://onevanpest.example',
      trade: 'pest control',
      email: 'sales@onevanpest.example',
      stage: 'audited',
      audit_score: 5,
    },
    {
      id: 'd',
      name: 'Stonebridge Aggregates',
      website: 'https://stonebridgeaggregates.example',
      trade: 'concrete contractor',
      email: 'office@stonebridgeaggregates.example',
      stage: 'audited',
      audit_score: 1,
    },
  ]
  const queue = queueFor({ candidates: rows, held: new Set(), messages: new Map(), sending: true })
  // The held domain and the firm too large to buy here are gone; the desk at a
  // one-van pest control stays, because it is the address that business prints.
  same(queue.length, 2, 'rows left in the queue')
  same(queue.map(row => row.id).join(','), 'c,a', 'the rows left, worst score first')
})

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
  console.error(`\n${failures.length} of ${cases.length} outreach exclusion checks failed`)
  process.exit(1)
}

console.log(`outreach exclusions: ${cases.length} checks passed`)
