/**
 * Proves a payment ends with the buyer inside their own console, and that
 * every way it can fail to still leaves them a way in.
 *
 * Nobody signs up for this site. The account is opened by the payment and the
 * buyer is signed into it on the way back from Stripe, which replaces a screen
 * that asked somebody who had just paid to fill a form in. What that removed
 * was a whole family of ways to lose a paid build - a different address typed
 * out of habit, a tab closed on the form, a link back to the site taken instead
 * of the account - and what it added is a credential travelling in a URL.
 *
 * So this reads both halves. That the account is opened on both paths a payment
 * is learned about, because a build attaches to the account matching the
 * address that paid and can attach to nothing if no account is there. And that
 * the key which signs the buyer in is a key rather than the session id: the id
 * rides back in the address bar, gets copied into support threads and sits in
 * history, and a sign-in that the id alone could mint would turn each of those
 * into a way into somebody's console.
 *
 * The failure this guards is silent from every direction. The payment
 * succeeded, the project exists, the console is waiting, and the only sign
 * anything went wrong is a build sitting unopened under an address while its
 * buyer wonders what they bought.
 *
 *   npm run check:buyer-path
 */

import { claimHolds, claimReturnUrl, mintClaim, withinClaimWindow } from '../../lib/stripe/claim.js'
import { claimSpent } from '../../lib/auth/buyer.js'
import { cases, check, finish, same } from '../harness/checks.js'
import { read } from '../harness/files.js'

// Read before the endpoint is imported: it fixes the Stripe key at module load
// and answers 503 without one, and the database client fixes its own pair the
// same way. Nothing here reaches either service - every request the endpoint
// makes is answered by the stub below.
process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_key'
process.env.SUPABASE_URL = 'https://project.supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_not_a_real_key'
process.env.SUPABASE_ANON_KEY = 'anon_not_a_real_key'

const { default: claimEndpoint } = await import('../../api/checkout-claim.js')

const WELCOME = 'src/app/views/auth/Welcome.jsx'
const LOGIN = 'src/app/views/auth/Login.jsx'
const SHELL = 'src/app/views/auth/AuthShell.jsx'
const NEXT = 'src/app/views/auth/AuthNext.jsx'
const READER = 'src/app/data/checkout/checkoutClaim.js'
const CLAIM = 'api/checkout-claim.js'
const CHECKOUT = 'api/checkout.js'
const LINK = 'api/checkout-link.js'
const WEBHOOK = 'api/stripe-webhook.js'
const FORGOT = 'src/app/views/auth/ForgotPassword.jsx'
const ROUTES = 'src/app/constants/routes.js'

/* ----------------------------------------------------------------------- *
 * The endpoint, run rather than read.
 *
 * Stripe and Supabase are both replaced for the duration by something that
 * answers the way they answer and keeps a note of what was asked. What is
 * exercised is the endpoint's own code: the two guards, the order they run in,
 * the account being opened, the key being spent, and what comes back each time.
 * Reading the file can prove the lines are present; only running it can prove a
 * second arrival with the same URL is handed nothing.
 * ----------------------------------------------------------------------- */

const STRIPE = 'https://api.stripe.com/v1/checkout/sessions/'
const AUTH = 'https://project.supabase.test/auth/v1'

const sessions = new Map()
const accounts = new Map()
let asked = []

/** What either service sends back, in the shape its client library reads. */
const answer = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // Without this the client reads the error's `code` as absent, and the
      // already-registered case would be recognised by its sentence alone.
      'x-supabase-api-version': '2024-01-01',
    },
  })

globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const method = init.method || 'GET'
  const sent = init.body ? JSON.parse(init.body) : {}
  asked.push(`${method} ${url.replace(AUTH, '').replace(STRIPE, 'stripe/')}`)

  if (url.startsWith(STRIPE)) {
    const session = sessions.get(url.slice(STRIPE.length))
    return session ? answer(200, session) : answer(404, { error: { message: 'No such session.' } })
  }

  if (url === `${AUTH}/admin/users` && method === 'POST') {
    const address = String(sent.email).toLowerCase()
    if (accounts.has(address)) {
      return answer(422, {
        code: 'email_exists',
        msg: 'A user with this email address has already been registered',
      })
    }
    const made = {
      id: `00000000-0000-4000-8000-${String(accounts.size + 1).padStart(12, '0')}`,
      email: address,
      email_confirmed_at: sent.email_confirm ? new Date().toISOString() : null,
      user_metadata: sent.user_metadata || {},
      app_metadata: {},
    }
    accounts.set(address, made)
    return answer(200, made)
  }

  if (url === `${AUTH}/admin/generate_link` && method === 'POST') {
    const account = accounts.get(String(sent.email).toLowerCase())
    if (!account) return answer(404, { code: 'user_not_found', msg: 'User not found' })
    return answer(200, {
      action_link: 'https://project.supabase.test/auth/v1/verify?token=stub',
      email_otp: '123456',
      hashed_token: `pkce_${account.id}`,
      redirect_to: '',
      verification_type: 'magiclink',
      ...account,
    })
  }

  if (url.startsWith(`${AUTH}/admin/users/`) && method === 'PUT') {
    const id = url.slice(`${AUTH}/admin/users/`.length)
    const account = [...accounts.values()].find(held => held.id === id)
    if (!account) return answer(404, { code: 'user_not_found', msg: 'User not found' })
    Object.assign(account, sent)
    return answer(200, account)
  }

  throw new Error(`nothing stubs ${method} ${url}`)
}

/** One checkout, as Stripe hands it back, with a key already minted for it. */
function paidCheckout(id, { openedAt = Date.now(), key } = {}) {
  const claim = key || mintClaim()
  sessions.set(id, {
    id,
    payment_status: 'paid',
    created: Math.floor(openedAt / 1000),
    customer_details: { email: 'buyer@example.com', name: 'Dana Reyes' },
    metadata: { business_name: 'Lawton Park', claim: claim.hash },
  })
  return claim
}

/** One arrival back from Stripe, answered by the endpoint. */
async function arrives(session, claim) {
  asked = []
  const out = { status: 0, body: null }
  const response = {
    setHeader() {
      return this
    },
    status(code) {
      out.status = code
      return this
    },
    json(payload) {
      out.body = payload
      return this
    },
  }
  await claimEndpoint(
    {
      method: 'POST',
      url: '/api/checkout-claim',
      headers: {},
      socket: { remoteAddress: '203.0.113.7' },
      body: { session, claim },
    },
    response
  )
  return { ...out, asked: [...asked] }
}

const first = paidCheckout('cs_test_thefirstarrival')
const opened = await arrives('cs_test_thefirstarrival', first.token)
const again = await arrives('cs_test_thefirstarrival', first.token)

const forged = paidCheckout('cs_test_akeythatisnotone')
const wrong = await arrives('cs_test_akeythatisnotone', mintClaim().token)

paidCheckout('cs_test_openedlastweek', { openedAt: Date.now() - 8 * 24 * 3600 * 1000, key: forged })
const stale = await arrives('cs_test_openedlastweek', forged.token)

sessions.set('cs_test_neverpaidforat', {
  id: 'cs_test_neverpaidforat',
  payment_status: 'unpaid',
  created: Math.floor(Date.now() / 1000),
  customer_details: { email: 'browser@example.com', name: 'Sam Ellis' },
  metadata: {},
})
const unpaid = await arrives('cs_test_neverpaidforat', first.token)

