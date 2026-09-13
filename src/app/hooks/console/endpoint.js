import { faultFromResponse } from '@utils/faults'

/**
 * The requests every console feed makes, as the account that is signed in.
 *
 * Each answers with the response and its body side by side, because the body
 * is read whatever the status: a refusal carries the sentence that explains
 * it, and that sentence and the status are what `faultFromResponse` needs in
 * hand. A body that is not JSON - a relay's own error page, most often - reads
 * as an empty one, so the status is still what decides and nothing throws
 * past it.
 */

/**
 * One read, never answered out of the browser's cache: every figure the
 * console draws is only worth drawing as it stands now.
 *
 * @param {string} token
 * @param {string} url
 * @returns {Promise<{response: Response, payload: object}>}
 */
export async function readEndpoint(token, url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

/**
 * One write, with its body sent as JSON.
 *
 * `init` is whatever else the request carries - another method, or
 * `keepalive` for a write made while the page is going away.
 *
 * @param {string} token
 * @param {string} url
 * @param {object} body
 * @param {RequestInit} [init]
 * @returns {Promise<{response: Response, payload: object}>}
 */
export async function writeEndpoint(token, url, body, init = {}) {
  const response = await fetch(url, {
    method: 'POST',
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

/**
 * A file written straight into the private bucket, at the address an endpoint
 * signed for it, and what a reader is told if it did not go in.
 *
 * The bucket answers a refused upload with its own XML rather than anything a
 * reader could use, so the status is the whole of what is known here - and a
 * status on its own is a case the door already answers, which is why nothing
 * is read off this response.
 *
 * @param {string} url
 * @param {File} file
 * @param {string} fallback
 * @returns {Promise<string|null>} null once the file is in
 */
export async function putSigned(url, file, fallback) {
  const put = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  return put.ok ? null : faultFromResponse(put, null, fallback)
}
