/**
 * Checks each channel's cadence metadata is a shape Buffer will accept on an edit.
 *
 * Promoting a draft is an `editPost` that names the post's type for the first
 * time, because a draft is written with no service metadata at all. Buffer
 * validates that transition more strictly than it validates a create: a Google
 * Business whats-new post that arrives without `detailsWhatsNew.button` is
 * refused with `Google Business whats-new posts require button when switching
 * post type`, while the identical metadata on a create is accepted.
 *
 * That asymmetry is why this needs its own check. The queue went on placing
 * posts directly and reporting a healthy runway while every promotion failed,
 * so the only signal was a line in a log nobody reads. A shape checked here
 * fails on the pull request instead.
 *
 *   npm run check:social-metadata
 */
import { CADENCE } from '../../lib/social/buffer.js'

/** The call-to-action values Buffer's `GoogleBusinessPostActionType` accepts. */
const GOOGLE_BUTTONS = new Set(['book', 'call', 'learn_more', 'none', 'order', 'shop', 'signup'])

/**
 * The buttons that are a destination, and so are nothing without a link.
 *
 * `none` draws no button at all and `call` uses the number on the profile
 * rather than a URL. Every other value is a button whose whole content is where
 * it goes, and Google drops one it has no destination for — which reads on the
 * profile exactly like a post nobody thought to put a button on.
 */
const NEEDS_LINK = new Set(['book', 'learn_more', 'order', 'shop', 'signup'])

/** The post types Buffer's `PostTypeGoogleBusiness` accepts. */
const GOOGLE_TYPES = new Set(['event', 'offer', 'whats_new'])

/**
 * The post types an Instagram channel accepts, of the whole `PostType` enum.
 *
 * A reel and a story are a video and a thing that expires, and the queue writes
 * neither. Naming the three keeps a typo landing here rather than as a post
 * Buffer accepts and Instagram refuses when it is due.
 */
const INSTAGRAM_TYPES = new Set(['post', 'reel', 'story'])

/** Where the details for each Google post type are carried. */
const GOOGLE_DETAILS = {
  event: 'detailsEvent',
  offer: 'detailsOffer',
  whats_new: 'detailsWhatsNew',
}

const failures = []
let checks = 0

function check(what, ok) {
  checks += 1
  if (!ok) failures.push(what)
}

for (const [name, cadence] of Object.entries(CADENCE)) {
  check(`${name} declares metadata`, cadence.metadata && typeof cadence.metadata === 'object')
  const services = Object.keys(cadence.metadata ?? {})
  check(`${name} names exactly one service`, services.length === 1)

  for (const service of services) {
    const meta = cadence.metadata[service]
    check(`${name}.${service} names a type`, typeof meta.type === 'string' && meta.type.length > 0)

    if (service === 'instagram') {
      check(`${name} type is one Instagram knows`, INSTAGRAM_TYPES.has(meta.type))

      // `shouldShareToFeed` is non-null in Buffer's schema, so leaving it off
      // is a refused request rather than a default. Checked for being true as
      // well as present: false is the value that publishes a post to the
      // account and puts it nowhere anybody scrolls.
      check(`${name} shares to the feed`, meta.shouldShareToFeed === true)

      // Instagram publishes nothing without media, and the queue is the only
      // thing that knows that before a post is due. A cadence that forgot to
      // say so writes captions that schedule cleanly and fail on the day.
      check(`${name} declares it requires an image`, cadence.requiresImage === true)
      continue
    }

    if (service !== 'google') continue

    check(`${name} type is one Buffer knows`, GOOGLE_TYPES.has(meta.type))
    const details = GOOGLE_DETAILS[meta.type]
    check(`${name} carries ${details}`, meta[details] && typeof meta[details] === 'object')

    // The refusal this whole file exists for.
    if (meta.type === 'whats_new') {
      const button = meta.detailsWhatsNew?.button
      check(`${name} sets a button, which an edit requires`, typeof button === 'string')
      check(`${name} button is one Buffer knows`, GOOGLE_BUTTONS.has(button))

      // A button is what the post is read for, and a button with nowhere to go
      // is dropped by Google without anything being refused here or reported
      // there. The two are written together or the post publishes bare.
      const link = meta.detailsWhatsNew?.link
      if (NEEDS_LINK.has(button)) {
        check(`${name} gives its ${button} button somewhere to go`, typeof link === 'string')
        check(`${name} button link is an address`, /^https:\/\/\S+$/.test(link ?? ''))
      }
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`social metadata: ${failure}`)
  process.exit(1)
}

console.log(`social metadata holds ${checks} checks: every cadence carries a shape an edit accepts`)
