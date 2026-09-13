import { BRAND_STATES, FEELINGS, PHOTO_STATES, VOICE_STEPS } from '../../start/lib/look.js'

/**
 * The questions a client answers before their site is drawn, and the whole of
 * the arithmetic over them.
 *
 * This is one file for the same reason `sections.js` is one file: the steps,
 * the fields, the seeds, the percent and the prefill are all readings of the
 * same list, and a list written out once per reader is a list that drifts. The
 * trail across the top of the flow, the bar on the tracker, the review screen,
 * the check script and the database function that refuses an incomplete
 * submission are five readers of what is written here, and every one of them
 * has to agree about what "answered" means or a client reads a hundred percent
 * over a control that will not fire.
 *
 * Nothing in here draws anything and nothing in here talks to anything. It is
 * plain data and pure functions, imported by the app through the bundler and by
 * a check script under bare node, so it holds no JSX, no browser globals, and
 * no import that reaches a component. `look.js` is the one module it pulls in,
 * because that is where the four questions the pay form already asked are
 * defined and their ids have to be the same ids on both sides of the payment.
 *
 * TWO RULES EVERYTHING BELOW OBEYS.
 *
 * The first is that nothing the paid brief already carries is asked a second
 * time. It is prefilled and shown as an answer the client may change. A step
 * that asked how the site should feel again would be asking somebody to repeat
 * themselves twenty minutes after they paid, and the answer the second time
 * would be shorter and worse.
 *
 * The second is that the brief holds display names rather than ids. 'Business
 * Type' holds "Plumbing", not `plumbing`; 'Tools in Use' holds "ServiceTitan,
 * Jobber", not `serviceTitan`. Every prefill therefore resolves a name back to
 * an id against the same list the name was written from, and a name that
 * resolves to nothing prefills nothing rather than guessing. A brief row that
 * is missing entirely - which is every project opened before the brief existed,
 * and every checkout whose brief write failed - prefills nothing and the field
 * is simply blank.
 *
 * The order of the steps is the order the owner asked for, and the ideas step
 * being second is the whole of the reason. A client is still warm from paying,
 * and what somebody says about their own business in the ten minutes after a
 * card clears is better than what they say in a follow-up email three days
 * later. Everything after it descends from what only they know toward what a
 * form can mostly fill in for them.
 */

/**
 * The nine rows the pay form writes into `project_briefs.answers`.
 *
 * Named here rather than typed into each prefill, because the label is the
 * join: `lookSummary` and the configurator write these exact strings and this
 * file matches on them. A row renamed on one side and not the other is a
 * prefill that silently stops filling, which reads as a client who answered
 * nothing rather than as a bug.
 */
export const BRIEF_LABELS = {
  trade: 'Business Type',
  designs: 'Designs You Like',
  feel: 'How It Should Feel',
  brand: 'Logo and Colors',
  photos: 'Photographs',
  voice: 'How It Reads',
  references: 'Sites to Look At',
  tools: 'Tools in Use',
  provider: 'Business Email',
}

/**
 * The brief rows that are read back on the review screen and never edited.
 *
 * Three of the nine rows have no field to fill. The designs somebody took off
 * the wall, the mailbox their business email runs on, and the software in the
 * 'Tools in Use' row that is not a payment processor are all context the person
 * building the site wants and the client has already given. Showing them as
 * read-only rows is how they get used without being asked twice.
 */
export const CONTEXT_LABELS = [BRIEF_LABELS.designs, BRIEF_LABELS.tools, BRIEF_LABELS.provider]

/**
 * The three answers the configurator writes when a question was left alone.
 *
 * They are sentences rather than empty strings, because the inquiry message
 * they were written for reads better saying a question is open than leaving a
 * gap. Read as a prefill they mean nothing was chosen, so they resolve to
 * nothing by definition and never reach a field.
 */
const SENTINELS = new Set(['not chosen', 'none given', 'none checked'])

/** The shortest written answer a builder can build from. */
const LONGTEXT_FLOOR = 40

/**
 * The shape an address has to take, matching the one `api/checkout.js` uses on
 * the buyer's own address. An address good enough to take money with is good
 * enough to put on the site, and two different rules would mean a client whose
 * receipt arrived being told their address is not an address.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** The seven rows the hours field always holds, in the order a week runs. */
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * Monday to Friday, eight to five, closed at the weekend.
 *
 * Seeded rather than left blank because most of the trades on the list keep
 * those hours, and correcting two rows is faster than filling in fourteen
 * fields. A seed counts as answered, which is the point: a client whose hours
 * are already right should not have to press anything to say so.
 */
const HOURS_SEED = DAYS.map(day => {
  const weekend = day === 'sat' || day === 'sun'
  return { day, closed: weekend, open: weekend ? null : '08:00', close: weekend ? null : '17:00' }
})

/**
 * How somebody takes money, which is not the same list as the software they
 * run. The first three carry the names the configurator's tool list writes, so
 * the 'Tools in Use' row resolves against this list directly and everything in
 * it that is software rather than money resolves to nothing and is dropped.
 */
const PAYMENTS = [
  { id: 'stripe', name: 'Stripe' },
  { id: 'square', name: 'Square' },
  { id: 'paypal', name: 'PayPal' },
  { id: 'cash', name: 'Cash' },
  { id: 'check', name: 'Check' },
  { id: 'card_terminal', name: 'Card terminal' },
  { id: 'invoice', name: 'Invoice' },
  { id: 'financing', name: 'Financing' },
]

const TEXT_OK = [
  { id: 'yes', name: 'Yes' },
  { id: 'no', name: 'No' },
  { id: 'not_sure', name: 'Not sure' },
]

const SOCIAL_NETWORKS = [
  { id: 'facebook', name: 'Facebook' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'x', name: 'X' },
  { id: 'nextdoor', name: 'Nextdoor' },
  { id: 'yelp', name: 'Yelp' },
  { id: 'other', name: 'Somewhere else' },
]

/**
 * Where a web address might be registered.
 *
 * The last two are the answers that are actually true most often, and leaving
 * them off would push a client into guessing at one of the named ones. Nothing
 * here asks for a login and the field says so, because the one thing this whole
 * flow must never grow is a box that takes the password to somebody's domain.
 */
