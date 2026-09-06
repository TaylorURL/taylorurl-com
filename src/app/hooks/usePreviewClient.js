import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * The console as a client sees it, shown to an admin, over a build that is not
 * anybody's.
 *
 * There is no other way to read the client's console. Every section a client
 * has is drawn from their own account, an admin's account has a different
 * shape, and the screens that matter most - the first afternoon of a build,
 * the questions that come before a design - are exactly the ones nobody on
 * this side ever sees. So the console is asked to draw for a client, and the
 * build it draws is written down here.
 *
 * NOTHING IN THIS FILE CAN REACH A REAL RECORD, and that is not a claim about
 * how carefully it is used. It is four separate things, each of which holds on
 * its own:
 *
 *   It has no way to ask. This module imports nothing that fetches and calls
 *   nothing that does. Every value it hands back is a literal written in this
 *   file, so a preview cannot read a client's answers for the same reason a
 *   constant cannot: there is no request in it.
 *
 *   Its ids are not uuids, on purpose. Every write in `api/projects.js` runs
 *   the id it was handed through `uuid()` and answers a 400 before it names a
 *   database function, so `sample-task-logo` is refused at the door whatever
 *   the console believed it was doing. This is the guard that survives a bug
 *   in everything above it, and it is why the ids here must never be tidied
 *   into `crypto.randomUUID()`.
 *
 *   The session is still the admin's. A write that somehow carried a real uuid
 *   would be run against the caller's own profile, and the project functions
 *   refuse a row that does not belong to the caller. An admin's session cannot
 *   answer a client's question even when it is pointed at one.
 *
 *   The address on the sample account is at `.example`, which is reserved and
 *   can never be registered, so nothing here can be mistaken for a customer or
 *   reach one by accident.
 *
 * What this file does NOT do is swap anything. It answers one question - is
 * this reader being shown the client's console - and hands back the build to
 * show. The console is what puts the sample in place of the live feed, in one
 * expression, because a swap made at the object rather than at each request is
 * a swap that cannot be half done.
 */

/**
 * The flag, and the prefix every sample record made during a preview is filed
 * under.
 *
 * They are the same string so that leaving sweeps the flag along with
 * everything written while it was on. A record added by a later step of the
 * flow is then cleared by a leave that was written before it existed, which is
 * the only version of this that stays correct as the flow grows.
 */
const FLAG_KEY = 'taylorurl_console_preview'
export const PREVIEW_PREFIX = 'taylorurl_console_preview'

/** The address that turns it on, and the one value it answers to. */
const FLAG = 'preview'
const FLAG_ON = 'client'

/**
 * The browser's own store, where there is one.
 *
 * Session storage rather than local, and the difference is the whole safety of
 * the thing. A preview belongs to the tab and the sitting that opened it. An
 * admin who looked at the client's console on Friday and opens the console on
 * Monday to answer a real client's question must not open into a sample build,
 * and a workstation somebody else signs into must not either. Local storage
 * would hold the flag until it was deliberately cleared, and the one state
 * nobody remembers to clear is the one that looks exactly like the state they
 * meant to be in.
 *
 * Per tab rather than per browser for a second reason: the way this is used is
 * one tab holding the real console and another holding the client's, and a
 * store shared between them would put both into whichever state was written
 * last and take that arrangement away.
 *
 * A browser set to block site data throws on the accessor itself rather than
 * answering empty, so reaching it is what has to be guarded. A refused store
 * means the preview cannot be entered at all, which is right: a rehearsal
 * whose answers cannot be written down is one that loses them on the first
 * navigation.
 */
