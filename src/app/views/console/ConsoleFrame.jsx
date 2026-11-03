import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Seo from '@components/Seo'
import { breadcrumbSchema } from '@constants/seo'
import ConsoleShell from '@components/account/ConsoleShell'
import Waiting from '@components/app-shell/Waiting'
import { useDeferredWait } from '@hooks/chrome/useDeferredWait'
import { useToast } from '@hooks/chrome/useToast'
import { faultMessage } from '@utils/faults'
import { SUPPORT_EMAIL } from '@constants/navigation'
import { useAnalyticsFeed } from '@hooks/console/useAnalytics'
import { SAMPLE_BUSINESS, usePreviewClient } from '@hooks/console/usePreviewClient'
import { useSession } from '@hooks/session/useSession'
import { askWithLadder } from '@hooks/session/readSession'
import { supabase } from '@data/supabase/supabaseClient'
import { ConsoleBar } from './shell/ConsoleBar'
import { ConsoleSidebar } from './shell/ConsoleSidebar'
import { ConsoleStrip } from './shell/ConsoleStrip'
import { menuSections, SECTIONS, sectionHref } from './lib/sections'
import PreviewStrip from './shell/PreviewStrip'
import { Panel } from './ui'
import { Figures } from './Figures'
import {
  bucketLabel,
  bucketTitle,
  compactCount,
  duration,
  fullCount,
  percent,
} from '../analytics/lib/format'
import { withCountedPages } from '../analytics/lib/counted'

// Live figures move on their own; the windowed ones only move as hits land in
// them, and a 30-day total does not change visibly in thirty seconds.
// The presence window the collector counts "now" over. The payload states the
// real one and wins the moment it lands; this is only what the caption reads on
// the first frame, before there is an answer to read.
const LIVE_WINDOW_MINUTES = 10

const LIVE_POLL_MS = 10_000
const SITE_POLL_MS = 30_000
const OVERVIEW_POLL_MS = 60_000

// What somebody is told when the console could not put their session back and
// signs them out from under a screen they were reading. The sign-in form is
// where they land either way; without a word beside it, the console reads as
// having thrown them out for nothing.
const SESSION_GONE = 'Your session ended. Sign in to pick up where you were.'

// And what somebody is told when the console could not find out whether they
// are signed in. The distinction is the whole fix: that sentence says the
// session is over, this one says nothing is known about it yet, and the console
// used to say the first for both.
const SESSION_UNREAD = 'Your session could not be checked. Your connection dropped, so try again.'

// The head description a console URL falls back to when it matches no listed
// section, which is only reachable while a route is being added.
const CONSOLE_META =
  'The traffic and uptime figures for every site TaylorURL builds and looks after: who is reading, which pages they open, and where they arrive from.'

// The column width survives a reload, because a reader who narrowed it once
// narrowed it for a reason and re-narrowing it every visit is the console
// arguing with them.
const NARROW_KEY = 'taylorurl_console_narrow'

// So does the scope. A reader who came back to look at one site is coming back
// to the same site, and a console that reopens on the whole account every time
// makes them pick it again before they can read anything.
//
// It is stored as the ids joined by commas, and an empty store is every site.
// A single id therefore reads the same written by the version that stored one
// site and by the one that stores a set, which is what carries a scope across
// the change rather than dropping the reader back on the whole account.
const SCOPE_KEY = 'taylorurl_console_scope'

// Both settings are read after the first render rather than during it. Every
// console route is written to static HTML at build time and served whole, so
// the render that adopts that markup has to come out as the markup it was
// handed. The build has no store to read, so it writes the wide column and the
// whole account; a render in the browser that already held the reader's
// settings would draw a narrowed column into a wide one, and React answers a
// tree that does not match by throwing the served page away and drawing it
// again. The defaults stand for that one render and the remembered settings
// arrive on the frame after it, which is the same shape `useModifierLabel` and
// `useSessionGlimpse` already use for the same reason.
function storedNarrow() {
  try {
    return window.localStorage.getItem(NARROW_KEY) === 'true'
  } catch {
    // Private browsing refuses the read; the wide column is the right default.
    return false
  }
}

