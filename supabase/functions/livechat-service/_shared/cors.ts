// Origin-restricted CORS for the live-chat function. Production origins are
// the canonical site + www; localhost ports are allowed for `vite dev`. Any
// other origin gets a 403 from the caller — we never echo arbitrary origins.

const ALLOWED_ORIGINS = new Set<string>([
  'https://taylorurl.com',
  'https://www.taylorurl.com',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
])

export function resolveOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')
  if (!origin) return null
  return ALLOWED_ORIGINS.has(origin) ? origin : null
}

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? 'https://taylorurl.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function preflightResponse(origin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) })
}
