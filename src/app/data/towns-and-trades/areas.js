import { PORTFOLIO_PROJECTS } from '../portfolio.js'
import { SERVICE_TOWNS } from './serviceTowns.js'

export { SERVICE_TOWNS }

/**
 * The trades named on each town's page, as ids from `@data/towns-and-trades/trades`. They point
 * at the industry pages, so a town reads as a set of destinations rather than a
 * paragraph about a place.
 *
 * A town the portfolio already works in carries that work's trade among them.
 * A town absent from this map falls back to the trades common across the whole
 * area, so a town added to `SERVICE_TOWNS` gets a working page immediately.
 */
const TRADES_BY_TOWN = {
  Baytown: ['plumbing', 'hvac', 'auto-repair', 'restaurant', 'barber-shop', 'marine-services'],
  Houston: ['real-estate', 'accounting', 'law-firm', 'restaurant', 'hair-salon', 'printing'],
  Pasadena: ['printing', 'auto-repair', 'towing', 'hvac', 'plumbing', 'restaurant'],
  'Deer Park': ['hvac', 'electrical', 'plumbing', 'auto-repair', 'fencing'],
  'La Porte': ['marine-services', 'auto-repair', 'plumbing', 'towing', 'concrete'],
  'Mont Belvieu': ['concrete', 'fencing', 'landscaping', 'hvac', 'storage'],
  Galveston: ['restaurant', 'marine-services', 'towing', 'storage', 'hair-salon'],
  'Texas City': ['marine-services', 'plumbing', 'auto-repair', 'towing', 'concrete'],
  Dickinson: ['marine-services', 'restaurant', 'plumbing', 'landscaping', 'towing'],
  Dayton: ['real-estate', 'fencing', 'concrete', 'landscaping', 'plumbing', 'towing'],
  Huffman: ['fencing', 'landscaping', 'marine-services', 'storage', 'pest-control', 'concrete'],
  Liberty: ['barber-shop', 'hair-salon', 'auto-repair', 'fencing', 'restaurant'],
  Daisetta: ['auto-repair', 'fencing', 'plumbing', 'landscaping', 'restaurant', 'towing'],
}

const COMMON_TRADES = ['plumbing', 'hvac', 'auto-repair', 'restaurant', 'real-estate']

/**
 * The copy a town carries that is its own. A town without an entry here runs
 * from the shared copy in `@views/Area`.
 *
 * The band is written about the work rather than about the town. A web studio
 * has no standing to tell Baytown what Baytown is like, and thirteen pages of
 * that reads as thirteen pages of one template. So a paragraph here either
 * states something checkable about the place, or it says what we do about it,
 * and it is set as prose rather than as a grid of headed cells.
 *
 * - `client` Portfolio slug of the work live in the town, where there is any.
 *   The live-work band puts it first, so the slug names an entry in
 *   `@data/portfolio`.
 * - `lede`   The line under the town's heading.
 * - `search` The page's meta description.
 * - `work`   Heading and standfirst for the live-work band, for a town with a
 *   client of its own. A town without one leaves the key out and takes the
 *   shared heading, because five towns each carrying their own wording for
 *   the same absent fact is five copies of one sentence.
 * - `local`  The local band: its heading, the county beside it, the prose, and
 *   the places the page also covers.
 * - `close`  The closing invitation.
 */
