import { Link } from 'react-router-dom'
import StaffScreen from '../StaffScreen'
import { useStaff } from '../lib/context'

/**
 * Where a representative starts the day.
 *
 * Four destinations and nothing else. It is deliberately the thinnest screen in
 * the portal: somebody opening it is on their way somewhere, and a figure or a
 * standing drawn here is a figure read before there is anything to read it
 * against.
 *
 * The call centre leads because it is where the day is spent, and the main site
 * is one of the four rather than a link in a corner - a representative is asked
 * about the pricing page on the phone and needs it the same way they need the
 * script.
 */
export default function PortalPage() {
  const { name, signOut } = useStaff()

  return (
    <StaffScreen title="Staff Portal">
      <div className="staff-greet">
        <h2>{name ? `Morning, ${name.split(' ')[0]}` : 'Morning'}</h2>
        <p className="staff-mute">Pick up where the list left off.</p>
      </div>

      <div className="staff-tiles">
        <Link className="staff-tile" to="/staff/calls" data-lead="true">
          <b>Call Center</b>
          <p>The next number, the business behind it, and every call placed to it so far.</p>
        </Link>
        <Link className="staff-tile" to="/staff/management">
          <b>Management Center</b>
          <p>Your day against the three figures it is measured by, and who else is on the list.</p>
        </Link>
        <Link className="staff-tile" to="/staff/resources">
          <b>Resources Center</b>
          <p>The script, the questions that come back down the phone, and the answers to them.</p>
        </Link>
        <Link className="staff-tile" to="/">
          <b>Main Site</b>
          <p>The pages an owner is looking at while you talk to them.</p>
        </Link>
      </div>

      <div className="staff-part">
        <button type="button" className="staff-quiet" onClick={signOut}>
          Sign Out
        </button>
      </div>
    </StaffScreen>
  )
}
