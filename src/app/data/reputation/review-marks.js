/**
 * Written by `npm run capture:review-logos`, never by hand.
 *
 * Each reviewer's mark, by the site the review is about, under the name the
 * file is held at. The name ends in the hash of the file's own bytes because
 * `/images/` is served immutable for a year: a browser that has seen a mark
 * never asks for it again under the same name, so a recaptured mark has to
 * arrive under a new one, and the hash is what makes that happen without
 * anybody remembering to rename it.
 */
export const REVIEW_MARKS = {
  'baytowngokarts.com': 'baytowngokarts-com-41016b8d.png',
  'ccscaleservices.com': 'ccscaleservices-com-486bbf8e.png',
  'djrxexcellence.com': 'djrxexcellence-com-746302a3.png',
  'rootriseholdings.com': 'rootriseholdings-com-46c86707.png',
  'tiretracker.app': 'tiretracker-app-85b63b75.png',
}