const REGISTRARS = [
  { id: 'godaddy', name: 'GoDaddy' },
  { id: 'namecheap', name: 'Namecheap' },
  { id: 'squarespace', name: 'Squarespace' },
  { id: 'network_solutions', name: 'Network Solutions' },
  { id: 'wix', name: 'Wix' },
  { id: 'bluehost', name: 'Bluehost' },
  { id: 'hover', name: 'Hover' },
  { id: 'elsewhere', name: 'Somewhere else' },
  { id: 'dont_know', name: 'I do not know' },
  { id: 'dont_have', name: 'I do not have one' },
]

const REACH_BY = [
  { id: 'word_of_mouth', name: 'Word of mouth' },
  { id: 'google_search', name: 'Google search' },
  { id: 'google_maps', name: 'Google Maps' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'truck_or_sign', name: 'The truck or the sign' },
  { id: 'directory', name: 'A directory listing' },
  { id: 'trade_referral', name: 'Another trade sending work over' },
  { id: 'repeat', name: 'Customers coming back' },
  { id: 'ads', name: 'Ads we pay for' },
]

const JOB_WORTH = [
  { id: 'under_100', name: 'Under $100' },
  { id: '100_500', name: '$100 to $500' },
  { id: '500_2500', name: '$500 to $2,500' },
  { id: '2500_10000', name: '$2,500 to $10,000' },
  { id: 'over_10000', name: 'Over $10,000' },
  { id: 'varies', name: 'It varies too much to say' },
]

const DECISION = [
  { id: 'calls', name: 'Calls' },
  { id: 'texts', name: 'Texts' },
  { id: 'books_online', name: 'Books online' },
  { id: 'fills_a_form', name: 'Fills in a form' },
  { id: 'walks_in', name: 'Walks in' },
  { id: 'messages_on_social', name: 'Messages on social' },
]

/**
 * The steps, in order, and every field on each of them.
 *
 * A field carries six things the flow always needs and a few more that only
 * some kinds have:
 *
 * - `key`       Where the answer lives in the stored object, as `step.field`.
 *               Two segments, always, so one splitter reads every path.
 * - `kind`      What the answer is, which decides both the control drawn and
 *               the rule in `answeredField`. The two are the same question.
 * - `label`     What the field is called, in Title Case, as a label is.
 * - `help`      The sentence under the label, in sentence case, as prose is.
 *               Null where the label is the whole question and a helper would
 *               be a sentence restating it.
 * - `required`  Whether the percent counts it. Only required fields carry
 *               weight, which is the only arrangement under which a hundred
 *               means what it says.
 * - `fill`      Where a prefill comes from, or null. A source key rather than a
 *               function, so `prefill` is driven off this list rather than off
 *               a second hand-written one beside it.
 *
 * `weight` is the step's share of the hundred. Welcome and review carry zero
 * because neither holds an answer, and a bar that moved for pressing Continue
 * on a page of prose would be a bar measuring the wrong thing.
 *
 * Each step is meant to fit one screen with the console rail standing, so where
 * a step runs to more than five fields they are short controls and prefilled
 * ones rather than five more boxes to write in.
 */
