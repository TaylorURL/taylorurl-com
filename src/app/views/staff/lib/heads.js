/**
 * What each surface puts in the document head.
 *
 * It lives here rather than on the four screens because the head is about the
 * address rather than about who is signed in, and the screens are behind a gate:
 * a crawler and a direct load both arrive before there is a session to read, and
 * a title decided inside the gate is a title neither of them ever gets. The
 * console's frame carries its own head for the same reason.
 *
 * Every one of them is noindex, so the set says what each page is and nothing
 * says it to a search engine.
 */
const HEADS = Object.freeze({
  '/staff': {
    title: 'Staff Portal',
    description: 'Where TaylorURL representatives work the call list.',
  },
  '/staff/calls': {
    title: 'Call Center',
    description:
      'The next lead on the TaylorURL call list, and where a representative logs the call.',
  },
  '/staff/management': {
    title: 'Management Center',
    description: "A TaylorURL representative's numbers for the day, and who else is calling.",
  },
  '/staff/resources': {
    title: 'Resources Center',
    description: 'The TaylorURL call script, common questions, objections and pricing.',
  },
})

/**
 * @param {string} pathname The address the browser opened.
 * @returns {{title: string, description: string}} The head for it, falling back
 *   to the portal's - which is the only one reachable while a surface is being
 *   added, and says the right thing about the family either way.
 */
export function headFor(pathname) {
  const held = String(pathname ?? '').replace(/\/+$/, '')
  return HEADS[held] || HEADS['/staff']
}
