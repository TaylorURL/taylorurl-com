/**
 * The other side of a client's tracker: moving a build along and writing to the
 * person waiting on it.
 *
 * Everything here is a call into a database function that already holds the
 * rules. A stage will not close while the client still owes something required
 * for it, an update needs a title, a picture has to belong to an update that
 * exists - none of that is decided in this file, because a rule enforced at the
 * screen with the button on it is a rule that lapses the moment a second screen
 * grows one. This endpoint decides who is asking and hands the question on.
 *
 * The functions it calls are granted to the service role alone, which is why
 * they are reachable only from here. That grant is what keeps a client from
 * advancing their own build by posting at the endpoint their tracker uses.
 *
 * GET answers one of two views:
 *
 *   (no query)      every project, with who it belongs to and what it waits on
 *   ?project=<id>   one project's updates, newest first, with its pictures
 *
 * POST carries one action:
 *
 *   { action: 'stage',  project_id, stage }
 *   { action: 'update', project_id, title, body, stage, publish }
 *   { action: 'upload', project_id, content_type }
 *   { action: 'media',  update_id, path, caption, width, height }
 *   { action: 'site',   project_id, site_id }
 *   { action: 'task',   project_id, task_id, label, detail, stage, kind, required }
 *   { action: 'untask', task_id }
 *   { action: 'claim',  project_id, email }
 *
 * `site` is how a finished build meets the figures for the site it produced.
 * Until it is set, a project and the site it became are two records that do
 * not know about each other.
 *
 * `task` is what makes the checklist this build's rather than every build's.
 * Seven items are seeded when a project opens and they suit most work; a shop
 * that needs a menu photographed or a licence number on the footer needs an
 * eighth, and until it could be added the only way to ask was an email the
 * tracker knew nothing about.
 *
 * `claim` re-points a build at a different address. A build attaches to the
 * account whose email matches the one that paid, exactly, so a buyer who pays
 * from one address and signs up with another is stranded in an empty console.
 * That was fixable only by hand in the database, which is no answer at all
 * when the person it happens to has already paid.
 *
 * Nothing here bills anybody. The monthly starts on the checkout, on the same
 * session that takes the build, so marking a build live is a stage change and
 * nothing else.
 *
 * A picture goes up in two steps rather than through this endpoint's body. The
 * bucket is private, so the browser cannot write to it and the file cannot come
 * through here without a screenshot of a full page meeting a request-body cap
 * that has nothing to do with how big a screenshot ought to be. `upload` hands
 * back a URL the browser can PUT to once, and `media` records the file after it
 * has landed.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { field, uuid } from '../lib/db/fields.js'

const SHOTS_BUCKET = 'project-shots'

/** Where what the client hands over is kept. The tracker's own bucket. */
const INTAKE_BUCKET = 'project-intake'

/** What a client can be asked for, and how the tracker draws each one. */
const TASK_KINDS = ['tick', 'text', 'files']

/**
 * How long a link to a capture stays good.
 *
 * The same hour the client's own tracker signs for. Two different lifetimes on
 * one file would mean a picture that is still there on one screen and gone on
 * the other, which reads as the record disagreeing with itself.
 */
const SHOT_TTL_SECONDS = 3600

/** Updates one project carries. Long enough to hold every build ever run. */
const UPDATE_LIMIT = 200

/** What a capture may be, and the extension each one is stored under. */
const SHOT_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/**
 * The columns an update is read back on, which is all of them but the author.
 *
 * Who wrote an update is not something the person writing it needs told, and
 * the client is never shown it either.
 */
const UPDATE_COLUMNS = 'id, project_id, stage, title, body, published_at, created_at'

/**
 * One project's updates, newest first, with every picture signed.
 *
 * Read off the tables rather than through a function, because this is the one
 * view no client ever sees: the tracker returns published updates alone, and
 * an admin writing the next one needs the drafts beside them or the same
 * update gets written twice.
 */
