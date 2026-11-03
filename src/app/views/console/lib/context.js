import { useOutletContext } from 'react-router-dom'

/**
 * The figures every section reads.
 *
 * The shell owns the three feeds and the scope (which site, which window) and
 * hands them down here, so the sections that read figures share one set of
 * requests rather than each fetching the same thing on its own schedule.
 * Status reads none of it - its figures come from the uptime monitor - and the
 * studio's own sections answer to their own endpoints.
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
 *             set is empty.
 *
 * @returns {object} the shell's feeds and scope
 */
export function useConsole() {
  return useOutletContext()
}
