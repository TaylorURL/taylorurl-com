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
 * The call center leads because it is where the day is spent, and the main site
 * is one of the four rather than a link in a corner - a representative is asked
 * about the pricing page on the phone and needs it the same way they need the
 * script.
 */
export default function PortalPage() {
  const { name, signOut } = useStaff()

  return (
    <StaffScreen title="Staff Portal" layout="portal">
      <div className="staff-split">
        <div className="staff-greet">
          <h2>{name ? name.split(' ')[0] : 'Staff'}</h2>
        </div>

        <div className="staff-tiles">
          <Link className="staff-tile" to="/staff/calls" data-lead="true">
            <b>Call Center</b>
            <p>Next lead, call history, and logging.</p>
          </Link>
          <Link className="staff-tile" to="/staff/management">
            <b>Management Center</b>
            <p>Today's numbers and the team.</p>
          </Link>
          <Link className="staff-tile" to="/staff/resources">
            <b>Resources Center</b>
            <p>Script, objections, and pricing.</p>
          </Link>
          <Link className="staff-tile" to="/">
            <b>Main Site</b>
            <p>The public site.</p>
          </Link>
        </div>

        <div className="staff-part staff-split-foot">
          <button type="button" className="staff-quiet" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </div>
    </StaffScreen>
  )
}
