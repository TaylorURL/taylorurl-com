import { useEffect, useMemo, useRef, useState } from 'react'
import { faultMessage } from '@utils/faults'
import { useSession } from '@hooks/session/useSession'
import { useToast } from '@hooks/chrome/useToast'
import { useInboxFeed } from '@hooks/console/useInboxFeed'
import { dayIn, formatInstant } from '@lib/time/zone.js'
import { fillTemplate, TEMPLATE_LIMITS, unfilled } from '@lib/leads/templates.js'
import {
  Area,
  ConsoleError,
  ConsolePage,
  ConsoleSplit,
  Panel,
  PanelBody,
  PanelFoot,
  SectionNotice,
  SkeletonList,
  ViewNav,
} from '../../ui'
import { useView } from '../../lib/views'
import { BUTTON, FIELD, MONO_LABEL, QUIET, SELECT } from '../../lib/tokens'

/**
 * The Inbox: everybody who wrote to the studio, newest first, and the
 * conversation with whichever of them is open.
 *
 * Two views. Replies is everybody who wrote back to a letter - a cold email, a
 * new-business email or a preview-site email - and it is the one the Inbox
 * opens on. Enquiries is everybody who came in through the site or the ads.
 * Automated replies are left out by the endpoint, so every row is somebody who
 * wrote, with what they wrote under their name.
 *
 * A lead is handled once the studio has answered it since the last thing they
 * wrote, whether by a reply sent from here, a call, or Mark Handled. Not
 * Interested takes somebody off the list, behind Show Not Interested; a new
 * reply to a letter puts them back on it by itself.
 */

/**
 * The doors, in the words a person uses for them rather than the column's.
 *
 * Every source the spine can hold is named, each spelled as the database
 * spells it, so a door that has fallen quiet still reads as a door when one
 * of its old rows comes back up.
 */
const DOORS = new Map([
  ['outreach-reply', 'Reply to a letter'],
  ['contact', 'Contact form'],
  ['tools', 'Tools enquiry'],
  ['speed-check', 'Speed check'],
  ['ad', 'Paid ad'],
  ['configurator', 'Configurator'],
  ['payment', 'Payment page'],
])

/** A door's name, or its own spelling where it is one this page has never heard of. */
const doorName = source => DOORS.get(source) || source

/** The door every reply to a letter comes through; every other door is an enquiry. */
const REPLY_DOOR = 'outreach-reply'

const VIEWS = [
  { key: 'replies', label: 'Replies' },
  { key: 'enquiries', label: 'Enquiries' },
]

const time = value => (value ? new Date(value).getTime() : 0)

/** Who they are, falling back through what the door managed to collect. */
function who(lead) {
  return lead.business || lead.name || lead.email || lead.phone || 'Unnamed'
}

/** When they last wrote: the reply itself where there is one, or the row's last sighting. */
function heardAt(lead) {
  return lead.said?.at || lead.last_seen || lead.first_seen
}

/** What they said: their latest reply, or what they wrote on the enquiry. */
function words(lead) {
  if (lead.said?.text) return lead.said.text
  const note = typeof lead.note === 'string' ? lead.note.trim() : ''
  return note || null
}

/**
 * Whether the studio has answered them since they last wrote.
 *
 * `contacted_at` is stamped by every answer - a reply sent from here, a call,
 * Mark Handled - and `last_seen` by every time they write. A reply to a letter
 * also arrives with `contacted_at` and `replied_at` stamped together, which
 * says the letter went first; an answer after it has to be newer than both.
 */
function handled(lead) {
  const answered = time(lead.contacted_at)
  if (!answered) return false
  return answered >= time(lead.last_seen) && answered > time(lead.replied_at)
}

/** Where a lead stands, in a word, or nothing while it waits on an answer. */
function standing(lead) {
  if (lead.dismissed_at) return 'Not interested'
  if (lead.unsubscribed_at) return 'Unsubscribed'
  if (handled(lead)) return 'Handled'
  return null
}

