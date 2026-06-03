export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-sunday-conversation',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export function handleOptions(): Response {
  return new Response('ok', { headers: corsHeaders })
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status)
}
