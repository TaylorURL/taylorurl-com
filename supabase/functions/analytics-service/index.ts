import { createClient } from "npm:@supabase/supabase-js@2"
import { getCorsHeaders, handleOptions, jsonResponse, errorResponse } from "../_shared/cors.ts"
import { BEACON_SOURCE } from "./beacon-source.ts"

const DEDUP_WINDOW_SECONDS = 30
const UPTIME_TIMEOUT_MS = 10_000
const ACTIVE_VISITOR_WINDOW_MINUTES = 5

function getAdminClient() {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!serviceRoleKey) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set — refusing to fall back to anon key")
    }
    return createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey)
}

async function computeVisitorHash(ip: string, userAgent: string): Promise<string> {
    const raw = `${ip}|${userAgent}`
    const encoded = new TextEncoder().encode(raw)
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded)
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("")
}

async function resolveVisitorAndWebsite(req: Request, project: string, supabase: ReturnType<typeof getAdminClient>) {
    const { data: website } = await supabase
        .from("websites")
        .select("id")
        .or(`domain.eq.${project},domain.eq.www.${project}`)
        .limit(1)
        .single()

    if (!website) return null

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? req.headers.get("cf-connecting-ip")
        ?? "unknown"
    const userAgent = req.headers.get("user-agent") ?? "unknown"
    const visitorId = await computeVisitorHash(clientIp, userAgent)

    return { websiteId: website.id, visitorId }
}

// ─── /track ──────────────────────────────────────────────────────────────────

async function handleTrack(req: Request, headers: Record<string, string>) {
    const body = await req.json().catch(() => null)
    if (!body?.project || !body?.page_url) {
        return errorResponse("project and page_url are required", headers)
    }

    const supabase = getAdminClient()
    const resolved = await resolveVisitorAndWebsite(req, body.project, supabase)
    if (!resolved) return errorResponse("Unknown project", headers, 404)

    const { websiteId, visitorId } = resolved

    // Deduplicate: same visitor + same page within dedup window
    const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_SECONDS * 1000).toISOString()
    const { data: existing } = await supabase
        .from("page_views")
        .select("id")
        .eq("website_id", websiteId)
        .eq("visitor_id", visitorId)
        .eq("page_url", body.page_url)
        .gte("created_at", dedupCutoff)
        .limit(1)

    if (!existing?.length) {
        await supabase.from("page_views").insert({
            website_id: websiteId,
            visitor_id: visitorId,
            page_url: body.page_url,
            referrer: body.referrer || null,
            country: req.headers.get("cf-ipcountry") ?? null,
        })
    }

    // Always upsert active presence on page view
    await supabase.from("active_visitors").upsert(
        { website_id: websiteId, visitor_id: visitorId, last_seen: new Date().toISOString() },
        { onConflict: "website_id,visitor_id" },
    )

    return new Response(null, { status: 204, headers })
}

// ─── /heartbeat ──────────────────────────────────────────────────────────────

async function handleHeartbeat(req: Request, headers: Record<string, string>) {
    const body = await req.json().catch(() => null)
    if (!body?.project) return errorResponse("project is required", headers)

    const supabase = getAdminClient()
    const resolved = await resolveVisitorAndWebsite(req, body.project, supabase)
    if (!resolved) return new Response(null, { status: 204, headers })

    const { websiteId, visitorId } = resolved

    await supabase.from("active_visitors").upsert(
        { website_id: websiteId, visitor_id: visitorId, last_seen: new Date().toISOString() },
        { onConflict: "website_id,visitor_id" },
    )

    return new Response(null, { status: 204, headers })
}

// ─── /check-uptime ───────────────────────────────────────────────────────────

async function handleCheckUptime(headers: Record<string, string>) {
    const supabase = getAdminClient()

    const { data: websites } = await supabase
        .from("websites")
        .select("id, domain, status")
        .in("status", ["active", "maintenance"])

    if (!websites?.length) {
        return jsonResponse({ checked: 0, up: 0, down: 0 }, headers)
    }

    let upCount = 0
    let downCount = 0

    for (const site of websites) {
        const startTime = Date.now()
        let statusCode = 0
        let isUp = false

        try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), UPTIME_TIMEOUT_MS)

            // Use GET — some hosts (e.g. Vercel) return 405 for HEAD
            const response = await fetch(`https://${site.domain}`, {
                method: "GET",
                signal: controller.signal,
                redirect: "follow",
            })

            clearTimeout(timeout)
            statusCode = response.status
            isUp = statusCode >= 200 && statusCode < 400
        } catch {
            statusCode = 0
            isUp = false
        }

        await supabase.from("uptime_checks").insert({
            website_id: site.id,
            status_code: statusCode,
            response_time_ms: Date.now() - startTime,
            is_up: isUp,
        })

        if (isUp) upCount++
        else downCount++
    }

    return jsonResponse({ checked: websites.length, up: upCount, down: downCount }, headers)
}

// ─── /aggregate-stats ────────────────────────────────────────────────────────

