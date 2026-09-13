/**
 * The fetch a check leaves in place of the network.
 *
 * A path a check forgot to stub would otherwise make a real request, which
 * either answers or sits until it times out, and either can pass for the wrong
 * reason. This one throws where it is called, so the path that reached it fails
 * where it stands, and every check that installs it says the same thing when it
 * does.
 */

/** A fetch that refuses every request it is handed. */
export const OFFLINE = () => {
  throw new Error('a check reached the network')
}
