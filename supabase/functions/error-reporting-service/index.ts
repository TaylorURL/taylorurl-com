import { createClient } from "npm:@supabase/supabase-js@2"
import { getCorsHeaders, handleOptions, jsonResponse, errorResponse } from "../_shared/cors.ts"

const MAX_BATCH_SIZE = 50
const MAX_MESSAGE_LENGTH = 2000
const MAX_STACK_LENGTH = 10000
const DEDUP_WINDOW_HOURS = 24

interface ErrorReport {
    project: string
    error_message: string
    stack_trace?: string
    source_file?: string
    line_number?: number
    column_number?: number
    component_stack?: string
    url: string
    user_agent?: string
    browser?: string
    os?: string
}

function getAdminClient() {
    return createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    )
}

function truncate(value: string | undefined | null, maxLength: number): string | null {
    if (!value || typeof value !== "string") return null
    return value.slice(0, maxLength)
}

async function computeErrorHash(project: string, message: string, file: string | null, line: number | null): Promise<string> {
    const raw = `${project}|${message}|${file ?? ""}|${line ?? ""}`
    const encoded = new TextEncoder().encode(raw)
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded)
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("")
}

function validateErrorReport(entry: unknown): ErrorReport | null {
    if (!entry || typeof entry !== "object") return null
    const record = entry as Record<string, unknown>

    const project = typeof record.project === "string" ? record.project.trim() : ""
    const errorMessage = typeof record.error_message === "string" ? record.error_message.trim() : ""
    const url = typeof record.url === "string" ? record.url.trim() : ""

    if (!project || !errorMessage || !url) return null

    return {
        project,
        error_message: truncate(errorMessage, MAX_MESSAGE_LENGTH)!,
        stack_trace: truncate(record.stack_trace as string, MAX_STACK_LENGTH),
        source_file: truncate(record.source_file as string, MAX_MESSAGE_LENGTH),
        line_number: typeof record.line_number === "number" ? record.line_number : null,
        column_number: typeof record.column_number === "number" ? record.column_number : null,
        component_stack: truncate(record.component_stack as string, MAX_STACK_LENGTH),
        url: truncate(url, MAX_MESSAGE_LENGTH)!,
        user_agent: truncate(record.user_agent as string, MAX_MESSAGE_LENGTH),
        browser: truncate(record.browser as string, 100),
        os: truncate(record.os as string, 100),
    } as ErrorReport
}

async function upsertError(supabase: ReturnType<typeof createClient>, report: ErrorReport, errorHash: string) {
    const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

    const { data: existing } = await supabase
        .from("client_errors")
        .select("id, error_count")
        .eq("error_hash", errorHash)
        .eq("fixed", false)
        .gte("created_at", dedupCutoff)
        .limit(1)
        .single()

    if (existing) {
        await supabase
            .from("client_errors")
            .update({ error_count: existing.error_count + 1, updated_at: new Date().toISOString() })
            .eq("id", existing.id)
        return "incremented"
    }

    const { error } = await supabase.from("client_errors").insert({
        ...report,
        error_hash: errorHash,
    })

    if (error) throw error
    return "inserted"
}

Deno.serve(async (req) => {
    const origin = req.headers.get("origin")
    if (req.method === "OPTIONS") return handleOptions(origin)

    const headers = getCorsHeaders(origin)
    const url = new URL(req.url)
    const endpoint = url.pathname.split("/").pop()

    if (req.method !== "POST") {
        return errorResponse("Method not allowed", headers, 405)
    }

    if (endpoint !== "report-batch") {
        return errorResponse("Invalid endpoint", headers, 404)
    }

    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.errors) || body.errors.length === 0) {
        return errorResponse("Request body must contain a non-empty 'errors' array", headers)
    }

    if (body.errors.length > MAX_BATCH_SIZE) {
        return errorResponse(`Batch size exceeds maximum of ${MAX_BATCH_SIZE}`, headers)
    }

    const supabase = getAdminClient()
    let insertedCount = 0
    let incrementedCount = 0
    let invalidCount = 0

    for (const entry of body.errors) {
        const report = validateErrorReport(entry)
        if (!report) {
            invalidCount++
            continue
        }

        try {
            const errorHash = await computeErrorHash(report.project, report.error_message, report.source_file ?? null, report.line_number ?? null)
            const result = await upsertError(supabase, report, errorHash)
            if (result === "inserted") insertedCount++
            else incrementedCount++
        } catch {
            invalidCount++
        }
    }

    return jsonResponse({ inserted: insertedCount, incremented: incrementedCount, invalid: invalidCount }, headers)
})
