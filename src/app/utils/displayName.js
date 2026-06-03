/**
 * Derive a human display name from a Supabase auth user, in priority order:
 *   1. user_metadata.full_name (set during sign-up if provided)
 *   2. user_metadata.name
 *   3. localpart of the email, title-cased ("trentbtaylor" → "Trentbtaylor")
 *   4. "Sunday user" as a last-resort fallback so we never write null
 */
export function getDisplayName(user) {
  if (!user) return 'Sunday user'
  const fromMetadata = user.user_metadata?.full_name?.trim() || user.user_metadata?.name?.trim()
  if (fromMetadata) return fromMetadata
  const email = user.email ?? ''
  const local = email.split('@')[0]
  if (local) return titleCase(local)
  return 'Sunday user'
}

function titleCase(input) {
  return input
    .split(/[-_.]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