function storedScope() {
  try {
    const held = window.localStorage.getItem(SCOPE_KEY) || ''
    return held.split(',').filter(Boolean)
  } catch {
    // The account opens on every site, which is where a first visit starts.
    return []
  }
}

export default function ConsoleFrame() {
  const {
    session,
    checking,
    mfaPending,
    unreachable: sessionUnread,
    retryRead,
    signOut,
    email,
  } = useSession()
  const toast = useToast()
  // A session already in storage comes back in a few milliseconds, which is
  // shorter than the line saying so takes to read. This decides whether it is
  // worth drawing at all, and keeps it on screen long enough to be read once it
  // has been.
  const sessionWait = useDeferredWait(checking)
  const location = useLocation()
  const token = session?.access_token ?? null
  const [days, setDays] = useState(7)
  const [siteIds, setSiteIds] = useState([])
  const [narrow, setNarrow] = useState(false)
  // Whether the remembered settings have been read back yet. The two effects
  // that persist them are the same two that would overwrite them with the
  // defaults on the commit that adopts the page, so they wait for this.
  const [adopted, setAdopted] = useState(false)
  const [drawer, setDrawer] = useState(false)

  // What the scope comes to for the rest of the console. One site is still one
  // site, so every section that reads `siteId` reads what it always did; a set
  // of two carries no single id, and the sections fall to the reading they use
  // for the account - over the two sites the feed was narrowed to.
  const siteId = siteIds.length === 1 ? siteIds[0] : null
  // The identity of the scoped feed. The joined string is what the memo hangs
  // on, since an array rebuilt each render would restart the poll every tick.
  const scopeKey = siteIds.join(',')

  const overviewParams = useMemo(() => ({ days }), [days])
  const siteParams = useMemo(
    () => ({ sites: scopeKey ? scopeKey.split(',') : [], days }),
    [scopeKey, days]
  )

  const live = useAnalyticsFeed({ token, view: 'live', intervalMs: LIVE_POLL_MS })
  const overview = useAnalyticsFeed({
    token,
    view: 'overview',
    params: overviewParams,
    intervalMs: OVERVIEW_POLL_MS,
  })
  const site = useAnalyticsFeed({
    token,
    view: 'site',
    params: siteParams,
    intervalMs: SITE_POLL_MS,
  })

  // Who is signed in, and who the console is drawing for. The same value for
  // everybody except an admin who has asked to be shown the client's console,
  // and keeping the two apart is what makes that request safe: every menu,
  // every section and every branch downstream reads the second, while the
  // control that offers the preview and the strip that announces it read the
  // first. Collapsed into one, an admin in a preview would have no way to know
  // they were an admin and no way back out of it.
  //
  // The analytics feeds keep polling either way, which is deliberate: the real
  // role comes out of the overview read, so a preview that stopped it would
  // strand itself with no way to know the reader is an admin and no way to
  // correct a flag that reached the wrong account. What those feeds read is
  // this account's own figures and never a client's, because the collector is
  // keyed on the caller's session.
  const signedInRole = overview.data?.role
  const { preview, enterPreview, leavePreview } = usePreviewClient(signedInRole)

  // The studio's own people looking at a prospect's preview site are not the
  // prospect looking at it. The previews on *.taylorurl.com read this cookie
  // and leave the visit uncounted, so signing in here once is enough for that
  // browser.
  useEffect(() => {
    if (signedInRole !== 'admin') return
    if (!window.location.hostname.endsWith('taylorurl.com')) return
    document.cookie =
      'tu_staff=1; domain=.taylorurl.com; path=/; max-age=315360000; samesite=lax; secure'
  }, [signedInRole])

  // The column width and the scope, picked up from the store once the served
  // page has been adopted. Nothing is set where nothing is held, so a first
  // visit does not pay a second render for a setting it has not made.
  useEffect(() => {
    setAdopted(true)
    const held = storedScope()
    if (held.length) setSiteIds(held)
    if (storedNarrow()) setNarrow(true)
  }, [])

  useEffect(() => {
    if (!adopted) return
    try {
      window.localStorage.setItem(NARROW_KEY, String(narrow))
    } catch {
      // Nothing to do; the column simply starts wide next time.
    }
  }, [adopted, narrow])

  // The drawer is a phone control and a route change is what it was opened to
  // do, so arriving somewhere closes it.
  useEffect(() => {
    setDrawer(false)
  }, [location.pathname])

  // The work region scrolls, not the document, so the window scroll a page
  // change performs never reaches it: without this a section opened from
  // halfway down the last one opens halfway down itself. It waits for the
  // outgoing section to fade rather than running on the URL change, so the
  // region does not jump under a reader who is still looking at it, and focus
  // follows the scroll for the same reason it does everywhere else on the
  // site - without it a reader on the keyboard is left in the column they
  // navigated from and has to tab back across to the work.
  const workRef = useRef(null)
  const arrived = useRef(false)
  useEffect(() => {
    if (!arrived.current) {
      arrived.current = true
      return
    }
    workRef.current?.scrollTo({ top: 0 })
    workRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  const role = preview ? 'client' : signedInRole
  const liveSites = useMemo(() => live.data?.sites || [], [live.data])
  const sites = useMemo(() => {
    const rows = overview.data?.sites || []
    // The live count refreshes six times more often than the overview, so a
    // column headed "now" takes it from the live feed rather than showing a
    // minute-old figure.
    return rows.map(row => ({
      ...row,
      live: liveSites.find(entry => entry.site_id === row.site_id)?.live ?? row.live,
    }))
  }, [overview.data, liveSites])

  // Which sites the account holds, as last read.
  //
  // The overview is keyed on the window, so moving from 7 days to 30 empties
  // `sites` for the length of the read - and which sites exist is not a fact
  // about the window. Deriving the chooser, the heading and every "which site"
  // branch from the empty list made the console blink to All Sites and back on
  // every window button, and took the status board's scope and the Google
  // section's scoped reading with it.
  //
  // The figures on these rows still belong to the window and are read through
  // `sites`, which waits. This answers the other question only: what there is.
  const known = useRef([])
  if (sites.length) known.current = sites
  const knownSites = sites.length ? sites : known.current

  // What the console picks on its own, before anybody touches the chooser.
  //
  // One site is its own scope: selecting it by hand every visit would be a step
  // with one option, which is not a choice. Several sites open on all of them,
  // which is the reading that answers "how is everything doing" - and the one a
  // reader can narrow in a click.
  //
  // A remembered site the account can no longer see is dropped rather than
  // held: it scopes every section to a site whose figures the collector will
  // not answer for, which reads as a console that has gone empty.
  // It waits for the overview to actually answer rather than for the list to be
  // non-empty: a collector that is down answers with nothing, and dropping a
  // remembered site over that would move the reader's scope every time the feed
  // hiccuped.
  useEffect(() => {
    if (!overview.data) return
    if (!sites.length) {
      if (siteIds.length) setSiteIds([])
      return
    }
    if (sites.length === 1) {
      if (scopeKey !== sites[0].site_id) setSiteIds([sites[0].site_id])
      return
    }
    // A site that has gone is dropped from the scope and the rest of it stands.
    // Clearing the whole selection because one member went would take away a
    // comparison the reader set up over the sites that are still there.
    const held = siteIds.filter(id => sites.some(row => row.site_id === id))
    if (held.length !== siteIds.length) setSiteIds(held)
  }, [overview.data, siteIds, scopeKey, sites])

  useEffect(() => {
    if (!adopted) return
    try {
      if (scopeKey) window.localStorage.setItem(SCOPE_KEY, scopeKey)
      else window.localStorage.removeItem(SCOPE_KEY)
    } catch {
      // Nothing to do; the console simply opens on every site next time.
    }
  }, [adopted, scopeKey])

  // Every chooser goes through here, so a site picked in the column or under
  // the heading lands the console in the same state.
  const pickSite = useCallback(next => {
    setSiteIds(next === null ? [] : [next])
  }, [])

  /**
   * Adds a site to the scope or takes it out, leaving the rest of it alone.
   *
   * Taking the last one out is the whole account rather than nothing, since a
   * console showing no site at all is a console with nothing to read.
   */
  const toggleSite = useCallback(id => {
    setSiteIds(held => (held.includes(id) ? held.filter(one => one !== id) : [...held, id]))
  }, [])

  // The name a scope goes by outlives the window's figures, so a section asking
  // which site it is answering for is never told "all of them" mid-read. The
  // count a set goes by is taken against the same list for the same reason.
  const scopeName = siteId ? (knownSites.find(row => row.site_id === siteId)?.name ?? null) : null

  // The breakdown read answers for one site when one is picked and for every
  // visible site when none is, so it is the source either way. Its `site` key
  // is null for the account-wide read, which is what the header reads to label
  // the scope.
  //
  // The console's own pages come out of it here. The tracker stopped filing
  // them, which fixes every window from that deploy forward and none of the
  // ones already recorded, so the rule is read a second time over the rows -
  // and it is read here rather than in the two sections that draw pages, so
  // there is one answer to what counts as a visit rather than two that agree
  // until one of them is edited. A row only names its site across more than one,
  // so the scoped read hands the name in.
  const detail = useMemo(() => withCountedPages(site.data, scopeName), [site.data, scopeName])
  const totals = detail?.totals || overview.data?.totals
  // Across the scope rather than for one site or for the account, so a set of
  // two reads the two added together rather than the whole estate.
  // How far back "now" reaches on the live figures. It is read from the payload
  // rather than written here, so the caption under the count cannot drift away
  // from the window the count was actually taken over - which is what a sentence
  // typed once beside a figure does the first time the window moves.
  const liveWindowMinutes = Math.round(live.data?.window_minutes ?? LIVE_WINDOW_MINUTES)
  const liveNow = siteIds.length
    ? liveSites
        .filter(entry => siteIds.includes(entry.site_id))
        .reduce((sum, entry) => sum + (entry.live || 0), 0)
    : (live.data?.total ?? 0)
  // Every section draws from both reads, and the breakdown is the slower of
  // the two. Waiting for only the one that happens to land first is what put
  // zeros and empty tables on screen ahead of the figures that fill them, so
  // the console is loading until both have answered the question being asked.
  const loading = site.loading || overview.loading
  const liveLoading = live.loading
  const feedError = site.error || overview.error
  const unreachable = Boolean(feedError) && !loading && !detail && !overview.data
  // A client whose account has no site linked to it yet.
  const unassigned = role === 'client' && !overview.loading && !sites.length

  const sections = useMemo(
    () => menuSections({ signedIn: Boolean(session), role }),
    [session, role]
  )

  // Every feed on screen, read again in one call rather than the feed that
  // happens to own the section being looked at: the header's figures come from
  // a different feed than the table underneath them, so a recovered session
  // that re-read only one would leave half the screen refused.
  const refresh = useCallback(
    () => Promise.all([live.refresh(), overview.refresh(), site.refresh()]),
    [live, overview, site]
  )

  const refused = live.rejected || overview.rejected
  const recovering = useRef(false)
  useEffect(() => {
    // A refused read is usually a stale token rather than a dead account: the
    // browser is holding one issued before the account changed, and refreshing
    // it fixes the read without the reader doing anything.
    //
    // Signing out on the first refusal is what turned that into a locked door.
    // A token for an account that no longer exists refuses, the console ends
    // the session, and the next sign-in hands the same stale token straight
    // back to the same read, so the reader signs in and is thrown out again
    // with nothing on screen to say why. Only a refresh that itself fails
    // proves the session is gone, and that is the one case worth ending.
    //
    // A recovery that works is silent, which is the point of it: the reader was
    // never told the read was refused and has nothing to be told now. A
    // recovery that does not is the opposite - the console empties, the
    // sign-in form takes its place, and without a sentence the reader is left
    // to guess whether they did it. The notice outlives the route change,
    // because it is thrown from above the router.
    if (!refused || !session || recovering.current) return
    recovering.current = true
    // Signing out is itself a request and can be refused, which puts the same
    // failure through here twice. The reader is told once.
    let spoken = false
    const ended = cause => {
      if (!spoken) {
        spoken = true
        toast(faultMessage(cause, SESSION_GONE), 'error')
      }
      return signOut()
    }
    // And the refresh is given the ladder rather than one attempt. This is the
    // same fault as the session read had, one step further in: a single dropped
    // request here answered "the session is gone", and the console acted on it
    // by signing the reader out of a session that was fine. Only a refresh that
    // was answered, and answered with a refusal, proves anything - so a request
    // that never landed is asked again before any of that is believed.
    askWithLadder(() => supabase.auth.refreshSession())
      .then(({ answer, cause, unreachable: lost }) => {
        // Every rung spent without an answer. The session is unknown, not over,
        // and the reader keeps it: the next read, or the next tick of the
        // poller, asks again from a page they are still on.
        if (lost) return undefined
        if (cause || !answer?.data?.session) return ended(cause)
        return refresh()
      })
      .catch(ended)
      .finally(() => {
        recovering.current = false
      })
  }, [refused, session, signOut, refresh, toast])

  // A path with a trailing slash is the same path. Some hosts add one on a
  // directory-style URL, and a section matched by string equality against the
  // unslashed form reads as no section at all - which sends a signed-out
  // reader away from the one page they are allowed to open.
  const here = location.pathname.replace(/\/+$/, '') || '/'

  // Every section is its own URL, so every section answers for its own head:
  // one title and one description each, taken from the same catalogue the menu
  // reads. Without it every console URL shares one title, and a crawler reading
  // them finds a dozen copies of the same page.
  const section = useMemo(() => SECTIONS.find(entry => sectionHref(entry) === here), [here])
  const sectionTitle = section ? section.title || `${section.label} - Console` : 'Console'
  const head = {
    // An admin runs the real console and a client's in two tabs, and the tab
    // strip is where they tell them apart before pressing one.
    title: preview ? `Client Preview - ${sectionTitle}` : sectionTitle,
    description: section ? section.meta : CONSOLE_META,
  }

  // The strip is the account's traffic, so it belongs to the sections that
  // answer to traffic. A section that measures something else carries its own
  // figures in the same place rather than six that say nothing about it, and
  // the section that answers for the account measures no traffic at all.
  const figures = section?.figures !== false && !section?.account

  // The window, the re-read and the feed's own state all act on the traffic
  // feeds. On a section that reads none of them all three are controls that
  // move nothing on screen, which is worse than no control at all: pressing
  // one and seeing the page sit still reads as a page that is broken.
  const traffic = !section?.account

  // Status is the one section anyone may read: it is the uptime monitor's feed,
  // which says nothing about any one account. Everything else is an account's
  // own figures.
  const onStatus = here === '/console/status'

  // A session that owes a second factor is a session that has not finished
  // arriving, so it opens what a signed-out visitor opens and is sent to the
  // code step on anything else.
  const publicOnly = !session || mfaPending

  // The buckets behind the window, which is what gives the promoted figure
  // something to draw. Two of the six have one - the collector counts
  // pageviews and sessions per bucket and nothing else - so the other four
  // fill the room with what they are made of instead, or leave it empty.
  const windowLabel = days === 1 ? 'last 24 hours' : `last ${days} days`
  const series = useMemo(
    () => detail?.series || overview.data?.series || [],
    [detail, overview.data]
  )
  const grain = detail?.grain || overview.data?.grain || 'day'

  /**
   * The strip above every section, as records.
   *
   * Every caption here is a second fact rather than a definition of the label
   * above it. The definitions have not gone: they sit on the label, where a
   * reader who wants one asks for it once instead of being handed it on every
   * read for the life of the account.
   */
  const trafficFigures = useMemo(() => {
    const drawn = key =>
      series.length > 1
        ? {
            kind: 'series',
            points: series.map(point => ({
              at: bucketLabel(point.bucket, grain),
              value: point[key] || 0,
              text: fullCount(point[key] || 0),
            })),
          }
        : null

    const visitors = totals?.visitors || 0
    const fresh = Math.min(totals?.new_visitors || 0, visitors)
    const back = Math.max(0, visitors - fresh)
    const sessions = totals?.sessions || 0
    const pageviews = totals?.pageviews || 0
    const bounced = Math.round((sessions * (totals?.bounce_rate || 0)) / 100)
    const stayed = Math.max(0, sessions - bounced)
    const perVisitor = visitors ? pageviews / visitors : 0
    const perSession = sessions ? pageviews / sessions : 0
    const busiest = series.length
      ? series.reduce((top, point) => (point.pageviews > top.pageviews ? point : top))
      : null

    return [
      {
        key: 'live',
        label: 'Online Now',
        gloss: 'Anybody whose last hit landed inside the window.',
        value: String(liveNow),
        caption: `last ${liveWindowMinutes} minutes`,
        window: `last ${liveWindowMinutes} minutes`,
        tone: liveNow > 0 ? 'accent' : 'plain',
        pulse: liveNow > 0,
        loading: live.loading,
      },
      {
        key: 'visitors',
        label: 'Visitors',
        gloss: 'People, counted once each however often they came back.',
        value: compactCount(visitors),
        caption: `${compactCount(fresh)} first time`,
        window: windowLabel,
        loading,
        facts: [
          [compactCount(fresh), 'first time'],
          [compactCount(back), 'came back'],
          perVisitor ? [perVisitor.toFixed(1), 'pages each'] : null,
        ].filter(Boolean),
        room: visitors
          ? {
              kind: 'parts',
              parts: [
                {
                  key: 'visitors',
                  label: 'First time',
                  value: fresh,
                  text: compactCount(fresh),
                  tone: 'accent',
                },
                { label: 'Came back', value: back, text: compactCount(back) },
              ],
            }
          : null,
      },
      {
        key: 'pageviews',
        label: 'Pageviews',
        gloss: 'Every page loaded, repeats inside one visit included.',
        value: compactCount(pageviews),
        caption: perVisitor ? `${perVisitor.toFixed(1)} per visitor` : null,
        window: windowLabel,
        loading,
        facts: [
          perVisitor ? [perVisitor.toFixed(1), 'per visitor'] : null,
          perSession ? [perSession.toFixed(1), 'per session'] : null,
          busiest ? [bucketTitle(busiest.bucket, grain), 'busiest'] : null,
        ].filter(Boolean),
        room: drawn('pageviews'),
      },
      {
        key: 'sessions',
        label: 'Sessions',
        gloss: 'A visit, not a person. One person coming back twice is two.',
        value: compactCount(sessions),
        caption: perSession ? `${perSession.toFixed(1)} pages each` : null,
        window: windowLabel,
        loading,
        facts: [
          perSession ? [perSession.toFixed(1), 'pages each'] : null,
          [compactCount(bounced), 'left on the first page'],
          [duration(totals?.avg_session_ms), 'average length'],
        ].filter(Boolean),
        room: drawn('sessions'),
      },
      {
        key: 'avg',
        label: 'Avg Session',
        gloss: 'First hit to last, averaged across every session in the window.',
        value: duration(totals?.avg_session_ms),
        caption: sessions ? `across ${compactCount(sessions)} sessions` : null,
        window: windowLabel,
        loading,
      },
      {
        key: 'bounce',
        label: 'Bounce',
        gloss: 'The share of sessions that left after one page.',
        value: percent(totals?.bounce_rate),
        caption: sessions ? `${compactCount(bounced)} of ${compactCount(sessions)}` : null,
        window: windowLabel,
        loading,
        facts: [
          [compactCount(bounced), 'left on the first page'],
          [compactCount(stayed), 'opened another'],
        ],
        room: sessions
          ? {
              kind: 'parts',
              parts: [
                {
                  key: 'bounce',
                  label: 'Left after one',
                  value: bounced,
                  text: compactCount(bounced),
                  tone: 'warn',
                },
                { label: 'Opened another', value: stayed, text: compactCount(stayed) },
              ],
            }
          : null,
      },
    ]
  }, [grain, live.loading, liveNow, liveWindowMinutes, loading, series, totals, windowLabel])

  // Status never waits on the session. It needs none, and the wait is what a
  // crawler and a first paint would otherwise both get instead of the board.
  if (sessionWait.blocked && !onStatus) {
    return (
      <ConsoleShell>
        <Seo title={head.title} description={head.description} path={location.pathname} noIndex />
        <Waiting visible={sessionWait.visible} label="Checking your session" />
      </ConsoleShell>
    )
  }

  // The session could not be read at all - every rung of the ladder spent on a
  // request that never landed. That is not a signed-out visitor, and sending
  // one to the sign-in form is what this fault did: the session was still in
  // storage, the nav bar still said they were signed in, and the console asked
  // them to sign in again for a connection that dropped one request. So the
  // reader is told what happened in the site's own sentence for it and given
  // the ask back, on the page they were already on.
  if (sessionUnread && !session && !onStatus) {
    return (
      <ConsoleShell>
        <Seo title={head.title} description={head.description} path={location.pathname} noIndex />
        <div
          role="alert"
          className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
        >
          <p className="section-label text-accent">Connection Lost</p>
          <h1 className="display-5 max-w-md font-semibold leading-[1.1] tracking-tightest [text-wrap:balance]">
            {faultMessage(null, SESSION_UNREAD)}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button className="btn btn-primary" type="button" onClick={retryRead}>
              Try Again
            </button>
            <a className="btn btn-secondary" href="/console/status">
              Go to Status
            </a>
          </div>
        </div>
      </ConsoleShell>
    )
  }

  if (publicOnly && !checking) {
    // A bare /console lands on the part a visitor can see; anything else asks
    // them to sign in and comes back to where they were headed.
    if (here === '/console') return <Navigate to="/console/status" replace />
    if (!onStatus) return <Navigate to="/login" state={{ from: here }} replace />
  }

  // A section marked for an admin is shut to everybody else, not merely absent
  // from their menu: typing its address sends anybody else back to the
  // Overview. The role rides in on the overview read, so this waits for that
  // read to land rather than throwing an admin off their own section on every
  // refresh.
  const roleKnown = preview || Boolean(overview.data)
  if (!publicOnly && roleKnown && role !== 'admin' && section?.admin) {
    return <Navigate to="/console" replace />
  }

  // What the chrome is handed, which is not always what the console is
  // holding. The scope belongs to this admin and is remembered across visits,
  // so a preview that cleared it would take a setting away in order to borrow
  // it. A client waiting on a build owns no site at all, so the choosers, the
  // palette and the line under the heading are handed the empty scope a client
  // has rather than the one this account holds.
  const shownSites = publicOnly || preview ? [] : knownSites
  const shownScope = preview ? [] : siteIds
  const shownName =
    shownScope.length === 1
      ? (shownSites.find(row => row.site_id === shownScope[0])?.name ?? null)
      : null
  const scopeLabel = shownName
    ? shownName
    : shownScope.length
      ? `${shownScope.length} of ${shownSites.length} Sites`
      : 'All Sites'

  // The sites the console is showing, which is the scope where one is set and
  // every site where none is. Sections draw their per-site lists from this, so
  // narrowing the scope narrows those lists without each of them filtering.
  const inScope = siteIds.length ? sites.filter(row => siteIds.includes(row.site_id)) : sites

  const context = {
    // More than one site on screen, which is when a row has to say which site
    // it belongs to. Two chosen sites need that as much as the whole account.
    bulk: !siteId,
    detail,
    knownSites,
    live,
    liveLoading,
    liveNow,
    liveSites,
    loading,
    overview,
    inScope,
    role,
    scopeLabel,
    scopeName,
    siteId,
    siteIds,
    unreachable,
    windowLabel,
  }

  // What the section underneath is answering about, and whether that is a
  // choice. Every section that reads a site has two readings - the one site, or
  // every site at once - so the line naming the scope is the control that moves
  // between them. The sections answering for the account have one reading, and
  // naming a site over a build or a roll of accounts states a scope they
  // do not have and cannot be narrowed to.
  const chooseScope = !publicOnly && section?.scope !== false
  const scopeLine = publicOnly
    ? 'Every site under care'
    : section?.scope === false
      ? email || 'This account'
      : scopeLabel

  return (
    <ConsoleShell>
      <Seo
        title={head.title}
        description={head.description}
        path={location.pathname}
        noIndex={!onStatus}
        schema={
          onStatus
            ? [
                breadcrumbSchema([
                  { name: 'Home', path: '/' },
                  { name: 'Console', path: '/console' },
                  { name: 'Status', path: '/console/status' },
                ]),
              ]
            : undefined
        }
      />

      {/* The wrapper is in the tree whether or not there is a preview, and is
          `display: contents` when there is not, so the frame's own grid and
          every rule under it are untouched off it. Standing, the strip and the
          console share the window rather than one being laid over the other: a
          band over the frame covers the account panel, and a band that pushes a
          full-height frame down pushes its last row off the bottom of the
          screen. */}
      <div className="console-previewing" data-on={preview}>
        {preview ? <PreviewStrip business={SAMPLE_BUSINESS} onLeave={leavePreview} /> : null}

        <div className="console-frame" data-narrow={narrow} data-drawer={drawer}>
          {/* The column is one element at every width: a rail on a desktop, and
            the same rail slid in from the edge on a phone, so a section reached
            on one is in the same place on the other. */}
          <div className="console-rail">
            <ConsoleSidebar
              sections={sections}
              collapsed={narrow}
              onToggle={() => setNarrow(open => !open)}
              email={publicOnly ? null : email}
              role={role}
              sites={shownSites}
              siteIds={shownScope}
              scopeLabel={scopeLabel}
              onPickSite={pickSite}
              onToggleSite={toggleSite}
              onSignOut={signOut}
              canPreview={signedInRole === 'admin'}
              preview={preview}
              onPreview={enterPreview}
            />
          </div>
          <button
            type="button"
            className="console-scrim"
            aria-label="Close the Menu"
            onClick={() => setDrawer(false)}
          />

          <div className="console-main">
            <ConsoleBar
              title={publicOnly ? 'System Status' : section?.label || 'Overview'}
              group={section?.group}
              drawer={drawer}
              onDrawer={() => setDrawer(open => !open)}
              sites={shownSites}
              siteIds={shownScope}
              scopeLabel={scopeLabel}
              onPickSite={pickSite}
              onToggleSite={toggleSite}
              chooseScope={chooseScope}
              scopeLine={scopeLine}
              days={days}
              onPickWindow={setDays}
              traffic={traffic}
              publicOnly={publicOnly}
              reading={loading || liveLoading}
              signInTo={here}
            />

            {/* The same sections as the column, in a row, for the widths at
                which the column is a drawer. A phone should move between
                sections without opening anything. */}
            <ConsoleStrip sections={sections} />

            <div className="console-work" ref={workRef} tabIndex={-1}>
              {publicOnly || !figures ? null : unassigned ? (
                <Panel title="Your Sites">
                  <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
                    No sites are linked to this account yet.{' '}
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="text-accent hover:text-[color:var(--accent-hi)]"
                    >
                      Ask us to connect yours
                    </a>{' '}
                    and its figures appear here.
                  </p>
                </Panel>
              ) : (
                <Figures
                  figures={trafficFigures}
                  pinned="visitors"
                  busy={loading || live.loading}
                />
              )}
              <div key={location.pathname} className="console-section">
                <Outlet context={context} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ConsoleShell>
  )
}