function store() {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

/** Whether this tab is in a preview. False everywhere there is no store. */
export function heldPreview() {
  const held = store()
  if (!held) return false
  try {
    return held.getItem(FLAG_KEY) === 'on'
  } catch {
    return false
  }
}

/** Turns it on for this tab. */
export function holdPreview() {
  const held = store()
  if (!held) return
  try {
    held.setItem(FLAG_KEY, 'on')
  } catch {
    // A full or refused store costs the preview and nothing else.
  }
}

/**
 * Turns it off, and takes everything written during it with it.
 *
 * The keys are enumerated rather than named, so a sample record this file has
 * never heard of is still cleared. Anything written while a preview is on
 * belongs under the prefix for exactly this reason.
 */
export function dropPreview() {
  const held = store()
  if (!held) return
  try {
    const doomed = []
    for (let at = 0; at < held.length; at += 1) {
      const key = held.key(at)
      if (key && key.startsWith(PREVIEW_PREFIX)) doomed.push(key)
    }
    for (const key of doomed) held.removeItem(key)
  } catch {
    // Nothing to clear, or nothing clearable. Either way the tab holds no
    // preview, because a store that cannot be read never entered one.
  }
}

/**
 * Whether the console is drawing for a client, and the two ways in and out.
 *
 * It takes the role the account actually holds rather than the one being
 * drawn. Keeping those two apart is what makes the whole arrangement safe: the
 * console draws from the second, while the control that offers the preview and
 * the strip that announces it read the first. Collapsed into one value, an
 * admin in a preview would have no way to know they were an admin and no way
 * back out.
 *
 * @param {string|undefined} signedInRole the role on the account, undefined
 *   while the read that answers for it is still out
 * @returns {{preview: boolean, enterPreview: () => void, leavePreview: () => void}}
 */
export function usePreviewClient(signedInRole) {
  const location = useLocation()
  const navigate = useNavigate()
  const [held, setHeld] = useState(heldPreview)

  // The store is the state and the address is a one-shot instruction to write
  // it. The flag is read once, on the first render, and held rather than acted
  // on: the role arrives from a feed a moment after the console mounts, so a
  // flag obeyed immediately would be obeyed before there is anybody to check
  // it against, and a flag re-read every render would come back after it had
  // been spent.
  const asked = useRef(new URLSearchParams(location.search).get(FLAG) === FLAG_ON)

  useEffect(() => {
    if (!asked.current || signedInRole === undefined) return
    asked.current = false
    if (signedInRole === 'admin') {
      holdPreview()
      setHeld(true)
    }
    // Spent either way. A flag left in the address is a second place the answer
    // lives, and it is the copy that gets pasted into a message.
    const params = new URLSearchParams(location.search)
    params.delete(FLAG)
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true })
  }, [signedInRole, location.pathname, location.search, navigate])

  // A flag that reached an account which is not an admin is dropped rather than
  // left sitting, so a tab handed one does not carry it for the visit. The flag
  // names no project and no account, so there is nothing in it that could
  // address somebody else's build even if it were honoured.
  useEffect(() => {
    if (!held || signedInRole === undefined || signedInRole === 'admin') return
    dropPreview()
    setHeld(false)
  }, [held, signedInRole])

  // On while the role is still out, corrected the moment it lands. The other
  // way round costs an admin the studio's own menu, drawn on a screen meant to
  // hold none of it, for the length of one read on every reload - and the
  // reader that correction would be for, a client holding a hand-written flag,
  // is shown the client console either way.
  const preview = held && (signedInRole === 'admin' || signedInRole === undefined)

  // Entering deliberately does not navigate. The console sends a client with an
  // unfinished build to their questions the instant it reads one, which is
  // exactly the arrival a client gets, and a second navigation here would be a
  // second answer to where a client lands.
  const enterPreview = useCallback(() => {
    holdPreview()
    setHeld(true)
  }, [])

  // Leaving lands on the console rather than standing still. The addresses a
  // preview is usually left from are the two a client has, and an admin has no
  // build behind either, so staying put would hand them the empty reading of a
  // section they did not ask to open.
  const leavePreview = useCallback(() => {
    dropPreview()
    setHeld(false)
    navigate('/console', { replace: true })
  }, [navigate])

  return { preview, enterPreview, leavePreview }
}

/**
 * The business the sample build is for. The strip across the top names it, so
 * it is read from here rather than written twice.
 */
export const SAMPLE_BUSINESS = 'Bellview Plumbing'

/** The address on the sample account. `.example` is reserved and unroutable. */
const SAMPLE_EMAIL = 'owner@bellview-plumbing.example'

/**
 * The seven items a build opens with, in the database's own order and its own
 * words.
 *
 * Copied from `project_seed_tasks` verbatim, capitalisation included. Their
 * labels are data rather than console furniture, and tidying them here would
 * show an admin words no client will ever read, which is the one thing a
 * preview must never do.
 *
 * None of them is at the first stage, which is not an omission. A build on the
 * afternoon it is paid for has an empty checklist, and the questions are what
 * the client is given instead.
 */
