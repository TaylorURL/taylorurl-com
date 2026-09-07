/**
 * Holds the outreach pipeline to writing to people at businesses that can buy
 * from it, and to never writing to a domain that has been held off.
 *
 * Three things are asserted. A held domain is refused everywhere an address
 * is read: by the shape check the queue and the transport share, and by the
 * row rule the enricher and its sweep share, against the site and the address
 * both. A business too large to buy is caught off its name, off its host, and
 * off the signs its own pages carry, while the ordinary shops those signals
 * could be mistaken for are not. And an address is read for who it reaches, so
 * a person's name is taken first, the shop's open inbox where the site prints
 * no name, and the desk it does print where it prints neither - off the contact
 * and about pages the site links to itself, with the guessed paths filling in
 * behind them, and at the domain the listing named wherever a redirect ends
 * somewhere else - and the queue shows none of what the sender would refuse.
 *
 * Nothing here reaches the network or the database. Every page is a string and
 * every row is a literal, and the one crawl exercised is handed the pages it
 * asks for rather than fetching them.
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
import { contactFor, contactIn, linkedPages } from '../../../api/outreach/enrich.js'
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
    // What a shop on the ship channel writes about its own work: the trade it
    // is in, the word on the sign since its grandfather's day, and what it
    // filed as with the state. None of the three counts anybody in the
    // building, and each is read off the host as well as the name.
    ['Texas Gulf Manufacturing', 'texasgulfmanufacturing.com'],
    ['Coastal Industries', 'coastalindustries.com'],
    ['Ellis Welding Corporation', 'elliswelding.com'],
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
  same(corporateSignsIn(`${SHOP}<a href="/team">Leadership Team</a>`).length, 0, 'one hint alone')
  const two = corporateSignsIn(
    `${SHOP}<a href="/team">Leadership Team</a><a href="/locations">Our Locations</a>`
  )
  same(two.length, 2, 'two hints')
})

check('the words a shop writes about itself are not signs', () => {
  const html = `${SHOP}<a href="/careers">Careers</a>
<p>Our headquarters on Decker Drive has run three shifts since 1994.</p>
<a href="/portal">Employee Portal</a>`
  same(corporateSignsIn(html).length, 0, 'signs')
})

check('a timeclock labelled twice is one thing bought once', () => {
  // The widget prints Employee Portal over the heading and Employee Login on
  // the button. Read as two hints it reaches the number it takes on its own,
  // and a twenty-person shop is skipped for size on one page element.
  const html = `${SHOP}<h2>Employee Portal</h2><p>Staff use the Employee Login button below.</p>`
  same(corporateSignsIn(html).length, 0, 'signs')
})

check('what a large employer prints and a shop does not is still read', () => {
  // What the name list gave up when 'manufacturing', 'industries' and
  // 'corporation' came out of it. A plant with three hundred people writes an
  // equal opportunity line, says what the benefits come to, and lists more
  // than one facility; none of the three settles anything alone.
  const plant = `${SHOP}<h2>Employee Portal</h2>
<p>We are an equal opportunity employer.</p>`
  ok(corporateSignsIn(plant).length >= 2, 'a plant that prints both was read as a shop')
  for (const alone of [
    '<p>We are an equal opportunity employer.</p>',
    '<a href="/benefits">Employee Benefits</a>',
    '<a href="/plants">Our Facilities</a>',
  ]) {
    same(corporateSignsIn(`${SHOP}${alone}`).length, 0, alone)
  }
})

check('the signs that settle it alone still do', () => {
  for (const carried of [
    '<a href="/investors">Investor Relations</a>',
    '<p>NYSE: ACM</p>',
    '<a href="/intranet">Intranet</a>',
    '<a href="https://acme.taleo.net/careersection/">Careers</a>',
  ]) {
    ok(corporateSignsIn(`${SHOP}${carried}`).length, carried)
  }
})

check('a page naming its subsidiaries beside a leadership team is read as one', () => {
  const html = `${SHOP}<a href="/team">Leadership Team</a>
<p>Acme and its subsidiaries operate across the Gulf Coast.</p>`
  ok(corporateSignsIn(html).length >= 2, 'signs')
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

// -- which pages a home page names ------------------------------------------

const links = (...hrefs) =>
  `<html><body>${hrefs.map(href => `<a href="${href}">go</a>`).join(' ')}</body></html>`

const HOME = 'https://shop.com/'

check('a home page names its own contact and about pages', () => {
  // The names no guessed list holds. A machine shop filing its contact page as
  // /contact.html is the case the whole of this exists for.
  const found = linkedPages(links('/contact.html', '/about-us', '/services'), HOME)
  same(found.length, 2, 'pages followed')
  same(found[0].url, 'https://shop.com/contact.html', 'the contact page was not first')
  same(found[0].rank, 2, 'the contact page is worth a contact page')
  same(found[1].url, 'https://shop.com/about-us', 'the about page')
  same(found[1].rank, 1, 'the about page is worth a page anywhere else')
})

check('nothing that leaves the site is followed', () => {
  // A mailto and a tel are not pages, and a supplier's contact page is the
  // supplier's. Serving at www and linking to the bare name is one site.
  same(linkedPages(links('mailto:sales@shop.com'), HOME).length, 0, 'a mailto')
  same(linkedPages(links('tel:+12815550134'), HOME).length, 0, 'a phone number')
  same(linkedPages(links('https://supplier.com/contact'), HOME).length, 0, "somebody else's")
  same(linkedPages(links('https://www.shop.com/contact'), HOME).length, 1, 'its own www')
})

check('the careers and locations pages are left alone', () => {
  // Neither prints an address, and a locations page is a page whose subject is
  // the words that settle the corporate rule once a second hint joins them.
  // Reading one would hand that hint to a shop with two yards.
  same(linkedPages(links('/careers', '/locations', '/our-locations'), HOME).length, 0, 'followed')
})

check('a site naming more pages than the budget holds is cut to the budget', () => {
  const found = linkedPages(
    links('/contact', '/contact-us', '/get-in-touch', '/about', '/who-we-are'),
    HOME
  )
  same(found.length, 3, 'pages followed')
  ok(
    found.every(entry => entry.rank === 2),
    'an about page was read before a contact page the site also named'
  )
})

// -- what a whole site gives up ---------------------------------------------

/**
 * A site as a map of path to HTML, answering the way a server does.
 *
 * `landed` is where a request is answered from when that is not where it was
 * sent, which is how a redirect is written down without a redirect to follow:
 * the www a site serves under, and the parked page or the profile a lapsed
 * domain ends at. Anything the map does not hold is a 404, which is what a
 * guessed path costs on a site that does not have it.
 */
