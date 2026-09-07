/**
 * The towns the studio names as its service area. The footer renders this list
 * and `/areas` builds a page for each entry, so the two can never name
 * different places.
 *
 * It stands on its own rather than inside `@data/areas` because the footer is
 * on every page and `areas.js` reads the whole portfolio to build its town
 * pages. A module importing the list from there carries the portfolio with it.
 * Nothing may be imported into this file for the same reason.
 */
export const SERVICE_TOWNS = [
  'Baytown',
  'Houston',
  'Pasadena',
  'Deer Park',
  'La Porte',
  'Mont Belvieu',
  'Galveston',
  'Texas City',
]
