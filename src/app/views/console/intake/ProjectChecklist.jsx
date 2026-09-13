import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { EASE } from '@constants/animations'
import { clientAsks } from '../lib/stages'

/**
 * What the client still owes, docked in the corner of every screen.
 *
 * It sits over the work rather than inside a section because it is the one
 * thing on the console that is true wherever they are: a build waits on a logo
 * whether they are reading the tracker or their traffic, and a list that only
 * exists on one page is a list nobody is reminded by.
 *
 * It shows what is outstanding now, not the whole plan. An item belonging to a
 * stage further on is not late and putting it here would make a five-week
 * build look like a homework pile on day one; the tracker is where the whole
 * shape lives. So this holds every unfinished item up to and including the
 * stage the work has reached, oldest stage first.
 *
 * Ticking one is a claim rather than a confirmation. Nothing here can close a
 * stage on its own - that stays with the person doing the work, who can see
 * whether what arrived is usable.
 *
 * Only an item that is genuinely a claim gets a tick. An item wanting a logo
 * or a paragraph is answered on the tracker, where there is room for a file
 * picker and a text box, so here it states where it stands and links across.
 * A checkbox against "Your logo" would let somebody mark it done without ever
 * sending one, which is exactly the gap this list was drawn to close.
 */
export default function ProjectChecklist({ project, onTick, acting }) {
  const [open, setOpen] = useState(true)

  const mine = clientAsks(project)
  const outstanding = mine.filter(task => !task.done_at)

  // Nothing to ask for is nothing to draw. A finished list that keeps its
  // corner is a permanent reminder of work already done.
  const empty = !project || !mine.length || !outstanding.length

  // A newly emptied list closes itself, so the last tick is acknowledged on
  // screen rather than by the panel vanishing under the pointer.
  useEffect(() => {
    if (empty) setOpen(false)
  }, [empty])

  if (empty) return null

  return (
    <aside className="console-dock" aria-label="What we are waiting on">
      {/* The dock stands outside the console frame, so the frame's own hover
          and focus ring do not reach it and it states both here. */}
      <button
        type="button"
        className="console-dock-tab min-h-[44px] cursor-pointer touch-manipulation transition-colors duration-150 hover:bg-[color:var(--console-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent active:bg-[color:var(--paper-hairline)]"
        aria-expanded={open}
        onClick={() => setOpen(now => !now)}
      >
        <span className="console-dock-count">{outstanding.length}</span>
        <span className="console-dock-title">Waiting on You</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" data-open={open} />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <m.ul
            className="console-dock-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {mine.map(task => (
              <li
                key={task.task_id}
                className="console-dock-item"
                data-done={Boolean(task.done_at)}
              >
                {(task.kind || 'tick') === 'tick' ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(task.done_at)}
                      disabled={acting === task.task_id}
                      onChange={event => onTick(task.task_id, event.target.checked)}
                    />
                    <span className="console-dock-label">{task.label}</span>
                  </label>
                ) : (
                  <Link className="console-dock-ask" to="/console/project">
                    <span className="console-dock-label">{task.label}</span>
                    <span className="console-dock-go">
                      {task.done_at ? 'Sent' : task.kind === 'files' ? 'Send' : 'Write'}
                    </span>
                  </Link>
                )}
                {task.detail ? <p className="console-dock-detail">{task.detail}</p> : null}
              </li>
            ))}
          </m.ul>
        ) : null}
      </AnimatePresence>
    </aside>
  )
}