export const STEPS = [
  {
    id: 'welcome',
    label: 'Welcome',
    eyebrow: 'Getting Started',
    title: 'Everything the build needs, in about ten minutes.',
    description:
      'Some of this is already filled in from what you picked before you paid. Change anything that is wrong and answer what is blank.',
    weight: 0,
    fields: [],
  },
  {
    id: 'ideas',
    label: 'Your Ideas',
    eyebrow: 'In Your Words',
    title: 'Tell us about the business in your own words.',
    description:
      'This is the part nobody else can write. There are tools beside every box to help you say it, and none of it has to be polished.',
    weight: 20,
    // Nothing on this step is prefilled and nothing on it ever will be.
    // Prefilling a client's own words with a machine's guess is how a build
    // ends up describing a business nobody recognizes, and the guess is the
    // hardest thing in the world to depart from once it is sitting in the box.
    fields: [
      {
        key: 'ideas.in_words',
        kind: 'longtext',
        label: 'What You Do',
        help: null,
        placeholder: 'Say it the way you would say it to somebody standing at the counter.',
        required: true,
        fill: null,
        assist: true,
      },
      {
        key: 'ideas.edge',
        kind: 'longtext',
        label: 'Why People Pick You',
        help: 'The reason a customer calls you and not the shop down the road. One real reason beats three general ones.',
        required: true,
        fill: null,
        assist: true,
      },
      {
        key: 'ideas.must_have',
        kind: 'longtext',
        label: 'What the Site Has to Do',
        help: 'The one thing that has to be on it. A phone number that never scrolls away, the price list, a photograph of the crew.',
        required: true,
        fill: null,
        assist: true,
      },
      {
        key: 'ideas.avoid',
        kind: 'longtext',
        label: 'What to Leave Off',
        help: 'Anything you do not want on the site, or anything a competitor does that you would rather not copy.',
        required: false,
        fill: null,
        assist: true,
      },
    ],
  },
  {
    id: 'brand',
    label: 'Your Brand',
    eyebrow: 'The Look',
    title: 'Your name, your colors, and how it should read.',
    description:
      'The look answers you gave before you paid are already here. Confirm them, add what you have, and move on.',
    weight: 16,
    fields: [
      {
        key: 'brand.name_as_written',
        kind: 'text',
        label: 'Business Name',
        help: 'Capitals, punctuation and any LLC exactly as you want it read.',
        required: true,
        fill: 'project.business_name',
      },
      {
        key: 'brand.tagline',
        kind: 'text',
        label: 'One Line Under the Name',
        help: null,
        placeholder: 'Eight words that say what you do and where.',
        required: true,
        fill: null,
        assist: true,
      },
      {
        key: 'brand.feel',
        kind: 'multichoice',
        label: 'How It Should Feel',
        help: null,
        required: true,
        max: 3,
        options: FEELINGS,
        fill: `brief.${BRIEF_LABELS.feel}`,
      },
      {
        key: 'brand.voice',
        kind: 'choice',
        label: 'How It Reads',
        help: null,
        required: true,
        options: VOICE_STEPS,
        fill: `brief.${BRIEF_LABELS.voice}`,
      },
      {
        key: 'brand.photos_state',
        kind: 'choice',
        label: 'Photographs',
        help: null,
        required: true,
        options: PHOTO_STATES,
        fill: `brief.${BRIEF_LABELS.photos}`,
      },
      {
        key: 'brand.logo_files',
        kind: 'files',
        label: 'Your Logo',
        help: 'PNG, JPG, WEBP or PDF, up to 25MB each. The original file beats a screenshot of it every time.',
        required: true,
        fill: null,
        // Taken away only from somebody who said they have nothing to pick. A
        // client who told the pay form they have no logo yet is not shown a
        // picker for a file they already said does not exist, and the field is
        // then in neither half of the percent fraction. Silence is not that
        // answer: a project opened without a brief, or one whose brand row
        // resolved to nothing, is still asked, because not knowing whether
        // somebody has a logo is a reason to ask rather than a reason to skip.
        applies: answers => readPath(answers, 'brand.logo_state') !== 'nothing',
      },
      {
        key: 'brand.colors',
        kind: 'chips',
        label: 'Your Colors',
        help: null,
        placeholder: 'A hex code, a Pantone number, or the green on the truck.',
        required: false,
        fill: null,
      },
      {
        key: 'brand.references',
        kind: 'longtext',
        label: 'Sites to Look At',
        help: 'Sites you like, and what you like about each one.',
        required: false,
        fill: `brief.${BRIEF_LABELS.references}`,
      },
    ],
  },
  {
    id: 'business',
    label: 'Business Details',
    eyebrow: 'The Business',
    title: 'Where you are, when you are open, and who you cover.',
    description:
      'This is what goes on the contact page, in the map listing, and in the code that puts you in local search.',
    weight: 18,
    fields: [
      {
        key: 'business.address',
        kind: 'address',
        label: 'Address',
        help: 'The address customers use. If nobody visits you, say so and the site works off your service area instead.',
        required: true,
        fill: null,
      },
      {
        key: 'business.service_area',
        kind: 'chips',
        label: 'Towns You Cover',
        help: null,
        placeholder: 'Type a town and press enter.',
        required: true,
        fill: null,
      },
      {
        key: 'business.hours',
        kind: 'list',
        label: 'Hours',
        help: null,
        required: true,
        // The one list with a fixed length. `days` both seeds it and marks it,
        // because seven rows that are always there are a different question
        // from a list somebody adds rows to, and the answered rule below
        // branches on it rather than on the field's key.
        days: DAYS,
        columns: ['day', 'closed', 'open', 'close'],
        seed: HOURS_SEED,
        fill: 'seed',
      },
      {
        key: 'business.hours_note',
        kind: 'text',
        label: 'Anything Else About Hours',
        help: null,
        placeholder: 'Emergency calls answered any hour.',
        required: false,
        fill: null,
      },
      {
        key: 'business.founded',
        kind: 'text',
        label: 'Year You Started',
        help: null,
        placeholder: '2014',
        required: false,
        fill: null,
      },
      {
        key: 'business.licenses',
        kind: 'chips',
        label: 'Licenses and Certifications',
        help: 'License numbers, certifications and insurance you want shown on the site.',
        required: false,
        fill: null,
      },
      {
        key: 'business.payments_taken',
        kind: 'multichoice',
        label: 'How You Take Money',
        help: null,
        required: false,
        options: PAYMENTS,
        // The 'Tools in Use' row is mostly software, and software is not money.
        // Resolving the whole row against the payment options is what separates
        // the two: Stripe, Square and PayPal are in both lists and land here,
        // ServiceTitan and Jobber are in neither and land nowhere, and the
        // review screen shows the row back whole so nothing is lost.
        fill: `brief.${BRIEF_LABELS.tools}`,
      },
    ],
  },
  {
    id: 'contacts',
    label: 'How to Reach You',
    eyebrow: 'Contact',
    title: 'The number that gets answered and the inbox that gets read.',
    description:
      'One number and one address do most of the work. The rest is anything else you want linked.',
    weight: 14,
    fields: [
      {
        key: 'contacts.phone',
        kind: 'phone',
        label: 'Phone Number',
        help: 'The number that actually gets answered, not the one on the old business cards.',
        required: true,
        fill: null,
      },
      {
        key: 'contacts.text_ok',
        kind: 'choice',
        label: 'Texts to That Number',
        help: null,
        required: false,
        options: TEXT_OK,
        fill: null,
      },
      {
        key: 'contacts.email_public',
        kind: 'email',
        label: 'Email Shown on the Site',
        help: null,
        required: true,
        fill: 'project.email',
      },
      {
        key: 'contacts.lead_to',
        kind: 'email',
        label: 'Where Form Messages Land',
        help: 'Can be the same address.',
        required: true,
        fill: 'project.email',
      },
      {
        key: 'contacts.socials',
        kind: 'list',
        label: 'Social Profiles',
        help: null,
        required: false,
        columns: ['network', 'url'],
        networks: SOCIAL_NETWORKS,
        fill: null,
      },
      {
        key: 'contacts.google_profile',
        kind: 'url',
        label: 'Google Business Profile',
        help: 'Search your business on Google, open the panel on the right, and copy the link.',
        required: false,
        fill: null,
      },
      {
        key: 'contacts.current_site',
        kind: 'url',
        label: 'Your Website Today',
        help: 'If you have one. It is where the words and photographs we already have live.',
        required: false,
        // The website typed on the pay form travels to Stripe metadata and is
        // never written to a table this side can read, so there is nothing to
        // prefill from and this is a blank box rather than an oversight.
        fill: null,
      },
      {
        key: 'contacts.registrar',
        kind: 'choice',
        label: 'Where Your Web Address Is Registered',
        help: 'We never ask for the login. Pointing the address at the new site is a phone call near the end, and it takes five minutes.',
        required: false,
        options: REGISTRARS,
        fill: null,
      },
    ],
  },
  {
    id: 'pages',
    label: 'Your Pages',
    eyebrow: 'The Site',
    title: 'The pages your site is made of.',
    description:
      'The list starts with what a business like yours usually needs. Turn off what you do not want and add anything missing.',
    weight: 18,
    fields: [
      {
        key: 'pages.chosen',
        kind: 'multichoice',
        label: 'Pages',
        help: null,
        required: true,
        min: 3,
        // The options are the trade's own candidate set rather than a constant,
        // so they are resolved at draw time through `pagesForTrade` and the
        // field carries none. The seed alone clears the minimum, which is what
        // makes this field arrive answered.
        options: null,
        fill: 'trade',
      },
      {
        key: 'pages.extra',
        kind: 'list',
        label: 'Anything Missing',
        help: null,
        required: false,
        columns: ['title', 'note'],
        fill: null,
      },
      {
        key: 'pages.hero_page',
        kind: 'choice',
        label: 'The One That Matters Most',
        help: 'If somebody only ever opens one page, which should it be?',
        required: true,
        // Its options are whatever is currently on in `pages.chosen` plus the
        // rows in `pages.extra`, so there is no list to carry and none to check
        // against. Deliberately not prefilled either: the default answer is
        // always the home page, and a prefilled default would collect that
        // non-answer from everybody who ever fills this in.
        options: null,
        fill: null,
      },
      {
        key: 'pages.services',
        kind: 'list',
        label: 'What You Sell',
        help: 'Every job you want the phone to ring about. Prices only where you want them shown.',
        required: true,
        min: 1,
        // Price is free text so "from $1,200", "$95 an hour" and "by the job"
        // are all sayable. A number field here would refuse the way most of
        // these trades actually quote.
        columns: ['name', 'price', 'note'],
        fill: null,
      },
    ],
  },
  {
    id: 'customers',
    label: 'Your Customers',
    eyebrow: 'Who It Is For',
    title: 'Who the site has to convince.',
    description:
      'A few short answers here change more about the first draft than anything else on this form.',
    weight: 14,
    // Seven and no more, and the five required ones each change something a
    // builder does: who they are sets the register the copy is written in,
    // where they are sets the towns the local pages are built for, how they
    // find you sets whether the build leans on search or on a map listing, what
    // a job is worth sets whether a page argues or only books, and what they do
    // first sets the primary control on every screen. Nothing here asks age
    // brackets, income brackets or household size, because a shop owner does
    // not know them and a guess dressed as data is worse than a blank.
    fields: [
      {
        key: 'customers.who',
        kind: 'longtext',
        label: 'Your Best Customer',
        help: 'Describe the one you would take ten more of. What they own, what they are worried about, what they just found out is broken.',
        required: true,
        fill: null,
        assist: true,
      },
      {
        key: 'customers.where',
        kind: 'chips',
        label: 'Where They Are',
        help: 'Towns and neighborhoods you want the work from.',
        required: true,
        // Copied forward the first time this step is opened rather than when
        // the record is created, because at creation the field it copies from
        // is empty. Editing either afterwards leaves the other alone: where you
        // can work and where you want the work are two different lists, and a
        // business that knows the difference should be able to say so.
        fill: 'answers.business.service_area',
      },
      {
        key: 'customers.reach_by',
        kind: 'multichoice',
        label: 'How They Find You Today',
        help: 'Everything that is true, not just the biggest one.',
        required: true,
        options: REACH_BY,
        fill: null,
      },
      {
        key: 'customers.job_worth',
        kind: 'choice',
        label: 'What a Typical Job Is Worth',
        help: 'This decides whether a page has to sell or only has to book.',
        required: true,
        options: JOB_WORTH,
        fill: null,
      },
      {
        key: 'customers.decision',
        kind: 'choice',
        label: 'What They Do First',
        help: 'Whatever this is becomes the button on every screen of the site.',
        required: true,
        options: DECISION,
        fill: null,
      },
      {
        key: 'customers.not_for',
        kind: 'text',
        label: 'Work You Would Rather Not Get',
        help: 'A site that turns down the wrong call is worth as much as one that brings in the right one.',
        placeholder: 'Jobs under $200. Anything outside the county.',
        required: false,
        fill: null,
      },
      {
        key: 'customers.compete',
        kind: 'chips',
        label: 'Who You Lose Work To',
        help: 'Names or websites. We look at what they do and do it better.',
        required: false,
        fill: null,
      },
    ],
  },
  {
    id: 'review',
    label: 'Review',
    eyebrow: 'Review',
    title: 'Read it back and send it.',
    description:
      'Every answer is here in one list. Anything you change goes back into the same place, and nothing is locked after you send it.',
    weight: 0,
    fields: [],
  },
]

