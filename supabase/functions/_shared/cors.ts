const ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://taylorurl.com",
    "https://www.taylorurl.com",
    "https://smyrnatools.com",
    "https://www.smyrnatools.com",
    "https://baytowngocarts.com",
    "https://www.baytowngocarts.com",
    "https://coreminecraft.com",
    "https://www.coreminecraft.com",
    "https://setxfootball.com",
    "https://www.setxfootball.com",
    "https://kildred.com",
    "https://www.kildred.com",
    "https://charliets.com",
    "https://www.charliets.com",
    "https://scapeclient.com",
    "https://www.scapeclient.com",
]

const DEFAULT_ORIGIN_INDEX = 2

export function getCorsHeaders(origin: string | null): Record<string, string> {
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[DEFAULT_ORIGIN_INDEX],
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    }
}

export function handleOptions(origin: string | null): Response {
    return new Response(null, { status: 204, headers: getCorsHeaders(origin) })
}

export function jsonResponse(data: unknown, headers: Record<string, string>, status = 200): Response {
    return new Response(JSON.stringify(data), { status, headers })
}

export function errorResponse(message: string, headers: Record<string, string>, status = 400): Response {
    return jsonResponse({ error: message }, headers, status)
}
