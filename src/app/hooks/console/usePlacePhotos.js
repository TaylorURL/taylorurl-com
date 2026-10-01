import { useEffect, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { readEndpoint } from './endpoint'
import { useAlive } from './useAlive'

const PHOTOS_PATH = '/api/calls-admin'

/** What a caller is told when the photos will not come back. */
const NO_PHOTOS = 'The photos did not load.'

/**
 * The photos on one business's Google listing, read as the caller arrives on it.
 *
 * Each answer is kept for as long as the call screen is open, keyed by the
 * business, so Back and Next between businesses already read cost nothing: a
 * photo address is a billed request to Google, and the same storefront does not
 * change between one look and the next. A refusal is not kept, so arriving on
 * the business again asks again.
 *
 * Until the answer for the business on screen lands, `loading` is true and
 * nothing else is claimed. An answer still held from the last business is
 * never drawn under this one's name.
 *
 * @param {{token: string|null, id: string|null}} options
 * @returns {{loading: boolean, photos: Array<{uri: string, width: number|null,
 *   height: number|null, by: Array<{name: string, uri: string|null}>}>,
 *   listed: boolean, error: string|null}}
 */
export function usePlacePhotos({ token, id }) {
  const kept = useRef(new Map())
  const [answer, setAnswer] = useState(null)
  const alive = useAlive()

  useEffect(() => {
    if (!token || !id) return undefined
    const held = kept.current.get(id)
    if (held) {
      setAnswer(held)
      return undefined
    }
    let stop = false
    ;(async () => {
      let next
      try {
        const { response, payload } = await readEndpoint(
          token,
          `${PHOTOS_PATH}?photos=${encodeURIComponent(id)}`
        )
        next = response.ok
          ? {
              id,
              photos: Array.isArray(payload.photos) ? payload.photos : [],
              listed: payload.listed !== false,
              fault: null,
            }
          : { id, photos: [], listed: true, fault: faultFromResponse(response, payload, NO_PHOTOS) }
      } catch (cause) {
        next = { id, photos: [], listed: true, fault: faultMessage(cause, NO_PHOTOS) }
      }
      if (!next.fault) kept.current.set(id, next)
      if (!stop && alive.current) setAnswer(next)
    })()
    return () => {
      stop = true
    }
  }, [token, id, alive])

  const current = answer?.id === id ? answer : null
  return {
    loading: Boolean(id) && !current,
    photos: current?.photos ?? [],
    listed: current?.listed ?? true,
    error: current?.fault ?? null,
  }
}
