import { faultFromResponse, faultMessage } from '@utils/faults'

const ENDPOINT = '/api/speed-check'

const FALLBACK_ERROR = 'The check could not be completed. Try again in a few minutes.'

/**
 * The stages, in the order the endpoint finishes them, and what each is called
 * on the page.
 *
 * A reused reading finishes every stage at once, so the list is what the wait
 * is drawn from rather than what a run is guaranteed to walk through.
 */
export const STAGES = [
  { id: 'reaching', label: 'Checking the address answers' },
  { id: 'measuring', label: 'Loading your site the way a phone would' },
  { id: 'capturing', label: 'Taking a picture of the page' },
]

/** Where a named stage sits in the list, and the first one for anything else. */
export function stageIndex(id) {
  const at = STAGES.findIndex(stage => stage.id === id)
  return at === -1 ? 0 : at
}

/**
 * Runs a check, reporting each stage as the endpoint finishes it.
 *
 * The answer arrives as newline-delimited JSON rather than one object, because
 * the reading takes most of a minute and a page that reports nothing for that
 * long is one a visitor closes. Every line but the last names a stage; the last
 * carries either the reading or the reason there is not one.
 *
 * A proxy that buffers the stream delivers every line at once, which costs the
 * stages and nothing else. The reading is read out of the same last line either
 * way, so the wait degrades and the answer does not.
 *
 * @param {{site: string, email: string}} asked What the visitor typed.
 * @param {{onStage?: (id: string) => void, signal?: AbortSignal}} [options]
 * @returns {Promise<object>} The reading.
 */
export async function runSpeedCheck({ site, email }, { onStage, signal } = {}) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ site: site.trim(), email: email.trim() }),
    signal,
  })

  // A refusal is answered before the stream opens and carries JSON, so it is
  // read whole rather than line by line. What that JSON holds is written by
  // whatever refused - the endpoint's own sentence on a good day, an upstream
  // service's error body on a bad one - so it is read before it is thrown
  // rather than by the page that catches it.
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(faultFromResponse(response, payload, FALLBACK_ERROR))
  }

  let last = null
  const decoder = new TextDecoder()
  const reader = response.body?.getReader()
  let held = ''

  const take = line => {
    const text = line.trim()
    if (!text) return
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      return
    }
    if (payload.stage) onStage?.(payload.stage)
    else last = payload
  }

  if (reader) {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      held += decoder.decode(value, { stream: true })
      const lines = held.split('\n')
      held = lines.pop() ?? ''
      for (const line of lines) take(line)
    }
  } else {
    held = await response.text()
  }
  for (const line of held.split('\n')) take(line)

  if (!last) throw new Error(FALLBACK_ERROR)
  // The last line of a run that got as far as opening the stream carries the
  // reason instead of the reading, and it comes from the same place the refusal
  // above does, so it is read the same way.
  if (last.fault) throw new Error(faultMessage(last.fault, FALLBACK_ERROR))
  return last.result
}

/**
 * What to show when a check did not come back.
 *
 * The reading takes most of a minute and can fail at any point in it: before
 * the request lands, in the endpoint, or in Google's own service. All of those
 * arrive here as one thrown thing, and none of them is written for the person
 * who asked for the reading, so the one door in `utils/faults` answers for all
 * of them. The fallback names the check rather than whatever failed inside it.
 */
export function speedCheckErrorMessage(error) {
  return faultMessage(error, FALLBACK_ERROR)
}
