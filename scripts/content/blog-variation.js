#!/usr/bin/env node
/**
 * Measures how much of an article is already on the blog, and refuses the ones
 * that are.
 *
 * A search engine that meets two pages saying the same thing indexes one and
 * drops the other, so an article rebuilt from a published one costs a slot
 * rather than filling one. The daily routine writes from a file of standing
 * instructions and the articles beside it, which is exactly the setup that
 * drifts into rewriting yesterday's piece with different nouns, and nothing
 * downstream of it reads two articles side by side.
 *
 * The measure is word-shingle containment. Every article becomes the set of
 * its overlapping five-word phrases, and a pair scores as the share of the
 * smaller set the two hold in common. Containment rather than Jaccard because
 * the denominator has to be the smaller article: a 1,300-word draft that
 * reproduces a third of a 300-word post is republishing that post, and Jaccard
 * divides that away to nothing against the union. Five words rather than
 * eight because a skeleton reused with the nouns changed loses only the
 * shingles the changed word sits in, so the shorter phrase leaves more of the
 * reuse visible, and five is still a phrase rather than a collocation - across
 * the 630 pairs of the corpus this bar was set from, 617 score below 0.01.
 *
 * The bar is three times the highest score any pair of genuinely distinct
 * published articles reaches. Measured over 36 articles: median 0, 99th
 * percentile 0.0119, highest 0.0328. Measured the other way, against reuse
 * introduced on purpose, 0.10 is about two paragraphs of a fifteen-block
 * article carried over word for word, and a whole section lifted with the rest
 * newly written scores 0.21. So nothing now published trips it and the
 * smallest amount of recycling worth the name does.
 *
 *   node scripts/content/blog-variation.js                     every published article against every other
 *   node scripts/content/blog-variation.js --distribution      the pairwise spread the bar is read from
 *   node scripts/content/blog-variation.js --candidate <file>  a draft against everything published
 *   node scripts/content/blog-variation.js --self-test         the cases the measure has to get right
 *
 * `--candidate` takes a module exporting an array of article objects, `--as`
 * gives the path it would live at so its relative imports resolve, and
 * `--json` prints the verdict for a caller rather than a reader. Exit 1 is a
 * collision, exit 2 is a run that could not reach a verdict.
 */
import path from 'node:path'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SHINGLE_WORDS = 5
const MAX_CONTAINMENT = 0.1

// A lifted run is quoted only far enough for the writer to recognise the
// passage; the score already says how much of it there is.
const QUOTED_WORDS = 22

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CORPUS = path.join(ROOT, 'src/app/data/blog/index.js')

// A candidate is read from wherever it was written rather than from the place
// it belongs, so a relative import it makes that finds nothing beside it is
// resolved against the directory it belongs to. Asking whether the file is
// there rather than matching the importer's own path is what survives the
// temporary directory being reached under two names. The extension is supplied
// because the article files import each other the way the bundler resolves
// them, which Node on its own does not.
let candidateHome = null

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('.')) return nextResolve(specifier, context)
    const spelled = /\.[a-z]+$/i.test(specifier) ? specifier : `${specifier}.js`
    if (candidateHome && !beside(spelled, context.parentURL)) {
      return nextResolve(spelled, {
        ...context,
        parentURL: pathToFileURL(`${candidateHome}/`).href,
      })
    }
    return nextResolve(spelled, context)
  },
})

function beside(specifier, parentURL) {
  try {
    return existsSync(new URL(specifier, parentURL))
  } catch {
    return false
  }
}

/** Every article a module exports, whichever array it exports them in. */
function postsOf(module) {
  const found = new Map()
  for (const value of Object.values(module)) {
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (item && typeof item.slug === 'string' && Array.isArray(item.content)) {
        found.set(item.slug, item)
      }
    }
  }
  return [...found.values()]
}

async function load(file, belongsAt) {
  if (belongsAt) candidateHome = path.dirname(path.resolve(belongsAt))
  try {
    return postsOf(await import(pathToFileURL(path.resolve(file)).href))
  } finally {
    candidateHome = null
  }
}

/**
 * An article as the words a reader would hear.
 *
 * The title and excerpt are in because a recycled article usually carries a
 * recycled excerpt, and the markup is out because `<strong>` moving one clause
 * to the left is not a rewrite.
 */
