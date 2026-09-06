/**
 * Where the project lives and the key that identifies it.
 *
 * Held apart from the client itself so the build can read the same two values
 * without loading the SDK: `vite/site-routes.js` queries the REST endpoint
 * directly to learn which newsletter issues exist, and it runs inside Vite's
 * config process where a bundled client library has no business being.
 *
 * The publishable key is public by design. It names the project and grants
 * nothing on its own; what a request may read comes from row-level security
 * and, where there is one, the session it presents.
 */
export const SUPABASE_URL = 'https://gujgtjqqurildqurpffh.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qn4ZWB2n95HGMJm0L58I0w_ClE_Qu4M'
