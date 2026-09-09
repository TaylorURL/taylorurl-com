/**
 * What a source is called and which channel it belongs to.
 *
 * The collector files an arrival under the host that sent it and nothing more,
 * so which channel a host belongs to is read from the host's own name. That
 * reading lives here rather than in a section, because the windowed ranking and
 * the live rows are naming the same arrivals and two answers to "is this
 * search" would agree until one of them was edited.
 */

// What the collector calls an arrival that carried no referrer.
export const DIRECT = 'direct'

// A name without a dot is matched against the labels of the host, so a search
// engine is found under any of its country domains and behind any subdomain; a
// name with one is a whole domain, since a two-letter host like `t.co` would
// otherwise be found inside half the web.
const SEARCH = [
  'google',
  'bing',
  'duckduckgo',
  'yahoo',
  'ecosia',
  'brave',
  'yandex',
  'baidu',
  'startpage',
  'qwant',
  'kagi',
  'aol',
]

const SOCIAL = [
  'facebook',
  'fb.com',
  'fb.me',
  'instagram',
  'twitter',
  't.co',
  'x.com',
  'linkedin',
  'lnkd.in',
  'reddit',
  'pinterest',
  'pin.it',
  'tiktok',
  'youtube',
  'youtu.be',
  'threads',
  'bsky.app',
  'mastodon',
  'snapchat',
  'nextdoor',
  'tumblr',
  'quora',
  'discord',
  'whatsapp',
  'telegram',
  'messenger',
]

/** The host a source names, however the collector spelled it. */
export function hostOf(source) {
  return String(source || '')
    .toLowerCase()
    .replace(/^[a-z][\w+.-]*:\/\//, '')
    .split('/')[0]
}

function inFamily(host, names) {
  const labels = host.split('.')
  return names.some(name =>
    name.includes('.') ? host === name || host.endsWith(`.${name}`) : labels.includes(name)
  )
}

export function channelOf(source) {
  const host = hostOf(source)
  if (host === DIRECT) return 'direct'
  if (inFamily(host, SEARCH)) return 'search'
  if (inFamily(host, SOCIAL)) return 'social'
  return 'referral'
}

/**
 * A source as a reader should see it: the host without the `www.` nobody says
 * out loud, and the word "Direct" for an arrival that carried no referrer.
 *
 * A row on the live list is one person, and a person did not come from
 * `www.google.com` - they came from Google. The host is kept otherwise, since
 * which subdomain of a partner sent somebody is the whole answer on a referral.
 */
export function sourceLabel(source) {
  const host = hostOf(source)
  if (!host || host === DIRECT) return 'Direct'
  return host.replace(/^www\./, '')
}
