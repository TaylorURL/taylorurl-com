import { useMemo, useRef, useState } from 'react'
import { ImagePlus, Send } from 'lucide-react'
import { useSession } from '@hooks/session/useSession'
import { useAdminFeed } from '@hooks/console/useAdminFeed'
import { useBuildsFeed } from '@hooks/console/useBuildsFeed'
import { displayDomain } from '@utils/domains'
import {
  Area,
  Badge,
  Board,
  ConsoleError,
  ConsolePage,
  ConsoleSplit,
  EmptyRow,
  Panel,
  PanelBody,
  PanelFoot,
  SectionNotice,
  SidePanel,
  SkeletonList,
  SkeletonRows,
  ViewNav,
} from '../../ui'
import { useView } from '../../lib/views'
import { BUTTON, CELL, FIELD, MONO_LABEL, QUIET, SELECT, TH } from '../../lib/tokens'
import { STAGES, stageOf, stageRank } from '../../lib/stages'
import { ZONE } from '@lib/time/zone.js'

/**
 * The side of a build the client never sees: moving it along, and writing to
 * the person waiting on it.
 *
 * A stage and an update are one job rather than two. Nobody advances a build
 * without saying what happened, and an update written against the wrong stage
 * is a report filed under the wrong heading, so the composer opens on the
 * build the stage control stands over and takes its default from it.
 *
 * The record is every build at once because that is the reading that answers
 * the question actually being asked, which is never "how is this one going"
 * but "which of these is waiting on me". A build waiting on the client says so
 * in its own row, and the stage control refuses rather than the row hiding it.
 *
 * One build opened out of the record is read beside it: the list keeps a
 * column on the left so the next build is one press away, and the build takes
 * the rest, with its stage across the top and what the client owes beside
 * what has been written to them. The brief, the composer and the form that
 * asks for one more thing open over the build rather than standing in it,
 * because each is read or written once and would otherwise hold a third of
 * the page for the whole visit.
 *
 * Pictures attach to an update after it is written rather than alongside it.
 * A capture of a page is taken once the page exists, which is usually a
 * different moment from the one the update is written in, and a composer that
 * insisted on both would be a composer nobody could finish.
 */

/** What a client can be asked for, in the words the picker offers them in. */
const KINDS = [
  { id: 'tick', label: 'Tick to confirm' },
  { id: 'text', label: 'Written answer' },
  { id: 'files', label: 'Files' },
]

/**
 * The tab row holds its own height and the work takes what is left, on the
 * page and again on the board an open build is laid out on: the stage band is
 * a fixed shape however far the build has got, and the two cards under it
 * are as long as the build makes them and move inside themselves.
 */
const ROWS = 'auto minmax(0,1fr)'

/**
 * What the client owes on the left, what has been written to them on the
 * right, and the two read against each other. The updates take the wider
 * column because a capture of a page needs the width and a checklist item
 * does not.
 */
const SPLIT = 'minmax(0,2fr) minmax(0,3fr)'

/**
 * The address a build is attached to, and a way to move it.
 *
 * A build finds its account by an exact match on the address that paid, so a
 * buyer who pays from one address and signs up from another sits in an empty
 * console while their build sits here marked "Not signed up". This is the only
 * screen that can put those two back together, and before it existed the fix
 * was a hand-written statement against the database.
 *
 * It is deliberately a little awkward to use - typed in full, confirmed by a
 * button rather than a blur - because re-pointing a build at the wrong address
 * hands somebody else's site to a stranger.
 *
 * In a table cell the form stacks, because the column is narrow and the row
 * is as tall as it needs to be. In a row of controls it is a row as well, so
 * opening it does not put two more lines under the strip it opened from.
 */
