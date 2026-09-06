import { useOutletContext } from 'react-router-dom'

/**
 * The figures every section reads.
 *
 * The shell owns the three feeds and the scope (which site, which window, which
 * page) and hands them down here, so the sections that read figures share one
 * set of requests rather than each fetching the same thing on its own schedule.
 * Status reads none of it - its figures come from the uptime monitor - and
 * Admin reads none of it either, since it answers to a different endpoint.
 *
 * `sections` is the menu this reader actually has, which is not the whole
 * catalogue: a client has no Admin section, and a section documenting the
 * keyboard must not name a chord that goes nowhere for them.
 *
 * The scope is a set of sites, and a section reads it through whichever of
 * three keys answers its question:
 *
 *   `siteIds` is the set itself, empty for every site the account holds.
 *   `siteId`  is the one site when the set holds exactly one, and null
 *             otherwise - so a section drawing one site's reading needs no
 *             other test, and a set of two falls to the reading it draws for
 *             the account, over the two sites the feeds were narrowed to.
 *   `inScope` is the site rows the scope covers, which is every row when the
 *             set is empty. A per-site list draws from this rather than from
 *             `sites`, which stays the whole account for the choosers.
 *
 * `toggleSite` adds one site to the set or takes it out; `pickSite` replaces
 * the set with one site, or with every site when given null.
 *
 * @returns {object} the shell's feeds, scope, and the setters that change it
 */
export function useConsole() {
  return useOutletContext()
}
