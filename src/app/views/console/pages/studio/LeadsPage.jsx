import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Send, X } from 'lucide-react'
import { faultMessage } from '@utils/faults'
import { useSession } from '@hooks/session/useSession'
import { useToast } from '@hooks/chrome/useToast'
import { useLeadsFeed } from '@hooks/console/useLeadsFeed'
import { formatInstant } from '@lib/time/zone.js'
import { fromPaymentPage } from '@lib/leads/paths.js'
import {
  fillTemplate,
  PLACEHOLDERS,
  placeholderToken,
  placeholderValues,
  TEMPLATE_LIMITS,
  unfilled,
} from '@lib/leads/templates.js'
import {
  Area,
  Badge,
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
import { Figures } from '../../Figures'
import { useView } from '../../lib/views'
import {
  BUTTON,
  CELL_TIGHT,
  FIELD,
  MONO_LABEL,
  QUIET,
  QUIET_ROW,
  SELECT,
  SELECT_ON,
  TH_TIGHT,
} from '../../lib/tokens'

/**
 * Everybody who has raised a hand at this business, whichever door they came
 * through, and the desk they are worked from.
 *
 * The section used to be one table with two marks on it, and the work it
 * fronts happened somewhere else: reading what a lead said meant unfolding a
 * row, and answering them meant leaving for the mail client with their
 * address on the clipboard. So the page is a desk now. The list holds the
 * left column, the lead being worked holds the rest, and everything the
 * studio does about a lead - answer it by mail, mark it answered or replied,
 * hand it to somebody, date it, rule it out - is a control on the record it
 * acts on.
 *
 * The mail goes from drafts the section itself keeps, under its own Settings
 * view, with the lead's facts written into the blanks. One lead at a time,
 * always: the composer opens from inside a single record with the whole
 * message on screen, because a hundred addresses beside one button is a
 * mistake waiting for a slow afternoon.
 *
 * Nothing here re-reads behind a button. The feed keeps its own beat, so a
 * lead that lands while the section is open walks in on its own.
 */

/** The doors, in the words a person uses for them rather than the column's. */
const DOORS = {
  configurator: 'Configurator',
  payment: 'Payment Page',
  contact: 'Contact Form',
  tools: 'Tools Enquiry',
  'speed-check': 'Speed Check',
  ad: 'Paid Ad',
  'outreach-reply': 'Outreach Reply',
  call: 'Phone Call',
}

/**
 * The same doors as a list, which is what the filter runs off and what proves
 * the table above has a name for every one of them.
 *
 * Written out rather than derived from the object's keys, because the check
 * that reads this file has to see each door named as the database spells it -
 * and an object key spells `speed-check` one way and `configurator` another.
 */
const DOOR_NAMES = [
  'configurator',
  'payment',
  'contact',
  'tools',
  'speed-check',
  'ad',
  'outreach-reply',
  'call',
]

/**
 * The steps the configurator runs, so a number reads as a place.
 *
 * Only two of the eight doors have steps at all, and for those two how far
 * somebody got is the most useful thing about them: a lead who read the price
 * and closed the tab is a different conversation from one who answered the
 * first question.
 */
const STEPS = ['Business type', 'The work', 'The look', 'What it costs', 'Payment']

/** How far somebody reached, written as the screen they were on. */
function reached(lead) {
  if (fromPaymentPage(lead.path)) return 'Payment page'
  const name = STEPS[lead.step]
  return name ? `${lead.step + 1}. ${name}` : null
}

/** An instant as the day and time it happened, in the studio's own zone. */
function when(value) {
  if (!value) return '—'
  return formatInstant(new Date(value), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** A date alone, for a thing that is owed on a day rather than at a minute. */
function onDay(value) {
  if (!value) return '—'
  return formatInstant(new Date(value), { month: 'short', day: 'numeric' })
}

/**
 * The furthest thing that happened to a lead, in a word.
 *
 * Read newest-fact-first, so somebody who enquired and then paid reads as a
 * customer rather than as an enquiry still waiting for an answer.
 */
function stage(lead) {
  if (lead.dismissed_at) return { label: 'Ruled Out', tone: 'plain' }
  if (lead.unsubscribed_at) return { label: 'Unsubscribed', tone: 'bad' }
  if (lead.bought_at) return { label: 'Bought', tone: 'good' }
  if (lead.checkout_at) return { label: 'Reached Checkout', tone: 'accent' }
  if (lead.replied_at) return { label: 'Replied', tone: 'accent' }
  if (lead.enquired_at) return { label: 'Enquired', tone: 'accent' }
  if (lead.contacted_at) return { label: 'Answered', tone: 'plain' }
  return { label: 'Waiting', tone: 'warn' }
}

/**
 * Whether a lead is owed something right now.
 *
 * Two ways to be owed, and they are genuinely different: nobody has answered
 * them at all, or somebody set a date and the date has passed. A lead that is
 * bought, unsubscribed or ruled out is owed nothing by either reading.
 */
function waiting(lead) {
  if (lead.dismissed_at || lead.bought_at || lead.unsubscribed_at) return false
  if (!lead.contacted_at) return true
  return Boolean(lead.due_at && new Date(lead.due_at) <= new Date())
}

/** Who they are, falling back through what the door managed to collect. */
function who(lead) {
  return lead.name || lead.business || lead.email || lead.phone || 'Unnamed'
}

/** The rows a lead's brief carries, or nothing where it never had one. */
function briefRows(lead) {
  return Array.isArray(lead.brief) ? lead.brief.filter(row => row?.label && row?.value) : []
}

/** The campaign tags, as a line, or nothing where the visit carried none. */
function arrival(lead) {
  const tags = lead.campaign
  if (!tags || typeof tags !== 'object') return null
  const parts = [tags.utm_source, tags.utm_medium, tags.utm_campaign].filter(Boolean)
  return parts.length ? parts.join(' / ') : null
}

/** What the search box runs over: everything a lead is known by. */
function matches(lead, needle) {
  if (!needle) return true
  const hay = [lead.name, lead.business, lead.email, lead.phone, lead.town, lead.trade, lead.note]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(needle)
}

/** The stages the filter offers, each the reading the badge gives it. */
const STAGE_VIEWS = [
  { key: 'all', label: 'Every Stage' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'Answered', label: 'Answered' },
  { key: 'Replied', label: 'Replied' },
  { key: 'Enquired', label: 'Enquired' },
  { key: 'Reached Checkout', label: 'Reached Checkout' },
  { key: 'Bought', label: 'Bought' },
  { key: 'Ruled Out', label: 'Ruled Out' },
  { key: 'Unsubscribed', label: 'Unsubscribed' },
]

/** The orders the list can be read in. */
const ORDERS = [
  { key: 'newest', label: 'Newest First' },
  { key: 'oldest', label: 'Oldest First' },
  { key: 'due', label: 'Next Owed' },
]

/** One labelled thing a lead told us. */
function Fact({ label, value }) {
  return (
    <div>
      <dt className={`${MONO_LABEL} text-paper-faint`}>{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] leading-snug text-ink-paper">{value}</dd>
    </div>
  )
}

/** One lead in the column: who, where from, how far, and whether they wait. */
function LeadRow({ lead, open, onOpen }) {
  const state = stage(lead)
  return (
    <li className="border-hair-paper border-t first:border-t-0">
      <button
        type="button"
        aria-current={open ? 'true' : undefined}
        onClick={onOpen}
        className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-left transition-colors duration-150 ease-out-soft hover:bg-[color:var(--paper-field)] aria-[current=true]:bg-[color:var(--paper-field)] aria-[current=true]:shadow-[inset_2px_0_0_var(--accent)]"
      >
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-[13px] font-medium text-ink-paper">{who(lead)}</span>
          <span className="text-paper-faint truncate text-[12px]">
            {DOORS[lead.source] || lead.source} · {when(lead.first_seen)}
            {lead.due_at ? ` · owed ${onDay(lead.due_at)}` : ''}
          </span>
        </span>
        <Badge tone={state.tone}>{state.label}</Badge>
      </button>
    </li>
  )
}

/**
 * Everything that has happened to one lead, newest first: the moments the
 * doors stamped, and every message written to them from here.
 */
function Record({ lead, messages, fault }) {
  const moments = [
    ['Came In', lead.first_seen, DOORS[lead.source] || lead.source],
    ['Enquired', lead.enquired_at, null],
    ['Reached Checkout', lead.checkout_at, null],
    ['Bought', lead.bought_at, null],
    ['Answered', lead.contacted_at, null],
    ['Replied', lead.replied_at, null],
    ['Unsubscribed', lead.unsubscribed_at, null],
    ['Ruled Out', lead.dismissed_at, lead.dismissed_reason],
  ]
    .filter(([, at]) => at)
    .map(([label, at, detail]) => ({ kind: 'moment', label, at, detail }))

  const letters = (messages || []).map(message => ({
    kind: 'letter',
    label: 'Written To',
    at: message.sent_at,
    message,
  }))

  const record = [...moments, ...letters].sort((a, b) => new Date(b.at) - new Date(a.at))

  return (
    <div className="grid gap-2">
      <p className={`${MONO_LABEL} text-paper-faint`}>The Record</p>
      {fault && <p className={`${MONO_LABEL} text-[color:var(--warn)]`}>{fault}</p>}
      <ul className="grid gap-1.5">
        {record.map((entry, at) => (
          <li key={`${entry.label}-${entry.at}-${at}`} className="text-[13px] leading-snug">
            {entry.kind === 'letter' ? (
              <details>
                <summary className="cursor-pointer text-ink-paper">
                  <span className="font-medium">{entry.message.subject}</span>
                  <span className="text-paper-faint">
                    {' '}
                    · sent {when(entry.at)}
                    {entry.message.sent_by ? ` by ${entry.message.sent_by}` : ''}
                  </span>
                </summary>
                <p className="border-hair-paper mt-2 max-w-prose whitespace-pre-line border-l-2 pl-3 text-[13px] leading-relaxed text-paper-soft">
                  {entry.message.body}
                </p>
              </details>
            ) : (
              <span>
                <span className="font-medium text-ink-paper">{entry.label}</span>
                <span className="text-paper-faint"> · {when(entry.at)}</span>
                {entry.detail && <span className="text-paper-soft"> · {entry.detail}</span>}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The lead being worked: everything they told us, everything that has
 * happened to them, and every control that acts on them.
 */
function Reading({ lead, team, messages, messagesError, saving, onMark, onCompose }) {
  const state = stage(lead)
  const rows = briefRows(lead)
  const came = arrival(lead)
  // Ruling out asks for the reason in place rather than marking first and
  // asking after, so a misclick costs nothing and a reason is never owed.
  const [ruling, setRuling] = useState(false)
  const [because, setBecause] = useState('')
  const busy = saving === lead.id

  useEffect(() => {
    setRuling(false)
    setBecause('')
  }, [lead.id])

  const mailless = !lead.email
  const gone = Boolean(lead.unsubscribed_at)

  return (
    <Panel
      title={who(lead)}
      aside={<Badge tone={state.tone}>{state.label}</Badge>}
      className="lg:row-span-full"
    >
      <div className="border-hair-paper flex flex-wrap items-center gap-x-2 gap-y-2 border-b px-5 py-3">
        <button
          type="button"
          className={BUTTON}
          disabled={busy || mailless || gone}
          title={
            mailless
              ? 'This lead left no address.'
              : gone
                ? 'They unsubscribed. Nothing goes to them.'
                : undefined
          }
          onClick={onCompose}
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Send an Email
        </button>
        <button
          type="button"
          className={QUIET}
          disabled={busy}
          aria-pressed={Boolean(lead.contacted_at)}
          onClick={() => onMark(lead.id, { mark: 'contacted', on: !lead.contacted_at })}
        >
          <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
          {lead.contacted_at ? 'Not Answered Yet' : 'Mark Answered'}
        </button>
        <button
          type="button"
          className={QUIET}
          disabled={busy}
          aria-pressed={Boolean(lead.replied_at)}
          onClick={() => onMark(lead.id, { mark: 'replied', on: !lead.replied_at })}
        >
          <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
          {lead.replied_at ? 'No Reply After All' : 'They Replied'}
        </button>
        {lead.dismissed_at ? (
          <button
            type="button"
            className={QUIET}
            disabled={busy}
            onClick={() => onMark(lead.id, { mark: 'dismissed', on: false })}
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
            Put Back
          </button>
        ) : ruling ? (
          <span className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              className={`${FIELD} w-48`}
              placeholder="Why you are ruling them out"
              maxLength={200}
              value={because}
              onChange={event => setBecause(event.target.value)}
            />
            <button
              type="button"
              className={QUIET}
              disabled={busy}
              onClick={async () => {
                const done = await onMark(lead.id, {
                  mark: 'dismissed',
                  on: true,
                  reason: because,
                })
                if (done) setRuling(false)
              }}
            >
              Rule Out
            </button>
            <button type="button" className={QUIET} onClick={() => setRuling(false)}>
              Keep Them
            </button>
          </span>
        ) : (
          <button type="button" className={QUIET} disabled={busy} onClick={() => setRuling(true)}>
            <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
            Rule Out
          </button>
        )}
        <span className="grow" />
        <label className={`${MONO_LABEL} text-paper-faint flex items-center gap-1.5`}>
          Next
          <input
            type="date"
            className="border-hair-paper rounded-[var(--console-radius-sm)] border bg-[color:var(--paper-field)] px-2 py-1 text-[13px] text-ink-paper"
            value={lead.due_at ? new Date(lead.due_at).toISOString().slice(0, 10) : ''}
            disabled={busy}
            onChange={event => onMark(lead.id, { due_at: event.target.value || null })}
          />
        </label>
        <label className={`${MONO_LABEL} text-paper-faint flex items-center gap-1.5`}>
          Carried By
          <select
            className={lead.owner ? SELECT_ON : SELECT}
            value={lead.owner || ''}
            disabled={busy}
            onChange={event => onMark(lead.id, { owner: event.target.value || null })}
          >
            <option value="">Nobody</option>
            {team.map(person => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PanelBody>
        <div className="grid gap-5 px-5 py-4">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {lead.email && (
              <Fact
                label="Address"
                value={
                  <a href={`mailto:${lead.email}`} className="text-accent hover:underline">
                    {lead.email}
                  </a>
                }
              />
            )}
            {lead.phone && (
              <Fact
                label="Phone"
                value={
                  <a
                    href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}
                    className="text-accent hover:underline"
                  >
                    {lead.phone}
                  </a>
                }
              />
            )}
            {lead.website && (
              <Fact
                label="Website"
                value={
                  <a
                    href={
                      /^https?:\/\//.test(lead.website) ? lead.website : `https://${lead.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    {lead.website}
                  </a>
                }
              />
            )}
            {lead.business && <Fact label="Business" value={lead.business} />}
            {lead.trade && <Fact label="Trade" value={lead.trade} />}
            {lead.town && <Fact label="Town" value={lead.town} />}
            {reached(lead) && <Fact label="Reached" value={reached(lead)} />}
            {came && <Fact label="Came From" value={came} />}
            <Fact label="First Seen" value={when(lead.first_seen)} />
            {rows.map(row => (
              <Fact key={row.label} label={row.label} value={row.value} />
            ))}
          </dl>

          {lead.note && (
            <div className="grid gap-2">
              <p className={`${MONO_LABEL} text-paper-faint`}>In Their Words</p>
              <p className="border-hair-paper max-w-prose whitespace-pre-line border-l-2 pl-3 text-[13px] leading-relaxed text-ink-paper">
                {lead.note}
              </p>
            </div>
          )}

          <Record lead={lead} messages={messages} fault={messagesError} />
        </div>
      </PanelBody>
      <PanelFoot>
        A message you send from here goes to this lead alone, in the words you wrote, and the record
        above keeps it alongside everything else that has happened to them.
      </PanelFoot>
    </Panel>
  )
}

/**
 * The composer: a draft picked, the blanks filled from the lead, and the
 * whole message read before it goes.
 */
function Composer({ open, lead, templates, sending, onSend, onClose }) {
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [fault, setFault] = useState(null)
  const toast = useToast()

  // A fresh composer for each opening and each lead, so yesterday's half-typed
  // message never rides into today's.
  useEffect(() => {
    if (!open) return
    setTemplateId('')
    setSubject('')
    setBody('')
    setFault(null)
  }, [open, lead?.id])

  if (!lead) return null

  const startFrom = id => {
    setTemplateId(id)
    const draft = templates.find(row => row.id === id)
    if (!draft) return
    setSubject(fillTemplate(draft.subject, lead))
    setBody(fillTemplate(draft.body, lead))
  }

  const standing = unfilled(`${subject}\n${body}`)
  const known = placeholderValues(lead)
  const absent = PLACEHOLDERS.filter(({ key }) => !known[key])
  const ready = subject.trim() && body.trim() && !standing.length && !sending

  const send = async event => {
    event.preventDefault()
    setFault(null)
    const answer = await onSend({ id: lead.id, subject, body, templateId: templateId || null })
    if (!answer.ok) {
      setFault(faultMessage(answer.error, 'That did not go. Try again in a moment.'))
      return
    }
    toast(`Sent to ${lead.email}.`, 'success')
    onClose()
  }

  return (
    <SidePanel
      open={open}
      title={`Write to ${who(lead)}`}
      aside={lead.email || ''}
      note="It goes exactly as it reads here, from the studio's own address, to this lead alone."
      onClose={onClose}
    >
      <form onSubmit={send} className="grid gap-4 px-5 py-4">
        {templates.length ? (
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Start From</span>
            <select
              className={`${SELECT} w-full`}
              value={templateId}
              onChange={event => startFrom(event.target.value)}
            >
              <option value="">A Blank Page</option>
              {templates.map(draft => (
                <option key={draft.id} value={draft.id}>
                  {draft.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-[13px] leading-relaxed text-paper-soft">
            No drafts yet. You write them in the Settings view, and this composer offers each one
            with the lead's own details already in the blanks.
          </p>
        )}
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>Subject</span>
          <input
            required
            type="text"
            maxLength={TEMPLATE_LIMITS.subject}
            value={subject}
            onChange={event => setSubject(event.target.value)}
            className={FIELD}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>Message</span>
          <textarea
            required
            rows={12}
            maxLength={TEMPLATE_LIMITS.body}
            value={body}
            onChange={event => setBody(event.target.value)}
            className={`${FIELD} resize-y font-normal leading-relaxed`}
          />
        </label>
        {standing.length > 0 && (
          <p className={`${MONO_LABEL} text-[color:var(--warn)]`}>
            Still blank: {standing.join(', ')}. Fill each one in before it goes
            {absent.length
              ? ` - this lead has nothing for ${absent.map(({ key }) => placeholderToken(key)).join(', ')}.`
              : '.'}
          </p>
        )}
        {fault && <p className={`${MONO_LABEL} text-[color:var(--warn)]`}>{fault}</p>}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={!ready} className={BUTTON}>
            <Send className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {sending ? 'Sending' : `Send to ${lead.email}`}
          </button>
          <button type="button" className={QUIET} onClick={onClose}>
            Keep the Draft Unsent
          </button>
        </div>
      </form>
    </SidePanel>
  )
}

/**
 * The Settings view: the drafts the composer starts from, and the blanks a
 * draft may carry.
 */
function Drafts({ templates, loading, busy, onEdit, onNew, area }) {
  return (
    <Panel
      title="Drafts"
      area={area}
      loading={loading}
      aside={`${templates.length} kept`}
      note="What the composer offers beside every lead. It fills a blank like {{first_name}} from the lead as you pick the draft."
    >
      <PanelBody>
        <table className="console-table">
          <thead>
            <tr>
              <th className={TH_TIGHT}>Name</th>
              <th className={`${TH_TIGHT} hidden sm:table-cell`}>Subject</th>
              <th className={`${TH_TIGHT} hidden lg:table-cell`}>Last Edited</th>
              <th className={TH_TIGHT}>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows
                cols={['px-3', 'px-3 hidden sm:table-cell', 'px-3 hidden lg:table-cell', 'px-3']}
                rows={4}
              />
            ) : templates.length ? (
              templates.map(draft => (
                <tr key={draft.id} className="align-top">
                  <td className={CELL_TIGHT}>
                    <span className="block truncate font-medium text-ink-paper">{draft.name}</span>
                  </td>
                  <td className={`${CELL_TIGHT} hidden sm:table-cell`}>
                    <span className="block truncate text-[13px] text-paper-soft">
                      {draft.subject}
                    </span>
                  </td>
                  <td className={`${CELL_TIGHT} hidden tabular-nums lg:table-cell`}>
                    {when(draft.updated_at)}
                  </td>
                  <td className={`${CELL_TIGHT} text-right`}>
                    <button
                      type="button"
                      className={QUIET_ROW}
                      disabled={busy}
                      onClick={() => onEdit(draft)}
                    >
                      <Pencil aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={4}>
                No drafts yet. The first one makes the composer worth opening.
              </EmptyRow>
            )}
          </tbody>
        </table>
      </PanelBody>
      <PanelFoot>
        <span>
          The composer offers every draft beside every lead, and only a person can send one.
        </span>
        <button type="button" className={QUIET} onClick={onNew}>
          <Plus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
          New Draft
        </button>
      </PanelFoot>
    </Panel>
  )
}

/** The blanks a draft may carry, said once where the drafts are written. */
function Blanks({ area }) {
  return (
    <Panel title="The Blanks" area={area}>
      <PanelBody>
        <dl className="grid gap-x-8 gap-y-3 px-5 py-4 sm:grid-cols-2">
          {PLACEHOLDERS.map(({ key, label }) => (
            <div key={key}>
              <dt className="font-mono text-[12px] text-accent">{placeholderToken(key)}</dt>
              <dd className="mt-0.5 text-[13px] leading-snug text-paper-soft">{label}</dd>
            </div>
          ))}
        </dl>
      </PanelBody>
      <PanelFoot>
        A blank the lead cannot fill stays standing in the composer, and the send refuses while one
        does. So a draft can lean on a name, and nobody can send it to a lead who has not given one.
      </PanelFoot>
    </Panel>
  )
}

/** The editor one draft opens in, new or held. */
function DraftEditor({ open, draft, busy, onSave, onDelete, onClose }) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [fault, setFault] = useState(null)
  // Deleting asks twice, in place, rather than trusting one press over a
  // draft that took somebody twenty minutes to word.
  const [sure, setSure] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(draft?.name || '')
    setSubject(draft?.subject || '')
    setBody(draft?.body || '')
    setFault(null)
    setSure(false)
  }, [open, draft])

  const save = async event => {
    event.preventDefault()
    setFault(null)
    const answer = await onSave({ id: draft?.id, name, subject, body })
    if (!answer.ok) {
      setFault(faultMessage(answer.error, 'That draft did not save. Try it again.'))
      return
    }
    onClose()
  }

  return (
    <SidePanel
      open={open}
      title={draft ? 'Edit the Draft' : 'A New Draft'}
      aside={draft?.name || ''}
      note="Write it once and the composer offers it beside every lead. It fills blanks like {{first_name}} from whoever it opens on."
      onClose={onClose}
    >
      <form onSubmit={save} className="grid gap-4 px-5 py-4">
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>Name</span>
          <input
            required
            type="text"
            maxLength={TEMPLATE_LIMITS.name}
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="What the composer lists it as"
            className={FIELD}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>Subject</span>
          <input
            required
            type="text"
            maxLength={TEMPLATE_LIMITS.subject}
            value={subject}
            onChange={event => setSubject(event.target.value)}
            className={FIELD}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={`${MONO_LABEL} text-paper-faint`}>Body</span>
          <textarea
            required
            rows={14}
            maxLength={TEMPLATE_LIMITS.body}
            value={body}
            onChange={event => setBody(event.target.value)}
            className={`${FIELD} resize-y leading-relaxed`}
          />
        </label>
        {fault && <p className={`${MONO_LABEL} text-[color:var(--warn)]`}>{fault}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy} className={BUTTON}>
            {busy ? 'Keeping' : 'Keep the Draft'}
          </button>
          {draft &&
            (sure ? (
              <>
                <button
                  type="button"
                  className={`${QUIET} border-[color:var(--warn)] text-[color:var(--warn)]`}
                  disabled={busy}
                  onClick={async () => {
                    const answer = await onDelete(draft.id)
                    if (answer.ok) onClose()
                    else
                      setFault(faultMessage(answer.error, 'That draft is still here. Try again.'))
                  }}
                >
                  Delete for Good
                </button>
                <button type="button" className={QUIET} onClick={() => setSure(false)}>
                  Keep It
                </button>
              </>
            ) : (
              <button type="button" className={QUIET} disabled={busy} onClick={() => setSure(true)}>
                <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                Delete
              </button>
            ))}
        </div>
      </form>
    </SidePanel>
  )
}

/** The section's two views: the desk, and the drafts it writes from. */
const VIEWS = [
  { key: 'leads', label: 'Leads' },
  { key: 'settings', label: 'Settings' },
]

export default function LeadsPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const [view, go, params] = useView(VIEWS)
  const openId = params.get('lead')

  const {
    data,
    error,
    loading,
    saving,
    sending,
    templateBusy,
    mark,
    send,
    saveTemplate,
    removeTemplate,
    messages,
    messagesError,
  } = useLeadsFeed({ token, enabled: Boolean(token), openId })

  const [needle, setNeedle] = useState('')
  const [door, setDoor] = useState('all')
  const [stageKey, setStageKey] = useState('all')
  const [order, setOrder] = useState('newest')
  const [composing, setComposing] = useState(false)
  const [editing, setEditing] = useState(null)

  const leads = useMemo(() => data?.leads || [], [data])
  const totals = useMemo(() => data?.totals || {}, [data])
  const templates = useMemo(() => data?.templates || [], [data])
  const team = useMemo(() => data?.team || [], [data])

  const shown = useMemo(() => {
    const query = needle.trim().toLowerCase()
    const kept = leads
      .filter(lead => (door === 'all' ? true : lead.source === door))
      .filter(lead => {
        if (stageKey === 'all') return true
        if (stageKey === 'waiting') return waiting(lead)
        return stage(lead).label === stageKey
      })
      .filter(lead => matches(lead, query))
    if (order === 'oldest') {
      return [...kept].sort((a, b) => new Date(a.first_seen) - new Date(b.first_seen))
    }
    if (order === 'due') {
      return [...kept].sort((a, b) => {
        const owedA = a.due_at ? new Date(a.due_at).getTime() : Infinity
        const owedB = b.due_at ? new Date(b.due_at).getTime() : Infinity
        return owedA - owedB
      })
    }
    return kept
  }, [leads, door, stageKey, needle, order])

  // Only the doors that have actually produced a lead. A filter offering eight
  // sources where six of them are empty is a filter that mostly answers with
  // nothing and teaches the reader not to touch it.
  //
  // Ordered as the pipeline runs rather than alphabetically, so the options do
  // not move about as doors come and go from the record.
  const doors = useMemo(() => {
    const seen = new Set(leads.map(lead => lead.source))
    return DOOR_NAMES.filter(name => seen.has(name))
  }, [leads])

  const open = useMemo(() => leads.find(lead => lead.id === openId) || null, [leads, openId])

  // The desk opens on whoever is next: the first lead the filters show, so
  // arriving at the section is arriving at work rather than at a blank pane.
  useEffect(() => {
    if (view !== 'leads' || loading) return
    if (openId && leads.some(lead => lead.id === openId)) return
    if (shown.length) go(view, { lead: shown[0].id })
  }, [view, loading, openId, leads, shown, go])

  // The composer belongs to the lead it was opened on.
  useEffect(() => {
    setComposing(false)
  }, [openId])

  /**
   * The doors, as records.
   *
   * Every figure here is a share of the same list, so the promoted one is
   * drawn against the whole rather than left as a bare count: four leads
   * waiting means one thing against forty and another against four hundred.
   */
  const leadFigures = useMemo(() => {
    const all = totals.all ?? 0
    const waiting = totals.waiting ?? 0
    const enquired = totals.enquired ?? 0
    const bought = totals.bought ?? 0
    const dismissed = totals.dismissed ?? 0
    const untouched = Math.max(0, all - waiting - enquired - bought - dismissed)
    const share = (at, note) => ({ kind: 'progress', at, of: all, note })

    return [
      {
        key: 'waiting',
        label: 'Waiting',
        gloss: 'Nobody has answered them, or the date they were promised has passed.',
        value: loading ? '' : String(waiting),
        caption: all ? `of ${all} on the list` : null,
        tone: waiting ? 'warn' : 'plain',
        loading,
        room: all ? share(waiting, `${waiting} of ${all} are waiting on somebody here`) : null,
      },
      {
        key: 'all',
        label: 'Leads',
        gloss: 'Everybody who has ever raised a hand, through any door.',
        value: loading ? '' : String(all),
        caption: bought ? `${bought} became work` : null,
        loading,
        facts: [
          [String(enquired), 'asked for something'],
          [String(bought), 'bought a build'],
          [String(dismissed), 'ruled out'],
        ],
        room: all
          ? {
              kind: 'parts',
              parts: [
                {
                  key: 'waiting',
                  label: 'Waiting',
                  value: waiting,
                  text: String(waiting),
                  tone: 'warn',
                },
                {
                  key: 'enquired',
                  label: 'Enquired',
                  value: enquired,
                  text: String(enquired),
                  tone: 'accent',
                },
                {
                  key: 'bought',
                  label: 'Bought',
                  value: bought,
                  text: String(bought),
                  tone: 'good',
                },
                { key: 'dismissed', label: 'Ruled out', value: dismissed, text: String(dismissed) },
                { label: 'Untouched', value: untouched, text: String(untouched) },
              ].filter(part => part.value > 0),
            }
          : null,
      },
      {
        key: 'enquired',
        label: 'Enquired',
        gloss: 'Asked for something in writing.',
        value: loading ? '' : String(enquired),
        caption: all ? `of ${all} on the list` : null,
        tone: enquired ? 'accent' : 'plain',
        loading,
        room: all ? share(enquired, `${enquired} of ${all} asked for something`) : null,
      },
      {
        key: 'bought',
        label: 'Bought',
        gloss: 'Paid for a build.',
        value: loading ? '' : String(bought),
        caption: all ? `of ${all} on the list` : null,
        tone: bought ? 'good' : 'plain',
        loading,
        room: all ? share(bought, `${bought} of ${all} became work`) : null,
      },
      {
        key: 'dismissed',
        label: 'Ruled Out',
        gloss: 'Looked at and set aside.',
        value: loading ? '' : String(dismissed),
        caption: all ? `of ${all} on the list` : null,
        loading,
        room: all ? share(dismissed, `${dismissed} of ${all} were ruled out`) : null,
      },
    ]
  }, [loading, totals])

  // A refusal with nothing behind it is the whole answer, so it stands in
  // place of the desk rather than above an empty one.
  if (error && !data) return <SectionNotice>{error}</SectionNotice>

  const narrowed = door !== 'all' || stageKey !== 'all' || Boolean(needle.trim())

  return (
    <ConsolePage areas={['stats', 'views', 'work']} rows="auto auto minmax(0,1fr)">
      <Area area="stats">
        <ConsoleError>{error}</ConsoleError>

        <Figures figures={leadFigures} pinned="all" busy={loading} />
      </Area>

      <Area area="views">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ViewNav
            views={[
              { key: 'leads', label: 'Leads', count: totals.waiting, loading },
              { key: 'settings', label: 'Settings', count: templates.length, loading },
            ]}
            current={view}
            onPick={go}
            label="Leads views"
          />
          {view === 'leads' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                className={`${FIELD} w-44 sm:w-56`}
                placeholder="Find a name, address, town"
                value={needle}
                onChange={event => setNeedle(event.target.value)}
                aria-label="Find a lead"
              />
              <select
                className={door === 'all' ? SELECT : SELECT_ON}
                value={door}
                onChange={event => setDoor(event.target.value)}
                aria-label="Which door"
              >
                <option value="all">Every Door</option>
                {doors.map(name => (
                  <option key={name} value={name}>
                    {DOORS[name] || name}
                  </option>
                ))}
              </select>
              <select
                className={stageKey === 'all' ? SELECT : SELECT_ON}
                value={stageKey}
                onChange={event => setStageKey(event.target.value)}
                aria-label="Which stage"
              >
                {STAGE_VIEWS.map(one => (
                  <option key={one.key} value={one.key}>
                    {one.label}
                  </option>
                ))}
              </select>
              <select
                className={SELECT}
                value={order}
                onChange={event => setOrder(event.target.value)}
                aria-label="Reading order"
              >
                {ORDERS.map(one => (
                  <option key={one.key} value={one.key}>
                    {one.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Area>

      {view === 'leads' ? (
        <ConsoleSplit
          area="work"
          list={
            <Panel
              title="Leads"
              loading={loading}
              aside={narrowed ? `${shown.length} of ${leads.length}` : `${leads.length} held`}
            >
              <PanelBody>
                {loading ? (
                  <SkeletonList rows={8} />
                ) : shown.length ? (
                  <ul>
                    {shown.map(lead => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        open={lead.id === openId}
                        onOpen={() => go(view, { lead: lead.id })}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
                    {narrowed ? 'Nobody matches that reading.' : 'Nobody has raised a hand yet.'}
                  </p>
                )}
              </PanelBody>
              {data && !data.complete && (
                <PanelFoot>
                  The newest leads, up to the number one read carries. The figures above are counted
                  over every row rather than over these.
                </PanelFoot>
              )}
            </Panel>
          }
        >
          {open ? (
            <Reading
              lead={open}
              team={team}
              messages={messages}
              messagesError={messagesError}
              saving={saving}
              onMark={mark}
              onCompose={() => setComposing(true)}
            />
          ) : (
            <Panel title="The Lead" loading={loading}>
              <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
                Open a name to read what they said and act on them here.
              </p>
            </Panel>
          )}
        </ConsoleSplit>
      ) : (
        <ConsoleSplit area="work" list={<Blanks />}>
          <Drafts
            templates={templates}
            loading={loading}
            busy={templateBusy}
            onEdit={draft => setEditing({ draft })}
            onNew={() => setEditing({ draft: null })}
          />
        </ConsoleSplit>
      )}

      <Composer
        open={composing && Boolean(open)}
        lead={open}
        templates={templates}
        sending={sending}
        onSend={send}
        onClose={() => setComposing(false)}
      />

      <DraftEditor
        open={Boolean(editing)}
        draft={editing?.draft || null}
        busy={templateBusy}
        onSave={saveTemplate}
        onDelete={removeTemplate}
        onClose={() => setEditing(null)}
      />
    </ConsolePage>
  )
}
