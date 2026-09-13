/**
 * What a request carried, in the two forms an endpoint reads it in.
 *
 * The platform parses a body before a handler runs, and whether the handler is
 * handed an object or a string depends on the content type the caller declared
 * rather than on what it sent. A page posting JSON and a script that left its
 * header off are both ordinary callers, and both are read the same way here.
 *
 * An endpoint checking a signature is the other case. A signature is over what
 * was sent and not over what a parser made of it, so that endpoint turns the
 * platform's parsing off and reads the bytes itself.
 */

/**
 * The JSON body, whether the platform parsed it or handed it over as text.
 *
 * A body that will not parse, or that never arrived, answers as an empty
 * object, so a handler reading a field off it meets a field that is missing
 * rather than a throw.
 *
 * @param {object} request
 * @returns {object}
 */
export function readBody(request) {
  const body = request.body
  if (body && typeof body === 'object') return body
  if (typeof body !== 'string' || !body) return {}
  try {
    return JSON.parse(body)
  } catch {
    return {}
  }
}

/**
 * The raw bytes of the request, read straight off the stream.
 *
 * For an endpoint that exports `config = { api: { bodyParser: false } }`, which
 * is what leaves the stream unread for this to read.
 *
 * @param {object} request
 * @returns {Promise<string>}
 */
export async function rawBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}
