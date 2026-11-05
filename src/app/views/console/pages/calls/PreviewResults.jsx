import { useState } from 'react'
import { usePreviewFunnel } from '@hooks/console/usePreviewFunnel'
import { buildsWords, doneWords, overallWords, percent, weeksWords } from '@lib/outreach/funnel.js'
import { EmptyRow, SidePanel, SkeletonBar, SkeletonRows } from '../../ui'
import { CELL_END, CELL_TIGHT, MONO_LABEL, QUIET, TH_END, TH_TIGHT } from '../../lib/tokens'

/**
 * How the preview sites are doing, on the Call List: whether the businesses
 * sent one open it, come to look at their site, and write back.
 *
 * Three lines beside the day's calls say it in words - the whole of it, this
 * week against last, and the new layouts against the old - and See Preview
 * Results opens the panel with the figures by layout and by the week each
 * preview was sent, and what the people who looked did there.
 *
 * The counts are the funnel's (lib/outreach/funnel.js), read the way the list
 * beside it reads a business: an open in the first ten minutes and a visit in
 * the first two after a letter are machines, and an auto-responder is not a
 * reply.
 */

/** The columns each table draws, so the placeholder rows match the real ones. */
const COLS = ['px-3', 'pl-1 pr-3', 'pl-1 pr-3', 'pl-1 pr-3', 'pl-1 pr-3']

/** A group's visitors, with what share of the openers they were. */
function looked(group) {
  if (!group.visited) return String(group.visited)
  return `${group.visited} (${percent(group.visitedPerOpened)})`
}

/** One table of groups: a row of figures each, and what the visitors did under it. */
function Groups({ head, first, groups, loading, empty }) {
  return (
    <section className="grid gap-2">
      <h3 className={`${MONO_LABEL} text-paper-faint px-5`}>{head}</h3>
      <table className="console-table">
        <thead>
          <tr>
            <th className={`${TH_TIGHT} w-[38%]`}>{first}</th>
            <th className={TH_END}>Sent</th>
            <th className={TH_END}>Opened</th>
            <th className={TH_END}>Looked</th>
            <th className={TH_END}>Replied</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={COLS} rows={4} />
          ) : groups.length ? (
            groups.map(group => <GroupRows key={group.key} group={group} />)
          ) : (
            <EmptyRow cols={COLS}>{empty}</EmptyRow>
          )}
        </tbody>
      </table>
    </section>
  )
}

function GroupRows({ group }) {
  const done = doneWords(group)
  return (
    <>
      <tr className="border-hair-paper border-t align-top">
        <td className={CELL_TIGHT}>
          <span className="block truncate">{group.label}</span>
        </td>
        <td className={`${CELL_END} tabular-nums`}>{group.sent}</td>
        <td className={`${CELL_END} tabular-nums`}>{group.sent ? group.opened : '–'}</td>
        <td className={`${CELL_END} tabular-nums`}>{group.sent ? looked(group) : '–'}</td>
        <td className={`${CELL_END} tabular-nums`}>{group.sent ? group.replied : '–'}</td>
      </tr>
      {done && (
        <tr className="align-top">
          <td colSpan={COLS.length} className="px-3 pb-3 text-[12px] text-paper-soft">
            {done}
          </td>
        </tr>
      )}
    </>
  )
}

/** The words under the tables: what each column counts, and what it leaves out. */
function HowCounted({ data }) {
  const all = data?.overall
  return (
    <div className="grid gap-2 px-5 pb-5 text-[12px] leading-relaxed text-paper-soft">
      <p>
        Opened is a person opening any of the emails about the site. An open in the first ten
        minutes after an email goes is a mail scanner loading the pictures, so it is left out
        {all ? `; counting those, ${all.openedAny} were opened` : ''}.
      </p>
      <p>
        Looked is a person on the preview site. A visit in the first two minutes after an email is a
        link checker and is left out. The share beside it is out of the businesses that opened.
      </p>
      <p>
        Replied is a person writing back. Auto-replies and bounces are left out
        {all?.stopped
          ? `, and ${all.stopped} ${all.stopped === 1 ? 'reply that asked' : 'replies that asked'} to stop ${all.stopped === 1 ? 'is' : 'are'} not counted as interest`
          : ''}
        .
      </p>
      {data && !data.complete && <p>Not every row was read, so these are short of the whole.</p>}
    </div>
  )
}

/** The lines beside the day's calls, and the panel they open. */
export function PreviewResults({ token }) {
  const { data, error, loading } = usePreviewFunnel({ token })
  const [open, setOpen] = useState(false)

  return (
    <div className="grid min-w-0 max-w-[40rem] gap-1.5">
      {error && !data ? (
        <p className="text-[13px] text-paper-soft">{error}</p>
      ) : (
        <>
          <p className="text-[14px] font-medium text-ink-paper">
            {loading ? <SkeletonBar className="w-80" /> : overallWords(data)}
          </p>
          <p className="text-[13px] text-paper-soft">
            {loading ? <SkeletonBar className="w-64" /> : weeksWords(data)}
          </p>
          <p className="text-[13px] text-paper-soft">
            {loading ? <SkeletonBar className="w-56" /> : buildsWords(data)}
          </p>
          <button
            type="button"
            className={`${QUIET} justify-self-start`}
            disabled={loading}
            onClick={() => setOpen(true)}
          >
            See Preview Results
          </button>
        </>
      )}

      <SidePanel
        open={open}
        title="Preview Sites"
        aside={data ? `${data.overall.sent} sent` : null}
        note="Whether the businesses sent a preview open the email, come to look at the site, and write back."
        loading={loading}
        onClose={() => setOpen(false)}
      >
        <div className="grid gap-6 py-4">
          <div className="grid gap-1.5 px-5 text-[13px] text-ink-paper">
            <p>{loading ? <SkeletonBar className="w-64" /> : overallWords(data)}</p>
            <p className="text-paper-soft">{loading ? <SkeletonBar /> : weeksWords(data)}</p>
            <p className="text-paper-soft">{loading ? <SkeletonBar /> : buildsWords(data)}</p>
          </div>
          <Groups
            head="By Layout"
            first="Layout"
            groups={data?.families ?? []}
            loading={loading}
            empty="No preview site has been sent yet."
          />
          <Groups
            head="By Week Sent"
            first="Week"
            groups={data?.weeks ?? []}
            loading={loading}
            empty="No preview site has been sent yet."
          />
          <Groups
            head="Old and New Layouts"
            first="Built On"
            groups={data?.builds ?? []}
            loading={loading}
            empty="No preview site has been sent yet."
          />
          <HowCounted data={data} />
        </div>
      </SidePanel>
    </div>
  )
}