function wordsOf(post) {
  return [post.title, post.excerpt, ...post.content.map(block => block.text)]
    .join(' ')
    .replace(/<[^>]*>/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

function shingle(words) {
  const set = new Set()
  for (let i = 0; i + SHINGLE_WORDS <= words.length; i++) {
    set.add(words.slice(i, i + SHINGLE_WORDS).join(' '))
  }
  return set
}

/** The share of the smaller set the two hold in common. */
function overlap(a, b) {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const phrase of a) if (b.has(phrase)) shared++
  return shared / Math.min(a.size, b.size)
}

/**
 * The longest stretches of the draft that are already published.
 *
 * Shingles overlap, so a lifted sentence shows up as a run of consecutive
 * shared phrases. Merging the run back into one quotation is what turns a
 * score into something the writer can act on.
 */
function liftedRuns(words, published, limit = 2) {
  const runs = []
  let start = -1
  for (let i = 0; i + SHINGLE_WORDS <= words.length; i++) {
    const shared = published.has(words.slice(i, i + SHINGLE_WORDS).join(' '))
    if (shared && start < 0) start = i
    if (!shared && start >= 0) {
      runs.push(words.slice(start, i + SHINGLE_WORDS - 1))
      start = -1
    }
  }
  if (start >= 0) runs.push(words.slice(start))
  return runs
    .sort((a, b) => b.length - a.length)
    .slice(0, limit)
    .map(run =>
      run.length > QUOTED_WORDS ? `${run.slice(0, QUOTED_WORDS).join(' ')}...` : run.join(' ')
    )
}

function measured(posts) {
  return posts.map(post => {
    const words = wordsOf(post)
    return { slug: post.slug, words, set: shingle(words) }
  })
}

/**
 * Every collision a batch of drafts carries.
 *
 * A draft is held against everything published and against the rest of its own
 * batch, because a run that emits three articles can repeat itself inside one
 * firing and nothing published would show it. An article being edited is not
 * held against the copy of itself already on the blog, which is what the slug
 * match takes out.
 */
function collisionsIn(drafts, published) {
  const found = []
  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i]
    const against = [
      ...published
        .filter(post => post.slug !== draft.slug)
        .map(post => ({ post, where: 'published' })),
      ...drafts.slice(i + 1).map(post => ({ post, where: 'this batch' })),
    ]
    for (const { post, where } of against) {
      const score = overlap(draft.set, post.set)
      if (score < MAX_CONTAINMENT) continue
      found.push({
        draft: draft.slug,
        against: post.slug,
        where,
        score,
        lifted: liftedRuns(draft.words, post.set),
      })
    }
  }
  return found.sort((a, b) => b.score - a.score)
}

function pairs(posts) {
  const out = []
  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      out.push({ a: posts[i].slug, b: posts[j].slug, score: overlap(posts[i].set, posts[j].set) })
    }
  }
  return out.sort((x, y) => y.score - x.score)
}

function printCollisions(found) {
  for (const hit of found) {
    console.error(
      `REFUSED  ${hit.draft}  vs  ${hit.against} (${hit.where})  ` +
        `${hit.score.toFixed(3)} of its ${SHINGLE_WORDS}-word phrases, bar ${MAX_CONTAINMENT.toFixed(3)}`
    )
    for (const run of hit.lifted) console.error(`         already written: "${run}"`)
  }
  console.error(
    `\n${found.length} article${found.length === 1 ? '' : 's'} too close to what is on the blog. ` +
      'Write the piece the blog does not have yet, or fold the new material into the article it repeats.'
  )
}

function distribution(posts) {
  const all = pairs(posts)
  const scores = all.map(pair => pair.score).sort((a, b) => a - b)
  const at = share => scores[Math.min(scores.length - 1, Math.floor(share * scores.length))]
  console.log(
    `${posts.length} articles, ${all.length} pairs, ${SHINGLE_WORDS}-word shingles, containment`
  )
  console.log(
    `  median ${at(0.5).toFixed(4)}   90th ${at(0.9).toFixed(4)}   ` +
      `99th ${at(0.99).toFixed(4)}   highest ${scores[scores.length - 1].toFixed(4)}`
  )
  console.log(
    `  bar ${MAX_CONTAINMENT.toFixed(3)}, ${all.filter(p => p.score >= MAX_CONTAINMENT).length} pairs over it`
  )
  console.log('  closest pairs:')
  for (const pair of all.slice(0, 10))
    console.log(`    ${pair.score.toFixed(4)}  ${pair.a}  ||  ${pair.b}`)
}