/** A day and time, in the studio's own zone. */
function when(value) {
  return formatInstant(value, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** A row's time: the clock today, the date before that. */
function rowWhen(value) {
  if (!value) return ''
  if (dayIn(new Date(value)) === dayIn())
    return formatInstant(value, { hour: 'numeric', minute: '2-digit' })
  return formatInstant(value, { month: 'short', day: 'numeric' })
}

/** The subject a reply starts from: an answer to the last letter in the conversation. */
function replySubject(conversation) {
  const last = [...(conversation || [])].reverse().find(entry => entry.subject)
  if (!last) return ''
  return /^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`
}

/** A website as an address a link can open. */
function siteHref(value) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

/** One person in the list: who, when, and what they said. */
function InboxRow({ lead, open, door, onOpen }) {
  const state = standing(lead)
  const said = words(lead)
  const tags = [door ? doorName(lead.source) : null, state].filter(Boolean)
  return (
    <li>
      <button
        type="button"
        aria-current={open ? 'true' : undefined}
        onClick={onOpen}
        className="grid w-full cursor-pointer gap-1 px-5 py-3 text-left hover:bg-[color:var(--console-row-hover)] aria-[current=true]:bg-[color:var(--console-row-hover)] aria-[current=true]:shadow-[inset_2px_0_0_var(--accent)]"
      >
        <span className="flex min-w-0 items-baseline justify-between gap-3">
          <span
            className={`truncate text-[13px] font-medium ${state ? 'text-paper-soft' : 'text-ink-paper'}`}
          >
            {who(lead)}
          </span>
          <span className="text-paper-faint shrink-0 text-[12px] tabular-nums">
            {rowWhen(heardAt(lead))}
          </span>
        </span>
        {said && (
          <span className="line-clamp-2 whitespace-pre-line text-[13px] leading-snug text-paper-soft [overflow-wrap:anywhere]">
            {said}
          </span>
        )}
        {tags.length > 0 && (
          <span className="text-paper-faint truncate text-[12px]">{tags.join(' · ')}</span>
        )}
      </button>
    </li>
  )
}

/** One message in the conversation, theirs on a filled ground and ours on the card's. */
function Message({ entry, lead }) {
  const theirs = entry.from === 'them'
  const from = theirs ? who(lead) : entry.by || 'TaylorURL'
  // An enquiry's words were written on the row by the door they came through,
  // and a call's were written by the caller, so the door is named beside them.
  const door = entry.kind === 'note' ? doorName(lead.source) : null
  return (
    <article
      className={`grid gap-1 rounded-[var(--console-radius-sm)] px-4 py-3 ${
        theirs ? 'bg-[color:var(--console-row-hover)]' : ''
      }`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 text-[12px]">
        <span className="font-medium text-ink-paper">
          {from}
          {door && <span className="text-paper-faint font-normal"> · {door}</span>}
        </span>
        <span className="text-paper-faint tabular-nums">{when(entry.at)}</span>
      </header>
      {entry.subject && <p className="text-paper-faint text-[12px]">{entry.subject}</p>}
      <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-paper [overflow-wrap:anywhere]">
        {entry.body}
      </p>
    </article>
  )
}

/**
 * The reply box: a saved reply to start from if one helps, the subject and the
 * message, and the one send. It goes through the same one-at-a-time send the
 * endpoint guards - the address, the unsubscribe and the suppression list are
 * all held there - and goes exactly as it reads here.
 */
function ReplyBox({ lead, conversation, templates, sending, onSend }) {
  const [templateId, setTemplateId] = useState('')
  // Null until somebody types or picks a saved reply, so the subject can
  // follow the conversation as it loads without overwriting anything typed.
  const [subject, setSubject] = useState(null)
  const [body, setBody] = useState('')
  const [fault, setFault] = useState(null)
  const toast = useToast()

  if (!lead.email) {
    return (
      <p className="px-4 text-[13px] text-paper-soft">
        There is no address to write to.
        {lead.phone && (
          <>
            {' Call them on '}
            <a className="console-link" href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}>
              {lead.phone}
            </a>
            .
          </>
        )}
      </p>
    )
  }
  if (lead.unsubscribed_at) {
    return (
      <p className="px-4 text-[13px] text-paper-soft">
        They unsubscribed, so nothing goes to them from here.
      </p>
    )
  }

  const shownSubject = subject ?? replySubject(conversation)
  const standingBlanks = unfilled(`${shownSubject}\n${body}`)
  const ready = shownSubject.trim() && body.trim() && !standingBlanks.length && !sending

  const startFrom = id => {
    setTemplateId(id)
    const saved = templates.find(row => row.id === id)
    if (!saved) return
    setSubject(fillTemplate(saved.subject, lead))
    setBody(fillTemplate(saved.body, lead))
  }

  const submit = async event => {
    event.preventDefault()
    setFault(null)
    const answer = await onSend({ id: lead.id, subject: shownSubject, body, templateId })
    if (!answer.ok) {
      setFault(faultMessage(answer.error, 'That did not go. Try again in a moment.'))
      return
    }
    toast(`Sent to ${lead.email}.`, 'success')
    setTemplateId('')
    setSubject(null)
    setBody('')
  }

  return (
    <form onSubmit={submit} className="grid gap-3 px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`${MONO_LABEL} text-paper-faint min-w-0 truncate`}>Reply to {lead.email}</p>
        {templates.length > 0 && (
          <select
            className={SELECT}
            value={templateId}
            onChange={event => startFrom(event.target.value)}
            aria-label="Use a Saved Reply"
          >
            <option value="">Use a Saved Reply</option>
            {templates.map(saved => (
              <option key={saved.id} value={saved.id}>
                {saved.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <input
        type="text"
        required
        maxLength={TEMPLATE_LIMITS.subject}
        value={shownSubject}
        onChange={event => setSubject(event.target.value)}
        placeholder="Subject"
        aria-label="Subject"
        className={FIELD}
      />
      <textarea
        required
        rows={8}
        maxLength={TEMPLATE_LIMITS.body}
        value={body}
        onChange={event => setBody(event.target.value)}
        placeholder="Write your reply"
        aria-label="Message"
        className={`${FIELD} resize-y leading-relaxed`}
      />
      {standingBlanks.length > 0 && (
        <p className={`${MONO_LABEL} text-[color:var(--warn)]`}>
          Still blank: {standingBlanks.join(', ')}. Fill each one in before it goes.
        </p>
      )}
      {fault && <p className={`${MONO_LABEL} text-[color:var(--warn)]`}>{fault}</p>}
      <div>
        <button type="submit" disabled={!ready} className={BUTTON}>
          {sending ? 'Sending' : 'Send Reply'}
        </button>
      </div>
    </form>
  )
}

/** One labelled fact about the business. */
function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className={`${MONO_LABEL} text-paper-faint`}>{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] text-ink-paper">{children}</dd>
    </div>
  )
}

/** The open lead: what they are, the two marks, the conversation and the reply box. */
function Reading({
  lead,
  conversation,
  conversationError,
  templates,
  saving,
  sending,
  onMark,
  onSend,
}) {
  const state = standing(lead)
  const done = handled(lead)
  const busy = saving === lead.id
  const bodyRef = useRef(null)
  const scrolledFor = useRef(null)

  // The newest of the conversation is at the foot, beside the reply box, so a
  // conversation opens there rather than on the first letter of the chain.
  useEffect(() => {
    if (!conversation || scrolledFor.current === lead.id) return
    scrolledFor.current = lead.id
    const scroller = bodyRef.current?.closest('.console-card-body')
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }, [conversation, lead.id])

  return (
    <Panel title={who(lead)} aside={state} className="lg:row-span-full">
      <div className="grid gap-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={QUIET}
            disabled={busy}
            aria-pressed={done}
            onClick={() => onMark(lead.id, { mark: 'contacted', on: !done })}
          >
            {done ? 'Mark Not Handled' : 'Mark Handled'}
          </button>
          <button
            type="button"
            className={QUIET}
            disabled={busy}
            aria-pressed={Boolean(lead.dismissed_at)}
            onClick={() => onMark(lead.id, { mark: 'dismissed', on: !lead.dismissed_at })}
          >
            {lead.dismissed_at ? 'Put Back' : 'Not Interested'}
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {lead.name && lead.business && <Fact label="Contact">{lead.name}</Fact>}
          {lead.phone && (
            <Fact label="Phone">
              <a className="console-link" href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}>
                {lead.phone}
              </a>
            </Fact>
          )}
          {lead.website && (
            <Fact label="Website">
              <a
                className="console-link"
                href={siteHref(lead.website)}
                target="_blank"
                rel="noreferrer"
              >
                {lead.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
              </a>
            </Fact>
          )}
          {lead.town && <Fact label="Town">{lead.town}</Fact>}
        </dl>
      </div>
      <PanelBody>
        <div ref={bodyRef} className="grid gap-3 px-1 pb-5">
          {conversationError ? (
            <p className={`${MONO_LABEL} px-4 text-[color:var(--warn)]`}>{conversationError}</p>
          ) : !conversation ? (
            <SkeletonList rows={3} />
          ) : conversation.length ? (
            conversation.map(entry => <Message key={entry.id} entry={entry} lead={lead} />)
          ) : (
            <p className="px-4 text-[13px] text-paper-soft">Nothing they wrote is on the record.</p>
          )}
          <div className="pt-2">
            <ReplyBox
              key={lead.id}
              lead={lead}
              conversation={conversation}
              templates={templates}
              sending={sending}
              onSend={onSend}
            />
          </div>
        </div>
      </PanelBody>
    </Panel>
  )
}

export default function InboxPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const [view, go, params] = useView(VIEWS)
  const openId = params.get('lead')
  const [showDismissed, setShowDismissed] = useState(false)

  const { data, error, loading, saving, sending, mark, send, conversation, conversationError } =
    useInboxFeed({ token, enabled: Boolean(token), openId })

  const templates = useMemo(() => data?.templates || [], [data])

  // Everybody in this view, newest first.
  const inView = useMemo(
    () =>
      (data?.leads || [])
        .filter(lead => (lead.source === REPLY_DOOR) === (view === 'replies'))
        .sort((a, b) => time(heardAt(b)) - time(heardAt(a))),
    [data, view]
  )

  // Not Interested takes somebody off the list. The open one stays where it
  // is until another is opened, so Put Back is still in reach of a misclick.
  const shown = useMemo(
    () => inView.filter(lead => showDismissed || !lead.dismissed_at || lead.id === openId),
    [inView, showDismissed, openId]
  )
  const hidden = inView.some(lead => lead.dismissed_at)

  const open = useMemo(() => inView.find(lead => lead.id === openId) || null, [inView, openId])

  // The Inbox opens on whoever is at the top, so arriving at it is arriving at
  // the newest conversation rather than at an empty pane.
  useEffect(() => {
    if (loading || open) return
    if (shown.length) go(view, { lead: shown[0].id })
  }, [loading, open, shown, view, go])

  if (error && !data) return <SectionNotice>{error}</SectionNotice>

  const empty =
    view === 'replies' ? 'Nobody has written back yet.' : 'Nobody has sent an enquiry yet.'

  return (
    <ConsolePage areas={['views', 'work']} rows="auto minmax(0,1fr)">
      <Area area="views">
        <ConsoleError>{error}</ConsoleError>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ViewNav
            views={VIEWS}
            current={view}
            onPick={next => go(next, { lead: null })}
            label="Inbox views"
          />
          {hidden && (
            <button
              type="button"
              className={QUIET}
              aria-pressed={showDismissed}
              onClick={() => setShowDismissed(on => !on)}
            >
              {showDismissed ? 'Hide Not Interested' : 'Show Not Interested'}
            </button>
          )}
        </div>
      </Area>

      <ConsoleSplit
        area="work"
        list={
          <Panel title={view === 'replies' ? 'Replies' : 'Enquiries'} loading={loading}>
            <PanelBody>
              {loading ? (
                <SkeletonList rows={6} />
              ) : shown.length ? (
                <ul>
                  {shown.map(lead => (
                    <InboxRow
                      key={lead.id}
                      lead={lead}
                      door={view === 'enquiries'}
                      open={lead.id === openId}
                      onOpen={() => go(view, { lead: lead.id })}
                    />
                  ))}
                </ul>
              ) : (
                <div className="grid justify-items-center gap-3 px-5 py-10 text-center text-[13px] text-paper-soft">
                  <p>{hidden ? 'Everybody here is marked Not Interested.' : empty}</p>
                  {hidden && (
                    <button type="button" className={QUIET} onClick={() => setShowDismissed(true)}>
                      Show Not Interested
                    </button>
                  )}
                </div>
              )}
            </PanelBody>
            {data && !data.complete && (
              <PanelFoot>
                The newest people only. The oldest are past what one read carries.
              </PanelFoot>
            )}
          </Panel>
        }
      >
        {open ? (
          <Reading
            lead={open}
            conversation={conversation}
            conversationError={conversationError}
            templates={templates}
            saving={saving}
            sending={sending}
            onMark={mark}
            onSend={send}
          />
        ) : (
          <Panel title="Conversation" loading={loading}>
            <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
              {loading ? '' : 'Open somebody to read what they said and answer them.'}
            </p>
          </Panel>
        )}
      </ConsoleSplit>
    </ConsolePage>
  )
}