/**
 * Every page any trade can offer, and what it is called on the control.
 *
 * The names are sentence-shaped rather than clipped, because a client reads
 * this list as a description of their own site rather than as a menu. They are
 * Title Case, being labels beside a switch.
 */
const PAGE_LABELS = {
  home: 'Home',
  privacy: 'Privacy',
  terms: 'Terms',
  services: 'Services',
  about: 'About',
  contact: 'Contact',
  reviews: 'Reviews',
  gallery: 'Photo Gallery',
  service_areas: 'Service Areas',
  faq: 'Questions and Answers',
  pricing: 'Pricing',
  book: 'Booking',
  careers: 'Careers',
  blog: 'News',
  services_pricing: 'Services and Pricing',
  the_team: 'The Team',
  walk_ins: 'Walk-Ins',
  menu: 'Menu',
  order_delivery: 'Ordering and Delivery',
  reservations: 'Reservations',
  hours_holidays: 'Hours and Holidays',
  private_events: 'Private Events',
  emergency: 'Emergency Service',
  request_a_quote: 'Request a Quote',
  licenses_insurance: 'Licenses and Insurance',
  maintenance_plans: 'Maintenance Plans',
  financing: 'Financing',
  panel_rewire_generator: 'Panels, Rewiring and Generators',
  storm_insurance: 'Storm and Insurance Work',
  free_inspection: 'Free Inspection',
  materials_warranties: 'Materials and Warranties',
  before_after: 'Before and After',
  fence_styles: 'Fence Styles',
  pricing_by_the_foot: 'Pricing by the Foot',
  request_measurements: 'Request Measurements',
  driveways_slabs_patios: 'Driveways, Slabs and Patios',
  square_foot_pricing: 'Square-Foot Pricing',
  service_plans: 'Service Plans',
  design_install: 'Design and Install',
  service_map: 'Service Map',
  pay_online: 'Pay Online',
  plans_treatments: 'Plans and Treatments',
  pests_covered: 'Pests Covered',
  schedule_treatment: 'Schedule a Treatment',
  safety: 'Safety',
  services_fees: 'Services and Fees',
  book_a_bay: 'Book a Bay',
  fleet_accounts: 'Fleet Accounts',
  inspection_results: 'Inspection Results',
  call_now: 'Call Now',
  coverage_response: 'Coverage and Response Times',
  rates: 'Rates',
  storage_impound: 'Storage and Impound',
  new_patient_forms: 'New Patient Forms',
  insurance_accepted: 'Insurance Accepted',
  treatments: 'Treatments',
  dental_emergencies: 'Dental Emergencies',
  meet_the_dentist: 'Meet the Dentist',
  new_patient_intake: 'New Patient Intake',
  conditions_treated: 'Conditions Treated',
  book_consult: 'Book a Consultation',
  insurance_cash: 'Insurance and Cash Pricing',
  meet_the_doctor: 'Meet the Doctor',
  practice_areas: 'Practice Areas',
  case_results: 'Case Results',
  attorneys: 'Attorneys',
  free_consultation: 'Free Consultation',
  document_upload: 'Document Upload',
  deadlines: 'Deadlines',
  class_schedule: 'Class Schedule',
  memberships: 'Memberships',
  trainers: 'Trainers',
  results: 'Results',
  waivers: 'Waivers',
  listings: 'Listings',
  neighborhoods: 'Neighborhoods',
  buyers: 'For Buyers',
  sellers: 'For Sellers',
  home_valuation: 'Home Valuation',
  unit_sizes: 'Unit Sizes',
  rent_a_unit: 'Rent a Unit',
  access_rules: 'Access and Gate Hours',
  find_us: 'Find Us',
  products_pricing: 'Products and Pricing',
  upload_artwork: 'Upload Artwork',
  proof_approval: 'Proof Approval',
  order_status: 'Order Status',
  fleet_capability: 'Fleet and Capability',
  terminals: 'Terminals',
  dispatch: 'Dispatch',
  credentials_page: 'Credentials',
}