function ClaimControl({ project, busy, onClaim, inline = false }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')

  if (!open) {
    return (
      <button type="button" className={QUIET} onClick={() => setOpen(true)}>
        Move to Another Address
      </button>
    )
  }

  return (
    <div className={inline ? 'flex flex-wrap items-center gap-2' : 'mt-1.5 grid gap-1.5'}>
      <input
        type="email"
        value={email}
        autoComplete="off"
        placeholder={project.email}
        aria-label={`Move ${project.business_name || project.email} to another address`}
        onChange={event => setEmail(event.target.value)}
        className={inline ? `${FIELD} max-w-[16rem]` : FIELD}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className={BUTTON}
          disabled={busy || !email.trim()}
          onClick={async () => {
            const moved = await onClaim(email.trim())
            if (moved) {
              setEmail('')
              setOpen(false)
            }
          }}
        >
          {busy ? 'Moving' : 'Move'}
        </button>
        <button type="button" className={QUIET} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * The client's checklist, and what has actually arrived against each item.
 *
 * Seven items are seeded when a build opens and they cover most work. This is
 * for the eighth: a menu to photograph, a licence number for the footer, the
 * keys to a booking system. Until it existed the only way to ask for one of
 * those was an email, and then the stage gate - which will not close a stage
 * while the client still owes something - knew nothing about it.
 *
 * What the client sent is shown beside what was asked, because an item that
 * says done and holds no file is the thing worth noticing before a stage is
 * advanced on the strength of it.
 *
 * The form that asks for the eighth opens over the list rather than under it.
 * It is filled in once a build, and the list it adds to is the thing read on
 * every visit.
 */
function BuildChecklist({ tasks, busy, loading, error, onSave, onRemove, area }) {
  const [draft, setDraft] = useState({ label: '', detail: '', stage: STAGES[0].id, kind: 'tick' })
  const [asking, setAsking] = useState(false)

  const add = async event => {
    event.preventDefault()
    if (!draft.label.trim()) return
    const saved = await onSave(draft, 'task:new')
    if (saved) {
      setDraft({ label: '', detail: '', stage: draft.stage, kind: draft.kind })
      setAsking(false)
    }
  }

  return (
    <>
      <Panel
        title="Their Checklist"
        aside={tasks.length ? `${tasks.length} items` : null}
        loading={loading}
        area={area}
      >
        <PanelBody>
          {loading ? (
            <SkeletonList rows={4} />
          ) : tasks.length ? (
            <ul>
              {tasks.map(task => (
                <li key={task.id} className="border-hair-paper border-t px-5 py-3 first:border-t-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[14px] font-medium text-ink-paper">{task.label}</span>
                    <span className={`${MONO_LABEL} text-paper-faint`}>
                      {stageOf(task.stage).label} ·{' '}
                      {KINDS.find(k => k.id === task.kind)?.label || task.kind}
                      {task.required ? '' : ' · optional'}
                    </span>
                    <button
                      type="button"
                      className={`${QUIET} ml-auto`}
                      disabled={busy === `task:${task.id}`}
                      onClick={() => onRemove(task.id, `task:${task.id}`)}
                    >
                      Remove
                    </button>
                  </div>
                  {task.detail ? (
                    <p className="mt-1 text-[13px] text-paper-soft">{task.detail}</p>
                  ) : null}
                  {task.answer ? (
                    <p className="border-hair-paper mt-2 border-l-2 pl-3 text-[13px] leading-relaxed text-ink-paper">
                      {task.answer}
                    </p>
                  ) : null}
                  {task.files?.length ? (
                    <ul className="mt-2 flex flex-wrap gap-3">
                      {task.files.map(file => (
                        <li key={file.id} className="text-[13px]">
                          {file.url ? (
                            <a
                              className="console-link"
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {file.name || 'File'}
                            </a>
                          ) : (
                            <span>{file.name || 'File'}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <span className={`${MONO_LABEL} text-paper-faint mt-1.5 block`}>
                    {task.done_at ? `Done ${shortDate(task.done_at)}` : 'Outstanding'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-[13px] text-paper-soft">
              Nothing on their list yet.
            </p>
          )}
        </PanelBody>
        <PanelFoot>
          <span>
            A stage will not close while the client still owes something it asked of them.
          </span>
          <button type="button" className={BUTTON} onClick={() => setAsking(true)}>
            Add to Their List
          </button>
        </PanelFoot>
      </Panel>

      <SidePanel open={asking} title="Add to Their List" onClose={() => setAsking(false)}>
        <form onSubmit={add} className="grid gap-4 px-5 py-4">
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Ask for</span>
            <input
              type="text"
              value={draft.label}
              onChange={event => setDraft({ ...draft, label: event.target.value })}
              placeholder="What they need to send"
              className={FIELD}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Detail</span>
            <input
              type="text"
              value={draft.detail}
              onChange={event => setDraft({ ...draft, detail: event.target.value })}
              placeholder="The sentence under it, in their words"
              className={FIELD}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Stage</span>
            <select
              value={draft.stage}
              onChange={event => setDraft({ ...draft, stage: event.target.value })}
              className={`${SELECT} w-full`}
            >
              {STAGES.map(one => (
                <option key={one.id} value={one.id}>
                  {one.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>They answer with</span>
            <select
              value={draft.kind}
              onChange={event => setDraft({ ...draft, kind: event.target.value })}
              className={`${SELECT} w-full`}
            >
              {KINDS.map(one => (
                <option key={one.id} value={one.id}>
                  {one.label}
                </option>
              ))}
            </select>
          </label>
          {/* The panel covers the page, and with it the notice at the top of
              the page that every other refusal is read from, so a refusal is
              said where the typing is. */}
          {error ? (
            <p className={`${MONO_LABEL} text-[color:var(--warn)]`} role="status">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className={`${BUTTON} justify-self-start`}
            disabled={busy === 'task:new' || !draft.label.trim()}
          >
            {busy === 'task:new' ? 'Adding' : 'Add to Their List'}
          </button>
        </form>
      </SidePanel>
    </>
  )
}

/** What a build's state is called on a row, and the badge tone carrying it. */
const STATUS = {
  complete: { label: 'Finished', tone: 'good' },
  cancelled: { label: 'Cancelled', tone: 'bad' },
  active: { label: 'Active', tone: 'accent' },
}

/** The month and day a date reads as in a table. */
function shortDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString(undefined, {
    timeZone: ZONE,
    day: 'numeric',
    month: 'short',
  })
}

/** A build's stage, and the picker that moves it one click in. */
function StageControl({ project, busy, onPick, className = 'w-full' }) {
  return (
    <select
      aria-label={`Stage of ${project.business_name || project.email}`}
      value={project.stage}
      disabled={busy}
      onChange={event => {
        if (event.target.value !== project.stage) onPick(event.target.value)
      }}
      className={`${SELECT} ${className}`}
    >
      {STAGES.map(stage => (
        <option key={stage.id} value={stage.id}>
          {stageRank(stage.id)}. {stage.label}
        </option>
      ))}
    </select>
  )
}

/**
 * The site a build became, and the picker that attaches one.
 *
 * Until it is set, a build and the site it produced are two records that do
 * not know about each other, and the figures for the site never meet the
 * build that made it.
 */
function SiteControl({ project, sites, busy, onPick, className = 'w-full' }) {
  return (
    <select
      aria-label={`Site for ${project.business_name || project.email}`}
      value={project.site_id || ''}
      disabled={busy}
      onChange={event => onPick(event.target.value || null)}
      className={`${SELECT} ${className}`}
    >
      <option value="">Not yet</option>
      {sites.map(site => (
        <option key={site.site_id} value={site.site_id}>
          {displayDomain(site.name)}
        </option>
      ))}
    </select>
  )
}

/** One update as it stands, with the way to put a capture on it. */
function UpdateRow({ update, busy, onAttach }) {
  const picker = useRef(null)
  const [caption, setCaption] = useState('')

  return (
    <li className="border-hair-paper border-t px-5 py-4 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-medium text-ink-paper">{update.title}</h3>
        <span className={`${MONO_LABEL} text-paper-faint`}>
          {stageOf(update.stage).label}
          {update.published_at ? ` · ${shortDate(update.published_at)}` : ' · Draft'}
        </span>
      </div>
      {update.body ? (
        <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-paper-soft">
          {update.body}
        </p>
      ) : null}

      {/* One row of captures however many there are. A page has a handful,
          and stacked they would put the control that attaches the next one a
          screen below the update it belongs to. */}
      {update.media?.length ? (
        <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 py-1">
          {update.media.map(shot => (
            <figure
              key={shot.id}
              className="border-hair-paper w-40 flex-shrink-0 overflow-hidden rounded-[var(--console-radius-sm)] border"
            >
              <img
                src={shot.url || shot.path}
                alt={shot.caption || update.title}
                loading="lazy"
                width={shot.width || undefined}
                height={shot.height || undefined}
                className="block w-full"
              />
              {shot.caption ? (
                <figcaption className="text-paper-faint px-1.5 py-1 text-[11px]">
                  {shot.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={picker}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) onAttach(file, caption.trim())
            setCaption('')
            event.target.value = ''
          }}
        />
        <input
          type="text"
          value={caption}
          placeholder="What the picture shows"
          aria-label={`Caption for a picture on ${update.title}`}
          onChange={event => setCaption(event.target.value)}
          className={`${FIELD} max-w-[16rem]`}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => picker.current?.click()}
          className={QUIET}
        >
          <ImagePlus className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          {busy ? 'Attaching' : 'Attach Picture'}
        </button>
      </div>
    </li>
  )
}

/**
 * One build in the column beside the one being read: its name, where it has
 * got to, and what it is waiting on.
 *
 * The badge is the stage in the colour of the build's state, so a column of
 * them reads as a column of stages and the two that have stopped moving read
 * as stopped. A build that has not been signed up for says so here as well,
 * because that is the one fact about a build that is wrong before any stage
 * is.
 */
function BuildRow({ project, open, onOpen }) {
  const waiting = project.waiting_on || []
  const badge =
    project.status === 'cancelled'
      ? STATUS.cancelled
      : {
          label: stageOf(project.stage).label,
          tone: project.status === 'complete' ? 'good' : 'accent',
        }
  const facts = [
    project.claimed ? null : 'Not signed up',
    waiting.length ? `Waiting on ${waiting.join(', ')}` : 'Nothing owed',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="border-hair-paper border-t first:border-t-0">
      <button
        type="button"
        aria-current={open ? 'true' : undefined}
        onClick={onOpen}
        className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-left transition-colors duration-150 ease-out-soft hover:bg-[color:var(--paper-field)] aria-[current=true]:bg-[color:var(--paper-field)] aria-[current=true]:shadow-[inset_2px_0_0_var(--accent)]"
      >
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-[13px] font-medium text-ink-paper">
            {project.business_name || project.email}
          </span>
          <span className="text-paper-faint truncate text-[12px]">{facts}</span>
        </span>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </button>
    </li>
  )
}

/** The record, and the one build opened out of it. */
const BUILD_VIEWS = [{ key: 'builds', label: 'Builds' }]

export default function BuildsPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const enabled = Boolean(token)

  const {
    projects,
    updates,
    brief,
    tasks,
    open,
    error,
    loading,
    updatesLoading,
    acting,
    openBuild,
    act,
    attach,
  } = useBuildsFeed({ token, enabled })
  const { data: accounts } = useAdminFeed({ token, enabled })

  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [stage, setStage] = useState('')
  const [composing, setComposing] = useState(false)
  const [reading, setReading] = useState(false)

  const rows = useMemo(() => projects || [], [projects])
  const build = useMemo(() => rows.find(one => one.project_id === open) || null, [rows, open])
  const sites = useMemo(
    () => [...(accounts?.sites || [])].sort((a, b) => a.name.localeCompare(b.name)),
    [accounts]
  )
  // The open build is a view of its own while there is one, so the record
  // and the build are read one at a time rather than the build under the
  // record.
  const views = build
    ? [
        { ...BUILD_VIEWS[0], count: rows.length, loading },
        { key: 'build', label: build.business_name || build.email },
      ]
    : [{ ...BUILD_VIEWS[0], count: rows.length, loading }]
  const [view, go] = useView(views)
  const pick = id => {
    openBuild(id)
    go(id ? 'build' : 'builds')
  }

  if (error && !projects) return <SectionNotice>{error}</SectionNotice>

  const submitUpdate = async event => {
    event.preventDefault()
    const answer = await act(
      {
        action: 'update',
        project_id: open,
        title,
        body: note,
        stage: stage || build?.stage || null,
        publish: true,
      },
      'update'
    )
    if (!answer?.update_id) return
    setTitle('')
    setNote('')
    setStage('')
    setComposing(false)
  }

  const buildKey = build ? `build:${build.project_id}` : null
  const reached = build ? stageRank(build.stage) : 0
  const complete = build?.status === 'complete'

  return (
    <ConsolePage areas={['nav', 'work']} rows={ROWS}>
      <Area area="nav">
        <ConsoleError>{error}</ConsoleError>
        <ViewNav views={views} current={view} onPick={go} label="Build views" />
      </Area>

      {view === 'builds' ? (
        <Panel title="Builds" aside={`${rows.length} in the record`} loading={loading} area="work">
          <PanelBody className="overflow-x-auto">
            <table
              className="w-full min-w-[560px] table-fixed border-collapse text-[13px]"
              aria-busy={loading}
            >
              <thead>
                <tr>
                  <th scope="col" className={`${TH} w-[13rem]`}>
                    Build
                  </th>
                  <th scope="col" className={`${TH} w-[10rem]`}>
                    Stage
                  </th>
                  <th scope="col" className={TH}>
                    Waiting On
                  </th>
                  <th scope="col" className={`${TH} w-[11rem]`}>
                    Site
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={4} rows={4} />
                ) : rows.length ? (
                  rows.map(project => {
                    const key = `build:${project.project_id}`
                    const waiting = project.waiting_on || []
                    return (
                      <tr
                        key={project.project_id}
                        className="border-hair-paper border-t align-top"
                        data-open={project.project_id === open ? 'true' : undefined}
                      >
                        <td className={CELL}>
                          <button
                            type="button"
                            onClick={() =>
                              pick(project.project_id === open ? null : project.project_id)
                            }
                            className="block max-w-full cursor-pointer truncate text-left font-medium text-ink-paper hover:text-accent"
                          >
                            {project.business_name || project.email}
                          </button>
                          <span className={`${MONO_LABEL} text-paper-faint block truncate`}>
                            {project.email}
                          </span>
                          <span className={`${MONO_LABEL} text-paper-faint block`}>
                            {project.claimed ? 'Signed up' : 'Not signed up'}
                            {project.paid_at ? ` · Paid ${shortDate(project.paid_at)}` : ''}
                          </span>
                          {/* Offered only where it is the answer. A build already
                            attached to an account is one somebody is reading,
                            and moving it would take it off them. */}
                          {project.claimed ? null : (
                            <ClaimControl
                              project={project}
                              busy={acting === key}
                              onClaim={email =>
                                act({ action: 'claim', project_id: project.project_id, email }, key)
                              }
                            />
                          )}
                        </td>
                        <td className={CELL}>
                          <StageControl
                            project={project}
                            busy={acting === key}
                            onPick={next =>
                              act(
                                { action: 'stage', project_id: project.project_id, stage: next },
                                key
                              )
                            }
                          />
                          <span className="mt-1.5 block">
                            <Badge tone={STATUS[project.status]?.tone ?? 'plain'}>
                              {STATUS[project.status]?.label ?? project.status}
                            </Badge>
                          </span>
                        </td>
                        <td className={CELL}>
                          {waiting.length ? (
                            <ul className="flex flex-col gap-1">
                              {waiting.map(label => (
                                <li key={label} className="text-[13px] text-paper-soft">
                                  {label}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className={`${MONO_LABEL} text-paper-faint`}>Nothing</span>
                          )}
                        </td>
                        <td className={CELL}>
                          <SiteControl
                            project={project}
                            sites={sites}
                            busy={acting === key}
                            onPick={siteId =>
                              act(
                                { action: 'site', project_id: project.project_id, site_id: siteId },
                                key
                              )
                            }
                          />
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <EmptyRow cols={4}>No build has been opened yet.</EmptyRow>
                )}
              </tbody>
            </table>
          </PanelBody>
          <PanelFoot>
            <span>
              A stage will not close while the client still owes something it asked of them. What
              they owe is the Waiting On column.
            </span>
          </PanelFoot>
        </Panel>
      ) : null}

      {view === 'build' && build ? (
        <>
          <ConsoleSplit
            area="work"
            list={
              <Panel title="Builds" aside={`${rows.length} in the record`} loading={loading}>
                <PanelBody>
                  {loading ? (
                    <SkeletonList rows={5} />
                  ) : rows.length ? (
                    <ul>
                      {rows.map(project => (
                        <BuildRow
                          key={project.project_id}
                          project={project}
                          open={project.project_id === open}
                          onOpen={() => {
                            if (project.project_id !== open) pick(project.project_id)
                          }}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
                      No build has been opened yet.
                    </p>
                  )}
                </PanelBody>
              </Panel>
            }
          >
            <Board areas={['track track', 'asks updates']} cols={SPLIT} rows={ROWS}>
              <Panel
                title={build.business_name || build.email}
                aside={
                  complete
                    ? 'Finished'
                    : build.status === 'cancelled'
                      ? 'Cancelled'
                      : `Stage ${reached} of ${STAGES.length}`
                }
                area="track"
              >
                {/* Six steps at the floor the client's tracker gives them are
                    wider than the column this band has beside the list, so
                    here the steps share the width and a long label breaks
                    rather than the last step dropping to a row of its own. */}
                <ol className="console-track xl:[&>li]:min-w-0" aria-label="Progress">
                  {STAGES.map((one, index) => (
                    <li
                      key={one.id}
                      className="console-track-step"
                      data-state={
                        index + 1 < reached || complete
                          ? 'done'
                          : index + 1 === reached
                            ? 'here'
                            : 'ahead'
                      }
                      aria-current={index + 1 === reached && !complete ? 'step' : undefined}
                    >
                      <span className="console-track-dot" aria-hidden="true" />
                      <span className="console-track-label">{one.label}</span>
                    </li>
                  ))}
                </ol>
                <div className="border-hair-paper flex flex-wrap items-center gap-x-3 gap-y-2 border-t px-5 py-3">
                  <label className="flex items-center gap-2">
                    <span className={`${MONO_LABEL} text-paper-faint`}>Stage</span>
                    <StageControl
                      project={build}
                      busy={acting === buildKey}
                      onPick={next =>
                        act(
                          { action: 'stage', project_id: build.project_id, stage: next },
                          buildKey
                        )
                      }
                      className="w-[9rem]"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className={`${MONO_LABEL} text-paper-faint`}>Site</span>
                    <SiteControl
                      project={build}
                      sites={sites}
                      busy={acting === buildKey}
                      onPick={siteId =>
                        act(
                          { action: 'site', project_id: build.project_id, site_id: siteId },
                          buildKey
                        )
                      }
                      className="w-[9rem]"
                    />
                  </label>
                  <span className="grow" />
                  {/* What they asked for, before anybody spoke to them. Six
                      screens of answers used to be collected and then dropped
                      on the way to Stripe, so a build opened with an address
                      and a business name and the person starting it had to
                      ask for all of it again. */}
                  {brief?.answers?.length ? (
                    <button type="button" className={QUIET} onClick={() => setReading(true)}>
                      Their Brief
                    </button>
                  ) : null}
                  {build.claimed ? null : (
                    <ClaimControl
                      inline
                      project={build}
                      busy={acting === buildKey}
                      onClaim={email =>
                        act({ action: 'claim', project_id: build.project_id, email }, buildKey)
                      }
                    />
                  )}
                </div>
              </Panel>

              <BuildChecklist
                tasks={tasks}
                busy={acting}
                loading={updatesLoading}
                error={error}
                onSave={(task, key) =>
                  act({ action: 'task', project_id: build.project_id, ...task }, key)
                }
                onRemove={(taskId, key) => act({ action: 'untask', task_id: taskId }, key)}
                area="asks"
              />

              <Panel
                title="Updates"
                aside={`${(updates || []).length} updates`}
                loading={updatesLoading}
                area="updates"
              >
                <PanelBody>
                  {updatesLoading ? (
                    <SkeletonList rows={3} />
                  ) : updates?.length ? (
                    <ul>
                      {updates.map(update => (
                        <UpdateRow
                          key={update.id}
                          update={update}
                          busy={acting === `shot:${update.id}`}
                          onAttach={(file, caption) =>
                            attach(update.id, file, caption, `shot:${update.id}`)
                          }
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
                      Nothing written to them yet.
                    </p>
                  )}
                </PanelBody>
                <PanelFoot>
                  <button type="button" className={BUTTON} onClick={() => setComposing(true)}>
                    Write an Update
                  </button>
                </PanelFoot>
              </Panel>
            </Board>
          </ConsoleSplit>

          <SidePanel
            open={composing}
            title="Write an Update"
            aside={build.business_name || build.email}
            onClose={() => setComposing(false)}
          >
            <form onSubmit={submitUpdate} className="grid gap-4 px-5 py-4">
              <label className="grid gap-1.5">
                <span className={`${MONO_LABEL} text-paper-faint`}>Title</span>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  placeholder="What happened"
                  className={FIELD}
                />
              </label>
              <label className="grid gap-1.5">
                <span className={`${MONO_LABEL} text-paper-faint`}>Update</span>
                <textarea
                  rows={6}
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  placeholder="Written to the person waiting, not about them"
                  className={`${FIELD} resize-y`}
                />
              </label>
              <label className="grid gap-1.5">
                <span className={`${MONO_LABEL} text-paper-faint`}>Stage</span>
                <select
                  value={stage || build.stage}
                  onChange={event => setStage(event.target.value)}
                  className={`${SELECT} w-full`}
                >
                  {STAGES.map(one => (
                    <option key={one.id} value={one.id}>
                      {one.label}
                    </option>
                  ))}
                </select>
              </label>
              {/* The panel covers the page, and with it the notice at the top
                  of the page that every other refusal is read from, so a
                  refusal is said where the typing is. */}
              {error ? (
                <p className={`${MONO_LABEL} text-[color:var(--warn)]`} role="status">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={acting === 'update'}
                className={`${BUTTON} justify-self-start`}
              >
                <Send className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                {acting === 'update' ? 'Publishing' : 'Publish Update'}
              </button>
            </form>
          </SidePanel>

          {brief?.answers?.length ? (
            <SidePanel
              open={reading}
              title="Their Brief"
              aside="As they answered it"
              onClose={() => setReading(false)}
            >
              <dl className="grid gap-0">
                {brief.answers.map(row => (
                  <div
                    key={row.label}
                    className="border-hair-paper grid gap-1 border-t px-5 py-3 first:border-t-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4"
                  >
                    <dt className={`${MONO_LABEL} text-paper-faint`}>{row.label}</dt>
                    <dd className="text-[13px] leading-relaxed text-ink-paper">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </SidePanel>
          ) : null}
        </>
      ) : null}
    </ConsolePage>
  )
}
