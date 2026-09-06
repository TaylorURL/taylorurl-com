/**
 * Every site record in one map, for the tooling that reasons about all of them.
 *
 * Deliberately its own module rather than an export of `registry.js`. Building
 * the map is a top-level `Object.freeze` call, Rollup treats that as a side
 * effect and keeps every object it touches, and the result was both sites' copy
 * shipping inside both sites' bundles — taylor.website's title and origin sat in
 * taylorurl.com's `Seo` chunk until this moved out. Nothing the browser reaches
 * may import this file; `lib/site/current.js` selects a record directly and
 * never touches the map.
 *
 * The freeze stays here because a check script mutating a shared record while
 * asserting things about it is a worse problem than a wasted call.
 */
import { taylorurl, taylorwebsite } from './registry.js'

export const SITES = Object.freeze({
  taylorurl: Object.freeze(taylorurl),
  taylorwebsite: Object.freeze(taylorwebsite),
})
