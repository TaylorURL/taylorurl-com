/**
 * The client post queue, from a terminal or from the daily routine.
 *
 * The queue itself lives in `lib/social/buffer.js`, shared with the scheduled
 * endpoint. What is here is the key and the command line: a workstation and a
 * routine container both reach CryptoFort, so the key is read from the vault at
 * the point of use unless one is already in the environment.
 *
 *   node scripts/social.js status
 *   node scripts/social.js watch
 *   node scripts/social.js announce --slug what-a-plumbers-website-has-to-do
 *   node scripts/social.js announce --slug <slug> --dry-run
 *   node scripts/social.js post --text-file draft.txt --at 2026-09-09T14:00:00Z
 *   node scripts/social.js post --text-file draft.txt --draft
 *   node scripts/social.js post --text-file draft.txt --draft --channel googlebusiness
 *   node scripts/social.js post --text-file draft.txt --draft --channel instagram --image trades
 *   node scripts/social.js cards --channel instagram
 *   node scripts/social.js promote
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { registerHooks } from 'node:module'
import { CADENCE, connect, post, posts, promote, status, wiring } from '../lib/social/buffer.js'
import { CARDS, assetFor, card, landingFor, leastRecentlyUsed } from '../lib/social/cards.js'
import { announce } from '../lib/social/announce.js'
import { summary, watch } from '../lib/social/watch.js'

const CREDENTIAL = 'buffer-personal-key-taylorurl'

// cloud/setup.sh clones cryptofort into the home directory; a workstation keeps
// it beside the other checkouts. Neither is guaranteed, so a missing vault is
// reported rather than assumed.
const VAULT_PATHS = [
  join(homedir(), 'cryptofort', 'dist', 'index.js'),
  join(homedir(), 'Development', 'WebstormProjects', 'cryptofort', 'dist', 'index.js'),
]

// The vault's own credentials, where they sit when the environment does not
// carry them. A workstation keeps them in a locked file and exports nothing, so
// a run started from a terminal meets an empty environment and a full file. A
// container is handed them as variables and keeps no file, until one of those
// variables proves unusable and an override file is written to stand in front of
// it. Reading both, override first, is what lets one path serve a terminal, a
// container, and a container that has been patched.
const ENV_FILES = [join(homedir(), '.cryptofort-override.env'), join(homedir(), '.cryptofort.env')]

// A service role key is a three-segment JWT and nothing else. The environment
// settings that hold one display it masked - the revealed prefix followed by
// U+2022 bullets - and storing that display back into the field keeps the mask
// rather than the key. It is about the right length and opens with the right
// characters, so a presence check passes it on to fetch, which refuses it as a
// non-ByteString header from inside the Supabase client, naming neither the
// variable nor what is wrong with it.
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

function readEnvFile(path) {
  const values = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const text = line.trim()
    if (!text || text.startsWith('#')) continue
    const split = text.indexOf('=')
    if (split === -1) continue
    const name = text.slice(0, split).trim()
    values[name] = text
      .slice(split + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return values
}

/**
 * The four values the vault is opened with, from the environment or the files.
 *
 * An unusable variable does not win. The masked paste is the reason an override
 * file is written at all, and a file that lost to the variable it was written to
 * correct would leave the run failing exactly as it failed before. What is held
 * rather than dropped is the unusable value itself, so the caller can say which
 * of the two was wrong instead of reporting the key as absent.
 */
function vaultConfig() {
  const fromFiles = {}
  for (const path of ENV_FILES) {
    if (!existsSync(path)) continue
    for (const [name, value] of Object.entries(readEnvFile(path))) {
      if (!(name in fromFiles)) fromFiles[name] = value
    }
  }
  const pick = (name, usable = () => true) => {
    const candidates = [process.env[name], fromFiles[name]].filter(Boolean)
    return candidates.find(usable) ?? candidates[0] ?? null
  }
  return {
    url: pick('SUPABASE_URL') ?? 'https://gujgtjqqurildqurpffh.supabase.co',
    serviceKey: pick('SUPABASE_SERVICE_ROLE_KEY', value => JWT.test(value)),
    masterKey: pick('CRYPTOFORT_MASTER_KEY'),
    keyId: pick('CRYPTOFORT_KEY_ID') ?? 'default',
  }
}

