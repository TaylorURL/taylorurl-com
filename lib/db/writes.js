/**
 * A posted action, run as the database function that owns the change.
 *
 * The endpoints behind a client's tracker, its brief and the builds console
 * each take one action per POST, and each action is a call into a function
 * that already holds the rules. The writes answer the same way, so an endpoint
 * reads them off one table rather than writing each out as its own
 * near-identical block: the difference between them is the function and its
 * arguments, the sentence a failed call gets, and nothing else. The sentence
 * sits in the table rather than here because only the table knows which of the
 * things on it was asked for.
 */

/**
 * One action off an endpoint's table, called.
 *
 * Each entry reads what was posted and answers with either the first thing
 * wrong with it or the call to make. The function's own refusal is the answer a
 * person needs to read, and it arrives as a value rather than as an error:
 * waiting on a client is not the database going wrong.
 *
 * @param {object} db A service-role client.
 * @param {Record<string, () => ({fault: string}|{name: string, args: object, failed: string})>} writes
 *   The endpoint's table, keyed by action.
 * @param {unknown} action What the request asked for.
 * @param {(error: object, said: string) => {error: string}} faulted How the
 *   endpoint logs a driver fault and says it.
 * @returns {Promise<{status: number, body: object}|{data: unknown}>} The refusal
 *   to answer with, or what the function returned.
 */
export async function runWrite(db, writes, action, faulted) {
  const chosen = writes[action]
  if (!chosen) return { status: 400, body: { error: 'Unknown action.' } }

  const call = chosen()
  if (call.fault) return { status: 400, body: { error: call.fault } }

  const { data, error } = await db.rpc(call.name, call.args)
  if (error) return { status: 500, body: faulted(error, call.failed) }
  if (data?.error) return { status: 400, body: { error: data.error } }
  return { data }
}
