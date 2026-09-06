/**
 * The free tools, in the order the index lays them out.
 *
 * - `slug`        Last segment of the tool's own page, and the key the view
 *                 joins its flow and its mark on.
 * - `name`        The label on a card, a menu row, and the page heading.
 * - `summary`     The one line a card or a menu row carries.
 * - `title`       Page title written for search. Short, because the brand
 *                 suffix is appended to it.
 * - `description` What a search result says under the title.
 * - `lede`        The sentence under the page heading, longer than `summary`
 *                 and written for somebody who has already arrived.
 *
 * `vite/site-routes.js` imports this module under plain Node to build the
 * route and sitemap lists, so nothing here may be aliased and nothing here may
 * be a component. The marks live with the views for that reason.
 *
 * A tool is listed here only once its flow exists. The registry drives the
 * routes, the navigation, the sitemap and the prerender list together, so a
 * slug added before its page is a menu row and a sitemap line leading nowhere.
 */
const TOOLS = [
  {
    slug: 'google-presence-check',
    name: 'Google Presence Check',
    summary: 'See what Google sees when it looks at your website.',
    title: 'Free Google Presence Check',
    description:
      'Check what Google sees on your site: speed on a phone, whether your business details are readable, and how your link looks shared. Free, no account.',
    lede: 'Paste your address and get a plain-English account of what Google can and cannot read on your site, measured rather than guessed. Free, no account.',
  },
  {
    slug: 'logo-background-remover',
    name: 'Logo Background Remover',
    summary: 'Lift a logo off its background and get a set of files back.',
    title: 'Free Logo Background Remover',
    description:
      'Remove the background from a logo in your browser and download a transparent PNG plus black, white, and flattened versions. Free, nothing uploaded.',
    lede: 'Drop in a logo, adjust until the edges look right, and take away a folder holding the transparent file and the versions for dark and one-color work.',
  },
  {
    slug: 'qr-code-generator',
    name: 'QR Code Generator',
    summary: 'Make a QR code for a link, a phone number, or your wifi.',
    title: 'Free QR Code Generator',
    description:
      'Make a QR code for a link, phone number, email, or wifi network and download it as a PNG or SVG. Free, no account, no watermark, print-ready.',
    lede: 'Point it at whatever you need scanned, choose how it should look, and take away a file that prints cleanly at any size.',
  },
]

export const TOOLS_INDEX = TOOLS.map(tool => ({ ...tool, path: `/tools/${tool.slug}` }))

/**
 * @param {string | undefined} slug - Slug from the route.
 * @returns {object | null} The tool, or null when the URL names none of them.
 */
export function toolBySlug(slug) {
  return TOOLS_INDEX.find(tool => tool.slug === slug) || null
}
