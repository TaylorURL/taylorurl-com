import {
  MarkAt,
  MarkChip,
  MarkCycle,
  MarkDevice,
  MarkFind,
  MarkFrame,
  MarkGuard,
  MarkPanel,
  MarkRefit,
  MarkScreen,
  MarkTarget,
} from '@components/marks/marks'

/**
 * The mark each service carries, keyed on the slug its route ends in.
 *
 * One map, read by the menu, the cards and the page, so a service is drawn the
 * same way everywhere it is named. It is its own module rather than a field on
 * the page content because the menu is in the shell every visitor downloads
 * and the page content is not: the bar reads eleven marks from here and never
 * touches the copy in `@data/serviceDetail`.
 *
 * Keyed on the slug rather than written into the lists in `@data/services`,
 * because that file is read by the build's route table under plain node, where
 * the `@components` alias does not resolve.
 */
export const SERVICE_MARKS = {
  'new-website': MarkFrame,
  redesign: MarkRefit,
  'online-tools': MarkPanel,
  care: MarkGuard,
  'business-email': MarkAt,
  'ad-tracking': MarkTarget,
  seo: MarkFind,
  'mobile-apps': MarkDevice,
  'desktop-apps': MarkScreen,
  automation: MarkCycle,
  'ai-integration': MarkChip,
}
