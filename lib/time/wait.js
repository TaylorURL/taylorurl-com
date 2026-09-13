/** A pause, in milliseconds. */
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
