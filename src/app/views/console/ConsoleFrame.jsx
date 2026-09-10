import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { m } from 'framer-motion'
import Seo from '@components/Seo'
import { breadcrumbSchema } from '@constants/seo'
import { settleIn } from '@constants/animations'
import ConsoleShell from '@components/account/ConsoleShell'
import PageTransition from '@components/chrome/PageTransition'
import Waiting from '@components/app-shell/Waiting'
import { useDeferredWait } from '@hooks/chrome/useDeferredWait'
import { useToast } from '@hooks/chrome/useToast'
import { faultMessage } from '@utils/faults'
import { SUPPORT_EMAIL } from '@constants/navigation'
import { useAnalyticsFeed } from '@hooks/console/useAnalytics'
import { useProjectFeed } from '@hooks/console/useProjectFeed'
import {
  SAMPLE_BUSINESS,
  useSampleProjectFeed,
  usePreviewClient,
} from '@hooks/console/usePreviewClient'
import { useSession } from '@hooks/session/useSession'
import { THEMES, useTheme } from '@hooks/theme/useTheme'
import { supabase } from '@data/supabase/supabaseClient'
import { ConsoleBar } from './shell/ConsoleBar'
import { ConsoleSidebar } from './shell/ConsoleSidebar'
import { ConsoleSearch } from './shell/ConsoleSearch'
import { menuSections, SECTIONS, sectionHref } from './lib/sections'
import ProjectChecklist from './intake/ProjectChecklist'
import PreviewStrip from './shell/PreviewStrip'
import { currentProject, inOnboarding } from './lib/stages'
import { Panel } from './ui'
import { Figures } from './Figures'
import { ShortcutSheet } from './shell/shortcuts'
import { useConsoleShortcuts } from './lib/useConsoleShortcuts'
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
  const { session, checking, mfaPending, signOut, email } = useSession()
  const toast = useToast()
  // A session already in storage comes back in a few milliseconds, which is
  // shorter than the line saying so takes to read. This decides whether it is
  // worth drawing at all, and keeps it on screen long enough to be read once it
  // has been.
  const sessionWait = useDeferredWait(checking)
  // Whether the reader was actually shown the wait. The console resolves in
  // over the line it replaces only for someone who watched that line; a session
  // read back before the placeholder was ever drawn has nothing to resolve from
  // and the screen is simply there. It also keeps the opening state out of the
  // prerendered status board, which is the one console page a crawler reads and
  // must not arrive at transparent.
  const waited = useRef(false)
  if (sessionWait.visible) waited.current = true
  const location = useLocation()
  const token = session?.access_token ?? null
  const [days, setDays] = useState(7)
  const [siteIds, setSiteIds] = useState(storedScope)
  const [path, setPath] = useState(null)
  const [narrow, setNarrow] = useState(storedNarrow)
  const [drawer, setDrawer] = useState(false)
  const [searching, setSearching] = useState(false)
  const { choice, setChoice } = useTheme()

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
    () => ({ sites: scopeKey ? scopeKey.split(',') : [], days, path }),
    [scopeKey, days, path]
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

  // The builds this account has paid for. Read for everybody rather than only
  // for a client, because whether there is one is the question being asked and
  // an account cannot be sorted into having a project before it is answered.
  const liveProjects = useProjectFeed({ token, enabled: Boolean(token) })
  const sampleProjects = useSampleProjectFeed(preview)

  // One seam, and it is the object rather than the request. Everything the
  // console can do to a build - the dock's ticks, the tracker's boxes, the file
  // picker, the whole of the brief - reaches an endpoint through this one
  // value, so replacing it is what makes a preview unable to write rather than
  // merely unlikely to. The number is borrowed off the live read because it is
  // served rather than shipped and no fixture can hold it, and a footer
  // offering an address where a client is offered a phone call is a preview of
  // the wrong screen.
  //
  // The live read is left running rather than switched off. Making the swap
  // depend on two things - a disabled request as well as a replaced object -
  // would be two places to get it wrong, where the object alone is one line
  // that either holds or does not.
  const projectFeed = preview ? { ...sampleProjects, phone: liveProjects.phone } : liveProjects

  useEffect(() => {
    try {
      window.localStorage.setItem(NARROW_KEY, String(narrow))
    } catch {
      // Nothing to do; the column simply starts wide next time.
    }
  }, [narrow])

  // The drawer is a phone control and a route change is what it was opened to
  // do, so arriving somewhere closes it.
  useEffect(() => {
    setDrawer(false)
    setSearching(false)
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
  const arriveInSection = useCallback(() => {
    workRef.current?.scrollTo({ top: 0 })
    workRef.current?.focus({ preventScroll: true })
  }, [])

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
    try {
      if (scopeKey) window.localStorage.setItem(SCOPE_KEY, scopeKey)
      else window.localStorage.removeItem(SCOPE_KEY)
    } catch {
      // Nothing to do; the console simply opens on every site next time.
    }
  }, [scopeKey])

  // Every chooser goes through here, so a site picked in the column, in the
  // palette, or under the heading lands the console in the same state. The path
  // filter belongs to the site it was set on and means nothing on the next one,
  // unless the thing picked was a page - a row on the account-wide Pages table
  // names a site and a path together, and arriving on the site without the page
  // is arriving somewhere the reader did not click.
  const pickSite = useCallback((next, nextPath = null) => {
    setSiteIds(next === null ? [] : [next])
    setPath(nextPath)
  }, [])

  /**
   * Adds a site to the scope or takes it out, leaving the rest of it alone.
   *
   * Taking the last one out is the whole account rather than nothing, since a
   * console showing no site at all is a console with nothing to read. The path
   * filter goes whenever the set changes: it was set on one site's pages and
   * means nothing across a different set of them.
   */
  const toggleSite = useCallback(id => {
    setSiteIds(held => (held.includes(id) ? held.filter(one => one !== id) : [...held, id]))
    setPath(null)
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
  const liveForSite = useMemo(
    () => (siteId ? liveSites.find(entry => entry.site_id === siteId) : null),
    [liveSites, siteId]
  )
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
  const unassignedSites = role === 'client' && !overview.loading && !sites.length

  // A build in progress, and the one the tracker is about.
  //
  // Onboarding is held false while the read is still out. A console that
  // narrows itself to one section and then opens back up a second later has
  // taken the rest away in front of the reader, where one that opens whole and
  // narrows once is simply arriving.
  const project = currentProject(projectFeed.projects)
  const hasProject = Boolean(projectFeed.projects?.length)
  const onboarding = !projectFeed.loading && inOnboarding(projectFeed.projects)

  // Whether the client has handed their brief over. It rides on the project
  // rather than being read again here, because the feed already carries it and
  // a second read would be a second answer to a question the redirect below
  // turns on.
  const briefSent = Boolean(project?.onboarding?.submitted_at)

  // An account whose site is still being made has not lost its sites, it has
  // not got one yet, and the tracker is already saying so in better words.
  const unassigned = unassignedSites && !hasProject

  // How many sites the console is showing: the set when one is chosen, every
  // site the account holds when none is, and unknown until the sites have been
  // read. It is what decides the sections that only answer across more than one.
  // Taken against the list that outlives the window's figures, so the sections
  // answering only across more than one site do not come and go on a re-read.
  const inView = overview.data ? siteIds.length || knownSites.length : undefined

  const sections = useMemo(
    () => menuSections({ signedIn: Boolean(session), role, inView, hasProject, onboarding }),
    [session, role, inView, hasProject, onboarding]
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
    supabase.auth
      .refreshSession()
      .then(({ data, error }) => {
        if (error || !data?.session) return ended(error)
        return refresh()
      })
      .catch(ended)
      .finally(() => {
        recovering.current = false
      })
  }, [refused, session, signOut, refresh, toast])

  const cycleTheme = () => setChoice(THEMES[(THEMES.indexOf(choice) + 1) % THEMES.length])

  const shortcuts = useConsoleShortcuts({
    openSearch: () => setSearching(true),
    toggleRail: () => setNarrow(open => !open),
  })

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

  // The addresses a build leaves reachable, taken from the catalogue that
  // decides the menu so the two cannot come to disagree.
  const duringBuild = useMemo(
    () => new Set(SECTIONS.filter(entry => entry.duringBuild).map(sectionHref)),
    []
  )
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

  if (publicOnly && !checking) {
    // A bare /console lands on the part a visitor can see; anything else asks
    // them to sign in and comes back to where they were headed.
    if (here === '/console') return <Navigate to="/console/status" replace />
    if (!onStatus) return <Navigate to="/login" state={{ from: here }} replace />
  }

  // While a site is being built, the console is the brief and the tracker.
  //
  // Not a lock so much as the only thing there is to say: every other section
  // reports traffic to a site that does not exist yet, and a reader who opens
  // Sources during week one is asking a question nothing can answer. Status
  // stays reachable because it needs no account and answers for the sites
  // already running.
  //
  // Which addresses those are is read off the catalogue rather than written
  // out here. The menu and this branch have to be the same list, and written
  // twice they drift: a section marked to survive a build that this branch has
  // not heard of is a row a client can see in the menu and cannot open, and
  // nothing about that fails except in front of the client.
  //
  // Where they land depends on whether the brief has been sent. Until it has,
  // it is the only thing the build is waiting on and the tracker would open on
  // a bar that cannot move; afterwards the tracker is the whole of what there
  // is to look at.
  if (!publicOnly && onboarding && !duringBuild.has(here)) {
    return <Navigate to={briefSent ? '/console/project' : '/console/onboarding'} replace />
  }

  // A section marked for an admin is shut to everybody else, not merely absent
  // from their menu.
  //
  // `admin` was read by `menuSections` and nowhere else, which took the row out
  // of the column and left the address open. Anybody with a login could type
  // /console/server, or follow a link somebody had pasted, and get the studio's
  // own machine drawn around them - the units on it named, its card and its
  // temperature laid out - while the feed underneath refused every read. What
  // was kept back was the figures; what was handed over was the section, which
  // is most of what those pages say. The same address answers the same way for
  // Outreach, Builds, Leads, Call List, Payments and Admin, because they carry
  // the same mark for the same reason.
  //
  // The role rides in on the overview read, so this waits for that read to land
  // rather than acting on an unknown role. Redirecting while it is unknown
  // would throw an admin off their own section on every refresh, and an
  // unreachable collector would do it on sections that were working. Until it
  // lands the menu is already drawing as a client's, so the two agree.
  const roleKnown = preview || Boolean(overview.data)
  if (!publicOnly && roleKnown && role !== 'admin' && section?.admin) {
    return <Navigate to="/console" replace />
  }

  // The site in scope, and the name it goes by. Every section reads these to
  // decide which of its two readings to draw, so the whole console turns on one
  // value rather than each section working it out from the id again. A scope of
  // two names neither of them: what the sections draw then is the reading they
  // use for more than one site, over the two the feeds were narrowed to.
  const scoped = siteId ? sites.find(row => row.site_id === siteId) : null

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
    projectFeed,
    // What a section reads to know it is drawing a rehearsal rather than a
    // build, so nothing has to work it out from the shape of its own data.
    preview,
    days,
    detail,
    knownSites,
    live,
    liveForSite,
    liveLoading,
    liveNow,
    liveSites,
    loading,
    overview,
    path,
    pickSite,
    inScope,
    role,
    scoped,
    scopeLabel,
    scopeName,
    sections,
    setPath,
    site,
    siteId,
    siteIds,
    sites,
    toggleSite,
    totals,
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

        <m.div
          className="console-frame"
          data-narrow={narrow}
          data-drawer={drawer}
          initial={waited.current ? settleIn.initial : false}
          animate={settleIn.animate}
          transition={settleIn.transition}
        >
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
              onSearch={() => setSearching(true)}
              onShortcuts={shortcuts.openSheet}
              onTheme={cycleTheme}
              theme={choice}
              signInTo={here}
            />

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

              {/* The column, the bar and the figures above stay put; only the
                section's own work crosses over, so moving between sections
                reads as one screen changing rather than the console being
                rebuilt. */}
              <PageTransition
                routeKey={location.pathname}
                onArrive={arriveInSection}
                className="console-section"
              >
                <Outlet context={context} />
              </PageTransition>
            </div>
          </div>
        </m.div>
      </div>

      {publicOnly ? null : (
        <ProjectChecklist project={project} acting={projectFeed.acting} onTick={projectFeed.tick} />
      )}

      <ConsoleSearch
        open={searching}
        onClose={() => setSearching(false)}
        sections={sections}
        sites={shownSites}
        siteIds={shownScope}
        onPickSite={pickSite}
        onToggleSite={toggleSite}
      />

      <ShortcutSheet open={shortcuts.sheetOpen} onClose={shortcuts.closeSheet} />
    </ConsoleShell>
  )
}