/**
 * The three pages built whatever anybody picks.
 *
 * Drawn greyed with the word Always beside them rather than left off the list,
 * because a client who cannot find a privacy page on the list assumes they are
 * not getting one. They carry no switch, since offering one offers a decision
 * that does not exist, and they are excluded from the minimum of three so the
 * minimum measures what somebody actually chose.
 */
export const FIXED_PAGES = ['home', 'privacy', 'terms']

/**
 * What every trade is offered, and what each starts as.
 *
 * The six that start on are the pages nearly every small business needs and
 * would have turned on anyway. The five that start off are the ones a business
 * either wants badly or not at all, and defaulting those on would put pages on
 * the list that nobody asked for and somebody has to write.
 */
const COMMON_PAGES = [
  { id: 'services', on: true },
  { id: 'about', on: true },
  { id: 'contact', on: true },
  { id: 'reviews', on: true },
  { id: 'gallery', on: true },
  { id: 'service_areas', on: true },
  { id: 'faq', on: false },
  { id: 'pricing', on: false },
  { id: 'book', on: false },
  { id: 'careers', on: false },
  { id: 'blog', on: false },
]

/**
 * What each trade adds to the common set, and which common pages it flips.
 *
 * `add` is this trade's own pages, in the order they are offered. `flip` moves
 * a common page's default where the trade makes it obvious: a restaurant wants
 * a gallery, a law firm does not, and neither of those is a decision worth
 * making a client take.
 *
 * Everything added starts on unless it says otherwise, because a client who
 * turns two off is doing less work than a client who turns four on, and the
 * page they never think to add is the page the site ends up without.
 *
 * Nothing is capped. A list that runs long is a conversation the studio has
 * with the client, and a form that refuses a ninth page teaches them to stop
 * typing.
 */
