/**
 * One client's builds, and everything they can do to one.
 *
 * A project belongs to the account that paid for it, and the account is the
 * only thing that decides what comes back: there is no site id to scope by
 * here, because a project exists before its site does. Every read and every
 * write is keyed on the caller's own verified session and nothing else, which
 * is why none of them takes an account as an argument.
 *
 * POST carries one action:
 *
 *   { action: 'tick',   task_id, done }
 *   { action: 'answer', task_id, answer }
 *   { action: 'upload', task_id, content_type }
 *   { action: 'attach', task_id, path, name }
 *   { action: 'detach', file_id }
 *   { action: 'seen',   project_id }
 *
 * The middle three are what make the checklist an answer rather than a claim.
 * A build asks for a logo, for the words, for photographs; before these it
 * offered a tick and no way to hand any of it over, so every file still
 * arrived by email and the tracker described work it was not part of.
 *
 * A file goes up in two steps for the same reason a capture does on the admin
 * side: the bucket is private, the browser cannot write to it, and a
 * photograph has no business meeting a request-body cap. `upload` hands back a
 * URL the browser may PUT to once, and `attach` records the file after it has
 * landed. The path is composed here from ids the database confirmed belong to
 * the caller, never from a name the browser chose.
 *
 * Every refusal is the database's. A task belonging to somebody else, an item
 * that was never the client's to finish, a file against a task that takes no
 * files - all of it comes back from the function that owns the change. This
 * endpoint decides who is asking and nothing else.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAccount, connect } from '../lib/db/clients.js'
import { field, uuid } from '../lib/db/fields.js'

// How long a link to a capture stays good. Long enough to read a page of
// updates without one going dead mid-scroll, short enough that a link copied
// out of the page is not a permanent way in.
const SHOT_TTL_SECONDS = 3600

/** Where what the client hands over is kept. Private, like the captures. */
const INTAKE_BUCKET = 'project-intake'

/**
 * What a client may hand over, and the extension each is stored under.
 *
 * Deliberately short. These are logos and photographs, and every type here is
 * one a browser can be trusted to render inside an `img` without the file
 * getting a document of its own to run in. SVG is left out for that reason
 * rather than by oversight: it is a logo format, and it is also a script that
 * executes when the signed link is opened in a tab rather than drawn in a page.
 */
const INTAKE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/** The longest written answer a task takes. Room for the words, not an essay. */
const ANSWER_LIMIT = 4000

/** The longest original filename kept beside a stored file. */
const NAME_LIMIT = 200

/**
 * A fault from the database or from storage, with its own words kept out of it.
 *
 * What comes back names tables, buckets and constraints, and the person
 * reading it is a client looking at their own build. Those words go to the
 * log, where they are what we need to find the cause; what comes back is the
 * sentence for whichever thing did not happen.
 */
function faulted(error, said) {
  console.error('projects: %s', error?.message || error)
  return { error: said }
}

/**
 * What a client is told when a file will not go up.
 *
 * Signing an upload is two steps against two systems and either can refuse, so
 * one sentence stands for both: which of them failed is a fact about this
 * endpoint, and what the client can do about it is the same either way.
 */
const ATTACH_FAILED = 'That file could not be attached. Try again in a moment.'

/**
 * Every capture, as a link that works for an hour.
 *
 * The bucket is private, so what the database holds is an object path and
 * nothing a browser can load. Signing happens on the way out rather than being
 * stored, because a URL written into a row is a dead string by the time
 * anybody opens it.
 */
async function withSignedShots(db, projects) {
  const paths = projects.flatMap(project =>
    (project.updates || []).flatMap(update => (update.media || []).map(shot => shot.path))
  )
  if (!paths.length) return projects

  const { data, error } = await db.storage
    .from('project-shots')
    .createSignedUrls(paths, SHOT_TTL_SECONDS)
  if (error) return projects

  const signed = new Map((data || []).map(row => [row.path, row.signedUrl]))
  return projects.map(project => ({
    ...project,
    updates: (project.updates || []).map(update => ({
      ...update,
      media: (update.media || []).map(shot => ({ ...shot, url: signed.get(shot.path) || null })),
    })),
  }))
}

/**
 * Every file the client has handed over, as links that work for an hour.
 *
 * Signed on the way out for the same reason the captures are: a URL written
 * into a row is a dead string by the time anybody opens it.
 */
async function withSignedFiles(db, projects) {
  const paths = projects.flatMap(project =>
    (project.tasks || []).flatMap(task => (task.files || []).map(file => file.path))
  )
  if (!paths.length) return projects

  const { data, error } = await db.storage
    .from(INTAKE_BUCKET)
    .createSignedUrls(paths, SHOT_TTL_SECONDS)
  if (error) return projects

  const signed = new Map((data || []).map(row => [row.path, row.signedUrl]))
  return projects.map(project => ({
    ...project,
    tasks: (project.tasks || []).map(task => ({
      ...task,
      files: (task.files || []).map(file => ({ ...file, url: signed.get(file.path) || null })),
    })),
  }))
}