async function updatesFor(db, projectId) {
  const written = await db
    .from('project_updates')
    .select(UPDATE_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(UPDATE_LIMIT)
  if (written.error) return { error: written.error.message }

  const updates = written.data ?? []
  if (!updates.length) return { updates: [] }

  const attached = await db
    .from('project_update_media')
    .select('id, update_id, path, caption, width, height, sort')
    .in(
      'update_id',
      updates.map(update => update.id)
    )
    .order('sort', { ascending: true })
  if (attached.error) return { error: attached.error.message }

  const media = attached.data ?? []
  const signed = new Map()
  if (media.length) {
    const { data } = await db.storage.from(SHOTS_BUCKET).createSignedUrls(
      media.map(shot => shot.path),
      SHOT_TTL_SECONDS
    )
    for (const row of data ?? []) signed.set(row.path, row.signedUrl)
  }

  const byUpdate = new Map()
  for (const shot of media) {
    const held = byUpdate.get(shot.update_id) ?? []
    held.push({ ...shot, url: signed.get(shot.path) ?? null })
    byUpdate.set(shot.update_id, held)
  }

  return {
    updates: updates.map(update => ({ ...update, media: byUpdate.get(update.id) ?? [] })),
  }
}

/**
 * What the buyer said they wanted, as they answered it.
 *
 * Answers nothing rather than failing when there is no brief. Every project
 * opened before the configurator started carrying one has none, and a build
 * detail that will not load because a table is empty is worse than a build
 * detail with one panel missing.
 */
async function briefFor(db, projectId) {
  const read = await db
    .from('project_briefs')
    .select('id, answers, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (read.error || !read.data) return null
  return { answers: Array.isArray(read.data.answers) ? read.data.answers : [] }
}

/**
 * The checklist as the client sees it, plus what they have handed over.
 *
 * Signed on the way out, the same hour the client's own links last, so a logo
 * is one file with one lifetime rather than two views disagreeing about
 * whether it is still there.
 */
async function tasksFor(db, projectId) {
  const read = await db
    .from('project_tasks')
    .select('id, stage, owner, label, detail, kind, required, sort, answer, done_at')
    .eq('project_id', projectId)
    .order('sort', { ascending: true })
  if (read.error) return []

  const tasks = read.data ?? []
  if (!tasks.length) return []

  const held = await db
    .from('project_task_files')
    .select('id, task_id, path, name, created_at')
    .in(
      'task_id',
      tasks.map(task => task.id)
    )
    .order('created_at', { ascending: true })
  const files = held.data ?? []

  const signed = new Map()
  if (files.length) {
    const { data } = await db.storage.from(INTAKE_BUCKET).createSignedUrls(
      files.map(file => file.path),
      SHOT_TTL_SECONDS
    )
    for (const row of data ?? []) signed.set(row.path, row.signedUrl)
  }

  const byTask = new Map()
  for (const file of files) {
    const kept = byTask.get(file.task_id) ?? []
    kept.push({ ...file, url: signed.get(file.path) ?? null })
    byTask.set(file.task_id, kept)
  }

  return tasks.map(task => ({ ...task, files: byTask.get(task.id) ?? [] }))
}

/**
 * A URL the browser may write one file to, and the path it will land at.
 *
 * The path is composed here rather than taken from the caller. A name that
 * arrives from a browser is a name that can climb out of the folder it was
 * meant for, and nothing downstream would notice.
 */
async function signUpload(db, projectId, contentType) {
  const extension = SHOT_TYPES[contentType]
  if (!extension) return { error: 'That file type cannot be attached.' }

  const path = `${projectId}/${crypto.randomUUID()}.${extension}`
  const { data, error } = await db.storage.from(SHOTS_BUCKET).createSignedUploadUrl(path)
  if (error) return { error: error.message }
  return { url: data.signedUrl, path }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const wired = connect()
  if (!wired) return response.status(503).json({ error: 'Builds are not available right now.' })

  const account = await authorizeAdmin(wired, request.headers.authorization)
  if (account.error) return response.status(account.status).json({ error: account.error })

  if (request.method === 'GET') {
    const only = uuid(request.query?.project)
    response.setHeader('Cache-Control', 'no-store')

    if (only) {
      const read = await updatesFor(wired.db, only)
      if (read.error) return response.status(500).json({ error: read.error })
      // The brief and the checklist ride back with the updates rather than as
      // two more round trips: they are read together on one screen every time,
      // and a build detail that arrives in three pieces flickers into place.
      const brief = await briefFor(wired.db, only)
      const tasks = await tasksFor(wired.db, only)
      return response.status(200).json({ ...read, brief, tasks })
    }

    const { data, error } = await wired.db.rpc('admin_projects')
    if (error) return response.status(500).json({ error: error.message })
    return response.status(200).json({ projects: data ?? [] })
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const body = request.body || {}

  if (body.action === 'upload') {
    const project = uuid(body.project_id)
    if (!project) return response.status(400).json({ error: 'Which build?' })
    const signed = await signUpload(wired.db, project, body.content_type)
    if (signed.error) return response.status(400).json({ error: signed.error })
    return response.status(200).json(signed)
  }

  // The four writes answer the same way, so they are read off one table rather
  // than written out as four near-identical blocks: the difference between them
  // is the function and its arguments, and nothing else.
  const writes = {
    stage: () => {
      const project = uuid(body.project_id)
      if (!project) return { fault: 'Which build?' }
      if (typeof body.stage !== 'string' || !body.stage) return { fault: 'Which stage?' }
      return {
        name: 'admin_project_stage',
        args: { p_actor: account.userId, p_project: project, p_stage: body.stage },
      }
    },
    update: () => {
      const project = uuid(body.project_id)
      if (!project) return { fault: 'Which build?' }
      const title = field(body.title, 200)
      if (!title) return { fault: 'An update needs a title.' }
      return {
        name: 'admin_project_update',
        args: {
          p_actor: account.userId,
          p_project: project,
          p_title: title,
          p_body: field(body.body, 4000),
          p_stage: typeof body.stage === 'string' && body.stage ? body.stage : null,
          p_publish: body.publish !== false,
        },
      }
    },
    media: () => {
      const update = uuid(body.update_id)
      if (!update) return { fault: 'Which update?' }
      const path = field(body.path, 400)
      if (!path) return { fault: 'Which file?' }
      return {
        name: 'admin_project_media',
        args: {
          p_update: update,
          p_path: path,
          p_caption: field(body.caption, 200),
          p_width: Number.isFinite(body.width) ? Math.trunc(body.width) : null,
          p_height: Number.isFinite(body.height) ? Math.trunc(body.height) : null,
        },
      }
    },
    site: () => {
      const project = uuid(body.project_id)
      if (!project) return { fault: 'Which build?' }
      return {
        name: 'admin_project_site',
        args: { p_actor: account.userId, p_project: project, p_site: uuid(body.site_id) },
      }
    },
    task: () => {
      const project = uuid(body.project_id)
      if (!project) return { fault: 'Which build?' }
      const label = field(body.label, 200)
      if (!label) return { fault: 'An item needs a label.' }
      if (typeof body.stage !== 'string' || !body.stage) return { fault: 'Which stage?' }
      const kind = TASK_KINDS.includes(body.kind) ? body.kind : 'tick'
      return {
        name: 'admin_project_task',
        args: {
          p_actor: account.userId,
          p_project: project,
          // Absent for a new item, present when an existing one is being
          // rewritten. One action rather than two, because the difference
          // between adding and editing is whether an id came with it.
          p_task: uuid(body.task_id),
          p_label: label,
          p_detail: field(body.detail, 400),
          p_stage: body.stage,
          p_kind: kind,
          p_required: body.required !== false,
        },
      }
    },
    untask: () => {
      const task = uuid(body.task_id)
      if (!task) return { fault: 'Which item?' }
      return {
        name: 'admin_project_task_remove',
        args: { p_actor: account.userId, p_task: task },
      }
    },
    claim: () => {
      const project = uuid(body.project_id)
      if (!project) return { fault: 'Which build?' }
      const email = field(body.email, 254)
      if (!email) return { fault: 'Which address?' }
      return {
        name: 'admin_project_claim',
        args: { p_actor: account.userId, p_project: project, p_email: email },
      }
    },
  }

  const chosen = writes[body.action]
  if (!chosen) return response.status(400).json({ error: 'Unknown action.' })

  const call = chosen()
  if (call.fault) return response.status(400).json({ error: call.fault })

  const { data, error } = await wired.db.rpc(call.name, call.args)
  if (error) return response.status(500).json({ error: error.message })
  // The function's own refusal is the answer a person needs to read, and it
  // arrives as a value rather than as an error: waiting on a client is not the
  // database going wrong.
  if (data?.error) return response.status(400).json({ error: data.error })

  return response.status(200).json(data ?? { ok: true })
}