async function keyFromVault() {
  const dist = VAULT_PATHS.find(path => existsSync(path))
  if (!dist) return null

  const config = vaultConfig()
  if (!config.masterKey || !config.serviceKey) return null
  if (!JWT.test(config.serviceKey)) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is a masked display of the key rather than the key, ' +
        `so the vault cannot be opened. Write the real one to ${ENV_FILES[0]}, ` +
        'which is read ahead of the variable.'
    )
  }

  const { Vault, Crypto, SupabaseAdapter } = await import(dist)
  const supabase = await import(
    join(dist, '..', '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'index.cjs')
  )
  const createClient = supabase.createClient ?? supabase.default?.createClient

  const adapter = new SupabaseAdapter(createClient(config.url, config.serviceKey))
  await adapter.init()
  const vault = new Vault({
    adapter,
    crypto: new Crypto({ key: config.masterKey, keyId: config.keyId }),
  })
  const record = await vault.get(CREDENTIAL)
  const value = record?.secret ?? record?.value ?? record
  return typeof value === 'string' ? value : (value?.secret ?? null)
}

async function apiKey() {
  if (process.env.BUFFER_API_KEY) return process.env.BUFFER_API_KEY
  const fromVault = await keyFromVault()
  if (fromVault) return fromVault
  throw new Error(
    `no Buffer key: set BUFFER_API_KEY, or make CryptoFort reachable so ${CREDENTIAL} can be read`
  )
}

function flag(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1]
}

const BLOG = new URL('../src/app/data/blog/index.js', import.meta.url)

/**
 * One published article, read from the blog's own data.
 *
 * The article files import each other the way the bundler resolves them, which
 * Node on its own does not, so the extension is supplied on the way through.
 * Registered here rather than at the top of the file so the commands that never
 * read an article are not resolving imports through a hook.
 */
