/**
 * The industry pages and the order `/industries` lays them out in.
 *
 * A group is one heading on the index and the trades gathered under it. Every
 * entry in `trades` is an id from `@data/trades`, and that id is also the slug
 * its detail page answers to, so a trade renamed there renames here and a trade
 * removed there loses its page. `something-else` is absent: it is the
 * configurator's catch-all rather than an industry.
 *
 * The register is deliberate — a trade added to `@data/trades` gets a page by
 * being named in a group, so the index never grows a heading nobody chose.
 *
 * Nothing here reads the trade data itself. `vite/site-routes.js` imports this
 * module under plain Node to build the route list, where neither the path
 * aliases nor the icon components the trade data carries would resolve; the
 * views join the two lists together with `groupsWith`.
 */
export const INDUSTRY_GROUPS = [
  {
    id: 'home-trades',
    name: 'Home and Property',
    summary:
      'Work that arrives at an address. Everything turns on whether the site says where you go and takes a request with enough in it to price.',
    trades: [
      'plumbing',
      'hvac',
      'electrical',
      'roofing',
      'fencing',
      'concrete',
      'landscaping',
      'pest-control',
      'storage',
    ],
  },
  {
    id: 'automotive-industrial',
    name: 'Automotive and Industrial',
    summary:
      'Shops, yards, and fleets. Pricing and capability in the open, with fleet accounts handled apart from walk-ins.',
    trades: ['auto-repair', 'towing', 'marine-services', 'printing'],
  },
  {
    id: 'personal-services',
    name: 'Personal Services',
    summary:
      'Appointment businesses. A chair or a slot booked from a phone at any hour, with the price list and the hours stated before anyone calls.',
    trades: ['barber-shop', 'hair-salon', 'fitness', 'dentist', 'chiropractor'],
  },
  {
    id: 'professional-services',
    name: 'Professional Services',
    summary:
      'Practices judged on credibility before contact. Each area of work on its own page, and inquiries screened before they reach the desk.',
    trades: ['law-firm', 'accounting', 'real-estate'],
  },
  {
    id: 'food-hospitality',
    name: 'Food and Hospitality',
    summary:
      'A menu that is current on a phone, ordering and delivery links that go straight through, and a table held without a phone call.',
    trades: ['restaurant'],
  },
]

/** Every industry slug, in the order the index lays the groups out. */
export const INDUSTRY_SLUGS = INDUSTRY_GROUPS.flatMap(group => group.trades)

/**
 * The groups with their trade ids resolved against the trade data.
 *
 * @param {Array<{ id: string }>} trades The `TRADES` list from `@data/trades`.
 * @returns {Array<object>} Each group with `trades` as the trade objects
 *   themselves. An id the trade data no longer carries drops out.
 */
export function groupsWith(trades) {
  return INDUSTRY_GROUPS.map(group => ({
    ...group,
    trades: group.trades.map(id => trades.find(trade => trade.id === id)).filter(Boolean),
  }))
}

/**
 * @param {string} slug An industry slug.
 * @returns {object | null} The group holding it, or null for a slug no group
 *   names.
 */
export function groupForIndustry(slug) {
  return INDUSTRY_GROUPS.find(group => group.trades.includes(slug)) || null
}