const site = (pages, landed = null) => {
  const asked = []
  const get = async url => {
    asked.push(url)
    const at = new URL(url)
    const html = pages[at.pathname]
    if (html === undefined)
      return { ok: false, url, headers: { get: () => '' }, text: async () => '' }
    return {
      ok: true,
      url: landed ? new URL(at.pathname, landed).toString() : url,
      headers: { get: () => 'text/html; charset=utf-8' },
      text: async () => html,
    }
  }
  return { asked, get }
}

const HOME_LINKING =
  '<html><body><a href="/contact.html">Contact</a><a href="/about-us">About</a></body></html>'

check('a machine shop that prints one desk gives it up', async () => {
  // The whole of the defect this reads for. The site names its contact page
  // under a name no list of guesses holds, prints sales@ on it and nothing
  // anywhere else, and that is the address the business answers.
  const { asked, get } = site({
    '/': HOME_LINKING,
    '/contact.html': page('sales@machineshop.example'),
    '/about-us': '<html><body><p>Three bays since 1994.</p></body></html>',
  })
  const found = await contactFor(new URL('https://machineshop.example/'), get)
  ok(found.answered, 'the site did not answer')
  same(found.best?.email, 'sales@machineshop.example', 'the address taken')
  same(found.best?.source, 'https://machineshop.example/contact.html', 'the page it was printed on')
  same(asked.length, 3, 'pages read')
})

check('a site linking an about page and no contact page still has the guesses tried', async () => {
  // The shape the follow list is filled in for. The navigation names one page
  // this can read, the contact button is drawn by script, and the address is
  // on the page nothing linked to. A follow list that read the linked pages
  // instead of the guessed ones would stop at the about page and file the row
  // as publishing nothing.
  const { asked, get } = site({
    '/': '<html><body><a href="/about">About Us</a><button onclick="go()">Contact</button></body></html>',
    '/about': '<html><body><p>Two bays and a boom truck.</p></body></html>',
    '/contact': page('info@shop.com'),
  })
  const found = await contactFor(new URL('https://shop.com/'), get)
  same(found.best?.email, 'info@shop.com', 'the address taken')
  ok(asked.includes('https://shop.com/contact'), 'the contact guess was not tried')
  ok(asked.includes('https://shop.com/about'), 'the page the site named was not read')
  same(asked.length, 4, 'pages read')
})

check(
  'a plugin that ships its stylesheets under a contact path is not a contact page',
  async () => {
    // The commonest small business stack there is. Three of the contact form
    // plugin's stylesheets sit under /wp-content/plugins/contact-form-7/, and
    // read as links they fill the follow budget with CSS and push the site's own
    // contact page out of it.
    const head = [
      '<link rel="stylesheet" href="/wp-content/plugins/contact-form-7/includes/css/styles.css">',
      '<link rel="stylesheet" href="/wp-content/plugins/contact-form-7-extension/style.css">',
      '<link rel="preload" as="style" href="/wp-content/plugins/contact-form-7-conditional/css/main.css">',
    ].join('')
    const { asked, get } = site({
      '/': `<html><head>${head}</head><body><a href="/contact-us/">Contact</a><a href="/about-us/">About</a></body></html>`,
      '/contact-us/': page('info@shop.com'),
      '/about-us/': '<html><body><p>Since 1994.</p></body></html>',
    })
    const found = await contactFor(new URL('https://shop.com/'), get)
    same(found.best?.email, 'info@shop.com', 'the address taken')
    ok(
      !asked.some(url => url.includes('/wp-content/')),
      `a stylesheet was fetched as a page: ${asked.join(', ')}`
    )
  }
)

