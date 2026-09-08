import { PhoneOff } from 'lucide-react'
import { callerName, onPhoneNow, saidAgo, saidSince } from '@lib/outreach/prospects/callPresence.js'
import { SkeletonBar } from '../../ui'
import { MONO_LABEL, QUIET } from '../../lib/tokens'

/**
 * One line, always on screen, saying who is working the list and which number
 * each of them is on.
 *
 * It is the answer to the only question a shared queue raises that a ranked
 * list cannot answer for itself. Two callers open the list a minute apart, are
 * handed the same page in the same order, and ring the same business - and
 * neither of them finds out until the person who picks up says so. Nothing in
 * the ranking can help: a call is only suppressed once it has been recorded,
 * and the whole collision happens before either of them records anything.
 *
 * So it says the live thing and nothing else. Not a count of calls today, not
 * a leaderboard - who is here, what they are on, and how long they have been on
 * it. A caller reads it in the second before they press a number, which is why
 * it is one line above the list rather than a card somewhere on the page.
 *
 * The whole strip waits for the read. "Nobody is on a call" drawn while the
 * board is still loading is the one sentence that would make somebody dial.
 */
export default function CallBoard({ presence, you, loading, readAt, onHangUp, hanging }) {
  const now = new Date()
  const calls = onPhoneNow(presence, now)
  const yours = calls.find(row => row.user_id === you) ?? null

  // The card is a column of its own, so the line stands inside it rather than
  // being laid over it: a row direction set on the card itself reads correctly
  // right up until somebody looks at it.
  return (
    <div className="console-card">
      <div className="flex min-h-[42px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <span className="flex flex-shrink-0 items-center gap-2">
          <span className="console-stat-dot" aria-hidden="true" />
          <span className={`${MONO_LABEL} text-ink-paper`}>On The Phone</span>
        </span>

        {loading ? (
          <SkeletonBar className="w-44" />
        ) : calls.length ? (
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {calls.map(row => (
              <li key={row.user_id} className={`${MONO_LABEL} flex items-center gap-1.5`}>
                {/* Whose call it is comes first, because that is what decides
                    whether the reader may ring the name after it. Their own
                    call is named as theirs rather than by their own name, which
                    is what nobody reads about themselves. */}
                <span className="text-accent">{row.user_id === you ? 'You' : callerName(row)}</span>
                <span className="text-paper-faint">on</span>
                <span className="text-ink-paper">{row.business?.name || 'a business'}</span>
                <span className="text-paper-faint">{saidSince(row.on_phone_since, now)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className={`${MONO_LABEL} text-paper-faint`}>Nobody is on a call.</span>
        )}

        <span className="ml-auto flex flex-shrink-0 items-center gap-3">
          {yours && (
            <button type="button" className={QUIET} onClick={onHangUp} disabled={hanging}>
              <PhoneOff aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              Hang Up
            </button>
          )}
          {loading ? (
            <SkeletonBar className="w-24" />
          ) : (
            <span className={`${MONO_LABEL} text-paper-faint`}>
              {presence.length === 1 ? '1 caller here' : `${presence.length} callers here`}
              {readAt ? ` · read ${saidAgo(readAt, now)}` : ''}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