/**
 * A URL the browser may write one file to, and the path it will land at.
 *
 * The project and task are read back out of the database rather than taken
 * from the request, so the folder a file lands in is one the caller was
 * confirmed to own. A name that arrives from a browser is a name that can
 * climb out of the folder it was meant for, and nothing downstream would
 * notice; the only part of the caller's file that survives into the path is
 * the extension its content type implies.
 */
async function signIntakeUpload(db, actor, taskId, contentType) {
  const extension = INTAKE_TYPES[contentType]
  if (!extension) return { error: 'That file type cannot be attached.' }

  const { data, error } = await db.rpc('project_task_project', {
    p_actor: actor,
    p_task: taskId,
  })
  if (error) return faulted(error, ATTACH_FAILED)
  if (data?.error) return { error: data.error }
  if (!data?.project_id) return { error: 'Which item?' }

  const path = `${data.project_id}/${taskId}/${crypto.randomUUID()}.${extension}`
  const signed = await db.storage.from(INTAKE_BUCKET).createSignedUploadUrl(path)
  if (signed.error) return faulted(signed.error, ATTACH_FAILED)
  return { url: signed.data.signedUrl, path }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const wired = connect()
  if (!wired) {
    return response.status(503).json({
      error:
        'Your projects cannot be loaded. Get in touch and we will tell you how the build is going.',
    })
  }

  const account = await authorizeAccount(
    wired,
    request.headers.authorization,
    'Sign in to see your project.'
  )
  if (account.error) return response.status(account.status).json({ error: account.error })

  if (request.method === 'GET') {
    const { data, error } = await wired.db.rpc('projects_for_account', {
      p_profile: account.userId,
    })
    if (error) {
      return response
        .status(500)
        .json(faulted(error, 'Your projects could not be loaded. Try again in a moment.'))
    }

    const shown = await withSignedShots(wired.db, data ?? [])
    const projects = await withSignedFiles(wired.db, shown)
    response.setHeader('Cache-Control', 'no-store')
    // The number is served rather than shipped, because this repository is
    // public and the site states nowhere that anybody can be phoned. A
    // deployment without it falls back to the address, which is what the rest
    // of the site offers.
    return response.status(200).json({ projects, phone: process.env.SUPPORT_PHONE || null })
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const body = request.body || {}

  // Signing a upload is not a call into a database function - it reads one to
  // find out what the caller owns, then talks to storage - so it answers on its
  // own rather than through the table below.
  if (body.action === 'upload') {
    const task = uuid(body.task_id)
    if (!task) return response.status(400).json({ error: 'Which item?' })
    const signed = await signIntakeUpload(wired.db, account.userId, task, body.content_type)
    if (signed.error) return response.status(400).json({ error: signed.error })
    return response.status(200).json(signed)
  }

  // The writes answer the same way, so they are read off one table rather than
  // written out as five near-identical blocks: the difference between them is
  // the function and its arguments, the sentence a failed call gets, and
  // nothing else. The sentence sits here rather than at the call because only
  // this table knows which of the five things the client asked for.
  const writes = {
    tick: () => {
      const task = uuid(body.task_id)
      if (!task) return { fault: 'Which item?' }
      return {
        name: 'project_task_tick',
        failed: 'That item could not be updated. Try again in a moment.',
        args: { p_actor: account.userId, p_task: task, p_done: body.done !== false },
      }
    },
    answer: () => {
      const task = uuid(body.task_id)
      if (!task) return { fault: 'Which item?' }
      return {
        name: 'project_task_answer',
        failed: 'That answer could not be saved. Try again in a moment.',
        args: {
          p_actor: account.userId,
          p_task: task,
          // A cleared box is an answer withdrawn, which the function reads as
          // the item going back to unfinished. That is why this passes null
          // rather than refusing an empty string.
          p_answer: field(body.answer, ANSWER_LIMIT),
        },
      }
    },
    attach: () => {
      const task = uuid(body.task_id)
      if (!task) return { fault: 'Which item?' }
      const path = field(body.path, 400)
      if (!path) return { fault: 'Which file?' }
      return {
        name: 'project_task_file',
        failed: ATTACH_FAILED,
        args: {
          p_actor: account.userId,
          p_task: task,
          p_path: path,
          // Kept so the studio sees the name the client knows the file by
          // rather than the uuid it is stored under.
          p_name: field(body.name, NAME_LIMIT),
        },
      }
    },
    detach: () => {
      const file = uuid(body.file_id)
      if (!file) return { fault: 'Which file?' }
      return {
        name: 'project_task_file_remove',
        failed: 'That file could not be removed. Try again in a moment.',
        args: { p_actor: account.userId, p_file: file },
      }
    },
    seen: () => {
      const project = uuid(body.project_id)
      if (!project) return { fault: 'Which project?' }
      return {
        name: 'project_mark_seen',
        failed: 'That update could not be marked as read. Try again in a moment.',
        args: { p_actor: account.userId, p_project: project },
      }
    },
  }

  const chosen = writes[body.action]
  if (!chosen) return response.status(400).json({ error: 'Unknown action.' })

  const call = chosen()
  if (call.fault) return response.status(400).json({ error: call.fault })

  const { data, error } = await wired.db.rpc(call.name, call.args)
  if (error) return response.status(500).json(faulted(error, call.failed))
  if (data?.error) return response.status(400).json({ error: data.error })
  return response.status(200).json({ ok: true })
}