const SEEDED = [
  {
    task_id: 'sample-task-logo',
    stage: 'getting_started',
    owner: 'client',
    label: 'Your logo',
    detail: 'The original file if you have it, or the best copy you hold.',
    kind: 'files',
    required: true,
  },
  {
    task_id: 'sample-task-words',
    stage: 'getting_started',
    owner: 'client',
    label: 'Your words',
    detail: 'What you do, who you do it for, and the towns you cover.',
    kind: 'text',
    required: true,
  },
  {
    task_id: 'sample-task-photographs',
    stage: 'getting_started',
    owner: 'client',
    label: 'Your photographs',
    detail: 'Pictures of your own work. Not required, and worth more than any stock photograph.',
    kind: 'files',
    required: false,
  },
  {
    task_id: 'sample-task-design',
    stage: 'design',
    owner: 'client',
    label: 'Approve the design',
    detail: 'Say yes to the drawn pages, or say what to change.',
    kind: 'tick',
    required: true,
  },
  {
    task_id: 'sample-task-details',
    stage: 'build',
    owner: 'client',
    label: 'Check your details',
    detail: 'Phone, address, hours and prices, exactly as they should read.',
    kind: 'text',
    required: true,
  },
  {
    task_id: 'sample-task-read',
    stage: 'checks',
    owner: 'client',
    label: 'Read the finished site',
    detail: 'The last look before anybody else gets one.',
    kind: 'tick',
    required: true,
  },
  {
    task_id: 'sample-task-domain',
    stage: 'checks',
    owner: 'client',
    label: 'Your domain',
    detail: 'Where your web address is registered. We will call to sort the access.',
    kind: 'tick',
    required: true,
  },
]

/**
 * A build in the shape the endpoint hands one back in.
 *
 * Every field is the field `projects_for_account` returns, in the order and the
 * types it returns them in, because a fixture that is only nearly the right
 * shape is a preview that passes over a client screen that does not: a missing
 * `files` array is an empty list on a card here and a crash on a real build.
 * There is no `email`, no `paid_at` and no `deposit_cents` on it, because those
 * are columns rather than payload and inventing them here would teach whoever
 * reads this that the wire carries more than it does.
 *
 * The dates are made at the moment the sample is rather than written down, so
 * the build is always a couple of hours old. A fixed date would read as a
 * client who paid last spring and has been waiting ever since, which is a
 * different screen with different words on it.
 *
 * `stage` is an argument with the right answer as its default. A preview is of
 * the day somebody pays, and that is `received`; the argument is there because
 * the one thing that would ever move is which day is being looked at, and a
 * fixture that has to be rewritten to answer that is a fixture nobody moves.
 */
export function sampleProject(stage = 'received') {
  const opened = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  return {
    project_id: 'sample-project',
    business_name: SAMPLE_BUSINESS,
    stage,
    status: 'active',
    site_id: null,
    created_at: opened,
    launched_at: null,
    seen_at: null,
    tasks: SEEDED.map(task => ({ ...task, answer: null, done_at: null, files: [] })),
    // A build on its first afternoon has nothing written against it, and the
    // tracker already says so in better words than a made-up update would.
    updates: [],
  }
}

/**
 * What the sample client answered before the card was taken.
 *
 * These are the rows the pay form writes into `project_briefs.answers`, and
 * they are display names rather than ids because that is what is stored there:
 * 'Plumbing' rather than `plumbing`, 'ServiceTitan, Jobber' rather than a pair
 * of keys. The prefill resolves each name back against the module the name was
 * written from, so a fixture holding ids would exercise a path no client ever
 * takes and prove nothing about the one they do.
 *
 * A full set of nine, because the interesting thing to preview is a form that
 * opens a third answered. The empty version of it is what a build with no
 * brief gets, and it is reached by handing this an empty list rather than by
 * being written down twice.
 */