async function handleAggregateStats(headers: Record<string, string>) {
    const supabase = getAdminClient()

    const { data: websites } = await supabase.from("websites").select("id, status")
    if (!websites?.length) return jsonResponse({ aggregated: 0 }, headers)

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const activeWindowCutoff = new Date(Date.now() - ACTIVE_VISITOR_WINDOW_MINUTES * 60 * 1000).toISOString()
    let aggregatedCount = 0

    for (const site of websites) {
        // Unique visitors (30d)
        const { data: visitorRows } = await supabase
            .from("page_views")
            .select("visitor_id")
            .eq("website_id", site.id)
            .gte("created_at", thirtyDaysAgo)

        const uniqueVisitors30d = new Set(visitorRows?.map(r => r.visitor_id) ?? []).size

        // Total all-time page views
        const { count: totalPageViews } = await supabase
            .from("page_views")
            .select("id", { count: "exact", head: true })
            .eq("website_id", site.id)

        // Uptime percentage (30d) — only calculated for active sites
        const { data: uptimeRows } = await supabase
            .from("uptime_checks")
            .select("is_up")
            .eq("website_id", site.id)
            .gte("created_at", thirtyDaysAgo)

        let uptimePct: number | null = null
        if (site.status === "active" && uptimeRows?.length) {
            const upChecks = uptimeRows.filter(r => r.is_up).length
            uptimePct = parseFloat(((upChecks / uptimeRows.length) * 100).toFixed(1))
        }

        const { data: latestCheck } = await supabase
            .from("uptime_checks")
            .select("is_up")
            .eq("website_id", site.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

        const isUpNow = latestCheck?.is_up ?? null

        // Active visitors right now (last 5 min)
        const { count: visitorsNow } = await supabase
            .from("active_visitors")
            .select("visitor_id", { count: "exact", head: true })
            .eq("website_id", site.id)
            .gte("last_seen", activeWindowCutoff)

        const { data: existingStat } = await supabase
            .from("website_stats")
            .select("id")
            .eq("website_id", site.id)
            .limit(1)
            .single()

        const statsPayload = {
            website_id: site.id,
            visitors_30d: uniqueVisitors30d,
            page_views_30d: totalPageViews ?? 0,
            uptime_pct: uptimePct,
            visitors_now: visitorsNow ?? 0,
            is_up_now: isUpNow,
            updated_at: new Date().toISOString(),
        }

        if (existingStat) {
            await supabase.from("website_stats").update(statsPayload).eq("id", existingStat.id)
        } else {
            await supabase.from("website_stats").insert(statsPayload)
        }

        aggregatedCount++
    }

    return jsonResponse({ aggregated: aggregatedCount }, headers)
}

// ─── /live-visitors ──────────────────────────────────────────────────────────

/**
 * Returns a real-time count of active visitors per website by querying
 * `active_visitors` directly. Bypasses the hourly `website_stats` snapshot
 * so the dashboard's "Online Now" reflects the live 5-minute window.
 */
async function handleLiveVisitors(headers: Record<string, string>) {
    const supabase = getAdminClient()
    const cutoff = new Date(Date.now() - ACTIVE_VISITOR_WINDOW_MINUTES * 60 * 1000).toISOString()

    const { data, error } = await supabase
        .from("active_visitors")
        .select("website_id")
        .gte("last_seen", cutoff)

    if (error) return errorResponse(error.message, headers, 500)

    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
        counts[row.website_id as string] = (counts[row.website_id as string] ?? 0) + 1
    }

    return jsonResponse({ counts }, headers)
}

// ─── Router ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    const origin = req.headers.get("origin")
    if (req.method === "OPTIONS") return handleOptions(origin)

    const headers = getCorsHeaders(origin)
    const url = new URL(req.url)
    const endpoint = url.pathname.split("/").pop()

    // Serve the full-SDK beacon script via GET — no auth required.
    // Bot/crawler traffic can hit this too; caching softens repeat hits.
    if (req.method === "GET" && endpoint === "beacon.js") {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
        const functionUrl = `${supabaseUrl}/functions/v1`
        const apiKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""

        // replaceAll, not replace — placeholders also appear in comments, and a
        // single .replace() would only swap the first occurrence (leaving the
        // actual `var BASE_URL = '__BASE_URL__'` declaration broken).
        const beaconScript = BEACON_SOURCE
            .replaceAll("__BASE_URL__", functionUrl)
            .replaceAll("__API_KEY__", apiKey)

        return new Response(beaconScript, {
            headers: {
                "Content-Type": "application/javascript",
                "Cache-Control": "public, max-age=300",
                "Access-Control-Allow-Origin": "*",
            },
        })
    }

    if (req.method !== "POST") return errorResponse("Method not allowed", headers, 405)

    switch (endpoint) {
        case "track":           return handleTrack(req, headers)
        case "heartbeat":       return handleHeartbeat(req, headers)
        case "check-uptime":    return handleCheckUptime(headers)
        case "aggregate-stats": return handleAggregateStats(headers)
        case "live-visitors":   return handleLiveVisitors(headers)
        default:                return errorResponse("Invalid endpoint", headers, 404)
    }
})
