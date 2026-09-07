import {
  Activity,
  Anchor,
  AtSign,
  Building2,
  Bug,
  Calculator,
  Car,
  Dumbbell,
  Fence,
  HardHat,
  Layers,
  Mail,
  MoreHorizontal,
  Package,
  Printer,
  Scale,
  Scissors,
  Smile,
  Sparkles,
  Trees,
  Truck,
  UtensilsCrossed,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react'
import {
  ToolDoorDash,
  ToolGoogle,
  ToolMicrosoft,
  ToolPaypal,
  ToolQuickBooks,
  ToolSquare,
  ToolStripe,
  ToolUberEats,
  ToolXero,
} from '@components/marks/toolMarks'

/**
 * The software a local business already runs on, keyed by the id the trades
 * below name it with.
 *
 * - `name`     The product, as its vendor writes it.
 * - `mark`     The vendor's own brand mark, on the entries whose mark is
 *              published under a license that allows it. Everything else is
 *              identified by its name alone.
 * - `generic`  Set on the entries that name a capability rather than a
 *              company, which are set as running text instead of as a
 *              wordmark.
 *
 * A site works alongside these; none of them is a partnership, an endorsement,
 * or an official integration.
 */
export const TOOLS = {
  stripe: { name: 'Stripe', mark: ToolStripe },
  square: { name: 'Square', mark: ToolSquare },
  paypal: { name: 'PayPal', mark: ToolPaypal },
  squareAppointments: { name: 'Square Appointments' },
  booksy: { name: 'Booksy' },
  vagaro: { name: 'Vagaro' },
  schedulicity: { name: 'Schedulicity' },
  fresha: { name: 'Fresha' },
  toast: { name: 'Toast' },
  clover: { name: 'Clover' },
  openTable: { name: 'OpenTable' },
  doorDash: { name: 'DoorDash', mark: ToolDoorDash },
  uberEats: { name: 'Uber Eats', mark: ToolUberEats },
  serviceTitan: { name: 'ServiceTitan' },
  housecallPro: { name: 'Housecall Pro' },
  jobber: { name: 'Jobber' },
  quickBooks: { name: 'QuickBooks', mark: ToolQuickBooks },
  jobNimbus: { name: 'JobNimbus' },
  accuLynx: { name: 'AccuLynx' },
  buildertrend: { name: 'Buildertrend' },
  lmn: { name: 'LMN' },
  yardbook: { name: 'Yardbook' },
  pestPac: { name: 'PestPac' },
  fieldRoutes: { name: 'FieldRoutes' },
  briostack: { name: 'Briostack' },
  tekmetric: { name: 'Tekmetric' },
  shopWare: { name: 'Shop-Ware' },
  mitchellOne: { name: 'Mitchell 1' },
  carfax: { name: 'CARFAX' },
  towbook: { name: 'Towbook' },
  dispatchAnywhere: { name: 'Dispatch Anywhere' },
  dentrix: { name: 'Dentrix' },
  openDental: { name: 'Open Dental' },
  weave: { name: 'Weave' },
  chiroTouch: { name: 'ChiroTouch' },
  jane: { name: 'Jane' },
  clio: { name: 'Clio' },
  myCase: { name: 'MyCase' },
  smokeball: { name: 'Smokeball' },
  xero: { name: 'Xero', mark: ToolXero },
  taxDome: { name: 'TaxDome' },
  mindbody: { name: 'Mindbody' },
  trainerize: { name: 'Trainerize' },
  glofox: { name: 'Glofox' },
  idxMls: { name: 'IDX and MLS feeds', generic: true },
  followUpBoss: { name: 'Follow Up Boss' },
  storEdge: { name: 'storEDGE' },
  siteLink: { name: 'SiteLink' },
  printavo: { name: 'Printavo' },
  shopVox: { name: 'ShopVOX' },
  customIntegration: { name: 'Custom integration', generic: true },
}

// Card money reaches every trade on the list, so the three processors sit
// apart from any one trade's set and are appended to all of them.
const PAYMENT_TOOL_IDS = ['stripe', 'square', 'paypal']

// What the tool names and marks mean, stated wherever they are drawn. The
// products are named because a shop already pays for them, and naming one
// claims nothing beyond that.
export const TOOL_NOTE =
  'Your site works alongside the software you already pay for. Product names and marks belong to their owners, and none of it is a partnership or an official integration.'

/**
 * The mailboxes the email service is set up on. The two named platforms cover
 * most of what a small business already pays for; the third is every other
 * host, and the fourth is a business still running mail through a free
 * address.
 */
export const EMAIL_PROVIDERS = [
  { id: 'google-workspace', name: 'Google Workspace', mark: ToolGoogle },
  { id: 'microsoft-365', name: 'Microsoft 365', mark: ToolMicrosoft },
  { id: 'another-provider', name: 'Another Provider', mark: AtSign },
  { id: 'no-provider', name: 'Nothing Set Up Yet', mark: Mail },
]

/**
 * Every trade the configurator offers, in the order the grid lays them out.
 *
 * - `id`     Slug the grid, the inquiry, and `PORTFOLIO_PROJECTS.trades` join
 *            on. A client site becomes this trade's proof by carrying the same
 *            slug in the portfolio data.
 * - `name`   The label on the control.
 * - `mark`   The icon drawn on the control.
 * - `needs`  What a site for this trade has to do, in this trade's own terms.
 * - `tools`  Keys into `TOOLS`, naming the software this trade runs on. The
 *            payment processors reach every set, so no trade lists one.
 *
 * `something-else` closes the grid and carries the generic path. The trades
 * above it are the ones common enough around Baytown to be worth naming, and
 * every other business answers there.
 */
export const TRADES = [
  {
    id: 'barber-shop',
    name: 'Barber Shop',
    mark: Scissors,
    needs: [
      'A chair booked from a phone, day or night',
      'The cut list and what each one costs',
      'Walk-in days and cutting hours stated up front',
      'Fade and beard work shown in real photographs',
    ],
    tools: ['squareAppointments', 'booksy', 'vagaro', 'schedulicity', 'fresha'],
  },
  {
    id: 'hair-salon',
    name: 'Hair Salon',
    mark: Sparkles,
    needs: [
      'Booking by stylist, not just by time slot',
      'Color, cut, and treatment pricing in one list',
      'A gallery that shows the work leaving the chair',
      'A deposit taken when a long appointment is booked',
    ],
    tools: ['squareAppointments', 'booksy', 'vagaro', 'schedulicity', 'fresha'],
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    mark: UtensilsCrossed,
    needs: [
      'A menu that is current and readable on a phone',
      'Ordering and delivery links that go straight through',
      'Hours, holidays, and the kitchen’s last call',
      'A table reserved without a phone call',
    ],
    tools: ['toast', 'square', 'clover', 'openTable', 'doorDash', 'uberEats'],
  },
  {
    id: 'plumbing',
    name: 'Plumbing',
    mark: Wrench,
    needs: [
      'The emergency number above everything else on the page',
      'Service areas named town by town',
      'Photographs of finished jobs instead of stock images',
      'A quote request that arrives with the address on it',
    ],
    tools: ['serviceTitan', 'housecallPro', 'jobber', 'quickBooks'],
  },
  {
    id: 'hvac',
    name: 'HVAC',
    mark: Wind,
    needs: [
      'Tune-up and repair requests through one form',
      'Maintenance plans explained and signed up for online',
      'Financing terms stated in plain numbers',
      'Reviews sitting beside the work they describe',
    ],
    tools: ['serviceTitan', 'housecallPro', 'jobber', 'quickBooks'],
  },
  {
    id: 'electrical',
    name: 'Electrical',
    mark: Zap,
    needs: [
      'License and insurance shown where customers look for them',
      'Panel, rewire, and generator work each on its own page',
      'Emergency calls routed straight to the phone',
      'Estimate requests that carry photographs',
    ],
    tools: ['serviceTitan', 'housecallPro', 'jobber', 'quickBooks'],
  },
  {
    id: 'roofing',
    name: 'Roofing',
    mark: HardHat,
    needs: [
      'Storm and insurance work explained step by step',
      'Before and after photographs from jobs nearby',
      'A free inspection booked in a few taps',
      'Material and warranty options side by side',
    ],
    tools: ['jobNimbus', 'accuLynx', 'buildertrend', 'jobber'],
  },
  {
    id: 'fencing',
    name: 'Fencing',
    mark: Fence,
    needs: [
      'Wood, iron, and chain link priced by the foot',
      'A gallery sorted by style and height',
      'Measurements collected on a form instead of a call',
      'Lead times stated so nobody has to ask',
    ],
    tools: ['jobNimbus', 'accuLynx', 'buildertrend', 'jobber'],
  },
  {
    id: 'concrete',
    name: 'Concrete',
    mark: Layers,
    needs: [
      'Driveways, slabs, and patios shown as finished work',
      'Square-foot pricing stated on the page',
      'Pour schedules and weather delays explained',
      'Quote requests carrying photos and dimensions',
    ],
    tools: ['jobNimbus', 'accuLynx', 'buildertrend', 'jobber'],
  },
  {
    id: 'landscaping',
    name: 'Landscaping',
    mark: Trees,
    needs: [
      'Weekly, biweekly, and one-off service priced apart',
      'Design and install work shown in season',
      'Recurring billing set up once and left alone',
      'A service map drawn around the routes you run',
    ],
    tools: ['jobber', 'lmn', 'yardbook'],
  },
  {
    id: 'pest-control',
    name: 'Pest Control',
    mark: Bug,
    needs: [
      'Recurring plans and one-time treatments priced apart',
      'The pests covered, named one by one',
      'A treatment scheduled without a phone call',
      'Safety information for children and pets',
    ],
    tools: ['pestPac', 'fieldRoutes', 'briostack'],
  },
  {
    id: 'auto-repair',
    name: 'Auto Repair',
    mark: Car,
    needs: [
      'Appointments booked around the bay schedule',
      'Services and diagnostic fees listed in the open',
      'Inspection results reaching the customer’s phone',
      'Fleet accounts handled apart from walk-ins',
    ],
    tools: ['tekmetric', 'shopWare', 'mitchellOne', 'carfax'],
  },
  {
    id: 'towing',
    name: 'Towing',
    mark: Truck,
    needs: [
      'One tap to call from anywhere on the page',
      'Coverage area and response time stated',
      'Tow, winch, and storage rates in the open',
      'Roadside requests that carry a location',
    ],
    tools: ['towbook', 'dispatchAnywhere'],
  },
  {
    id: 'dentist',
    name: 'Dentist',
    mark: Smile,
    needs: [
      'New patient forms filled in before the visit',
      'Insurance accepted, listed by name',
      'Appointment requests sorted by treatment',
      'Emergency instructions on a page of their own',
    ],
    tools: ['dentrix', 'openDental', 'weave'],
  },
  {
    id: 'chiropractor',
    name: 'Chiropractor',
    mark: Activity,
    needs: [
      'New patient intake completed online',
      'Every condition treated, explained on its own terms',
      'A first consultation booked directly',
      'Insurance and cash pricing both stated',
    ],
    tools: ['chiroTouch', 'jane'],
  },
  {
    id: 'law-firm',
    name: 'Law Firm',
    mark: Scale,
    needs: [
      'Each practice area on its own page',
      'Consultation requests screened before they reach the desk',
      'Case results and reviews where they carry weight',
      'A contact route that keeps a message private',
    ],
    tools: ['clio', 'myCase', 'smokeball'],
  },
  {
    id: 'accounting',
    name: 'Accounting',
    mark: Calculator,
    needs: [
      'Tax, bookkeeping, and payroll priced apart',
      'Documents uploaded without email attachments',
      'Deadlines and what to bring, in one place',
      'Consultations booked by service',
    ],
    tools: ['quickBooks', 'xero', 'taxDome'],
  },
  {
    id: 'fitness',
    name: 'Fitness',
    mark: Dumbbell,
    needs: [
      'A class and session schedule that stays current',
      'Packages and memberships bought online',
      'Before and after photos with dates on them',
      'Intake and waivers signed before the first session',
    ],
    tools: ['mindbody', 'trainerize', 'glofox'],
  },
  {
    id: 'real-estate',
    name: 'Real Estate',
    mark: Building2,
    needs: [
      'Live listings searched by area and price',
      'Saved homes compared side by side',
      'Inquiries reaching the phone in seconds',
      'Neighborhood pages built to be found',
    ],
    tools: ['idxMls', 'followUpBoss'],
  },
  {
    id: 'storage',
    name: 'Storage',
    mark: Package,
    needs: [
      'Unit sizes, prices, and what is vacant right now',
      'A unit rented and paid for online',
      'Gate hours and access rules stated',
      'A map that gets people to the right building',
    ],
    tools: ['storEdge', 'siteLink'],
  },
  {
    id: 'printing',
    name: 'Printing',
    mark: Printer,
    needs: [
      'Quote requests that arrive with the artwork attached',
      'Products priced by quantity',
      'Proofs approved without a phone call',
      'Order status followed from one page',
    ],
    tools: ['printavo', 'shopVox'],
  },
  {
    id: 'marine-services',
    name: 'Marine Services',
    mark: Anchor,
    needs: [
      'Fleet, dock, and service capability laid out in full',
      'Terminal and harbor locations mapped',
      'Dispatch reachable around the clock',
      'Credentials and certifications where they are looked for',
    ],
    tools: ['quickBooks', 'customIntegration'],
  },
  {
    id: 'something-else',
    name: 'Something Else',
    mark: MoreHorizontal,
    needs: [
      'Pages written around what the business sells',
      'The one thing customers call to do, done on the site',
      'Inquiries reaching the phone the same minute',
      'Built to be found for the work worth having',
    ],
    tools: [],
  },
]

/**
 * @param {string | null} id Trade slug from `TRADES`.
 * @returns {object | null} The trade, or null when nothing is selected.
 */
export function tradeById(id) {
  return TRADES.find(trade => trade.id === id) || null
}

/**
 * The software shown for a trade: its own set followed by the payment
 * processors, with anything named twice kept once.
 *
 * @param {object | null} trade Entry from `TRADES`.
 * @returns {Array<{ id: string, name: string, mark: Function }>} Resolved tools
 *   in the order they are drawn.
 */
export function toolsForTrade(trade) {
  const ids = [...(trade?.tools || []), ...PAYMENT_TOOL_IDS]
  return [...new Set(ids)].map(id => ({ id, ...TOOLS[id] }))
}
