/**
 * The texts that carry a preview to a business the studio can only text.
 *
 * Three of them, from one person to one business, with the days counted from
 * the first the way the preview-first letters count theirs: the preview itself
 * with a picture of it, a short nudge four days later, and on day 18 the last
 * one, which says when the draft comes down. A reply, a STOP or a number that
 * cannot take a text ends the three wherever they had got to.
 *
 * The words name only what is true of every preview: the business's name, the
 * draft's address and when it comes down. A text has no room for the facts a
 * letter is built on, and a fact that turned out wrong is worse in a text,
 * which the owner reads standing up.
 *
 * Every text is filed in `outreach_texts` before it reaches Twilio, so a crash
 * between the two leaves a draft rather than a second copy.
 */

import { formatInstant } from '../time/zone.js'
import { PREVIEW_LIFETIME_DAYS, previewUrl } from './previews.js'
import { refusesNumber, sendText } from './sending/texts.js'

/** Days after the first text that each follow-up is owed. */
export const PREVIEW_TEXT_DAYS = [4, 18]

/** How long after the first text an unclaimed draft comes down. */
export const PREVIEW_TEXT_LIFETIME_DAYS = PREVIEW_LIFETIME_DAYS

/**
 * One text's words and picture.
 *
 * @param {object} site Row from `preview_sites`: slug, name, shot_url, expires_at.
 * @param {number} step 0 for the preview, 1 and 2 for the follow-ups.
 * @returns {{body: string, mediaUrl: string|null}}
 */
export function previewText(site, step) {
  const url = previewUrl(site.slug)
  const name = site.name
  if (step === 0) {
    return {
      body:
        `Hi, this is Trenton Taylor with TaylorURL in Baytown. I built ${name} a new website. ` +
        `You can see it here: ${url}\n\n` +
        "If you like it, I'll put it live for you. What would you change?\n\n" +
        'Reply STOP to opt out.',
      mediaUrl: site.shot_url || null,
    }
  }
  if (step === 1) {
    return {
      body: `Trenton again from TaylorURL. The draft site for ${name} is still up if you want to look at it on your phone: ${url}`,
      mediaUrl: null,
    }
  }
  const down = formatInstant(site.expires_at, { weekday: 'long' }, '')
  return {
    body:
      `Trenton at TaylorURL. Last text from me about the ${name} draft. ` +
      (down ? `I'm taking it down ${down}. ` : '') +
      `Reply "keep it" and I'll leave it up while we talk.`,
    mediaUrl: null,
  }
}

/**
 * Closes a number to every text the line would send it, for a reason.
 *
 * @param {object} db A service-role client.
 * @param {string} phone
 * @param {'stop'|'replied'|'undeliverable'|'finished'|'manual'} reason
 * @param {string} note
 */
export async function closeNumber(db, phone, reason, note) {
  const { error } = await db.from('text_suppression').upsert(
    { phone, reason, note: String(note).slice(0, 300) },
    // A STOP outranks whatever closed the number before it, since it is the
    // one reason a START can take back.
    { onConflict: 'phone', ignoreDuplicates: reason !== 'stop' }
  )
  if (error) throw new Error(error.message)
}

/**
 * Why this number is not to be texted, or null when it may be.
 *
 * @param {object} db A service-role client.
 * @param {string} phone
 * @returns {Promise<string|null>}
 */
export async function textBarred(db, phone) {
  const { data, error } = await db
    .from('text_suppression')
    .select('reason')
    .eq('phone', phone)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? `the number is closed: ${data.reason}` : null
}

/**
 * Files, sends and records one preview text.
 *
 * A refusal about the number - a landline, a number that does not exist, one
 * that has texted STOP - closes the number and is answered rather than thrown,
 * since it says nothing about the next business. Anything else is thrown, and
 * the caller stops its run there.
 *
 * @param {object} db A service-role client.
 * @param {{site: object, prospect: object, phone: string, step: number, service: string}} text
 * @returns {Promise<{id: string, at: string}|{refused: string}>}
 */
export async function sendPreviewText(db, { site, prospect, phone, step, service }) {
  const { body, mediaUrl } = previewText(site, step)
  const { data: row, error } = await db
    .from('outreach_texts')
    .insert({
      prospect_id: prospect.id,
      site_id: site.id,
      direction: 'outbound',
      status: 'drafted',
      step,
      phone,
      body,
      media_url: mediaUrl,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  let providerId
  try {
    providerId = await sendText({ to: phone, body, mediaUrl, service })
  } catch (cause) {
    const said = String(cause?.message || cause).slice(0, 500)
    await db.from('outreach_texts').update({ status: 'failed', error: said }).eq('id', row.id)
    if (refusesNumber(cause)) {
      await closeNumber(db, phone, 'undeliverable', said)
      return { refused: said }
    }
    throw cause
  }
  const at = new Date().toISOString()
  const marked = await db
    .from('outreach_texts')
    .update({ status: 'sent', sent_at: at, provider_id: providerId, error: null })
    .eq('id', row.id)
  if (marked.error) throw new Error(marked.error.message)
  return { id: row.id, at }
}
