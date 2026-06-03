import { userClient } from './supabase.ts'

export interface AuthorizedCaller {
  userId: string
  jwt: string
}

/**
 * Verify the request's Authorization header and confirm the caller is Sunday's admin.
 * Throws if the JWT is invalid, missing, or the user is not the admin.
 */
export async function authorizeAdmin(req: Request): Promise<AuthorizedCaller> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new HttpError('Missing Authorization bearer token', 401)
  const jwt = match[1]

  const supabase = userClient(jwt)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) throw new HttpError('Invalid session', 401)

  const adminId = Deno.env.get('SUNDAY_ADMIN_USER_ID') ?? ''
  if (!adminId) throw new HttpError('Sunday admin user not configured', 500)
  if (data.user.id !== adminId) throw new HttpError('Forbidden', 403)

  return { userId: data.user.id, jwt }
}

export class HttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
