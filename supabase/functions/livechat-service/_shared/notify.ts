// Lead-notification email via Resend. No-op (logs a warning) when env vars
// aren't set so leads still get persisted in a half-configured environment.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const LEAD_NOTIFY_EMAIL = Deno.env.get('LEAD_NOTIFY_EMAIL') ?? ''
const LEAD_NOTIFY_FROM = Deno.env.get('LEAD_NOTIFY_FROM') ?? 'TaylorURL Chat <chat@taylorurl.com>'

export type LeadNotification = {
  name: string
  email: string
  project: string
  pageUrl: string | null
  transcript: Array<{ role: 'user' | 'assistant'; content: string }>
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function transcriptToHtml(transcript: LeadNotification['transcript']): string {
  if (transcript.length === 0) return '<p><em>(no prior messages)</em></p>'
  return transcript
    .map((message) => {
      const speaker = message.role === 'user' ? 'Visitor' : 'Assistant'
      const colour = message.role === 'user' ? '#0a0a0a' : '#2f6bff'
      return `<p style="margin:0 0 12px"><strong style="color:${colour}">${speaker}:</strong> ${escapeHtml(
        message.content,
      )}</p>`
    })
    .join('')
}

function transcriptToText(transcript: LeadNotification['transcript']): string {
  return transcript
    .map((m) => `${m.role === 'user' ? 'Visitor' : 'Assistant'}: ${m.content}`)
    .join('\n\n')
}

/**
 * Send the lead notification. Returns true on a 2xx response, false otherwise.
 * Never throws — caller treats failure as "lead saved but email not sent" and
 * moves on.
 */
export async function sendLeadNotification(lead: LeadNotification): Promise<boolean> {
  if (!RESEND_API_KEY || !LEAD_NOTIFY_EMAIL) {
    console.warn(
      '[livechat-service] RESEND_API_KEY or LEAD_NOTIFY_EMAIL not set — lead saved without email notification.',
    )
    return false
  }

  const subject = `New live-chat lead — ${lead.name || lead.email}`
  const pageLine = lead.pageUrl ? `Came from: ${lead.pageUrl}` : 'Came from: (unknown page)'

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Geist,sans-serif;color:#0a0a0a;max-width:560px">
      <h2 style="margin:0 0 4px;font-size:18px">New live-chat lead</h2>
      <p style="margin:0 0 18px;color:#666;font-size:13px">${escapeHtml(pageLine)}</p>
      <table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">
        <tbody>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td>${escapeHtml(lead.name)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">Project</td><td>${escapeHtml(lead.project)}</td></tr>
        </tbody>
      </table>
      <h3 style="font-size:14px;margin:24px 0 8px;color:#666;text-transform:uppercase;letter-spacing:0.12em">Transcript</h3>
      <div style="border-left:2px solid #eee;padding:8px 0 8px 16px;font-size:14px;line-height:1.5">
        ${transcriptToHtml(lead.transcript)}
      </div>
    </div>
  `

  const text = [
    'New live-chat lead',
    pageLine,
    '',
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Project: ${lead.project}`,
    '',
    '— Transcript —',
    transcriptToText(lead.transcript),
  ].join('\n')

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: LEAD_NOTIFY_FROM,
        to: [LEAD_NOTIFY_EMAIL],
        reply_to: lead.email,
        subject,
        html,
        text,
      }),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.warn(`[livechat-service] Resend returned ${response.status}: ${body}`)
      return false
    }
    return true
  } catch (error) {
    console.warn('[livechat-service] Resend request failed', error)
    return false
  }
}