const TOWN_PROFILES = {
  Baytown: {
    client: 'speedway-146',
    lede: 'The office is in Baytown. Websites for the shops on Garth Road, the trades working off Decker Drive, and the contractors at the plant gates.',
    search:
      'Web design in Baytown, TX for local shops, trades, and contractors. Custom sites built, hosted, and looked after here, with Speedway 146 on TX-146 already live.',
    work: {
      title: 'Speedway 146 sells its own seat time.',
      description:
        'The outdoor go-kart track at 6750 TX-146, open Thursday through Sunday. Wristbands, party packages, and bounce house rentals go through a cart and a Stripe checkout, and staff work orders and live track traffic from a panel on the same site.',
    },
    local: {
      title: 'Working in our own town.',
      county: 'Harris and Chambers County',
      body: [
        'This is the one town where a first meeting is a drive across town and a look at the place itself, which tends to turn up the details nobody thinks to mention on a call.',
        'The plants along the ship channel run around the clock and so do the crews supplying them, so a fair number of the sites we build here have to answer at hours nobody is in the office. Hours, an address, a number worth tapping, and a booking form carry most of that.',
        'Baytown also sits in two counties, and the city grew out of Goose Creek and Pelly. Those names still turn up in searches, so they go on the page and get matched to the Google Business Profile.',
      ],
      nearby: ['Highlands', 'Cedar Bayou', 'Goose Creek', 'Pelly', 'Channelview', 'Mont Belvieu'],
    },
    close:
      'The office is here, so we can usually come and look at the place this week. Tell us what the business needs and you get a plan and a price before any work starts.',
  },

  Houston: {
    client: 'delux-financial-solutions',
    lede: 'Houston is twenty-six miles west on I-10, and the east side of it is the half we reach first. Websites for businesses around the ship channel terminals, the East End, and the strips along Navigation and Wayside.',
    search:
      'Web design in Houston, TX for east-side businesses, from the ship channel to the East End. Custom sites from Baytown. See Delux Financial Solutions, live.',
    work: {
      title: 'Delux Financial Solutions books both kinds of appointment.',
      description:
        'A Houston credit-education practice, with credit building and financial guidance laid out across services, education, and a booking path. Virtual consultations and mobile in-person ones are set on the site rather than over the phone.',
    },
    local: {
      title: 'The east side is the part we cover.',
      county: 'Harris County',
      body: [
        'Nobody small wins a search for Houston. Two million people means an agency for every keyword with a budget behind it, so the searches worth having name a neighborhood and a trade. We write the page for Second Ward or Navigation or the East End and let the city keyword go.',
        'Most of what we have built on this side is quoted rather than bought off a shelf. The brokers, haulers, and repair shops east of the Turning Basin win on a quote sheet, which puts the weight on proof of work and on a form that asks for the detail a price depends on.',
        'The Greater East End is majority Latino and a good deal of business there is done in Spanish. We build bilingual when that is already how a business talks to its customers, and it picks up a second set of searches while it is at it.',
      ],
      nearby: [
        'East End',
        'Second Ward',
        'Magnolia Park',
        'Denver Harbor',
        'Galena Park',
        'Jacinto City',
      ],
    },
    close:
      'Tell us which part of Houston the business trades in and what it sells. You get a plan and a price before any work starts, and most sites are live in two to four weeks.',
  },

  Pasadena: {
    client: 'impressiva-printing',
    lede: 'Pasadena runs along SH-225, west of us on the south side of the ship channel. Websites for the shops, suppliers, and studios working that corridor, and for the ones selling to the street.',
    search:
      'Web design in Pasadena, TX for shops and suppliers along SH-225 and Spencer Highway. Custom sites built and hosted locally. See the Impressiva Printing portal.',
    work: {
      title: 'Impressiva Printing runs its floor through its site.',
      description:
        'A Pasadena print studio running offset, digital, screen, direct-to-film, and wide format under one roof. Customers open a job, upload print-ready artwork, approve a proof, and follow the run, and staff work the same pipeline from an admin panel.',
    },
    local: {
      title: 'Reading a site with a purchase order open.',
      county: 'Harris County',
      body: [
        'A lot of what we have built in Pasadena gets read by somebody buying for a plant. Safety supply, machine work, uniforms, signage, and turnaround catering all sell into the corridor along SH-225, and that reader is after capabilities, capacities, certifications, and a way to send a spec.',
        'Impressiva is the clearest case of it. A print job starts with a spec and ends with an invoice, so the site collects the detail a price depends on in the order somebody can actually answer it, and the quote goes out the same day.',
        'The city is also big enough that nobody searches the whole of it. Spencer Highway, Red Bluff, Fairmont Parkway, and the Beltway side each pull their own traffic, and we name the stretch a business sits on.',
      ],
      nearby: ['South Houston', 'Deer Park', 'Galena Park', 'Genoa'],
    },
    close:
      'Tell us what the business does and who signs the purchase order. You get a plan and a price before any work starts, and most sites are live in two to four weeks.',
  },

  'Deer Park': {
    lede: 'Deer Park is over the ship channel from us, with SH 225 down the middle of it and Center Street through the older half. Websites for the suppliers and the trades along both.',
    search:
      'Web design in Deer Park, TX for suppliers and trades on SH 225 and Center Street. Built in Baytown, over the ship channel. A plan and a price before any work.',
    local: {
      title: 'The gates face one way and the town faces the other.',
      county: 'Harris County',
      body: [
        'The refinery and chemical gates face SH 225 and the town faces Center Street, and a business here is usually selling to one side or the other. We write the page for whichever it is, in the words that side uses, because a page hedged between the two tends to read as neither.',
        'Supplier sites here age badly when they lead with the name of the company they last invoiced. The certifications and the scope go first, because those hold when a plant changes hands.',
        'Deer Park calls itself the Birthplace of Texas and people search it that way, so it belongs on the page next to Deer Park, TX and the towns either side.',
      ],
      nearby: ['La Porte', 'Pasadena', 'Shoreacres', 'Baytown'],
    },
    close:
      'Tell us what the business does and which of the plants it works for, if any. You get a plan and a price before any work starts.',
  },

  'La Porte': {
    lede: 'La Porte holds Bayport, Battleground, and Barbours Cut on one side and Sylvan Beach on the other. Websites for the businesses selling to a plant gate, and for the ones out on the water.',
    search:
      'Web design in La Porte, TX for shops and contractors at Bayport, Battleground, and Barbours Cut. Built over the Fred Hartman Bridge. A plan and a price first.',
    local: {
      title: 'Inside the fence line, or out on the water.',
      county: 'Harris County',
      body: [
        'Most of the industrial work here sells through a badge reader. A purchasing office wants three things inside a minute: what you do, who has approved you, and who to call. Putting those at the top is most of the job.',
        'The city publishes which plant tests its alarm on which day, by name and street address. For half the trades in town that list is the account list, and the site is what gets checked before anyone rings back.',
        'Sylvan Beach and the San Jacinto monument bring a crowd that never goes near a gate. Food, fuel, and retail can be written for that traffic, and it answers to a different set of searches than Fairmont Parkway does.',
      ],
      nearby: ['Shoreacres', 'Morgan’s Point', 'Seabrook', 'Deer Park', 'Bayport', 'Barbours Cut'],
    },
    close:
      'Tell us whether the work is inside the fence line or out on the water. You get a plan and a price before any work starts, and most sites are live in two to four weeks.',
  },

  'Mont Belvieu': {
    lede: 'Mont Belvieu is fourteen miles up SH 146 from us, on the salt dome where most of the country’s natural gas liquids are stored. Websites for the contractors working the caverns and the trades following Eagle Drive out into Riceland.',
    search:
      'Web design in Mont Belvieu, TX for contractors at the storage caverns and trades building out Eagle Drive. A plan and a price first, fourteen miles down SH 146.',
    local: {
      title: 'Caverns on one side, new streets on the other.',
      county: 'Chambers County',
      body: [
        'Buyers on the cavern side already know the vocabulary, so the technical pages we write for them use it instead of explaining it. The Mont Belvieu price is what American propane and butane trade against, and a site pitched at a general audience reads like it came from out of town.',
        'The other half of the work follows Eagle Drive, where most of the new building is. Fencing, concrete, dirt work, roofing, and lawn crews are competing on search out in Riceland long before there is a sign on the road.',
        'Where SH 146 meets I-10 there is fuel, hotels, and drive-through food, while the town itself sits south of that on FM 1942. A search made at seventy miles an hour and one made from a driveway want different pages, and running both usually beats splitting the difference.',
      ],
      nearby: ['Cove', 'Barbers Hill', 'Old River-Winfree', 'Anahuac', 'Baytown'],
    },
    close:
      'Tell us whether the business sells to the caverns or to the neighborhoods. You get a plan and a price before any work starts.',
  },

  Galveston: {
    lede: 'Galveston is the far end of what we cover, down SH 146 and over the causeway. Websites for the shops on the Strand, the trades along the Seawall, and the operators working the harbor.',
    search:
      'Web design in Galveston, TX for Strand shops, Seawall trades, and the marine and rental businesses on the island. A plan and a price before any work starts.',
    local: {
      title: 'Two markets on the island, and a third that runs all year.',
      county: 'Galveston County',
      body: [
        'The Strand is the harbor-side historic block and the Seawall is ten miles of Gulf front and beach access. They are separate markets with separate searches, and a page that claims both vaguely tends to rank for neither.',
        'Anything seasonal needs hours, prices, and an open-or-closed notice the owner can change from a phone in a minute. A rental books solid in July, sits empty in February, and has hurricane season sitting on the peak of it.',
        'UTMB runs four hospitals and a national laboratory on the island, which is a year-round market the beach calendar never touches. A business selling to somebody on that payroll, or to a family visiting somebody in its care, should say so on the page.',
      ],
      nearby: ['Pelican Island', 'Jamaica Beach', 'Bolivar Peninsula', 'Texas City', 'La Marque'],
    },
    close:
      'Tell us whether the season carries the business or the whole year does. You get a plan and a price before any work starts, and most sites are live in two to four weeks.',
  },

  'Texas City': {
    lede: 'Texas City sits at the top of Galveston Bay, with the refineries along Loop 197 and the dike running five miles out into the water. Websites for the contractors, the marine trades, and the shops inside the loop.',
    search:
      'Web design in Texas City, TX for refinery contractors, marine trades, and shops on Palmer Highway. A plan and a price before any work, from the top of the bay.',
    local: {
      title: 'Work that arrives on a plant schedule.',
      county: 'Galveston County',
      body: [
        'Marathon and Valero are the two refineries here, and the contracting that keeps them turning is awarded on capability and safety record. Both go near the top of the page, because that is the part anyone checks.',
        'A turnaround arrives in a hurry and goes to whoever answers. Scope, certifications, crew size, and how fast a crew can mobilize belong on the page in plain numbers, because a contact form and a promise to reply inside two business days loses that work.',
        'The port has a terminal railway of its own, so freight, storage, and repair businesses here quote against a rail schedule about as often as a road one. The site is where a shipper checks whether you can meet it.',
      ],
      nearby: ['La Marque', 'Bayou Vista', 'Hitchcock', 'Santa Fe', 'Galveston'],
    },
    close:
      'Tell us how much of the work moves by rail or by water. You get a plan and a price before any work starts.',
  },

  Dayton: {
    client: 'dylan-jordan-real-estate',
    lede: 'Dayton is up SH-146 from us, where US-90 crosses SH-321 and the Grand Parkway now clips the edge of town. Websites for the trades and the agents working Liberty County.',
    search:
      'Web design in Dayton, TX and Liberty County for trades and agents working US-90 and SH-321. Built and hosted nearby. See the Dylan Jordan listing site.',
    work: {
      title: 'Dylan Jordan lists Dayton and seven towns either side.',
      description:
        'A RE/MAX Excellence agent working Liberty County. Buyers search by town across Dayton, Liberty, Cleveland, and Hardin, save what is worth a second look, and compare a shortlist before calling. Listings, leads, and questions are worked from a dashboard on the same site.',
    },
    local: {
      title: 'The county name does more work than the city name.',
      county: 'Liberty County',
      body: [
        'A Dayton business whose site says Houston is competing with every firm inside the Beltway and ranking against none of them. Liberty County, Dayton, and the towns either side are what people actually type.',
        'The listing site we built here is the clearest case: buyers search by town across four of them at once, so the pages had to be built for somebody who has never driven through Dayton.',
        'The Grand Parkway put the town inside a commute it was not in before, and subdivisions are arriving faster than the trades that service them. A household three weeks into a new build has nobody to ask, so they search, and the first credible name tends to get the call.',
      ],
      nearby: ['Liberty', 'Cleveland', 'Hardin', 'Ames', 'Kenefick'],
    },
    close:
      'Tell us which of the towns around Dayton the business works. You get a plan and a price before any work starts, and most sites are live in two to four weeks.',
  },

  Huffman: {
    client: 'compound-scale-services',
    lede: 'Huffman is unincorporated Harris County, at the corner of FM 1960 and FM 2100. There is no downtown block to put a sign on, which is why the businesses here tend to come to us about search first.',
    search:
      'Web design in Huffman, TX at FM 1960 and FM 2100. Custom sites for businesses with no storefront to be seen from. See Compound Industrial Scale Services, live.',
    work: {
      title: 'Compound Industrial Scale Services runs a parts counter online.',
      description:
        'Calibration, repair, preventive maintenance, and installation for industrial weighing equipment, out of Huffman. Every part in the catalog has a page of its own, and a customer collects what they need into a quote list that reaches sales carrying the make, model, and capacity of the scale it belongs to.',
    },
    local: {
      title: 'No storefront to be seen from.',
      county: 'Harris County',
      body: [
        'No city hall, no municipal directory, no main street anyone drives to find. Whatever the site says is what the town says about the business, and the Google Business Profile is standing in for a sign on a road. We set the two up together and keep the details matching.',
        'Houston is twenty-five miles out, far enough that people look locally first and near enough that they will drive in when nobody local answers. Ranking locally and answering quickly turn out to be the same piece of work.',
        'Work around Lake Houston moves with the weather, so boats, docks, trailers, and land clearing all have a season. A site somebody can change themselves catches that while it is being searched for.',
      ],
      nearby: ['Atascocita', 'Crosby', 'Barrett', 'Kingwood', 'Dayton'],
    },
    close:
      'Tell us what the business does and how far out from Huffman it travels. You get a plan and a price before any work starts, and most sites are live in two to four weeks.',
  },

  Liberty: {
    client: 'faded-barber-shop',
    lede: 'Liberty is the county seat, thirty-three miles up SH 146, where 146 and US-90 run as one street through the middle of town. Websites for the shops around the square and the trades working out past it.',
    search:
      'Web design in Liberty, TX, the county seat where US-90 and SH 146 meet. Custom sites for local shops and trades. See the Faded Barber Shop site on Main Street.',
    work: {
      title: 'Faded Barber Shop puts the walk-in day where people look for it.',
      description:
        'A Main Street barber open since 2018, taking fades to skin, shaping beards to the head, and doing straight razor work. Every day carries its own label, appointment or walk-in, which is the single fact most callers ring to find out.',
    },
    local: {
      title: 'What people call to ask first.',
      county: 'Liberty County',
      body: [
        'Are you open, do you take walk-ins, do you come out this far, what does it start at. Every trade in town gets asked those before anything else, so on a site here they go at the top and the rest follows.',
        'Around the square the title companies, abstractors, surveyors, and attorneys all work from the same county records, and their customers search the county name as much as the town. Professional services here rank on both.',
        'Further out the calendar belongs to the Trinity. Restoration, elevation, septic, and dirt work all move when the water does, which means a site for that work has to be able to say so the week it matters.',
      ],
      nearby: ['Dayton', 'Hardin', 'Ames', 'Hull', 'Daisetta', 'Cleveland'],
    },
    close:
      'Tell us what the business does and how far out it travels. You get a plan and a price before any work starts, and most sites are live in two to four weeks.',
  },

  Dickinson: {
    client: 'dickinson-bayou-fleeting',
    lede: 'Dickinson sits on the bayou that runs out to Galveston Bay, between Houston and the island. Websites for the marine trades and the shops along Highway 3 and FM 517.',
    search:
      'Web design in Dickinson, TX for marine trades and the shops along Highway 3 and FM 517. Built and hosted locally. See the Dickinson Bayou Fleeting site.',
    work: {
      title: 'Dickinson Bayou Fleeting lets the dock by the month.',
      description:
        'Two five-acre gated yards on Galveston Bay and the Gulf Intracoastal Waterway, their monthly rates on the page rather than behind a quote form, and the shore crew that comes with either one. Black and white and deliberately light, because the site gets opened on a phone with one bar while somebody is standing on a dock.',
    },
    local: {
      title: 'Built to open on a dock.',
      county: 'Galveston County',
      body: [
        'The fleeting site is built the way most of the marine work along this bayou has to be. Somebody opens it outside with a job to move, on whatever signal the phone can get, so capability, capacity, and a number that dials are the page, and its weight decides whether the inquiry happens at all.',
        'Houston is twenty-eight miles northwest and Galveston nineteen southeast, which puts a business here inside both markets already. San Leon and Bacliff share the trades, the docks, and the search results, and naming them costs a line of copy.',
      ],
      nearby: ['San Leon', 'Bacliff', 'League City', 'Kemah', 'Santa Fe', 'Texas City'],
    },
    close:
      'Tell us what the business does, on the water or off it. You get a plan and a price before any work starts, and most sites are live in two to four weeks.',
  },

  Daisetta: {
    client: 'setx-football',
    lede: 'Daisetta is a small town in Liberty County, and the customers a business here wants are spread across several others. Websites written to reach all of them.',
    search:
      'Web design in Daisetta, TX and the Hull-Daisetta side of Liberty County. Sites that rank across a county, not one street. See the SETX Football sign-up site.',
    work: {
      title: 'SETX Football takes the sign-up, the shirt order, and the roster.',
      description:
        'A two-day community camp in Daisetta for kids five to twelve, with no tryouts and no bench. Parents register, order shirts, and pay without being made to create a login first, then track payment and edit inside a three-day window. Volunteers verify payments and work the roster from a staff panel.',
    },
    local: {
      title: 'A page that has to cover a county.',
      county: 'Liberty County',
      body: [
        'The customers are in Liberty, Hull, Devers, and Hardin as much as in town, so the page names those places for the search to find it there. The school district joins Hull and Daisetta and people search for either, which is a line of copy rather than a second page.',
        'A camp, a team, or a name on a sponsor wall is how a good deal of local advertising works out here. The site is where that name leads, and it has to be worth arriving at when it does.',
      ],
      nearby: ['Hull', 'Liberty', 'Devers', 'Hardin', 'Ames', 'Cleveland'],
    },
    close:
      'Tell us how far across Liberty County the business reaches. You get a plan and a price before any work starts.',
  },
}