check('the first arrival opens an account and is handed the way into it', () => {
  same(opened.status, 200, 'the arrival is answered')
  same(opened.body.email, 'buyer@example.com', 'the address that paid comes back')
  same(opened.body.business, 'Lawton Park', 'and the business the checkout was opened for')
  same(Boolean(opened.body.token), true, 'a way in comes back with it')
  same(opened.body.type, 'magiclink', 'named as what it is, so the browser redeems it correctly')

  const made = accounts.get('buyer@example.com')
  same(Boolean(made), true, 'the account exists')
  same(made.user_metadata.full_name, 'Dana Reyes', 'under the name on the card')
  same(
    Boolean(made.email_confirmed_at),
    true,
    'confirmed, since a card at that address is stronger'
  )
})

check('the same URL a second time opens nothing', () => {
  same(again.status, 200, 'the second arrival is still answered')
  same(again.body.email, 'buyer@example.com', 'and still names the address that paid')
  same(again.body.token, undefined, 'but is handed no way in')
  same(
    accounts.get('buyer@example.com').app_metadata.claimed_checkouts.join(),
    'cs_test_thefirstarrival',
    'because the key was spent on the first'
  )
})

check('a key that is not this checkout is refused before an account is touched', () => {
  same(wrong.status, 200, 'the buyer is still named back')
  same(wrong.body.email, 'buyer@example.com', 'so the screen can say what address to use')
  same(wrong.body.token, undefined, 'and handed no way in')
  same(
    wrong.asked.filter(call => !call.startsWith('GET stripe/')).join() || 'nothing',
    'nothing',
    'nothing but Stripe was reached'
  )
})

check('a key past its window is refused the same way', () => {
  same(stale.status, 200, 'the buyer is still named back')
  same(stale.body.token, undefined, 'and handed no way in')
  same(
    stale.asked.filter(call => !call.startsWith('GET stripe/')).join() || 'nothing',
    'nothing',
    'nothing but Stripe was reached'
  )
})

check('a checkout nobody paid for reads back as nothing', () => {
  same(unpaid.status, 404, 'an unpaid session is answered as one that does not exist')
  same(unpaid.body.email, undefined, 'and gives up no address')
  same(accounts.has('browser@example.com'), false, 'nor opens an account for whoever asked')
})

check('the site offers nobody a way to sign up', () => {
  const routes = read(ROUTES)
  same(/key: 'Signup'/.test(routes), false, 'no sign-up route is mounted')
  for (const path of [
    'src/app/components/navigation/Navigation.jsx',
    'src/app/components/navigation/NavUtility.jsx',
    LOGIN,
  ]) {
    same(read(path).includes('/signup'), false, `${path} offers no way to a sign-up screen`)
  }
})

check('both endpoints that open a checkout return the buyer to the same place', () => {
  for (const path of [CHECKOUT, LINK]) {
    const source = read(path)
    same(source.includes('claimReturnUrl(SITE_URL'), true, `${path} uses the shared return address`)
    same(source.includes("'metadata[claim]': claim.hash"), true, `${path} leaves only the hash`)
    // The token itself must never be written onto the session. Anything holding
    // the session could then mint a sign-in from it, which is the whole thing
    // the split is for.
    same(source.includes('claim.token,'), false, `${path} does not send the token to Stripe`)
  }
})

check('the return address carries the session and the key, and nothing else', () => {
  const { token } = mintClaim()
  const url = claimReturnUrl('https://www.taylorurl.com', token)
  same(url.includes('/welcome?'), true, 'a paid checkout lands on the welcome screen')
  same(url.includes('session_id={CHECKOUT_SESSION_ID}'), true, 'Stripe fills the session in')
  same(url.includes(`claim=${token}`), true, 'the key rides back with it')
})

check('a key is recognised only by the checkout that minted it', () => {
  const mine = mintClaim()
  const other = mintClaim()
  same(claimHolds(mine.hash, mine.token), true, 'the key that was minted is accepted')
  same(claimHolds(mine.hash, other.token), false, 'another checkout key is refused')
  same(claimHolds(mine.hash, ''), false, 'no key is refused')
  same(claimHolds(mine.hash, mine.hash), false, 'the hash is not itself a key')
  same(claimHolds('', mine.token), false, 'a session carrying no hash accepts nothing')
  same(claimHolds(undefined, mine.token), false, 'nor one carrying nothing at all')
})

