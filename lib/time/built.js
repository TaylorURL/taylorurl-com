/**
 * The year the build stamped on itself.
 *
 * Every route on these sites is rendered to markup at build time and adopted
 * by the browser from that markup, so a year read from a clock is read from
 * two different clocks: the build container's, which wrote the markup, and the
 * reader's, which renders over it. They agree for most readers for most of the
 * year, which is the whole difficulty - they disagree for a reader whose clock
 * is wrong, which is the state a crawler or a freshly started container is
 * routinely in, and they disagree for everybody over the turn of a year
 * against a document built before it. One text node that does not match is a
 * subtree React discards and draws again, and a fault it files against the
 * site.
 *
 * So the year is decided once, by the build, and the same string is handed to
 * both renders. `vite.config.js` sets `BUILD_YEAR` on the environment and
 * defines the member expression for the browser chunk - esbuild substitutes
 * the literal there, while the prerender's in-process SSR keeps a real
 * environment read. That is the arrangement the site key is already under in
 * `lib/site/current.js`.
 *
 * The fallback is for a tree loaded outside a Vite build - a check script, a
 * test - where nothing stamped it and the clock is the only answer there is.
 * It is never the browser's path: the define has already replaced the read.
 */
import { dayIn } from './zone.js'

const stamped = process.env.BUILD_YEAR

export const BUILT_YEAR = Number(stamped) || Number(dayIn().slice(0, 4))
