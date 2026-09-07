/**
 * What each industry page says, keyed by the trade slug `@data/industries`
 * already names it with. The name, the icon, the four things the site has to
 * do, and the software the trade runs stay in `@data/trades`, so a trade
 * renamed there is renamed here and on every page that links to it.
 *
 * Fields, in the order the page reads them:
 *
 * - `metaDescription` What a search result says under the title, inside the
 *                     155 characters a result shows.
 * - `heroTitle`       The headline on the page itself.
 * - `heroDescription` The paragraph under it: the problem this trade has with
 *                     its web presence, rather than a description of a website.
 * - `needsTitle`,     The band framing the four jobs held in
 *   `needsDescription`   `@data/trades`.
 * - `buildTitle`,     The band naming the pages, forms, and flows this trade
 *   `buildDescription`, needs. `build` entries are `{ title, body }` cells,
 *   `build`              three to a trade.
 * - `toolsTitle`,     The band around the software panel, saying how the site
 *   `toolsDescription`   hands work to what the office already runs.
 * - `workTitle`,      The band around the live client sites. A trade with a
 *   `workDescription`    client of its own names it; the rest describe the
 *                        work generally, because the panel below falls back to
 *                        sites built for other trades.
 * - `townsDescription` Why this trade's market is a local one here.
 * - `ctaDescription`  What to send over to get a plan and a price.
 *
 * Nothing here may claim a client, a certification, or a result that
 * `@data/portfolio` does not carry.
 */