check('a key stops working once its window has gone by', () => {
  const now = Date.now()
  const seconds = at => Math.floor(at / 1000)
  same(withinClaimWindow(seconds(now), now), true, 'a checkout opened now is inside it')
  same(withinClaimWindow(seconds(now - 23 * 3600 * 1000), now), true, 'and one from this morning')
  same(withinClaimWindow(seconds(now - 25 * 3600 * 1000), now), false, 'yesterday is outside it')
  same(withinClaimWindow(undefined, now), false, 'a session with no time on it is outside it')
})

check('a key works once', () => {
  const account = { app_metadata: { claimed_checkouts: ['cs_test_first'] } }
  same(claimSpent(account, 'cs_test_first'), true, 'the checkout already claimed is refused')
  same(claimSpent(account, 'cs_test_second'), false, 'a different checkout is not')
  same(
    claimSpent({}, 'cs_test_first'),
    false,
    'an account that has claimed nothing refuses nothing'
  )

  const endpoint = read(CLAIM)
  same(endpoint.includes('claimSpent(data.user, session.id)'), true, 'the endpoint asks')
  same(endpoint.includes('spendClaim(db'), true, 'and spends the key it is about to answer with')
  // Spent before the token is handed over rather than after it is redeemed:
  // there is no after, because the endpoint has answered and gone by then.
  same(
    endpoint.indexOf('spendClaim(db') < endpoint.indexOf('data.properties.hashed_token,'),
    true,
    'the key is spent before it leaves the function'
  )
})

check('the session id alone opens nothing', () => {
  const endpoint = read(CLAIM)
  // Both cheap guards, and the account is not touched at all until they pass.
  const guarded = endpoint.indexOf('const earned =')
  same(guarded > 0, true, 'the key is weighed before an account is reached for')
  same(endpoint.indexOf('const way = await wayIn(') > guarded, true, 'and reached for only after')
  same(
    endpoint.includes('if (!earned) return response.status(200).json(buyer)'),
    true,
    'a bare id answers with the buyer and no way in'
  )
})

check('an unpaid checkout reads back as nothing at all', () => {
  const endpoint = read(CLAIM)
  same(endpoint.includes("payment_status !== 'paid'"), true, 'an unpaid session is not readable')
  // Three fields, and no figure among them. What a build sold for is nobody's
  // business but ours and the buyer's, and a quoted price readable from a URL
  // is a quoted price a second prospect can read.
  const answered = endpoint.slice(endpoint.indexOf('const buyer = {'))
  for (const filled of ['email,', 'name:', 'business:']) {
    same(answered.includes(filled), true, `the endpoint answers with ${filled.replace(/[,:]/, '')}`)
  }
  for (const figure of ['amount_total', 'build_cents', 'monthly_cents']) {
    same(endpoint.includes(figure), false, `no ${figure} is answered with`)
  }
})

check('the account is opened on both paths a payment is learned about', () => {
  same(read(WEBHOOK).includes('openBuyerAccount(db'), true, 'the webhook opens it')
  same(read(CLAIM).includes('openBuyerAccount(db'), true, 'the returning browser opens it')

  // Before the project rather than after it. `project_open` attaches a build to
  // an account that already exists, and to nothing otherwise.
  const webhook = read(WEBHOOK)
  same(
    webhook.indexOf('openBuyerAccount(db') < webhook.indexOf("db.rpc('project_open'"),
    true,
    'the account is there before the project looks for one'
  )
  // And it must not be able to cost a paid build its row.
  same(
    webhook.includes('stripe-webhook: the buyer account was not opened'),
    true,
    'a refused account is logged rather than raised'
  )
})

