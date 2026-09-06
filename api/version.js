import { servedHereOr404 } from '../lib/http/guard.js'
// The commit this deployment was built from, read from the page rather than
// from the host's record of it. Never cached: a cached answer would report a
// build that is no longer being served.
//
// The host value is reached through globalThis because this file runs on the
// server while the rest of the project runs in a browser: a project whose
// linter knows only browser globals rejects the bare name, and one that knows
// both rejects a declaration of it.
export default function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const build = globalThis.process?.env?.VERCEL_GIT_COMMIT_SHA || 'dev'
  response.setHeader('Cache-Control', 'no-store, max-age=0')
  response.status(200).json({ build })
}