const TRADE_PAGES = {
  'barber-shop': {
    add: ['services_pricing', 'the_team', 'walk_ins'],
    flip: { book: true, gallery: true, faq: false },
  },
  'hair-salon': {
    add: ['services_pricing', 'the_team', 'walk_ins'],
    flip: { book: true, gallery: true, faq: false },
  },
  restaurant: {
    add: ['menu', 'order_delivery', 'reservations', 'hours_holidays', 'private_events'],
    off: ['private_events'],
    flip: { gallery: true, reviews: true },
  },
  plumbing: {
    add: ['emergency', 'request_a_quote', 'licenses_insurance'],
    flip: { service_areas: true, pricing: false },
  },
  hvac: {
    add: ['emergency', 'request_a_quote', 'licenses_insurance', 'maintenance_plans', 'financing'],
    flip: { service_areas: true, pricing: false },
  },
  electrical: {
    add: ['emergency', 'request_a_quote', 'licenses_insurance', 'panel_rewire_generator'],
    flip: { service_areas: true, pricing: false },
  },
  roofing: {
    add: ['storm_insurance', 'free_inspection', 'materials_warranties', 'before_after'],
    flip: { service_areas: true },
  },
  fencing: {
    add: ['fence_styles', 'pricing_by_the_foot', 'request_measurements'],
    flip: { gallery: true },
  },
  concrete: {
    add: ['driveways_slabs_patios', 'square_foot_pricing', 'request_a_quote'],
    flip: { gallery: true },
  },
  landscaping: {
    add: ['service_plans', 'design_install', 'service_map', 'pay_online'],
  },
  'pest-control': {
    add: ['plans_treatments', 'pests_covered', 'schedule_treatment', 'safety'],
  },
  'auto-repair': {
    add: ['services_fees', 'book_a_bay', 'fleet_accounts', 'inspection_results'],
    off: ['inspection_results'],
  },
  towing: {
    add: ['call_now', 'coverage_response', 'rates', 'storage_impound'],
    flip: { gallery: false },
  },
  dentist: {
    add: [
      'new_patient_forms',
      'insurance_accepted',
      'treatments',
      'dental_emergencies',
      'meet_the_dentist',
    ],
    flip: { gallery: false },
  },
  chiropractor: {
    add: [
      'new_patient_intake',
      'conditions_treated',
      'book_consult',
      'insurance_cash',
      'meet_the_doctor',
    ],
    flip: { gallery: false },
  },
  'law-firm': {
    add: ['practice_areas', 'case_results', 'attorneys', 'free_consultation'],
    flip: { gallery: false, reviews: true },
  },
  accounting: {
    add: ['services_pricing', 'document_upload', 'deadlines', 'book_consult'],
    flip: { gallery: false },
  },
  fitness: {
    add: ['class_schedule', 'memberships', 'trainers', 'results', 'waivers'],
  },
  'real-estate': {
    add: ['listings', 'neighborhoods', 'buyers', 'sellers', 'home_valuation'],
    flip: { gallery: false },
  },
  storage: {
    add: ['unit_sizes', 'rent_a_unit', 'access_rules', 'find_us'],
    flip: { gallery: false },
  },
  printing: {
    add: ['products_pricing', 'upload_artwork', 'proof_approval', 'order_status'],
  },
  'marine-services': {
    add: ['fleet_capability', 'terminals', 'dispatch', 'credentials_page'],
  },
  // No additions on purpose. A business that answered Something Else is one no
  // list can guess at, so it gets the common set and the free-text field
  // sitting directly under it.
  'something-else': { add: [] },
}

/**
 * The candidate pages for a trade: the three that are always built, then the
 * common set with this trade's flips applied, then the trade's own.
 *
 * @param {string|null} tradeId Slug from `TRADES`, or null.
 * @returns {Array<{id: string, label: string, on: boolean, fixed: boolean}>}
 */
export function pagesForTrade(tradeId) {
  const trade = TRADE_PAGES[tradeId] || { add: [] }
  const flip = trade.flip || {}
  const off = new Set(trade.off || [])
  const added = (trade.add || []).filter(id => !FIXED_PAGES.includes(id))

  const fixed = FIXED_PAGES.map(id => ({ id, label: PAGE_LABELS[id], on: true, fixed: true }))

  const common = COMMON_PAGES.filter(page => !added.includes(page.id)).map(page => ({
    id: page.id,
    label: PAGE_LABELS[page.id],
    on: page.id in flip ? flip[page.id] : page.on,
    fixed: false,
  }))

  // A trade that names a common page in `add` - a barber shop naming Booking -
  // is asking for it to start on rather than for a second row of the same page,
  // so it is taken out of the common block above and drawn here in the trade's
  // own order, which is where the client is looking for it.
  const own = added.map(id => ({
    id,
    label: PAGE_LABELS[id],
    on: !off.has(id),
    fixed: false,
  }))

  return [...fixed, ...common, ...own]
}

/** Where a step sits in the order, counting from one. Zero for a name nothing uses. */
export function stepRank(id) {
  return STEPS.findIndex(step => step.id === id) + 1
}

/**
 * Read one answer by its stored path.
 *
 * Every key is two segments, so this is a two-step walk rather than a general
 * path resolver, and a missing step object answers undefined instead of
 * throwing. That matters more than it looks: the first render of a brand new
 * record holds `{}`, and every field on every step asks this question of it.
 */
function readPath(answers, key) {
  const [group, name] = key.split('.')
  const held = answers?.[group]
  return held && typeof held === 'object' ? held[name] : undefined
}

/** Read one answer by its stored path. */
export function answerAt(answers, key) {
  return readPath(answers, key)
}

/**
 * The answers with one path written, as a new object.
 *
 * The path also leaves `untouched` here, and this is the only place it can. A
 * path in that list is one still holding exactly what was prefilled into it,
 * which is what separates an answer the client gave from an answer the system
 * guessed, and it is the difference between a builder trusting the feel chips
 * and a builder asking about them on the first call. Once it changes it is
 * theirs, and it never goes back on the list.
 */
export function withAnswer(answers, key, value) {
  const [group, name] = key.split('.')
  const held = answers || {}
  const untouched = Array.isArray(held.untouched) ? held.untouched.filter(path => path !== key) : []
  return {
    ...held,
    untouched,
    [group]: { ...(held[group] || {}), [name]: value },
  }
}

const text = value => (typeof value === 'string' ? value.trim() : '')

/**
 * The list a chooser draws, for the two fields whose list is not a constant.
 *
 * Both live on the pages step and both are made out of something else. The page
 * switches are the trade's own candidate set, minus the three that are always
 * built: a switch beside Home offers a decision that does not exist. The page
 * that matters most is picked out of the site the client has just described -
 * the home page, whatever is still switched on, and anything typed into the
 * missing-pages rows - rather than out of a catalogue, because a site cannot
 * lead with a page it is not getting.
 *
 * Every other field carries its own options and is handed them straight back,
 * so a caller can put every field through here without first asking which kind
 * it is. `answeredField` reads the same two fields without this, and it has to:
 * an answer is checked against a list only where the field carries one, and
 * these carry none.
 *
 * @param {object} field An entry from a step's `fields`.
 * @param {object} answers The stored answers.
 * @param {string|null} trade Slug from `TRADES`, or null.
 * @returns {Array<{id: string, name: string}>|null} The field's own list where
 *   it has one, and null where a field of a kind that takes no list asked.
 */
