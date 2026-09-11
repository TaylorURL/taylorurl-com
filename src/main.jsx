import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { rememberCampaign } from './app/data/leads/campaign'
import './index.css'
import Providers from './app/Providers'
import App from './app/App'
import { resolveArrival, views } from './app/views'
import { onCaughtError } from './app/utils/caughtErrors'

// Read before the router mounts. The address the browser opened is the only
// one carrying the campaign tags, and the first navigation replaces it.
rememberCampaign(window.location.search)

// Adopted, not rebuilt. Every route is rendered to markup at build time and
// served whole, and a root that renders instead of hydrating discards all of it
// and builds the page a second time in the browser. The visitor saw the served
// page and then waited on the copy.
//
// Hydrating is not by itself enough to keep it. The landed route's view is
// code-split, and a boundary still waiting on its chunk when hydration reaches
// it is torn down and rebuilt exactly the same way - the served page replaced
// by the loading state, then drawn again. So the route's own module is asked
// for first and the root starts with it in hand; everything else stays lazy,
// because every later route is reached from a page already on screen.
// An error a boundary catches is announced by the root, and the announcement is
// what files it. Given here rather than left to React so that a piece with its
// own recovery can report its own failure when that recovery is spent instead
// of the moment it starts: see `app/utils/caughtErrors`.
resolveArrival(window.location.pathname).then(arrival =>
  hydrateRoot(
    document.getElementById('root'),
    <Providers>
      <BrowserRouter>
        <App views={{ ...views, ...arrival }} />
      </BrowserRouter>
    </Providers>,
    { onCaughtError }
  )
)