function selfTest() {
  const failures = []
  const check = (label, got, want) => {
    if (got !== want)
      failures.push(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
  }
  const article = (slug, sentences) => ({
    slug,
    title: slug.replace(/-/g, ' '),
    excerpt: sentences[0],
    content: sentences.map(text => ({ type: 'p', text })),
  })

  const speed = [
    'A page that takes six seconds to open has already lost the person who opened it.',
    'Your phone is on a truck bed in Baytown and the signal is one bar, not fibre.',
    'Compress the photographs before they ever reach the site and most of the wait goes away.',
    'We test every build throttled, on a real handset, before it is allowed to go live.',
  ]
  const logo = [
    'A mark has to read at the size of a van door and at the size of a favicon.',
    'Two colours is a palette and five is a paint chart nobody can print.',
    'Draw it in black first, because a logo that only works in colour does not work.',
    'The signwriter will thank you for a shape that survives being cut out of vinyl.',
  ]

  // Two articles about different things. Nothing in common but the language.
  const distinct = measured([article('speed', speed), article('logo', logo)])
  check('distinct pair passes', collisionsIn(distinct, []).length, 0)
  check(
    'distinct pair scores under the bar',
    overlap(distinct[0].set, distinct[1].set) < MAX_CONTAINMENT,
    true
  )

  // The same article with the nouns changed, which is the failure this exists
  // for: every phrase that does not touch a swapped word survives intact.
  const swapped = speed.map(line =>
    line
      .replace(/page/g, 'site')
      .replace(/photographs/g, 'images')
      .replace(/Baytown/g, 'Mont Belvieu')
  )
  const clone = measured([article('speed-again', swapped)])
  const published = measured([article('speed', speed)])
  const hits = collisionsIn(clone, published)
  check('noun-swapped rewrite is refused', hits.length, 1)
  check('the refusal names what it collided with', hits[0]?.against, 'speed')
  check('the refusal quotes what was lifted', (hits[0]?.lifted || []).length > 0, true)

  // A run that emits two drafts can repeat itself with nothing published.
  check(
    'a batch is held against itself',
    collisionsIn(measured([article('a', speed), article('b', swapped)]), []).length,
    1
  )

  // The boundary, counted rather than written: ten phrases of a hundred shared
  // is the bar and is refused, nine is under it and is not.
  const spread = (from, count) =>
    new Set(Array.from({ length: count }, (_, i) => `phrase ${from + i}`))
  const hundred = spread(0, 100)
  check(
    'exactly at the bar',
    overlap(hundred, new Set([...spread(90, 10), ...spread(1000, 90)])),
    MAX_CONTAINMENT
  )
  check(
    'one phrase under the bar is not a collision',
    overlap(hundred, new Set([...spread(91, 9), ...spread(1000, 91)])) < MAX_CONTAINMENT,
    true
  )
  check('an article is never held against itself', collisionsIn(published, published).length, 0)

  for (const failure of failures) console.error(`  ${failure}`)
  console.log(
    `blog variation self-test: ${failures.length ? `${failures.length} failed` : 'all cases pass'}`
  )
  return failures.length === 0
}

async function main() {
  const argv = process.argv.slice(2)
  const flag = name => {
    const at = argv.indexOf(name)
    return at < 0 ? null : argv[at + 1]
  }

  if (argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1)

  const published = measured(await load(CORPUS))

  if (argv.includes('--distribution')) {
    distribution(published)
    return
  }

  const candidate = flag('--candidate')
  const json = argv.includes('--json')
  const drafts = candidate ? measured(await load(candidate, flag('--as') || candidate)) : published
  const found = candidate ? collisionsIn(drafts, published) : collisionsIn(drafts, [])

  if (json) {
    console.log(JSON.stringify({ ok: found.length === 0, bar: MAX_CONTAINMENT, collisions: found }))
    process.exit(found.length ? 1 : 0)
  }

  if (found.length) {
    printCollisions(found)
    process.exit(1)
  }

  const worst = pairs(candidate ? [...drafts, ...published] : published)[0]
  const scope = candidate
    ? `${drafts.length} draft${drafts.length === 1 ? '' : 's'} against ${published.length} published`
    : `${published.length} published articles`
  console.log(
    `blog variation: ${scope}, closest ${worst ? worst.score.toFixed(3) : '0.000'}, ` +
      `bar ${MAX_CONTAINMENT.toFixed(3)} - clear`
  )
}

main().catch(error => {
  console.error(`blog variation could not reach a verdict: ${error.message}`)
  process.exit(2)
})