export function optionsFor(field, answers, trade = null) {
  if (field.options) return field.options

  if (field.key === 'pages.chosen') {
    return pagesForTrade(trade)
      .filter(page => !page.fixed)
      .map(page => ({ id: page.id, name: page.label }))
  }

  if (field.key === 'pages.hero_page') {
    const chosen = new Set(
      Array.isArray(readPath(answers, 'pages.chosen')) ? readPath(answers, 'pages.chosen') : []
    )
    const built = pagesForTrade(trade)
      .filter(page => page.id === 'home' || chosen.has(page.id))
      .map(page => ({ id: page.id, name: page.label }))
    const extra = (
      Array.isArray(readPath(answers, 'pages.extra')) ? readPath(answers, 'pages.extra') : []
    )
      .map(row => text(row?.title))
      .filter(Boolean)
      .map(title => ({ id: title, name: title }))
    return [...built, ...extra]
  }

  return field.options ?? null
}

const offers = (field, id) => (field.options || []).some(option => option.id === id)

/**
 * Whether one field counts as answered.
 *
 * Every threshold here is the same argument in a different shape: an answer
 * counts when a builder could act on it, and not before. That is why a
 * longtext needs forty characters where a text needs one - a single word is not
 * something a page can be written from, and the box says so before it refuses -
 * and why an address may be answered by saying there is no address, because a
 * tradesman working out of a truck is not an incomplete answer.
 *
 * A field is checked against its own list wherever it has one, so an id that is
 * no longer offered stops counting the moment the option is retired. The two
 * fields whose lists are made out of other answers carry no options, and for
 * those a value that is there at all is the whole of the test.
 *
 * @param {object} field An entry from a step's `fields`.
 * @param {unknown} value What is held at that field's path.
 * @returns {boolean}
 */
