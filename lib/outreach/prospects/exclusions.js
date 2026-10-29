/**
 * Which businesses outreach will not write to, and the reason each one records.
 *
 * The rules moved to chainwork. What stays here is the one thing that is the
 * studio's own rather than the package's: the list of domains the studio owns
 * or has built. A client trades in the towns the sourcing searches, under a
 * trade it searches for, so it turns up in the queue like any other business,
 * and a letter offering to build the site the studio already built is the one
 * message that costs a relationship rather than a stranger's attention.
 *
 * They are installed rather than written out, and read off the portfolio
 * rather than typed again, so a client added there is held the same day and
 * cannot be left off by anybody remembering to come back to this file.
 *
 * The install happens as this module loads, which is before anything that
 * imports it can ask a question. The held list asked for by name is loaded
 * separately, per run, by lib/outreach/runtime.js.
 */

import { installOwnDomains } from 'chainwork/core/prospects/exclusions.js'
import { hostOf } from 'chainwork/core/prospects/platforms.js'
import { PORTFOLIO_PROJECTS } from '../../../src/app/data/portfolio.js'

installOwnDomains([
  'taylorurl.com',
  'baytownwebdevelopment.com',
  'gettaylorurl.com',
  'baytownwebdesign.com',
  'lonestarsite.com',
  ...PORTFOLIO_PROJECTS.map(project => hostOf(project.displayUrl)),
])

export * from 'chainwork/core/prospects/exclusions.js'