check('the key comes out of the address bar as soon as it has been read', () => {
  const welcome = read(WELCOME)
  same(welcome.includes('navigate(id ? `/welcome?session_id='), true, 'the address is replaced')
  same(welcome.includes('replace: true'), true, 'and replaced rather than pushed')
  // The session id stays. A refresh after the key is spent has to still be able
  // to name the address the build is waiting under.
  same(welcome.includes('encodeURIComponent(id)'), true, 'the session id is kept')
})

check('the screen asks a buyer for nothing', () => {
  const welcome = read(WELCOME)
  same(welcome.includes('claimCheckout('), true, 'it spends the key itself')
  same(welcome.includes('verifyOtp('), true, 'and turns what comes back into a session')
  same(welcome.includes('<Navigate to="/console" replace />'), true, 'then leaves for the console')
  // One claim per arrival. The key works once, and a second call spends nothing.
  same(welcome.includes('claimed.current'), true, 'the claim is made once')
})

check('a buyer is offered no way back to the site', () => {
  const shell = read(SHELL)
  // The leave link is the explicit one, sitting directly above the form.
  same(
    /\{!bought && \(\s*<Link to="\/" className="auth-leave">/.test(shell),
    true,
    'the way out is drawn only for a reader who has not paid'
  )
  // And the wordmark is the one somebody clicks without reading it.
  same(
    /bought \? \(\s*<span className="auth-back">/.test(shell),
    true,
    'the wordmark is a mark rather than a door for a buyer'
  )
  same(
    read(WELCOME).includes('bought'),
    true,
    'the screen after a payment says which arrival it is'
  )
})

check('a buyer is not sold what they hold a receipt for', () => {
  const shell = read(SHELL)
  same(
    shell.includes('{bought ? <AuthNext business={business} /> : <AuthCase />}'),
    true,
    'the panel says what happens next rather than why to hold an account'
  )

  // The case panel is what argues for an account, and it must not be what a
  // buyer is looking at.
  const next = read(NEXT)
  for (const sold of ['Live Readers', 'Traffic', 'Sources', 'Page Speed', 'Uptime']) {
    same(next.includes(sold), false, `the buyer panel does not pitch ${sold}`)
  }
})

check('the panel names the three things the tracker opens by asking for', () => {
  // Seeded against every project as it is created, in `project_seed_tasks`.
  // Naming them here means the screen before the console and the screen after
  // it agree, and a buyer can go and find their logo while it loads.
  const next = read(NEXT)
  for (const ask of ['logo', 'words', 'photographs']) {
    same(next.toLowerCase().includes(ask), true, `the panel names ${ask}`)
  }
})

check('a key that does not work still leaves a way in', () => {
  const welcome = read(WELCOME)
  same(
    welcome.includes('`/forgot-password?email=${encodeURIComponent(address)}`'),
    true,
    'the reset carries the address that paid'
  )
  same(welcome.includes("to: '/login'"), true, 'and a buyer who already has a password can use it')
  // Prefilled rather than asked for again. Getting it wrong sends the link
  // nowhere and says nothing about why.
  const forgot = read(FORGOT)
  same(forgot.includes("query.get('email')"), true, 'the reset screen reads the address back')
  same(forgot.includes('autoFocus={!email}'), true, 'focus goes to what is still empty')
})

check('a lookup that fails costs a buyer nothing', () => {
  const reader = read(READER)
  same(reader.includes('return null'), true, 'every failure answers null')
  same(reader.includes('catch {'), true, 'nothing thrown reaches the screen')
  // The screen carries on with nothing and offers a password instead, which is
  // a way in. What must never happen is an error about our plumbing in front of
  // somebody who has just paid.
  same(/\bthrow new\b/.test(reader), false, 'the reader raises nothing of its own')
})

await finish()

console.log(`buyer path: all ${cases.length} cases pass; a payment ends inside the console`)