export function answeredField(field, value) {
  switch (field.kind) {
    case 'text':
      return text(value).length >= 1

    case 'longtext':
      return text(value).length >= LONGTEXT_FLOOR

    case 'choice':
      return field.options ? offers(field, value) : text(value).length >= 1

    case 'multichoice': {
      if (!Array.isArray(value) || !value.length) return false
      if (field.options && !value.every(id => offers(field, id))) return false
      return value.length >= (field.min || 1)
    }

    case 'chips':
      return Array.isArray(value) && value.length > 0 && value.every(chip => text(chip).length >= 1)

    case 'files':
      return Array.isArray(value) && value.length > 0

    case 'address': {
      if (!value || typeof value !== 'object') return false
      // The escape hatch counts as a complete answer on its own. Line two never
      // counts, because most addresses do not have one and requiring it would
      // hold a client at a field their own mail does not carry.
      if (value.none === true) return true
      return ['line1', 'city', 'state', 'postal'].every(part => text(value[part]).length >= 1)
    }

    case 'phone':
      return text(value).replace(/\D/g, '').length >= 10

    case 'email': {
      const held = text(value).toLowerCase()
      return held.length >= 5 && held.length <= 254 && EMAIL_SHAPE.test(held)
    }

    case 'url': {
      const held = text(value)
      if (!held) return false
      try {
        const parsed = new URL(held)
        return (
          (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
          parsed.hostname.includes('.')
        )
      } catch {
        return false
      }
    }

    case 'list': {
      if (!Array.isArray(value) || !value.length) return false
      // Hours are seven rows that are always there, so the question is not
      // whether somebody added a row but whether every day says something. A
      // day that is closed says enough by being closed; a day that is open has
      // to carry both ends of it, because one end is a time nobody can act on.
      if (field.days) {
        if (value.length !== field.days.length) return false
        return field.days.every(day => {
          const row = value.find(entry => entry?.day === day)
          if (!row) return false
          if (row.closed === true) return true
          return text(row.open).length >= 1 && text(row.close).length >= 1
        })
      }
      const first = (field.columns || [])[0]
      const filled = value.filter(row => text(row?.[first]).length >= 1)
      return filled.length >= (field.min || 1)
    }

    default:
      return false
  }
}

/**
 * Whether a field is in the running at all.
 *
 * A conditional field whose condition is false is in neither the numerator nor
 * the denominator, which is the only way a client who has no logo can reach a
 * hundred without being asked for one. It is not read back either, so the
 * review asks the same question the percent does, or it lists a logo picker at
 * a client who said they have no logo.
 */
export function applicable(field, answers) {
  return typeof field.applies === 'function' ? field.applies(answers) === true : true
}

/**
 * How much of one step is answered.
 *
 * `required` is the count of applicable required fields, not of fields. Optional
 * fields carry no weight at all, which is the only arrangement under which a
 * hundred means what it says: a client who answered everything asked of them
 * and skipped the three that said they could is finished, and a bar reading
 * eighty-two over a live submit control is a bar nobody believes again.
 *
 * @param {object} step An entry from `STEPS`.
 * @param {object} answers The stored answers.
 * @returns {{answered: number, required: number}}
 */
export function stepProgress(step, answers) {
  const wanted = step.fields.filter(field => field.required && applicable(field, answers))
  const answered = wanted.filter(field => answeredField(field, readPath(answers, field.key)))
  return { answered: answered.length, required: wanted.length }
}

/**
 * The figure the bar is raised against, from nothing to a hundred.
 *
 * Each step's weight is divided equally across its applicable required fields,
 * and the earned shares are summed and floored. The floor and the explicit
 * hundred branch are what stop a client one field short reading a hundred off a
 * rounding: anything incomplete is held at ninety-nine however the arithmetic
 * lands, and only a form with every required field answered returns the
 * hundred.
 *
 * This is the live reading rather than what the bar draws. The row carries a
 * high-water mark so the bar never retreats, and the one retreat it does allow -
 * a hundred back to ninety-nine, when somebody returns to a finished form and
 * empties a field - is allowed because the alternative is a bar reading a
 * hundred above a control that refuses to fire, with no way to tell which of the
 * two is lying.
 *
 * It is also not trusted. The percent is computed here because this is where
 * the answers are being typed, but the database clamps whatever it is handed to
 * ninety-nine and raises rather than sets, so no client can post themselves
 * finished.
 *
 * @param {object} answers The stored answers.
 * @returns {number} 0 to 100.
 */
export function onboardingPercent(answers) {
  let earned = 0
  let complete = true

  for (const step of STEPS) {
    const { answered, required } = stepProgress(step, answers)
    if (!required) continue
    if (answered < required) complete = false
    earned += (step.weight * answered) / required
  }

  return complete ? 100 : Math.min(99, Math.floor(earned))
}

/**
 * A display name reduced to the slug the same name carries in `TRADES`.
 *
 * The trades module cannot be imported here - it names an icon component for
 * every entry, and this file has to load under bare node with no bundler - so
 * the join is made by the rule the slugs were written under rather than by the
 * table. Every one of the twenty-three trades slugs exactly to its own id, and
 * a trade whose name does not is a trade with no page set, which falls through
 * to the common set. That is the same answer a trade nobody has written pages
 * for gets, and it is the right one either way.
 */
function slugOf(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * One row out of the brief, or an empty string.
 *
 * The three sentinels the configurator writes for an unanswered question mean
 * nothing was chosen, so they come back empty and no prefill happens. A row
 * that is absent entirely comes back the same way, which is what every project
 * opened before the brief existed looks like from here.
 */
function briefValue(brief, label) {
  const row = (Array.isArray(brief) ? brief : []).find(entry => entry?.label === label)
  const held = text(row?.value)
  return SENTINELS.has(held.toLowerCase()) ? '' : held
}

/** The id whose name this is, or null. Case and spacing are not the join. */
function idForName(options, name) {
  const wanted = text(name).toLowerCase()
  if (!wanted) return null
  return options.find(option => option.name.trim().toLowerCase() === wanted)?.id || null
}

/**
 * A brief row holding several names, resolved to the ids that exist.
 *
 * Split on the comma the summary joined them with. A name that resolves to
 * nothing is dropped rather than kept as itself, which is what keeps a stored
 * multichoice holding only ids that are still offered.
 */
function idsForRow(options, value) {
  return value
    .split(',')
    .map(part => idForName(options, part))
    .filter(Boolean)
}

/**
 * Whether a field is empty enough to be prefilled into.
 *
 * Deliberately looser than `answeredField`. A one-word paragraph is not an
 * answer for the percent, but it is somebody's typing and a prefill must never
 * land on top of it. The question here is only whether the client has put
 * anything in the box at all.
 */
function vacant(value) {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * The answers with everything derivable from the paid brief and the project
 * filled in.
 *
 * Driven off each field's own `fill` rather than off a second list written out
 * here, so a field that gains a source gains a prefill and a field that loses
 * one loses it, without two places having to agree.
 *
 * It never overwrites. A path is filled only when nothing is in it, which means
 * this is safe to run on every open rather than only on the first: a client who
 * changed a prefilled answer keeps their change, and a client who has not
 * reached a field yet gets the prefill even if the record was created before the
 * source existed.
 *
 * Every path it writes is recorded in `untouched`, which is how the person
 * building the site can tell an answer the client gave from an answer the
 * system guessed. A path leaves that list the first time its value changes and
 * never returns to it.
 *
 * With a complete brief and a business name on the pay form this returns a form
 * roughly a third answered, which is the whole argument for doing it: the form
 * opens partly done rather than empty, and that is the difference between a
 * thing somebody finishes and a thing somebody closes.
 *
 * @param {object} answers The stored answers, possibly empty.
 * @param {{project?: object|null, brief?: Array<{label: string, value: string}>|null}} source
 * @returns {object} A new answers object.
 */
export function prefill(answers, { project = null, brief = null } = {}) {
  const held = answers || {}
  const trade = slugOf(briefValue(brief, BRIEF_LABELS.trade))

  const filled = {}
  const marked = []

  const put = (key, value) => {
    if (value === null || value === undefined) return
    if (Array.isArray(value) && !value.length) return
    if (typeof value === 'string' && !value.trim()) return
    if (!vacant(readPath({ ...held, ...filled }, key))) return
    const [group, name] = key.split('.')
    filled[group] = { ...(held[group] || {}), ...(filled[group] || {}), [name]: value }
    marked.push(key)
  }

  for (const step of STEPS) {
    for (const field of step.fields) {
      const from = field.fill
      if (!from) continue

      // A source that reads another answer is copied forward by the step that
      // owns it, on the first time that step is opened, and never here: at the
      // moment a record is created the field it copies from is empty, so a
      // prefill would copy nothing and mark the path as guessed anyway.
      if (from.startsWith('answers.')) continue

      if (from === 'seed') {
        put(field.key, field.seed)
        continue
      }

      if (from === 'trade') {
        put(
          field.key,
          pagesForTrade(trade)
            .filter(page => !page.fixed && page.on)
            .map(page => page.id)
        )
        continue
      }

      if (from === 'project.business_name') {
        put(field.key, text(project?.business_name))
        continue
      }

      if (from === 'project.email') {
        put(field.key, text(project?.email))
        continue
      }

      if (from.startsWith('brief.')) {
        const value = briefValue(brief, from.slice('brief.'.length))
        if (!value) continue
        if (field.kind === 'multichoice') {
          const ids = idsForRow(field.options || [], value)
          put(field.key, field.max ? ids.slice(0, field.max) : ids)
        } else if (field.kind === 'choice') {
          put(field.key, idForName(field.options || [], value))
        } else {
          put(field.key, value)
        }
      }
    }
  }

  // The one key in `answers` that is not a field. Whether the logo picker is
  // shown at all depends on what the client said about their logo before they
  // paid, and the percent has to be computable wherever the answers are - in a
  // browser, in a check script, in the function that refuses an incomplete
  // submission - none of which has the brief beside it. So the brief's own
  // answer is carried forward into the record it governs.
  const brand = idForName(BRAND_STATES, briefValue(brief, BRIEF_LABELS.brand))
  if (brand && vacant(readPath({ ...held, ...filled }, 'brand.logo_state'))) {
    filled.brand = { ...(held.brand || {}), ...(filled.brand || {}), logo_state: brand }
  }

  const already = Array.isArray(held.untouched) ? held.untouched : []

  return {
    // The shape number. A field renamed or a step split is a migration over
    // rows that already exist, and a reader holding a row with no version has
    // to guess which shape it is looking at.
    version: 1,
    ...held,
    ...filled,
    untouched: [...new Set([...already, ...marked])],
  }
}
