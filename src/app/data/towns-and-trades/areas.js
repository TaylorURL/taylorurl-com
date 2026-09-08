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
 * The copy specific to a town. A town in here carries its own lede, meta
 * description, work band, local band, and close; a town absent from it reads
 * from the shared copy in `@views/Area`.
 *
 * - `client` Portfolio slug of the work live in the town, where there is any.
 *   The live-work band puts it first, so the slug names an entry in
 *   `@data/portfolio`. A town with no client of its own omits the key, and its
 *   work band falls back to the nearest client sites, which is why every
 *   `work` heading below states whose town the work is in.
 * - `lede`   The line under the town's heading.
 * - `search` The page's meta description.
 * - `work`   Heading and standfirst for the live-work band.
 * - `notes`  The local band's cells: the roads, trades, and habits a business
 *   there is found through.
 * - `close`  The closing invitation, written for what trades in the town.
 */
const TOWN_PROFILES = {
  Baytown: {
    client: 'speedway-146',
    lede: 'Websites for the shops on Garth Road, the contractors working the plant gates off Decker Drive, and the places people go on a day off. Built in Baytown, for a town that works shifts and searches on a phone.',
    search:
      'Web design in Baytown, TX for local shops, trades, and contractors. Custom sites built, hosted, and looked after here, with Speedway 146 on TX-146 already live.',
    work: {
      title: 'Speedway 146 sells its own seat time.',
      description:
        'The outdoor go-kart track at 6750 TX-146, open Thursday through Sunday. Wristbands, party packages, and bounce house rentals go through a cart and a Stripe checkout, and staff work orders and live track traffic from a panel on the same site.',
    },
    notes: [
      {
        title: 'Your customers search at hours you are closed',
        body: 'ExxonMobil, Chevron Phillips at Cedar Bayou, and Covestro run around the clock, and so do the crews feeding them. A site that answers at five in the morning with hours, an address, a number, and a way to book takes work the one that says call us during business hours never sees.',
      },
      {
        title: 'You are ranking against Houston firms',
        body: 'A search made in Baytown pulls in firms thirty miles west that have never driven Garth Road. Naming Baytown, Highlands, and Mont Belvieu on the page, and backing it with a Google Business Profile that matches, is what puts a local business above them in the map results.',
      },
      {
        title: 'Two counties split one business',
        body: 'Baytown sits in both Harris and Chambers, and Google does not always agree on which. Naming both counties, along with Goose Creek and Pelly, is what keeps a business findable from either side of the line instead of from half the town.',
      },
      {
        title: 'The visit is the phone or it is nothing',
        body: 'A search from a truck on Garth Road ends with whoever loads first and shows a number worth tapping. Seconds of load time and a tap-to-call button are worth more here than another page of copy nobody scrolls to.',
      },
    ],
    close:
      'This is run from Baytown, so a first meeting is a drive across town rather than a call. Tell us what the business needs and you get a reply within the hour, then a plan and a price before any work starts. Most sites are live in two to four weeks.',
  },
  Houston: {
    client: 'delux-financial-solutions',
    lede: 'Twenty-six miles west on I-10, where the east side is the half of the city a Baytown studio reaches first: the ship channel terminals, the East End, and the strips along Navigation and Wayside. Websites for the businesses working that side of Houston.',
    search:
      'Web design in Houston, TX for east-side businesses, from the ship channel to the East End. Custom sites by one developer. See Delux Financial Solutions, live.',
    work: {
      title: 'Delux Financial Solutions books both kinds of appointment.',
      description:
        'A Houston credit-education practice, with credit building and financial guidance laid out across services, education, and a booking path. Virtual consultations and mobile in-person ones are set on the site rather than over the phone.',
    },
    notes: [
      {
        title: 'Nobody wins the search for Houston',
        body: 'A city of two million has an agency for every keyword and a budget behind it. The searches a small business can win name a neighborhood, a trade, and a street, so the page has to say Second Ward or Navigation or East End rather than reach for the city and land nowhere.',
      },
      {
        title: 'The work here is quoted, not bought',
        body: 'The brokers, haulers, and repair shops working the channel from the Turning Basin east win on a quote sheet rather than a shop front. The site’s job is to make a purchasing office confident enough to send the inquiry, which means proof of work and a form that asks for the detail a price needs.',
      },
      {
        title: 'Half the street reads Spanish first',
        body: 'More than half of the Greater East End is Latino, and Magnolia Park has been the center of Mexican Houston since the 1920s. A site in one language is open to half its market, and a bilingual one ranks for a second set of searches nobody local is competing for.',
      },
      {
        title: 'You are found standing on a platform',
        body: 'METRORail runs Harrisburg Boulevard through Second Ward and Magnolia Park, and a phone search made waiting for a train is a different visitor from one already parked outside. Hours, a map link, and a number have to land before anything asks the visitor to read.',
      },
    ],
    close:
      'Tell us what the business does and which part of Houston it trades in. You get a reply within the hour and a plan and a price before any work starts. Most sites are live in two to four weeks.',
  },
  Pasadena: {
    client: 'impressiva-printing',
    lede: 'The second-largest city in Harris County, where most of what trades answers in some way to the plants along SH-225. Websites for the shops, suppliers, and studios working that corridor.',
    search:
      'Web design in Pasadena, TX for shops and suppliers along SH-225 and Spencer Highway. Custom sites built and hosted locally. See the Impressiva Printing portal.',
    work: {
      title: 'Impressiva Printing runs its floor through its site.',
      description:
        'A Pasadena print studio running offset, digital, screen, direct-to-film, and wide format under one roof. Customers open a job, upload print-ready artwork, approve a proof, and follow the run, and staff work the same pipeline from an admin panel.',
    },
    notes: [
      {
        title: 'The buyer is a purchasing office, not a passer-by',
        body: 'Safety supply, machine work, uniforms, signage, and turnaround catering all sell into the refining corridor along SH-225. That reader wants capabilities, capacities, certifications, and a way to send a spec, and will close a site that opens with a stock photo and a slogan.',
      },
      {
        title: 'A quote form beats a checkout',
        body: 'A job here starts with a spec and ends with an invoice. Collecting the detail a price depends on, in the order somebody can answer it, turns an inquiry into a quote the same day instead of into three emails asking what was left out.',
      },
      {
        title: 'Nobody searches the whole city',
        body: 'Red Bluff, Spencer Highway, Fairmont Parkway, and the Beltway side each pull their own traffic. A page naming the stretch it sits on ranks where its customers already are, and a page naming only Pasadena competes with every business in a hundred thousand-person city at once.',
      },
      {
        title: 'Two markets, one town',
        body: 'The plants buy on contract and the street buys on a Saturday, and San Jacinto College keeps both moving all week. A site that says plainly which of the two it is for converts better than one written to avoid choosing.',
      },
    ],
    close:
      'Tell us what the business needs and whether it sells to the plants or to the street. You get a reply within the hour and a plan and a price before any work starts. Most sites are live in two to four weeks.',
  },
  'Deer Park': {
    lede: 'Thirty-four thousand people with the ship channel on one side, SH 225 down the middle, and Center Street holding the civic half. Websites for the suppliers, the trades, and the shops serving both.',
    search:
      'Web design in Deer Park, TX for suppliers and trades on SH 225 and Center Street. Built in Baytown, over the ship channel. A plan and a price before any work.',
    work: {
      title: 'Work live over the ship channel.',
      description:
        'Client sites running now in the towns around Deer Park rather than in it, each one built, hosted, and looked after from Baytown, up SH 146 from the end of the La Porte Freeway.',
    },
    notes: [
      {
        title: 'Nothing here is found by accident',
        body: 'SH 225 runs the length of Deer Park without meeting another state highway inside the city, so no driver is routed onto a main street by chance. Everything that arrives came looking, which makes search where every customer comes from rather than a share of them.',
      },
      {
        title: 'Sell to the gate or sell to the street',
        body: 'The refinery and chemical gates face SH 225 and the town faces Center Street, and the two buy nothing alike. A page that names which side it works, in the words that side uses, is found by the half that can buy.',
      },
      {
        title: 'The name over the gate changes',
        body: 'Shell built the refinery in 1928 and Pemex has owned it outright since 2022, with Dow, Lubrizol, and Intercontinental Terminals along the same stretch. A supplier ranks on what it does and what it is certified for, because the company it invoiced last year may be called something else now.',
      },
      {
        title: 'Say the town’s own name back to it',
        body: 'Deer Park has held Birthplace of Texas as a registered trademark since 2007, and locals search the way locals talk. Using the town’s own name for itself, alongside Deer Park, TX and the neighboring towns, catches searches a generic page never sees.',
      },
    ],
    close:
      'Tell us what the business does and which of the plants it works for, if any. You get a reply within the hour and a plan and a price before any work starts. Most sites are live in two to four weeks.',
  },
  'La Porte': {
    lede: 'The fourth-largest city in Harris County, wrapped around Bayport, Battleground, and Barbours Cut, with Sylvan Beach on the other side of it. Websites for the businesses selling to a plant gate and the ones selling to a weekend.',
    search:
      'Web design in La Porte, TX for shops and contractors at Bayport, Battleground, and Barbours Cut. Built over the Fred Hartman Bridge. A plan and a price first.',
    work: {
      title: 'Work live across the Fred Hartman Bridge.',
      description:
        'Client sites running now in the towns around La Porte rather than in it, each one built, hosted, and looked after from Baytown, at the far end of the span SH 146 crosses.',
    },
    notes: [
      {
        title: 'Most of what sells goes through a badge reader',
        body: 'La Porte sits against the Bayport and Battleground industrial districts and Barbours Cut, which Port Houston has run since 1977. Selling in there means a site a purchasing office can check in a minute: what you do, who you are approved by, and who to call.',
      },
      {
        title: 'The plant roster is a customer list',
        body: 'The city publishes which plant tests its alarm on which day, by name and street address. That roster is the account list for half the trades in town, and the site is what gets checked before the call is returned.',
      },
      {
        title: 'Two towns share one set of search results',
        body: 'La Porte was a resort before it was a port, and Sylvan Beach still pulls a weekend crowd that never goes near a gate. A shop on the waterfront and a contractor on Fairmont Parkway are chasing different searches, and a page written for both ranks for neither.',
      },
      {
        title: 'Traffic arrives for the monument',
        body: 'San Jacinto was fought inside what is now unincorporated La Porte, and Independence Parkway carries visitors all year. It is the one stream of local searches with nothing to do with the channel, and food, fuel, and retail can be written to catch it.',
      },
    ],
    close:
      'Tell us what the business does and whether the work is inside the fence line or out on the water. You get a reply within the hour and a plan and a price before any work starts. Most sites are live in two to four weeks.',
  },
  'Mont Belvieu': {
    lede: 'Fourteen miles up SH 146 from Baytown, on the salt dome holding the largest store of natural gas liquids in the country. Websites for the contractors working the caverns and the trades following Eagle Drive out into Riceland.',
    search:
      'Web design in Mont Belvieu, TX for contractors at the storage caverns and trades building out Eagle Drive. A plan and a price first, fourteen miles down SH 146.',
    work: {
      title: 'Work live down the same highway.',
      description:
        'Client sites running now in the towns around Mont Belvieu rather than in it, each one built, hosted, and looked after from Baytown, fourteen miles down SH 146.',
    },
    notes: [
      {
        title: 'Your buyers already know the vocabulary',
        body: 'The caverns here hold the country’s largest store of natural gas liquids, and the Mont Belvieu price is what American propane and butane trade against. A site written down to a general audience reads as an outsider to the people signing the purchase orders.',
      },
      {
        title: 'The growth is on Eagle Drive',
        body: 'Riceland runs to 1,450 acres off Eagle Drive and FM 565 and covers most of the developable land left in the city. Fencing, concrete, dirt work, roofing, and lawn crews are competing on search there long before there is a sign on the road, and the first name a new household finds tends to keep the work.',
      },
      {
        title: 'The interstate and the town want different pages',
        body: 'Fuel, hotels, and drive-through food sit where SH 146 meets I-10, while the town is south of it on FM 1942 and Eagle Drive. A search made at seventy miles an hour and one made from a driveway are answered by different pages, and running both beats splitting the difference.',
      },
      {
        title: 'The address a local remembers is not the one that ranks',
        body: 'The community was rebuilt two miles east after the 1985 explosion, so old addresses and new ones both circulate. A consistent name, address, and phone across the site, the Google Business Profile, and every directory is what stops the listing from fragmenting.',
      },
    ],
    close:
      'Tell us what the business does and whether it sells to the caverns or to the neighborhoods. You get a reply within the hour and a plan and a price before any work starts. Most sites are live in two to four weeks.',
  },
  Galveston: {
    lede: 'An island of fifty-three thousand carrying a medical branch, a maritime academy, the only cruise homeport in Texas, and a beach season. Websites for the shops on the Strand, the trades along the Seawall, and the operators working the harbor.',
    search:
      'Web design in Galveston, TX for Strand shops, Seawall trades, and the marine and rental businesses on the island. A plan and a price before any work starts.',
    work: {
      title: 'Work live back up the mainland.',
      description:
        'Client sites running now on the mainland rather than on the island, each one built, hosted, and looked after from Baytown, at the far end of SH 146.',
    },
    notes: [
      {
        title: 'Half your visitors have never been here',
        body: 'A tourist searching from a hotel room, a cruise passenger with an hour to kill, and a local looking for a plumber want three different things from the same business. The site that ranks for all three names the Strand, the Seawall, and Galveston Island separately rather than hoping one word covers them.',
      },
      {
        title: 'The Strand and the Seawall are two markets',
        body: 'The Strand is the harbor-side historic block carrying Mardi Gras and Dickens on the Strand. The Seawall is ten miles of Gulf front, hotels, and beach access. Claiming the wrong one, or claiming both vaguely, costs the search either way.',
      },
      {
        title: 'The season decides the year',
        body: 'A short-term rental books solid in July and sits empty in February, with hurricane season sitting on the peak from June through November. Hours, prices, and whether the doors are open at all have to be changeable from a phone in a minute, not filed as a support ticket.',
      },
      {
        title: 'UTMB is a market of its own',
        body: 'The medical branch has been here since 1891 and runs four hospitals and the national laboratory on the island. A business in Galveston is often selling to somebody on its payroll or to a family visiting somebody in its care, a year-round customer the beach calendar never touches and one the page should name.',
      },
    ],
    close:
      'Tell us what the business does and whether the season carries it or the whole year does. You get a reply within the hour and a plan and a price before any work starts. Most sites are live in two to four weeks.',
  },
  'Texas City': {
    lede: 'The largest refinery in the country, a port with a railway of its own, and five miles of dike out into Galveston Bay. Websites for the contractors, the marine trades, and the shops inside Loop 197.',
    search:
      'Web design in Texas City, TX for refinery contractors, marine trades, and shops on Palmer Highway. A plan and a price before any work, from the top of the bay.',
    work: {
      title: 'Work live up the bay.',
      description:
        'Client sites running now around Texas City rather than in it, each one built, hosted, and looked after from Baytown, at the north end of the same water.',
    },
    notes: [
      {
        title: 'Two refineries set what the work is worth',
        body: 'Marathon’s Galveston Bay Refinery runs 631,000 barrels a day, the largest in the country, and Valero’s plant on Loop 197 runs another 260,000. The contracting that keeps both turning is most of what trades here, and it is awarded on capability and safety record rather than on price alone, so those are what the site states first.',
      },
      {
        title: 'A turnaround is a deadline, not a lead',
        body: 'Work that follows a plant schedule arrives in a hurry and goes to whoever answers. A site that states scope, certifications, crew size, and how fast you can mobilize closes work that a contact form and a promise to reply within two business days loses.',
      },
      {
        title: 'The loop is the address',
        body: 'Loop 197 joins SH 146 to circle the city, with I-45 west and Palmer Highway and Texas Avenue through the middle. A search here is made from a ring road, so the page has to say which side of town it answers from and how far out it travels.',
      },
      {
        title: 'Rail and water are both quoting against you',
        body: 'The Texas City Terminal Railway has worked the port’s thirty-two miles of track since 1921, jointly owned by Union Pacific and BNSF. Freight, storage, and repair businesses quote against a rail schedule as often as a road one, and the site is where a shipper checks whether you can meet it.',
      },
    ],
    close:
      'Tell us what the business does and how much of it moves by rail or by water. You get a reply within the hour and a plan and a price before any work starts. Most sites are live in two to four weeks.',
  },
  Dayton: {
    client: 'dylan-jordan-real-estate',
    lede: 'US-90 through the middle, SH-321 north to Cleveland, SH-146 south to Baytown, and the Grand Parkway crossing the lot on the edge of town. Websites for the businesses arriving with the traffic.',
    search:
      'Web design in Dayton, TX and Liberty County for trades and agents working US-90 and SH-321. Built and hosted nearby. See the Dylan Jordan listing site.',
    work: {
      title: 'Dylan Jordan lists Dayton and seven towns either side.',
      description:
        'A RE/MAX Excellence agent working Liberty County. Buyers search by town across Dayton, Liberty, Cleveland, and Hardin, save what is worth a second look, and compare a shortlist before calling. Listings, leads, and questions are worked from a dashboard on the same site.',
    },
    notes: [
      {
        title: 'Calling yourself Houston loses the search',
        body: 'A Dayton business whose site says Houston competes with every firm inside the Beltway and ranks against none of them. Liberty County, Dayton, and the towns either side are what people type, and naming them is most of what local ranking is.',
      },
      {
        title: 'Your customers are passing through',
        body: 'Three highways and the point where two Union Pacific lines meet put more people through a town of under nine thousand than live in it. Hours, a map link, and a number that works at speed matter more than a brand story nobody stops to read.',
      },
      {
        title: 'The Grand Parkway moved the market',
        body: 'SH-99 crossing US-90 put Dayton inside a commute it was not in before. The buyers, builders, and trades following that road are searching from somewhere else entirely, which means the page has to rank for people who have never driven through town.',
      },
      {
        title: 'Growth arrives one subdivision at a time',
        body: 'Dayton is taking new subdivisions faster than it is taking the trades that service them. A household three weeks into a new build has nobody to ask, so they search, call the first credible name, and that name keeps the work for years.',
      },
    ],
    close:
      'Tell us what the business needs and which of the towns around Dayton it works. You get a reply within the hour and a plan and a price before any work starts. Most sites are live in two to four weeks.',
  },
  Huffman: {
    client: 'compound-scale-services',
    lede: 'Websites for the businesses of Huffman, unincorporated Harris County at the corner of FM 1960 and FM 2100. There is no main street to be seen from, so a business here is found by search or it is not found at all.',
    search:
      'Web design in Huffman, TX at FM 1960 and FM 2100. Custom sites for businesses with no storefront to be seen from. See Compound Industrial Scale Services, live.',
    work: {
      title: 'Compound Industrial Scale Services runs a parts counter online.',
      description:
        'Calibration, repair, preventive maintenance, and installation for industrial weighing equipment, out of Huffman. Every part in the catalog has a page of its own, and a customer collects what they need into a quote list that reaches sales carrying the make, model, and capacity of the scale it belongs to.',
    },
    notes: [
      {
        title: 'The site is the storefront',
        body: 'Huffman is unincorporated: no city hall, no municipal directory, no downtown block anyone drives to find. Whatever the site says is what the town says about the business, and a Google Business Profile is the only listing standing in for a sign on a road.',
      },
      {
        title: 'Every search is made from a truck',
        body: 'FM 1960 and FM 2100 cross in the middle of Huffman and carry nearly everything through it. A page that will not load on a phone with two bars is a job lost at the intersection to whoever is one result down.',
      },
      {
        title: 'Twenty-five miles is the deciding distance',
        body: 'Houston is far enough out that people look for somebody local first, and near enough that they will drive in when nobody here answers. Ranking locally and answering quickly are the same piece of work.',
      },
      {
        title: 'The lake work runs on a season',
        body: 'Boats, docks, trailers, and land clearing pick up with the weather around Lake Houston. A site that can be changed to say what the season is, without paying somebody to rebuild a page, catches the work while it is being searched for.',
      },
    ],
    close:
      'Tell us what the business does and how far out from Huffman it travels. You get a reply within the hour and a plan and a price before any work starts. Most sites are live in two to four weeks.',
  },
  Liberty: {
    client: 'faded-barber-shop',
    lede: 'The county seat, thirty-three miles up SH 146 from Baytown, where 146 and US-90 run as one street through the middle of town. Websites for the shops around the square and the trades working the river bottom past it.',
    search:
      'Web design in Liberty, TX, the county seat where US-90 and SH 146 meet. Custom sites for local shops and trades. See the Faded Barber Shop site on Main Street.',
    work: {
      title: 'Faded Barber Shop puts the walk-in day where people look for it.',
      description:
        'A Main Street barber open since 2018, taking fades to skin, shaping beards to the head, and doing straight razor work. Every day carries its own label, appointment or walk-in, which is the single fact most callers ring to find out.',
    },
    notes: [
      {
        title: 'Answer the one question people call to ask',
        body: 'Liberty runs on a main street and a courthouse square, and every trade gets asked the same things first: are you open, do you take walk-ins, do you come out this far, what does it start at. Putting that answer above everything else turns searches into customers and cuts the calls that were never going to book.',
      },
      {
        title: 'Being the county seat brings its own traffic',
        body: 'The courthouse has stood on the square since the town was laid out in 1831, and the title companies, abstractors, surveyors, and attorneys around it all work from records pointing at the same block. Professional services here rank on the county name as much as the town.',
      },
      {
        title: 'The river sets the calendar',
        body: 'Lake Livingston Dam upstream holds no flood-control storage, so what the Trinity does above Liberty arrives here more or less unchanged. Restoration, elevation, septic, and dirt work all follow the water, and a site for that work has to answer in the week it matters rather than the month after.',
      },
      {
        title: 'The square and the highway are two customers',
        body: 'US-90 carries people who are passing and the square holds people who came. Trucking, tubular manufacturing, and the hospital carry the town now, so a business here sells into a mix, and the page ranks better for naming which part of it the work comes from.',
      },
    ],
    close:
      'Tell us what the business does and whether its customers come off the square or off the highway. You get a reply within the hour and a plan and a price before any work starts. Most sites are live in two to four weeks.',
  },
  Dickinson: {
    client: 'dickinson-bayou-fleeting',
    lede: 'Dickinson Bayou runs out to Galveston Bay, and most of the work that pays here follows it. Websites for the marine trades, the contractors, and the shops along Highway 3 and FM 517.',
    search:
      'Web design in Dickinson, TX for marine trades and the shops along Highway 3 and FM 517. Built and hosted locally. See the Dickinson Bayou Fleeting site.',
    work: {
      title: 'Dickinson Bayou Fleeting lets the dock by the month.',
      description:
        'Two five-acre gated yards on Galveston Bay and the Gulf Intracoastal Waterway, their monthly rates on the page rather than behind a quote form, and the shore crew that comes with either one. Black and white and deliberately light, because the site gets opened on a phone with one bar while somebody is standing on a dock.',
    },
    notes: [
      {
        title: 'The site is read by an operator, not a shopper',
        body: 'The yards, docks, and boat work along the bayou are most of what the money here does, and the person opening the site is standing outside with a job to move. Capability, capacity, and a number that dials are the page. Everything else is in the way.',
      },
      {
        title: 'One bar of signal is the test',
        body: 'A site opened on a dock or a deck loads on whatever the phone can get. Page weight decides whether the inquiry happens at all, which is why the work built for this town is deliberately small.',
      },
      {
        title: 'You are inside two metro markets',
        body: 'Houston sits twenty-eight miles northwest and Galveston nineteen southeast, which puts Dickinson inside both. A business claiming only one is working with half the reach it already has and half the searches it could rank for.',
      },
      {
        title: 'San Leon and Bacliff are the same customer',
        body: 'The towns down the bay share the trades, the docks, and the search results. Naming only Dickinson makes a business invisible to the people nearest the water, and naming the neighbors costs nothing but a line of copy.',
      },
    ],
    close:
      'Tell us what the business does, on the water or off it. You get a reply within the hour and a plan and a price before any work starts. Most sites are live in two to four weeks.',
  },
  Daisetta: {
    client: 'setx-football',
    lede: 'Under a thousand people in Liberty County, which means a business here competes for the same searches as towns twenty miles away. Websites written for a county rather than for a street.',
    search:
      'Web design in Daisetta, TX and the Hull-Daisetta side of Liberty County. Sites that rank across a county, not one street. See the SETX Football sign-up site.',
    work: {
      title: 'SETX Football takes the sign-up, the shirt order, and the roster.',
      description:
        'A two-day community camp in Daisetta for kids five to twelve, with no tryouts and no bench. Parents register, order shirts, and pay without being made to create a login first, then track payment and edit inside a three-day window. Volunteers verify payments and work the roster from a staff panel.',
    },
    notes: [
      {
        title: 'Nine hundred people is not a market',
        body: 'The customers are in Liberty, Hull, Devers, and Hardin as much as in town. What the site claims has to cover the drive people are willing to make, and the page has to name those towns for the search to find it there.',
      },
      {
        title: 'One place, two names',
        body: 'The school district joins Hull and Daisetta and people here search for either. A site naming only one is missing half the people looking for it, and adding the other is a line of copy rather than a second page.',
      },
      {
        title: 'Read as a business, not as a news story',
        body: 'The sinkholes the salt dome has opened since 1969 are what most people outside the county know the name for. Ranking on Daisetta means a page clear enough about what it sells that search puts it beside the businesses rather than the headlines.',
      },
      {
        title: 'Sponsorship is the local advertising',
        body: 'In Daisetta a camp, a team, or a name on a sponsor wall puts a business in front of the whole town at once. The site is where that name has to lead, and it has to be worth arriving at when it does.',
      },
    ],
    close:
      'Tell us what the business needs and how far across Liberty County it reaches. You get a reply within the hour and a plan and a price before any work starts. Most sites are live in two to four weeks.',
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