check('a site that links nothing still has the guessed paths tried', async () => {
  // Navigation drawn by script leaves no link to read, which is every site the
  // old list of paths already worked for.
  const { asked, get } = site({
    '/': '<html><body><div id="nav"></div></body></html>',
    '/contact-us': page('info@shop.com'),
  })
  const found = await contactFor(new URL('https://shop.com/'), get)
  same(found.best?.email, 'info@shop.com', 'the address taken')
  same(asked.length, 4, 'pages read')
  ok(asked.includes('https://shop.com/contact'), 'the first guess was not tried')
  ok(asked.includes('https://shop.com/about'), 'the last guess was not tried')
})

check('a site that answers nothing at its root is still asked for its contact page', async () => {
  // There is no home page to read the links off, which is not the same finding
  // as a business with no address: a server can serve the root as an error, as
  // a file or as a redirect nothing follows, and still print an address on the
  // page underneath it.
  const { get } = site({ '/contact': page('info@shop.com') })
  const found = await contactFor(new URL('https://shop.com/'), get)
  ok(found.answered, 'a site that answered a page read as never answering')
  same(found.best?.email, 'info@shop.com', 'the address taken')
})

check('a site that serves at www is the one site the listing named', async () => {
  // The redirect the crawl does follow all the way. The page is recorded at
  // the address it was served from, and the address it prints is the
  // business's own because the bare host is the same host.
  const { get } = site({ '/': page('jane@shop.com') }, 'https://www.shop.com/')
  const found = await contactFor(new URL('https://shop.com/'), get)
  same(found.best?.email, 'jane@shop.com', 'the address taken')
  same(found.best?.source, 'https://www.shop.com/', 'the page recorded is not the one served')
})

check('a domain that redirects off its own name gives up nothing', async () => {
  // A redirect can end anywhere: a lapsed domain parked for sale, a profile on
  // a platform, whoever bought the business. Every one of them prints an
  // address, none of them is read by anybody at the business, and the row
  // would still carry the old domain for the letter to open on.
  for (const landed of ['https://www.facebook.com/', 'https://buy-this-domain.example/']) {
    const { get } = site({ '/': page('support@example.com') }, landed)
    const found = await contactFor(new URL('https://oldshop.example/'), get)
    ok(found.answered, `the page did not answer: ${landed}`)
    same(found.best, null, `an address at ${landed} was read as the business's`)
  }
})

check('a site the listing named is not crawled through somebody else', async () => {
  // The half of it a domain test alone does not reach. The listed domain has
  // lapsed onto a profile, and the profile links its own contact and about
  // pages, so a crawl following them reads three pages of somebody else's site
  // on every run and finds the platform's own support desk on all of them.
  const { asked, get } = site(
    {
      '/': '<html><body><a href="/contact">Contact</a><a href="/about-us">About</a></body></html>',
      '/contact': page('support@example.com'),
      '/about-us': page('support@example.com'),
    },
    'https://www.facebook.com/'
  )
  const found = await contactFor(new URL('https://oldshop.example/'), get)
  same(found.best, null, "the platform's own address was read as the business's")
  same(asked.length, 1, `pages read off somebody else's site: ${asked.join(', ')}`)
})

check('a name on the contact page is the end of the crawl', async () => {
  // The most a site can give, so the pages left are not worth the wait. A name
  // on the home page is not: a contact page the site has not been read yet can
  // still print a better one, which is the whole reason the page settles ties.
  const { asked, get } = site({
    '/': `${HOME_LINKING}<a href="mailto:jane@shop.com">jane@shop.com</a>`,
    '/contact.html': page('tom@shop.com'),
    '/about-us': page('owner@shop.com'),
  })
  const found = await contactFor(new URL('https://shop.com/'), get)
  same(found.best?.email, 'tom@shop.com', 'the address taken')
  same(found.best?.score, 200, 'a person on the contact page')
  same(asked.length, 2, 'pages read')
})

check('a site that never answers is told apart from one that prints nothing', async () => {
  const { get } = site({})
  const dead = await contactFor(new URL('https://shop.com/'), get)
  same(dead.answered, false, 'a site nothing answered for read as answering')
  same(dead.best, null, 'an address off a site that never answered')

  const quiet = site({ '/': '<html><body><p>Call us.</p></body></html>' })
  const read = await contactFor(new URL('https://shop.com/'), quiet.get)
  same(read.answered, true, 'a site that answered read as silent')
  same(read.best, null, 'an address off a site that prints none')
})

check('a sign carried by a page the site linked still stops the row', async () => {
  // The corporate rule reads every page the crawl reads, so following a site's
  // own links feeds it evidence the guessed paths never reached.
  const { get } = site({
    '/': HOME_LINKING,
    '/about-us': '<html><body><a href="/x">Leadership Team</a><p>Our locations</p></body></html>',
  })
  const found = await contactFor(new URL('https://shop.com/'), get)
  ok(found.signs.length >= 2, 'the signs on a linked page were not read')
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
