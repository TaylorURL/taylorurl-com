import { useStatusFeed } from '@hooks/console/useStatusFeed'
import { bareDomain } from '@utils/domains'
import { useConsole } from '../../lib/context'
import { StatusBoard } from '../../../status/StatusBoard'

/**
 * Uptime and issues.
 *
 * This is the console's public section: anyone can read it, signed in or not,
 * and both see the same board. The shell above supplies the heading and the
 * chrome, so this is the board and nothing else.
 *
 * The feed is the monitor's rather than the analytics collector's: a site can
 * answer every check with nobody on it, or be down with yesterday's traffic
 * still in the window, so the two never share a source. What they do share is
 * the scope: a reader looking at one site's figures is asking about that site's
 * uptime too, and the board narrows to it. A signed-out reader holds no scope
 * and gets every site, which is what the public board has always been.
 */
export default function StatusPage() {
  const { scopeName } = useConsole()
  return <StatusBoard feed={useStatusFeed()} scope={scopeName ? bareDomain(scopeName) : null} />
}
