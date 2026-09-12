import { Link } from 'react-router-dom'
import { useStaff } from '../lib/context'
import { surfacesIn, usePortalNav } from '../lib/nav'

/**
 * Where a representative starts the day.
 *
 * The doors and nothing else. It is deliberately the thinnest screen in the
 * portal: somebody opening it is on their way somewhere, and a figure or a
 * standing drawn here is a figure read before there is anything to read it
 * against.
 *
 * The call center leads because it is where the day is spent, and the main site
 * is one of the doors rather than a link in a corner - a representative is asked
 * about the pricing page on the phone and needs it the same way they need the
 * script.
 *
 * Which doors there are is the portal's own answer rather than this screen's,
 * because the standalone portal and the console's carry different sets and a
 * list written here would be right in one of them.
 *
 * @param {{Shell: React.ComponentType}} props
 */
export default function PortalDoors({ Shell }) {
  const { name, signOut } = useStaff()
  const nav = usePortalNav()
  const doors = surfacesIn(nav.surfaces).filter(one => one.key !== 'portal')

  return (
    <Shell title="Staff Portal" layout="portal">
      <div className="staff-split">
        <div className="staff-greet">
          <h2>{name ? name.split(' ')[0] : 'Staff'}</h2>
        </div>

        <div className="staff-tiles">
          {doors.map((door, at) => (
            <Link
              className="staff-tile"
              key={door.key}
              to={nav.hrefFor(door.key)}
              data-lead={at === 0}
            >
              <b>{door.title}</b>
              <p>{door.lede}</p>
            </Link>
          ))}
          <Link className="staff-tile" to="/">
            <b>Main Site</b>
            <p>The public site.</p>
          </Link>
        </div>

        {signOut && (
          <div className="staff-part staff-split-foot">
            <button type="button" className="staff-quiet" onClick={signOut}>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </Shell>
  )
}