/**
 * @param {string} name A town name.
 * @returns {string} The slug its page answers to, e.g. `the-woodlands`.
 */
export function townSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Towns a client already trades in that the service list does not name. A page
// for each is what keeps live work from landing nowhere, and appending them
// means a client in a new town arrives with a page already built.
const CLIENT_TOWNS = [...new Set(PORTFOLIO_PROJECTS.map(project => project.town).filter(Boolean))]

/**
 * Every town with a page, in service-area order and then by the order clients
 * appear in the portfolio.
 *
 * - `name`    The town as it is written on the page.
 * - `slug`    The path segment under `/areas`.
 * - `trades`  Trade ids from `@data/towns-and-trades/trades`, resolved by the view.
 * - `profile` The town's own copy, or null for a town on the shared copy.
 */
export const AREAS = [
  ...SERVICE_TOWNS,
  ...CLIENT_TOWNS.filter(town => !SERVICE_TOWNS.includes(town)),
].map(name => ({
  name,
  slug: townSlug(name),
  trades: TRADES_BY_TOWN[name] || COMMON_TRADES,
  profile: TOWN_PROFILES[name] || null,
}))

/**
 * @param {string} slug A path segment under `/areas`.
 * @returns {object | null} The town, or null for a slug no town answers to.
 */
export function areaBySlug(slug) {
  return AREAS.find(area => area.slug === slug) || null
}

/**
 * The client sites in a town, the one its profile leads with first.
 *
 * @param {string} name A town name.
 * @returns {Array<object>} Matching portfolio entries; empty for a town with no
 *   client of its own yet.
 */
export function workInTown(name) {
  const featured = TOWN_PROFILES[name]?.client
  const lead = featured ? PORTFOLIO_PROJECTS.filter(project => project.slug === featured) : []
  const rest = PORTFOLIO_PROJECTS.filter(
    project => project.town === name && project.slug !== featured
  )
  return [...lead, ...rest]
}
