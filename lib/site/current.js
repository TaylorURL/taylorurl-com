/**
 * Which site this process is. The one place the key is read.
 *
 * `process.env.SITE` appears in this file and nowhere else in the repo, and
 * `scripts/site/check-site-key.js` fails the build if that stops being true. The
 * reason is that the same expression means three different things depending on
 * where it runs, and only one file should have to know that: Vite's `define`
 * substitutes a string literal into the browser bundle, so the comparison below
 * constant-folds and Rollup drops the record that lost; a Vercel function and the
 * prerender's in-process SSR read it as a real environment variable; and a check
 * script run under bare node reads it as an environment variable that is usually
 * unset. All three land on a resolved record, which is all any caller wants.
 *
 * Import this by RELATIVE path, never through the `@lib` alias. `api/` and
 * `lib/` resolve no Vite aliases — Vercel's function builder reads no jsconfig
 * paths — and the check scripts run as plain `node scripts/<subject>/check-x.js`
 * with no resolver hooks installed. An aliased import builds clean under Vite and
 * then 500s in a function or throws in CI, which is the failure this rule exists
 * to prevent. The repo already answers this way: `src/app/views.js` reaches this
 * file as `../../lib/site/current.js` for exactly this reason, even though every
 * other import in it goes through an alias.
 */

import { DEFAULT_SITE_KEY, SITE_KEYS, taylorurl, taylorwebsite } from './registry.js'

/**
 * The raw value, before it is trusted.
 *
 * An unset variable is the studio site, because that is what every build did
 * before this file existed and a developer who has never heard of the key should
 * get the site they expected. An empty string counts as unset: a shell that
 * exports `SITE=` has said nothing.
 *
 * Deliberately no `.trim()`. A method call is opaque to the bundler, and one
 * here would stop `requested` being a compile-time constant, which would stop
 * the selection below folding, which would put both sites' content in both
 * sites' bundles. That is not a guess — it is what the first version of this
 * file did, and the leak was found by grepping the built chunks for the other
 * site's domain. The cost of the strictness is that `SITE=" taylorurl "` is
 * refused rather than tidied up, which is the right answer anyway: a build key
 * with whitespace in it is a mistake, and this file's whole job is to make
 * mistakes loud.
 */
const raw = process.env.SITE
const requested = raw === undefined || raw === '' ? DEFAULT_SITE_KEY : raw

/**
 * A name nobody registered stops the build.
 *
 * The alternative — falling back to the default — is the worse failure by a wide
 * margin. `SITE=taylor-website` instead of `taylorwebsite`, or a stray `SITE`
 * exported by somebody's shell profile, would silently deploy TaylorURL's copy,
 * schema and canonical origin onto the other domain, and a build that shipped the
 * wrong site looks exactly like one that shipped the right site. Refusing is
 * loud, immediate and cheap; guessing is none of those.
 */
if (!SITE_KEYS.includes(requested)) {
  throw new Error(
    `SITE="${requested}" names no site. Known keys: ${SITE_KEYS.join(', ')}. ` +
      `Leave SITE unset to build ${DEFAULT_SITE_KEY}.`
  )
}

/**
 * The resolved record. Frozen; treat every field as read-only.
 *
 * Written as an explicit comparison rather than `SITES[requested]` so the browser
 * build can drop the record that lost. Vite's `define` replaces the expression
 * with a string literal, the comparison folds to a constant, and the losing
 * import becomes unreferenced and collectable. A map lookup is opaque to all of
 * that and ships both sites' content to both sites — measured by grepping the
 * built chunks, not theorised.
 *
 * The cost is that a third site means editing this line as well as the registry.
 * `scripts/site/check-site-key.js` resolves every registered key in a child process
 * and compares the ORIGIN it gets back, so a key added to the registry and
 * forgotten here fails the suite rather than silently resolving to the studio.
 */
export const SITE = requested === 'taylorwebsite' ? taylorwebsite : taylorurl

/**
 * The resolved key, read off the record rather than from the variable, so the
 * two can never disagree about which site this is.
 */
export const SITE_KEY = SITE.key

/**
 * Whether this build is the subsidiary, as a plain boolean.
 *
 * Exists so a module that has to choose between two bodies of content can do it
 * without reading the environment variable itself - the rule is one reader, and
 * `scripts/site/check-site-key.js` enforces it. After Vite substitutes the literal
 * this folds to `true` or `false`, which is what lets the losing side's copy be
 * dropped from the bundle rather than shipped inside the winner.
 */
export const IS_SECOND_SITE = requested === 'taylorwebsite'

/**
 * The record's flags again, in the one form a bundler can act on.
 *
 * `SITE.reviews` and `SITE.localSeo` are the questions these mean, and reading
 * them is correct everywhere the answer only has to be right at runtime. It is
 * not enough where the answer decides what is in the file: a property read of an
 * object the bundler cannot see through keeps both branches, so the losing one
 * ships. That is not hypothetical here. The subsidiary's main chunk - downloaded
 * on every page, before anything is rendered - carried the studio's ten service
 * towns, its Trustpilot standing, its five client reviews and the BBB registry,
 * none of it drawn on screen and all of it readable by anyone who opened the
 * file. Compared against the key Vite substitutes as a literal, the branch folds
 * and the losing side is gone.
 *
 * Two answers to one question is a thing that drifts, so `check-site-key.js`
 * asserts each of these against the field it stands for, under both keys.
 *
 * Use the record's field to decide what a page does. Use these to decide what a
 * bundle contains.
 */
export const PUBLISHES_REVIEWS = requested !== 'taylorwebsite'

export const HAS_LOCAL_SEO = requested !== 'taylorwebsite'

/**
 * Whether this deployment answers the scheduled work.
 *
 * `vercel.json` holds nine crons and the platform reads it before any build runs,
 * so both projects register all nine and there is no way to key that file. Every
 * scheduled handler therefore asks this first and returns 204 when the answer is
 * no, which is the only thing standing between two deployments and two outreach
 * pipelines sending from the same warmed domain on the same schedule.
 *
 * It is written as a call rather than a constant so a handler reads as asking a
 * question at the moment it matters, and so the check suite can assert the answer
 * under an unset SITE — the case every one of the existing check scripts runs in,
 * and the one where a wrong answer would silence the pipeline while looking
 * exactly like a quiet night.
 */
export function ownsSchedules() {
  return SITE.runsSchedules === true
}

/** True when this is the studio site. For the few places that genuinely differ. */
export function isStudio() {
  return SITE_KEY === DEFAULT_SITE_KEY
}