export function sampleOrder() {
  return [
    { label: 'Business Type', value: 'Plumbing' },
    { label: 'Designs You Like', value: 'Two picked from the wall' },
    { label: 'How It Should Feel', value: 'Hard-wearing and practical, Clean and simple' },
    { label: 'Logo and Colors', value: 'A logo, no set colors' },
    { label: 'Photographs', value: 'A few photos' },
    { label: 'How It Reads', value: 'Plain and friendly' },
    { label: 'Sites to Look At', value: 'None given' },
    { label: 'Tools in Use', value: 'ServiceTitan, QuickBooks' },
    { label: 'Business Email', value: 'Google Workspace' },
  ]
}

/**
 * The brief before anybody has answered any of it.
 *
 * A preview starts where a client starts. An admin who wants to see the
 * finished half of the form answers their way into it, which is the same
 * walk a client takes and the only one worth rehearsing; a fixture that
 * arrived half filled in would be a preview of a screen nobody is ever shown.
 */
export function sampleBrief() {
  return {
    onboarding_id: 'sample-brief',
    project_id: 'sample-project',
    email: SAMPLE_EMAIL,
    answers: {},
    progress: 0,
    step: 'welcome',
    submitted_at: null,
    created_at: new Date().toISOString(),
  }
}

/**
 * The sample build, as a feed the console cannot tell from the real one.
 *
 * The console reaches everything it can do to a build through one object -
 * the dock's ticks, the tracker's boxes, the file picker - so replacing the
 * object is what makes a preview unable to write, rather than merely unlikely
 * to. Every method here is the local edit its live twin makes remotely, so an
 * admin ticking an item on the sample watches it tick, and nothing leaves the
 * tab.
 *
 * The state is held rather than recomputed, because a fixture rebuilt on each
 * render would undo a tick the moment anything else on the page changed. It is
 * rebuilt when a preview begins, which is what makes the second rehearsal start
 * where the first one did rather than where it was abandoned.
 *
 * `acting` is never set. The live feed uses it to show one row waiting on a
 * request that is out; nothing here is ever out, and a spinner drawn for a
 * change that has already happened is a lie about how fast the real one is.
 *
 * @param {boolean} preview whether the console is drawing for a client
 * @returns {object} the same shape useProjectFeed returns
 */
export function useSampleProjectFeed(preview) {
  const [project, setProject] = useState(null)

  useEffect(() => {
    setProject(preview ? sampleProject() : null)
  }, [preview])

  const editTask = useCallback((taskId, change) => {
    setProject(held =>
      held
        ? {
            ...held,
            tasks: held.tasks.map(task =>
              task.task_id === taskId ? { ...task, ...change(task) } : task
            ),
          }
        : held
    )
    return Promise.resolve(true)
  }, [])

  const tick = useCallback(
    (taskId, done) => editTask(taskId, () => ({ done_at: done ? new Date().toISOString() : null })),
    [editTask]
  )

  const answer = useCallback(
    (taskId, textIn) =>
      editTask(taskId, () => ({
        answer: textIn,
        done_at: textIn.trim() ? new Date().toISOString() : null,
      })),
    [editTask]
  )

  // A file picked during a rehearsal is recorded by its name and goes nowhere.
  // The bucket is private and every path in it is composed from ids the
  // database confirmed, so there is no path a sample project could be given
  // that would be its own.
  const send = useCallback(
    (taskId, file) =>
      editTask(taskId, task => ({
        files: [
          ...(task.files || []),
          {
            file_id: `sample-${task.files?.length || 0}-${file.name}`,
            path: null,
            name: file.name,
          },
        ],
      })),
    [editTask]
  )

  const remove = useCallback(
    fileId =>
      Promise.resolve(
        setProject(held =>
          held
            ? {
                ...held,
                tasks: held.tasks.map(task => ({
                  ...task,
                  files: (task.files || []).filter(file => file.file_id !== fileId),
                })),
              }
            : held
        ) ?? true
      ),
    []
  )

  const nothing = useCallback(() => Promise.resolve(true), [])

  return {
    projects: project ? [project] : null,
    phone: null,
    error: null,
    // A fixture is never out for a read, so the console never draws a
    // placeholder over one. It is loading only in the frame between a preview
    // beginning and the effect above answering it.
    loading: preview && !project,
    acting: null,
    refresh: nothing,
    tick,
    answer,
    send,
    remove,
    markSeen: nothing,
  }
}
