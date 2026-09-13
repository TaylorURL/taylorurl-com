/**
 * How the notify checks put a request to the endpoint and read what it said.
 *
 * The endpoint answers into a response the way Vercel hands it one, and a case
 * reads back the status, the body and the headers. Header names are kept
 * lowercased, so a case asks for `cache-control` however the endpoint spelled
 * it.
 *
 * Several of the requests are refusals the endpoint is right to log, and a
 * passing run should read as a passing run, so its logging is held back for the
 * length of the call.
 *
 * The endpoint is handed in rather than imported here. It reads its environment
 * once, at load, and each check sets that environment before importing it.
 */

/** The status, body and headers `handler` answered `request` with. */
export async function answerTo(handler, request) {
  const answer = { status: 0, body: null, headers: {} }
  const response = {
    setHeader(name, value) {
      answer.headers[String(name).toLowerCase()] = value
    },
    status(code) {
      answer.status = code
      return response
    },
    json(payload) {
      answer.body = payload
      return response
    },
  }
  const said = console.error
  console.error = () => {}
  try {
    await handler(request, response)
  } finally {
    console.error = said
  }
  return answer
}