async function articleBySlug(slug) {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const relative = specifier.startsWith('.')
      const spelled = relative && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.js` : specifier
      return nextResolve(spelled, context)
    },
  })

  const { BLOG_POSTS } = await import(BLOG.href)
  const article = BLOG_POSTS.find(candidate => candidate.slug === slug)
  if (!article) throw new Error(`no article on the blog has the slug ${slug}`)
  return article
}

async function main() {
  const command = process.argv[2]
  const key = await apiKey()

  if (command === 'status') {
    console.log(JSON.stringify(await status(key), null, 2))
    return
  }

  // The reading a scheduled run makes, and the only command here whose exit
  // code is the answer. A queue that has stopped publishing reads exactly like
  // a queue with nothing to do, so a watch that always exits zero is one whose
  // report nobody has to open. The three codes are the three things a caller
  // can do next: nothing, look now, or come back once Buffer will answer.
  if (command === 'watch') {
    const answer = await watch(key)
    console.log(JSON.stringify(answer, null, 2))
    // The lines go to stderr and the reading to stdout, so a routine can pipe
    // one into a report and a person reading a terminal still gets sentences.
    console.error(summary(answer))
    if (answer.unread) process.exit(2)
    if (answer.needsAttention) process.exit(1)
    return
  }

  if (command === 'promote') {
    const limit = Number(flag('--limit') ?? 5)
    console.log(JSON.stringify(await promote(key, { limit }), null, 2))
    return
  }

  if (command === 'announce') {
    const slug = flag('--slug')
    if (!slug) throw new Error('announce needs --slug <slug>')

    const article = await articleBySlug(slug)
    const answer = await announce(key, { article, dryRun: process.argv.includes('--dry-run') })
    console.log(JSON.stringify(answer, null, 2))

    // A service the queue took and a service that already held the article both
    // count as settled: the second is what a retry looks like. Nothing settled
    // is a step that published to nobody, and it exits saying so.
    if (!answer.settled) process.exit(1)
    return
  }

  // Which card each channel has gone longest without, so a run picks one on
  // what the queue already holds rather than on what the last run remembered.
  // Answered for any channel, because nothing stops the Page carrying a card
  // too, and ordered least recently used with the never-run ones first.
  if (command === 'cards') {
    const service = flag('--channel') ?? 'instagram'
    const run = connect(key)
    const { organizationId, channels } = await wiring(run)
    const channel = channels.find(candidate => candidate.service === service)
    if (!channel) throw new Error(`no ${service} channel connected to this Buffer account`)

    const all = await posts(run, organizationId)
    const mine = all.filter(candidate => candidate.channelId === channel.id)
    // The destination rides on the answer. Whoever writes the caption picks
    // the card here and then has to name a link; left to remember one, every
    // post got the front door, and a reader who tapped a card about the free
    // Google report landed on a page that does not mention it.
    const ranked = leastRecentlyUsed(mine).map(entry => ({
      key: entry.key,
      alt: entry.alt,
      to: entry.to,
      link: landingFor(entry, service),
      lastUsed: entry.lastUsed === null ? null : new Date(entry.lastUsed).toISOString(),
    }))
    console.log(JSON.stringify({ service, cards: ranked }, null, 2))
    return
  }

  if (command === 'post') {
    const file = flag('--text-file')
    if (!file) throw new Error('post needs --text-file')
    const text = readFileSync(file, 'utf8').trim()
    if (!text) throw new Error(`${file} is empty`)

    const draft = process.argv.includes('--draft')
    const at = flag('--at')
    if (!draft && !at) throw new Error('post needs --at <iso8601>, or --draft')

    const service = flag('--channel') ?? 'facebook'

    // Named rather than picked here. A run that reads `cards` and then names
    // the one it wrote for is a run whose choice is in its own log; one that
    // let the tool choose would pair a caption with whatever the rotation
    // happened to surface between the two calls.
    const wanted = flag('--image')
    if (wanted && !card(wanted)) {
      throw new Error(`no card is called ${wanted}: ${CARDS.map(one => one.key).join(', ')}`)
    }
    if (!wanted && CADENCE[service]?.requiresImage) {
      throw new Error(`${service} needs --image <card>, because it publishes no post without one`)
    }
    const assets = wanted ? [assetFor(card(wanted))] : []

    // A caption that names no address gets the card's own, tagged for the
    // channel it is going out on. A caption that already carries a link is
    // left alone: whoever wrote it was pointing somewhere on purpose, and a
    // second address under the first is two things to tap.
    const carried =
      wanted && !/https?:\/\//.test(text) ? `${text}\n\n${landingFor(card(wanted), service)}` : text

    console.log(
      JSON.stringify(await post(key, { text: carried, at, draft, assets, service }), null, 2)
    )
    return
  }

  console.error(
    'usage: social.js status | social.js watch | social.js promote [--limit N] | ' +
      'social.js announce --slug SLUG [--dry-run] | ' +
      'social.js cards [--channel SERVICE] | ' +
      'social.js post --text-file F (--at ISO | --draft) [--channel SERVICE] [--image CARD]\n' +
      'watch exits 0 when the queue is publishing, 1 when something needs ' +
      'doing, and 2 when Buffer would not answer and it could not tell.'
  )
  process.exit(1)
}

main().catch(error => {
  // The code goes first where there is one. A run that gave up waiting for
  // Buffer to let it back in is a state to come back to in an hour, and the
  // routine reading this output has to tell it from a key that is simply wrong.
  console.error(error.code ? `${error.code}: ${error.message}` : error.message)
  process.exit(1)
})
