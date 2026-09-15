import { Fragment, useEffect, useRef } from 'react'
import { Lock } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { GROUPS, sectionHref } from '../lib/sections'

/**
 * The sections in a row, for the widths at which the column is a drawer.
 *
 * A drawer is a trip: open it, find the row, press it, watch it close. Moving
 * between two sections is the most common thing a reader does in the console,
 * so on a phone the same catalogue the column reads stands in a row under the
 * bar, scrolled sideways, with the open one kept in view. The drawer is left
 * holding the account, the sites and the full list, which are changed once a
 * visit rather than once a minute.
 *
 * It is the column's own menu, group for group, rather than a shorter one: a
 * section that is in the drawer and not here would be a section a phone can
 * reach one way and not the other, and the rule that a locked section stays in
 * the menu holds here too. The groups are marked by a rule between them rather
 * than a heading, since a heading in a row that scrolls is a word the reader
 * passes rather than one they file rows under.
 *
 * Above the desk width the column is on screen and this is not drawn at all,
 * so a section is never listed twice in one view.
 */
export function ConsoleStrip({ sections }) {
  const holder = useRef(null)

  // The open section scrolls into view on arrival, so a reader landing on
  // Visitors is not shown a row that begins at Status and has to be dragged.
  // Once only, and only sideways: scrolling the row on every render would fight
  // a thumb that is already moving it.
  useEffect(() => {
    const open = holder.current?.querySelector('[aria-current="page"]')
    open?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [sections])

  const groups = GROUPS.map(group => sections.filter(section => section.group === group)).filter(
    rows => rows.length
  )
  if (!groups.length) return null

  return (
    <nav className="console-strip" aria-label="Console sections" ref={holder}>
      {groups.map((rows, at) => (
        <Fragment key={rows[0].group}>
          {at > 0 && <span className="console-strip-rule" aria-hidden="true" />}
          {rows.map(section => (
            <NavLink
              key={section.id}
              to={section.locked ? '/login' : sectionHref(section)}
              state={section.locked ? { from: sectionHref(section) } : undefined}
              end={!section.path}
              data-locked={section.locked ? 'true' : undefined}
              title={section.description}
            >
              {section.label}
              {section.locked && <Lock aria-hidden="true" strokeWidth={2} />}
              {section.locked && <span className="sr-only">needs an account</span>}
            </NavLink>
          ))}
        </Fragment>
      ))}
    </nav>
  )
}