const DETAIL = {
  plumbing: {
    metaDescription:
      'Plumbing websites for Baytown and Houston shops. The after-hours number first, service areas named town by town, and job requests that carry an address.',
    heroTitle: 'Plumbing sites built for the two in the morning call.',
    heroDescription:
      'Most plumbing work is bought in a hurry by somebody standing in water. At that moment the site has one job: put a working number under a thumb and say whether you cover the address.',
    needsTitle: 'What a plumbing site is judged on.',
    needsDescription:
      'A burst supply line does not get researched. It gets a phone call, and the shop that answers first takes the job.',
    buildTitle: 'The pages a plumbing shop needs.',
    buildDescription:
      'Written around how the work is bought: fast in an emergency, slowly and by price for anything planned.',
    build: [
      {
        title: 'A Call Bar That Follows',
        body: 'The number pinned to the bottom of every page on a phone, with after-hours routing stated beside it so nobody has to guess whether anyone is awake.',
      },
      {
        title: 'Job Pages, Not a Service List',
        body: 'Water heaters, slab leaks, drain clearing, repipes, and backflow testing each get a page, because that is how the work is searched for and how it is priced.',
      },
      {
        title: 'A Dispatch Form With an Address',
        body: 'The request asks for the address, the fixture, and a photograph, so the truck is loaded before it leaves the yard.',
      },
    ],
    toolsTitle: 'It hands the job to your board.',
    toolsDescription:
      'Calls, dispatch, and invoicing stay where the office already keeps them. A request drops into ServiceTitan or Housecall Pro rather than into a mailbox somebody reads at five, so the truck rolls on it the same hour.',
    workTitle: 'Work already live.',
    workDescription:
      'Sites running now for businesses around the bay, each one built, hosted, and looked after from Baytown.',
    townsDescription:
      'Slab housing runs the length of the ship channel and the towns along it call plumbers for the same three or four things. Each town has a page of its own.',
    ctaDescription:
      'Tell me how many trucks you run and what hours you answer. You get a reply within the hour and a written plan and price before any work starts.',
  },

  hvac: {
    metaDescription:
      'HVAC websites for Baytown and Houston contractors. A repair request that loads fast in July, plans signed up for online, and financing in plain numbers.',
    heroTitle: 'HVAC sites that hold up in July.',
    heroDescription:
      'Half a year of calls arrive in about ten weeks, and most of them start on a phone in a hot house. A site that is slow in August costs you jobs.',
    needsTitle: 'Three visitors, one page.',
    needsDescription:
      'A no-cool call, a planned replacement, and the maintenance plan that carries a customer through winter are bought by three different people. The page has to serve all three.',
    buildTitle: 'What an HVAC site has to carry.',
    buildDescription:
      'Peak season rewards a site that sorts visitors quickly and punishes one that makes everybody fill in the same box.',
    build: [
      {
        title: 'One Form, Three Jobs',
        body: 'Tune-up, no cool, and replacement quote run through one request that changes what it asks as soon as the visitor says which one they are here for.',
      },
      {
        title: 'Maintenance Plans Sold Online',
        body: 'Tiers, what each visit covers, and the monthly figure, with the sign-up finished on the page instead of ending in a call back tomorrow.',
      },
      {
        title: 'Financing in Real Numbers',
        body: 'Terms, monthly payment ranges, and who the lender is, on the replacement pages where the number is what decides it.',
      },
    ],
    toolsTitle: 'Straight onto the dispatch board.',
    toolsDescription:
      'Peak season is won on dispatch. Requests land in ServiceTitan or Housecall Pro with the equipment and the address attached, so the board fills without anyone retyping.',
    workTitle: 'Sites running now.',
    workDescription:
      'An HVAC shop has not come my way yet, so the panel below shows the nearest work in shape, all of it for businesses around Baytown.',
    townsDescription:
      'Cooling season here runs March to October and the humidity load along the bay comes with it. Each town has a page and the trades it calls for most.',
    ctaDescription:
      'Tell me how many trucks run in July and whether you sell plans. The plan and the price come back in writing before anything is built, and most sites are live in two to four weeks.',
  },

  electrical: {
    metaDescription:
      'Electrician websites for Baytown and Houston. License numbers where customers look, panel and generator work on separate pages, estimates with photographs.',
    heroTitle: 'Electrical sites that answer the license question first.',
    heroDescription:
      'Nobody lets a stranger into the panel without checking. The license number, the insurance, and the work you take belong above the fold rather than on a page called About.',
    needsTitle: 'What gets checked before you get called.',
    needsDescription:
      'A dead circuit, a service upgrade, and a standby generator are bought by three different households, and only one of them is in a hurry.',
    buildTitle: 'The pages that win electrical work.',
    buildDescription:
      'Half of this is proving you are licensed and insured. The other half is being findable for the one scope of work the visitor came for.',
    build: [
      {
        title: 'License and Insurance Up Top',
        body: 'The state license number, the master electrician holding it, and the insurance carrier, sitting where a homeowner or a general contractor goes looking rather than in a footer.',
      },
      {
        title: 'A Page per Scope of Work',
        body: 'Panel replacement, rewires, standby generators, EV chargers, and troubleshooting, each written with the permit and inspection step named.',
      },
      {
        title: 'Estimates That Carry Photographs',
        body: 'The form takes a picture of the panel and the meter base, which is most of what an estimator needs before a truck moves.',
      },
    ],
    toolsTitle: 'Estimates go where you already keep them.',
    toolsDescription:
      'Change orders and invoicing stay in the software the office runs. The site hands a job to Housecall Pro or Jobber with the photographs already attached, so it can be priced from the desk.',
    workTitle: 'Live client work.',
    workDescription:
      'Work along the ship channel that is live today. I built each of these sites and I host them.',
    townsDescription:
      'Standby generator work follows every storm season through these towns, and the search that goes with it is a local one.',
    ctaDescription:
      'Tell me what your license covers and which work you want more of. Nothing starts until you have a plan and a price in hand, and most sites go live inside a month.',
  },

  roofing: {
    metaDescription:
      'Roofing websites for Baytown and Houston. The insurance claim explained step by step, inspections booked in three taps, and before and after sets nearby.',
    heroTitle: 'Roofing sites for the week after the storm.',
    heroDescription:
      'Demand arrives inside two weeks and every roofer in three counties is knocking. The site has to show you were here before the hail and will be here after the claim closes.',
    needsTitle: 'What a homeowner is deciding.',
    needsDescription:
      'They already know the roof needs work. The question is whether you are the one who will still answer the phone when the adjuster short-pays the supplement.',
    buildTitle: 'Built around the claim.',
    buildDescription:
      'Storm work and retail replacement are two businesses. The site should be clear about which one a visitor has walked into.',
    build: [
      {
        title: 'The Claim, Step by Step',
        body: 'Adjuster meeting, scope, supplement, and the two checks, written out so a homeowner knows what happens next and who pays whom.',
      },
      {
        title: 'Inspection Booked in Three Taps',
        body: 'Address, best time, and a photograph of the ceiling stain. No call, and no waiting for somebody to call back at five.',
      },
      {
        title: 'Streets, Not Stock Photographs',
        body: 'Before and after sets tagged by neighborhood, because the proof that counts is a roof somebody can drive past on the way home.',
      },
    ],
    toolsTitle: 'Feeds the production schedule.',
    toolsDescription:
      'Measurements, supplements, and crews live in JobNimbus or AccuLynx. The site feeds them rather than adding a second place to look.',
    workTitle: 'Work already up.',
    workDescription:
      'Sites I keep running for businesses on this side of Houston, every one of them built here.',
    townsDescription:
      'Hail and wind claims move in bands across these towns, and roofs on either side of a line get very different work.',
    ctaDescription:
      'Tell me whether you chase storm work or retail and how far you travel for it. I reply within the hour, and no work starts before you have agreed a price.',
  },

  fencing: {
    metaDescription:
      'Fencing websites for Baytown and Houston. Cedar, iron, and chain link priced by the foot, a gallery sorted by style, measurements taken on the form.',
    heroTitle: 'Fencing sites that price by the foot.',
    heroDescription:
      'The first question is always what a hundred feet of cedar runs. A site that will not answer it hands the inquiry to the company whose site does.',
    needsTitle: 'What the inquiry is really asking.',
    needsDescription:
      'Style, height, footage, and a date. Four answers, and every one of them can be given before anybody picks up a phone.',
    buildTitle: 'The pages a fence company needs.',
    buildDescription:
      'Fence work is compared on price and on photographs, and both of those can be settled on the page.',
    build: [
      {
        title: 'Priced by the Linear Foot',
        body: 'Cedar, wrought iron, and chain link with a per-foot range against each, plus what a gate, a corner, and hauling the old fence off add on top.',
      },
      {
        title: 'A Gallery Sorted by Style',
        body: 'Six-foot privacy, board on board, ranch rail, and ornamental iron kept apart, so nobody scrolls past forty photographs to find their own fence.',
      },
      {
        title: 'Measurements Taken on the Form',
        body: 'Run length, gate count, and whether the old fence comes out, collected before a call so the first conversation is about a date.',
      },
    ],
    toolsTitle: 'Quotes land in your scheduler.',
    toolsDescription:
      'Estimates and crew scheduling stay in Jobber or Buildertrend. Inquiries arrive there with the footage already on them, priced before anyone drives out to measure.',
    workTitle: 'Built and running.',
    workDescription:
      'Live client work from the east side. Each site was built here and is still looked after here.',
    townsDescription:
      'Deed restrictions and fence heights change from one subdivision to the next out here, which is why a fence site has to know the town it is quoting in.',
    ctaDescription:
      'Tell me what you build most of and how far you haul cedar. A plan and a price come back in writing, and you agree to both before I build anything.',
  },

  concrete: {
    metaDescription:
      'Concrete websites for Baytown and Houston. Square-foot ranges in the open, pour and cure times explained, and quotes that arrive with dimensions.',
    heroTitle: 'Concrete sites that show finished slabs.',
    heroDescription:
      'Flatwork is bought on square footage and on whether the last driveway cracked. Both get answered with photographs and a square-foot figure, and neither needs a phone call.',
    needsTitle: 'Two questions, every time.',
    needsDescription:
      'What it runs a square foot, and how long before a truck can park on it. A site that answers both takes the call warm.',
    buildTitle: 'What a flatwork site carries.',
    buildDescription:
      'Driveways, patios, and slabs are priced differently and photograph differently, so they do not share a page.',
    build: [
      {
        title: 'Square-Foot Ranges in the Open',
        body: 'Driveways, patios, and slabs with a per-square-foot band against each, plus what tear-out, thickness, and rebar do to it.',
      },
      {
        title: 'Pours, Weather, and Cure Time',
        body: 'How long the job takes, when you will not pour, and how long before the drive takes weight. Each of those is a phone call otherwise.',
      },
      {
        title: 'Quotes With Dimensions Attached',
        body: 'The form takes measurements and a photograph of what is there now, which prices most driveways without a site visit.',
      },
    ],
    toolsTitle: 'Fits the way you schedule.',
    toolsDescription:
      'Working around the weather and the ready-mix truck stays in Jobber or Buildertrend. The site sends the job across with the dimensions on it, so it is priced from the desk and put on the schedule once.',
    workTitle: 'Live work.',
    workDescription:
      'What is running now for businesses around Baytown and Houston, all of it built and hosted from one desk in Baytown.',
    townsDescription:
      'Gumbo clay moves under every slab on this side of Houston, and the towns on it want to see you have poured here before.',
    ctaDescription:
      'Tell me the mix of driveways, patios, and commercial flatwork you want. The price is agreed before any work starts, and most sites are live within a month.',
  },

  landscaping: {
    metaDescription:
      'Lawn care websites for Baytown and Houston. Weekly and biweekly priced apart, recurring billing set up at sign-up, and a map drawn on the real routes.',
    heroTitle: 'Landscaping sites that sell the route.',
    heroDescription:
      'A mowing business is worth what its recurring list is worth. The site should be putting people onto a schedule rather than collecting one-off calls in August.',
    needsTitle: 'Cadence beats price.',
    needsDescription:
      'The visitor is choosing weekly, biweekly, or a one-time cleanup before they are choosing you. Make that choice the first thing on the page.',
    buildTitle: 'The pages that fill a route.',
    buildDescription:
      'Route density is where the margin sits, so everything here is aimed at signing a customer who is already on a street you cut.',
    build: [
      {
        title: 'Weekly, Biweekly, One-Off',
        body: 'Three columns with what each covers and what it costs, so a visitor picks a cadence instead of writing in to ask.',
      },
      {
        title: 'Card on File at Sign-Up',
        body: 'The recurring plan is set up and the card stored on the page, which is the difference between an inquiry and a customer.',
      },
      {
        title: 'A Map Drawn on the Routes',
        body: 'Coverage shown as the streets you already run rather than a circle around the shop, because a yard off route costs more than it makes.',
      },
    ],
    toolsTitle: 'Sign-ups become scheduled work.',
    toolsDescription:
      'Routes, crews, and recurring billing stay in Jobber, LMN, or Yardbook. A sign-up arrives as a scheduled customer rather than as an email to read later.',
    workTitle: 'Sites already live.',
    workDescription: 'Client sites around the bay, live today and in my care month to month.',
    townsDescription:
      'St. Augustine, chinch bugs, and a nine-month growing season set the work here, and a crew that names the town it cuts in gets the yard next door.',
    ctaDescription:
      'Tell me how many yards you cut a week and where they sit. A reply comes back within the hour, and the plan and the price are written down before the first page is built.',
  },

  'pest-control': {
    metaDescription:
      'Pest control websites for Baytown and Houston. Quarterly plans and one-off treatments priced apart, every pest named, and safety answered up front.',
    heroTitle: 'Pest control sites that sell the quarterly.',
    heroDescription:
      'One roach call is a morning of margin. The same house on a quarterly plan is worth twenty of them, and the site is where that choice gets made.',
    needsTitle: 'The plan is the product.',
    needsDescription:
      'A one-time treatment is what a visitor asks for. A recurring plan is what the page should make the obvious answer.',
    buildTitle: 'What a pest control site needs.',
    buildDescription:
      'People search the pest, not the company, and they will not book until the safety question is settled.',
    build: [
      {
        title: 'Plans and One-Time Work Side by Side',
        body: 'Quarterly, bimonthly, and a single treatment, with what each covers and what the re-treat guarantee promises.',
      },
      {
        title: 'The Pest List, Named',
        body: 'Roaches, termites, fire ants, rodents, and mosquitoes each get a page, because that word is what gets typed into the search box.',
      },
      {
        title: 'Safety Answered First',
        body: 'What gets applied, how long before children and pets are back on it, and where the label lives, on a page rather than on a phone call.',
      },
    ],
    toolsTitle: 'Books into the tech calendar.',
    toolsDescription:
      'Routes, chemical logs, and recurring billing stay in PestPac, FieldRoutes, or Briostack. The site books into the same calendar the techs work from, so a booking is a stop on a route rather than a note to call back.',
    workTitle: 'Client sites running.',
    workDescription:
      'Sites for businesses around the bay, live now, hosted and monitored from Baytown.',
    townsDescription:
      'Termite pressure and mosquito season on the upper coast are their own thing, and every town on it searches the pest by name.',
    ctaDescription:
      'Tell me the split between quarterly accounts and one-off calls. You see the plan and the price first, and most sites are live in two to four weeks.',
  },

  storage: {
    metaDescription:
      'Self storage websites for Baytown and Houston. Live vacancy by size, a unit rented and paid for at any hour, and a map to the right building.',
    heroTitle: 'Storage sites that rent the unit at midnight.',
    heroDescription:
      'Somebody with a truck full of furniture is not calling the office. They want to see a ten by ten, know when the gate opens, and pay for it now.',
    needsTitle: 'Rented without a conversation.',
    needsDescription:
      'Every step that needs a person is a step where a visitor drives to the facility down the road instead.',
    buildTitle: 'The whole rental, on the site.',
    buildDescription:
      'Sizes, availability, price, lease, and gate code. All five have to work at two in the morning or none of them matter.',
    build: [
      {
        title: 'Live Vacancy by Size',
        body: 'Every size with its price and whether one is empty right now, read from the management software rather than retyped each Monday.',
      },
      {
        title: 'Rented and Paid for Online',
        body: 'Lease signed, insurance chosen, first month taken, and the gate code issued, without the office being open.',
      },
      {
        title: 'A Map to the Right Building',
        body: 'Gate location, drive lanes, and which building a unit number sits in, so nobody circles the property at ten at night.',
      },
    ],
    toolsTitle: 'Reads the same numbers as the counter.',
    toolsDescription:
      'Rates, occupancy, and autopay stay in storEDGE or SiteLink. The site shows what the front counter shows, at the moment it changes, so nobody rents a unit that went an hour ago.',
    workTitle: 'Live sites.',
    workDescription: 'East-side businesses whose sites I built and maintain, each one live now.',
    townsDescription:
      'Facilities along 146 and the interstate draw from the towns beside them rather than from a radius on a map.',
    ctaDescription:
      'Tell me how many units you run and which sizes sit empty. You get a reply within the hour, a written price before any work, and a site that is usually live inside a month.',
  },

  'auto-repair': {
    metaDescription:
      'Auto repair websites for Baytown and Houston. Booking against real bay capacity, diagnostic fees in the open, and fleet accounts kept apart.',
    heroTitle: 'Auto repair sites built around the bay schedule.',
    heroDescription:
      'A shop makes money with full bays and loses a morning to the phone explaining diagnostic fees. Both of those turn out to be website problems.',
    needsTitle: 'The three questions before any others.',
    needsDescription:
      'What the scan costs, whether it comes off the repair, and when you can take the car. Answer them on the page and the call is a booking.',
    buildTitle: 'What a shop site has to do.',
    buildDescription:
      'A walk-in and a fleet manager want opposite things from the same site, so each one takes a different route through it.',
    build: [
      {
        title: 'Booking That Knows the Bays',
        body: 'Appointments offered against real capacity and job length, so a two-hour brake job never lands in a fifteen-minute slot.',
      },
      {
        title: 'Fees and Shop Rate Stated',
        body: 'What diagnostics cost, whether it applies to the repair, and the hourly rate. Publishing them ends the calls that were never going to book.',
      },
      {
        title: 'Fleet Accounts Kept Separate',
        body: 'A route for the contractor with eight trucks that is not the form a walk-in fills in, carrying PO numbers and billing terms.',
      },
    ],
    toolsTitle: 'Inspections reach the customer.',
    toolsDescription:
      'Tickets, inspections, and history stay in Tekmetric, Shop-Ware, or Mitchell 1. A digital inspection reaches the customer as a link rather than as a voicemail, which is what gets the repair approved while the car is still on the lift.',
    workTitle: 'A product of my own for this trade.',
    workDescription:
      'TireTracker is dispatch and service tracking I built for commercial tire shops, on the same stack the client sites run on.',
    townsDescription:
      'Independent shops here compete with the dealerships along the interstate and with each other, and the search is for a shop in this town, not a shop in Houston.',
    ctaDescription:
      'Tell me how many bays you run and whether you want fleet work. The plan and the price come first, in writing, and most sites are live in two to four weeks.',
  },

  towing: {
    metaDescription:
      'Towing company websites for Baytown and Houston. A tap-to-call bar on every page, rates in the open, and roadside requests that arrive carrying a location.',
    heroTitle: 'Towing sites that are one tap from a call.',
    heroDescription:
      'The visitor is on a shoulder with a phone at ten percent. Every second the page spends loading something decorative is a call going to whoever sits below you in the results.',
    needsTitle: 'Speed is the whole product.',
    needsDescription:
      'Nobody compares two towing companies. They call the first one that loads and answers, which makes weight and uptime the design brief.',
    buildTitle: 'Built for a phone on the roadside.',
    buildDescription:
      'Everything here is stripped to what somebody can use one-handed in the dark on a bad signal.',
    build: [
      {
        title: 'The Number, Everywhere',
        body: 'A tap-to-call bar fixed to the screen on every page, above everything else, because nobody scrolls with the hazards on.',
      },
      {
        title: 'Rates You Do Not Have to Ask For',
        body: 'Hook fee, per mile, winch-out, and daily storage, written down. Publishing them wins more calls than it costs.',
      },
      {
        title: 'Location Sent With the Request',
        body: 'The roadside form takes the phone position, the vehicle, and whether it rolls, so dispatch sends the right truck first time.',
      },
    ],
    toolsTitle: 'Onto the board, with a location.',
    toolsDescription:
      'Calls, drivers, and impound stay in Towbook or Dispatch Anywhere. The site drops a job onto the board with the coordinates already on it, so the nearest truck rolls first.',
    workTitle: 'Sites live now.',
    workDescription:
      'Sites around Baytown and the ship channel that are live right now, every one of them built and hosted by me.',
    townsDescription:
      '146, 225, and the interstate feed most of the calls on this side of the bay, and a driver on the shoulder searches the town they can see the sign for.',
    ctaDescription:
      'Tell me how many trucks you run and whether you work motor club or private property. I reply within the hour, and the price is settled before anything is built.',
  },

  'marine-services': {
    metaDescription:
      'Marine service websites for the Houston Ship Channel. Fleet and capability in full, fleeting areas mapped, credentials where they get checked.',
    heroTitle: 'Marine service sites for the ship channel.',
    heroDescription:
      'The people reading are dispatchers, brokers, and terminal schedulers. They want fleet, capability, and a number that answers at three in the morning.',
    needsTitle: 'Read by a scheduler, not a shopper.',
    needsDescription:
      'This traffic arrives knowing exactly what it needs. The page either has the specification and the coverage or it is closed inside ten seconds.',
    buildTitle: 'What a marine site has to hold.',
    buildDescription:
      'Everything a charterer or a vendor-approval desk asks for, in one place they can be sent to.',
    build: [
      {
        title: 'The Fleet, Vessel by Vessel',
        body: 'Horsepower, draft, and what each boat is rigged for, laid out the way a charterer compares them rather than as a photo gallery.',
      },
      {
        title: 'Fleeting and Terminals Mapped',
        body: 'Where you work on the channel and the bayous, with mile markers, so a scheduler can tell in seconds whether you reach the berth.',
      },
      {
        title: 'Credentials Where They Are Checked',
        body: 'Documentation, insurance certificates, and safety record on a page that can be handed to a vendor-approval desk without a follow-up email.',
      },
    ],
    toolsTitle: 'Feeds whatever the office already runs.',
    toolsDescription:
      'Billing runs through QuickBooks and the operational side is whatever the office already built. The site feeds both rather than asking dispatch to learn a third screen.',
    workTitle: 'Two on the water now.',
    workDescription: 'Dickinson Bayou Fleeting and Hollingshead Harbor both run sites built here.',
    townsDescription:
      'The channel runs from Houston down to Galveston Bay and the work sits on both banks of it.',
    ctaDescription:
      'Tell me what you push and where you fleet. A plan and a price come back in writing, and most sites are live in two to four weeks.',
  },

  printing: {
    metaDescription:
      'Print shop websites for Baytown and Houston. Quantity breaks on the page, artwork uploaded with the quote request, and proofs approved on a link.',
    heroTitle: 'Print shop sites that take the artwork with the quote.',
    heroDescription:
      'A quote request without the file is two more emails before anybody can price it. One pass should collect the artwork, the quantity, and the deadline.',
    needsTitle: 'The estimate is the sale.',
    needsDescription:
      'Whoever quotes first usually prints it. Everything on the page is aimed at getting a real number out the same day.',
    buildTitle: 'Front counter, on the web.',
    buildDescription:
      'The parts of a print job that cost the most time are quoting, proofing, and telling people where their order is.',
    build: [
      {
        title: 'Quantity Breaks on the Page',
        body: 'Twenty-four, seventy-two, and a hundred and forty-four priced where a customer can see the break, instead of a button that says request a quote.',
      },
      {
        title: 'Artwork Uploaded With the Request',
        body: 'Vector and raster files, at the sizes you can print from, arriving attached to the job rather than in a mailbox.',
      },
      {
        title: 'Proofs Approved on a Link',
        body: 'The customer sees the proof, approves it or marks it up, and the shop gets a timestamp. No phone tag over a PDF.',
      },
    ],
    toolsTitle: 'Jobs land in production.',
    toolsDescription:
      'Quoting, proofing, and the production board stay in Printavo or ShopVOX. The site fills them from the front, so a job is on the board before anyone has typed it in.',
    workTitle: 'Live in this trade.',
    workDescription:
      'Impressiva Printing in Pasadena runs a quoting and order portal built here, from a hundred business cards to a ten-foot vinyl banner.',
    townsDescription:
      'Shop orders come from contractors, schools, and teams right across the east side, and a team orders from the shop in its own town.',
    ctaDescription:
      'Tell me what you print and how orders reach you now. You get a written plan and price before anything is built, and most sites are live inside a month.',
  },

  'barber-shop': {
    metaDescription:
      'Barber shop websites for Baytown and Houston. A chair booked at any hour, the cut list with prices, walk-in days stated, and real photographs of the fades.',
    heroTitle: 'Barber shop sites that fill the chair.',
    heroDescription:
      'A cut gets booked at eleven at night from a sofa. A site that cannot take that booking hands it to the shop down the road whose app can.',
    needsTitle: 'Booked before you open.',
    needsDescription:
      'Most of tomorrow is decided tonight. The chair, the price, and the walk-in question all have to be answered while the shop is shut.',
    buildTitle: 'What fills a barber shop.',
    buildDescription:
      'Regulars come back for a person and a price. Both belong on the page rather than in a phone call.',
    build: [
      {
        title: 'Booked by Barber',
        body: 'Regulars book their own chair rather than the next free slot, because that is the whole reason they keep coming back.',
      },
      {
        title: 'The Cut List and What It Costs',
        body: 'Skin fade, taper, beard line-up, and the kids’ cut, each with a price and how long it holds the chair.',
      },
      {
        title: 'Walk-In Hours Stated',
        body: 'Which days take walk-ins and roughly how long the wait runs, which is the question the shop answers forty times a week.',
      },
    ],
    toolsTitle: 'The book stays where it is.',
    toolsDescription:
      'Booksy, Square Appointments, or Vagaro keeps the calendar. The site sends people into it rather than asking a shop to move its book, so regulars keep the app they already have.',
    workTitle: 'Live in the chair.',
    workDescription:
      'Faded Barber Shop in Liberty runs a booking site built here, with the walk-in day stated on the page instead of answered on the phone.',
    townsDescription: 'A shop draws from a few miles, so the page has to say the town out loud.',
    ctaDescription:
      'Tell me how many chairs you run and which app you book on. A reply comes back within the hour, and you agree to the price before I start.',
  },

  'hair-salon': {
    metaDescription:
      'Hair salon websites for Baytown and Houston. Booking by stylist, color pricing in one list, deposits on long appointments, and a gallery of real work.',
    heroTitle: 'Salon sites that book the stylist, not the slot.',
    heroDescription:
      'Color is bought on trust in one pair of hands. A page showing the work leaving that chair, and taking a deposit against four hours of it, is doing the selling.',
    needsTitle: 'The chair is the brand.',
    needsDescription:
      'Clients follow a stylist rather than an address. A salon site that hides who does what is competing on price instead.',
    buildTitle: 'What a salon site carries.',
    buildDescription:
      'Long appointments are the profitable ones and the easiest to lose, so they get the most attention here.',
    build: [
      {
        title: 'A Page per Stylist',
        body: 'Photographs, what they specialize in, and their own booking link, so a client can follow the person who did their last color.',
      },
      {
        title: 'Color Priced by Service',
        body: 'Root touch-up, full highlight, balayage, and correction, each with a range and the time it holds the chair for.',
      },
      {
        title: 'Deposits on Long Appointments',
        body: 'A card taken when a five-hour correction is booked, which is what keeps a no-show from costing a day of color.',
      },
    ],
    toolsTitle: 'Fills the book you already keep.',
    toolsDescription:
      'Vagaro, Fresha, or Square Appointments holds the calendar and the deposits. The site fills it and leaves it where it is, so a client books the stylist they follow without the salon moving its book.',
    workTitle: 'Booking live now.',
    workDescription:
      'Faded Barber Shop in Liberty runs a booking site built here. It books a barber chair rather than a salon chair, on the same flow.',
    townsDescription:
      'Color clients drive further than a haircut does, so the page has to reach past the town it sits in.',
    ctaDescription:
      'Tell me how many chairs you rent out and who books their own. The plan and the price come back in writing, and most sites are live in two to four weeks.',
  },

  fitness: {
    metaDescription:
      'Training and gym websites for Baytown and Houston. A schedule that stays current, packages bought online, and waivers signed before the first session.',
    heroTitle: 'Fitness sites that sell the block, not the drop-in.',
    heroDescription:
      'An empty Tuesday afternoon is money that never comes back. The schedule, the packages, and the waiver all belong on the page rather than in a direct message.',
    needsTitle: 'Sold before the first session.',
    needsDescription:
      'A trainer with a full block booked and paid for has a business. One collecting inquiries has a hobby with good intentions.',
    buildTitle: 'What gets somebody on the schedule.',
    buildDescription:
      'Every step between deciding and turning up is a place somebody changes their mind, so there are as few of them as possible.',
    build: [
      {
        title: 'A Schedule That Is Current',
        body: 'Classes and open sessions read from the booking software, so a cancelled six o’clock is off the page the moment it is off the calendar.',
      },
      {
        title: 'Packages Bought on the Page',
        body: 'Ten-session blocks, monthly memberships, and the first-session rate, paid for before anybody turns up.',
      },
      {
        title: 'Waivers Signed at Booking',
        body: 'Intake and liability completed when the session is booked, which keeps the first hour about training.',
      },
    ],
    toolsTitle: 'The shop front for your booking app.',
    toolsDescription:
      'Mindbody, Trainerize, or Glofox runs the schedule and the billing. The site is the front of it rather than a second version of it, so nobody keeps two calendars.',
    workTitle: 'Booking now.',
    workDescription:
      'DeluxFit by Angie runs a personal training booking funnel built here, with memberships and coaching each priced on a page of its own and sold through a checkout.',
    townsDescription:
      'Clients drive ten minutes to a gym and no further than that, so a gym is found by the town it is in.',
    ctaDescription:
      'Tell me whether you run classes, one to one, or both. I reply within the hour, the price is fixed before any work, and most sites are live inside a month.',
  },

  dentist: {
    metaDescription:
      'Dental websites for Baytown and Houston. Insurance plans listed by name, new patient forms finished before the visit, and emergencies on their own page.',
    heroTitle: 'Dental sites that finish the paperwork first.',
    heroDescription:
      'A new patient is deciding two things: whether you take their insurance, and whether they can book without calling at lunchtime. Everything else on the page is decoration.',
    needsTitle: 'What the front desk repeats all day.',
    needsDescription:
      'Which plans are in network, what a new patient visit involves, and what to do about a tooth at nine at night. Written once, they stop being phone calls.',
    buildTitle: 'The pages a practice needs.',
    buildDescription:
      'Built to shorten the first visit and take the repeat questions off the desk.',
    build: [
      {
        title: 'Insurance Listed by Name',
        body: 'The plans you take, written out, and what in network means for the visit. The alternative is somebody answering it forty times a day.',
      },
      {
        title: 'Forms Done Before the Chair',
        body: 'Medical history, consent, and insurance details completed online, so a first appointment starts on time.',
      },
      {
        title: 'Emergencies on Their Own Page',
        body: 'A knocked-out tooth at nine at night needs an instruction and a number, not a contact form and a reply on Monday.',
      },
    ],
    toolsTitle: 'Books into practice management.',
    toolsDescription:
      'Dentrix, Open Dental, and Weave hold the schedule and the recall list. The site books into them and leaves the practice management alone, so an online booking shows up where the hygienist already looks.',
    workTitle: 'Sites running.',
    workDescription:
      'No dental practice has hired me yet. The sites below are the nearest work in shape: booking, hours, and a form that reaches somebody.',
    townsDescription:
      'A practice draws from the towns it sits between rather than the one it is in.',
    ctaDescription:
      'Tell me which plans you take and how many chairs you run. A written plan and price come back before anything is built, and most sites are live in two to four weeks.',
  },

  chiropractor: {
    metaDescription:
      'Chiropractic websites for Baytown and Houston. A page per condition, intake finished online, a consultation booked directly, and cash pricing stated.',
    heroTitle: 'Chiropractic sites written for the condition.',
    heroDescription:
      'Nobody searches for an adjustment. They search for lower back pain after a wreck, and the page that explains it in those words is the one that gets called.',
    needsTitle: 'Found by symptom.',
    needsDescription:
      'A practice page listing techniques ranks for nothing. A page about sciatica, written the way a patient describes it, ranks and converts.',
    buildTitle: 'What a chiropractic site needs.',
    buildDescription:
      'Explain the condition, take the intake, and be plain about what it costs. In that order.',
    build: [
      {
        title: 'A Page per Condition',
        body: 'Sciatica, disc pain, whiplash, and headaches, each written in a patient’s own words, with what a course of care looks like.',
      },
      {
        title: 'Intake Finished Online',
        body: 'History, symptoms, and consent completed before the visit, which turns a first appointment into an examination instead of a clipboard.',
      },
      {
        title: 'Cash and Insurance Both Stated',
        body: 'What a visit costs without insurance and what a plan covers, said plainly, because a good share of this market pays out of pocket.',
      },
    ],
    toolsTitle: 'One schedule, not two.',
    toolsDescription:
      'ChiroTouch or Jane holds the notes and the calendar. The site books into it rather than starting a second list somebody has to reconcile.',
    workTitle: 'Live client work.',
    workDescription:
      'No clinic has hired me yet. The sites below are the closest in shape, each one a booking site built and hosted from Baytown.',
    townsDescription: 'Injury work follows the freeways, and the towns beside them see most of it.',
    ctaDescription:
      'Tell me what you treat most and whether you bill insurance. You get a reply within the hour and a price in writing before any work starts.',
  },

  'law-firm': {
    metaDescription:
      'Law firm websites for Baytown and Houston. A page per practice area, consultations screened at the form, and a private route in for the case detail.',
    heroTitle: 'Law firm sites that carry the credential.',
    heroDescription:
      'A visitor is deciding whether to hand you the worst month of their life. Admission, years, outcomes, and a private way to write are what settle it.',
    needsTitle: 'Credibility, then contact.',
    needsDescription:
      'Nobody fills in a form on a law firm site until they believe the firm. The order of the page has to follow that.',
    buildTitle: 'The pages a firm needs.',
    buildDescription:
      'Split by practice area, screened at intake, and built so a case detail never travels through an ordinary mailbox.',
    build: [
      {
        title: 'One Page per Practice Area',
        body: 'Personal injury, family, criminal, and estate planning each written on their own, because a firm that does everything on one page ranks for none of it.',
      },
      {
        title: 'Consultations Screened at the Form',
        body: 'Matter type, opposing party, and dates collected up front, so the conflict check happens before the intake call rather than after it.',
      },
      {
        title: 'A Private Route In',
        body: 'A contact path that keeps case detail out of an ordinary inbox, with the no-relationship notice sitting where it belongs.',
      },
    ],
    toolsTitle: 'Intake, already filled in.',
    toolsDescription:
      'Clio, MyCase, or Smokeball holds the matters. An inquiry arrives as an intake record with the conflict fields already completed, so nobody at the desk retypes a stranger’s case.',
    workTitle: 'Client sites live.',
    workDescription:
      'No law firm has hired me yet. The sites below are the nearest in shape, each one built and hosted from Baytown.',
    townsDescription: 'County lines decide where a case is filed, and clients search that way too.',
    ctaDescription:
      'Tell me which practice areas you want more of. The plan and the price come back in writing, nothing starts until you approve them, and most sites are live inside a month.',
  },

  accounting: {
    metaDescription:
      'Accounting websites for Baytown and Houston. Tax, books, and payroll priced apart, documents uploaded rather than emailed, and deadlines in one place.',
    heroTitle: 'Accounting sites that stop the January phone calls.',
    heroDescription:
      'From the middle of January the same four questions arrive every hour. Written down once, they stop being interruptions and start being clients.',
    needsTitle: 'Three services, three conversations.',
    needsDescription:
      'A tax return, monthly books, and payroll are bought by people in very different moods. One page cannot hold all three.',
    buildTitle: 'What a practice site handles.',
    buildDescription:
      'Priced apart, documents collected safely, and the calendar stated so nobody has to call to ask when something is due.',
    build: [
      {
        title: 'Three Services, Three Prices',
        body: 'Tax preparation, monthly bookkeeping, and payroll priced apart, so a business owner knows which conversation they are starting.',
      },
      {
        title: 'Documents Uploaded, Not Emailed',
        body: 'W-2s, 1099s, and statements sent through a secure upload rather than as attachments to a personal address.',
      },
      {
        title: 'The Calendar and the Checklist',
        body: 'Filing dates, extension deadlines, and what to bring for each service, on one page that is right every year.',
      },
    ],
    toolsTitle: 'Documents land in the ledger.',
    toolsDescription:
      'QuickBooks, Xero, and TaxDome hold the books and the client files. The site collects documents straight into them, so a W-2 never sits in an inbox waiting to be filed.',
    workTitle: 'Live in this trade.',
    workDescription:
      'Delux Financial Solutions in Houston runs a site built here, four services compared side by side and every page in English and Spanish.',
    townsDescription:
      'Small business clients stay close to their accountant and refer inside a town.',
    ctaDescription:
      'Tell me the mix of tax, bookkeeping, and payroll you want more of. A reply comes within the hour, and the price is agreed before the first page is built.',
  },

  'real-estate': {
    metaDescription:
      'Real estate agent websites for Baytown and Houston. IDX and MLS search on your own domain, saved homes and searches, and neighborhood pages built to rank.',
    heroTitle: 'Real estate sites that keep the search on your domain.',
    heroDescription:
      'Every hour a buyer spends on a national portal is an hour spent generating somebody else’s leads. A search that works is the only reason they stay on yours.',
    needsTitle: 'The search is the site.',
    needsDescription:
      'Everything else on an agent site exists to get somebody into the listings and to keep them coming back to look again.',
    buildTitle: 'What an agent site has to do.',
    buildDescription:
      'Search, save, and be found for the area. Those three carry the whole of the lead flow.',
    build: [
      {
        title: 'IDX Search That Is Fast',
        body: 'Live MLS listings searched by area, price, and beds, on a map that loads on a phone sitting in a driveway.',
      },
      {
        title: 'Saved Homes and Saved Searches',
        body: 'A buyer keeps a shortlist and hears when something matching lands, which is most of the follow-up done for you.',
      },
      {
        title: 'Neighborhood Pages Built to Rank',
        body: 'Schools, subdivisions, and what has sold, written per area, because that is the search a buyer starts with.',
      },
    ],
    toolsTitle: 'Straight into the CRM.',
    toolsDescription:
      'The IDX feed and Follow Up Boss do the work. An inquiry arrives in the CRM within seconds, with the listing it came from attached, so the call back goes out while the buyer is still looking.',
    workTitle: 'Searching live now.',
    workDescription:
      'Dylan Jordan Real Estate in Dayton runs a listing search built here, grouped by town rather than by a radius on a map, with a shortlist a buyer can set side by side.',
    townsDescription:
      'Buyers search by subdivision and school zone long before they search by agent.',
    ctaDescription:
      'Tell me your board, your MLS, and the areas you farm. A written plan and price come first, and most sites are live in two to four weeks.',
  },

  restaurant: {
    metaDescription:
      'Restaurant websites for Baytown and Houston. A menu built as a page rather than a PDF, ordering links that land right, and a table held without a call.',
    heroTitle: 'Restaurant sites where the menu is not a PDF.',
    heroDescription:
      'A menu that opens as a document and has to be pinched to read costs a table every time. It should be a page, current tonight, that loads before the light changes.',
    needsTitle: 'Decided in the parking lot.',
    needsDescription:
      'Somebody is looking at the menu, the hours, and whether they can get a table, on a phone, with about twenty seconds of patience.',
    buildTitle: 'The four things a diner needs.',
    buildDescription:
      'Menu, hours, ordering, and a table. Everything else on a restaurant site is a photograph.',
    build: [
      {
        title: 'A Menu Built as a Page',
        body: 'Sections, prices, and what is off tonight, edited from a phone in the office rather than redrawn and exported every time the fish changes.',
      },
      {
        title: 'Ordering Links Straight Through',
        body: 'Toast, DoorDash, and Uber Eats each landing on the right menu instead of on a homepage the customer has to search all over again.',
      },
      {
        title: 'Hours, Holidays, and Last Call',
        body: 'Kitchen close, bar close, and the days you shut, matching what Google shows, because the two disagreeing is what puts somebody at a locked door.',
      },
    ],
    toolsTitle: 'Points at the register and the book.',
    toolsDescription:
      'Toast, Clover, or Square runs the tickets and OpenTable holds the book. The site points at all of them without asking the kitchen to change a thing.',
    workTitle: 'Live around the bay.',
    workDescription:
      'Businesses in Baytown and the towns around it, on sites built and hosted here.',
    townsDescription:
      'A dining room fills from the streets around it and from whoever is driving past at six.',
    ctaDescription:
      'Tell me whether you do delivery, reservations, or both. I reply within the hour, and you see the plan and the price before any work starts.',
  },
}

/**
 * @param {string} slug An industry slug from `@data/towns-and-trades/industries`.
 * @returns {object | null} The page copy for it, or null for a slug with none.
 */
export function industryCopyFor(slug) {
  return DETAIL[slug] || null
}

export const INDUSTRY_DETAIL = DETAIL
