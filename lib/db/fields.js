/**
 * The two shapes a value has to take before it reaches a column.
 *
 * Both are written here rather than beside the endpoints because an endpoint
 * that accepts a row another endpoint refuses is a difference nobody sees
 * until a console shows one thing and the table holds another. The rules are
 * about the boundary, not about any one table, so every endpoint crossing it
 * asks the same two questions.
 */

/**
 * The shape of a Postgres uuid, for a caller testing a value it will not keep.
 *
 * A caller that wants the value back takes `uuid` instead.
 */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A value that is a uuid, trimmed, or null.
 *
 * The trim happens before the test rather than after it, so an id that arrives
 * with a space around it - which is what a copy out of a console gives - is one
 * id everywhere rather than an id at some endpoints and a bad request at
 * others.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function uuid(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return UUID_PATTERN.test(trimmed) ? trimmed : null
}

/**
 * A trimmed field, capped, or null where the column takes a null.
 *
 * A value arriving longer than its cap is cut rather than refused, since the
 * length of a paste is not something the sender chose.
 *
 * @param {unknown} value
 * @param {number} max Characters the column holds.
 * @returns {string|null}
 */
export function field(value, max) {
  const trimmed = typeof value === 'string' ? value.trim().slice(0, max) : ''
  return trimmed || null
}
