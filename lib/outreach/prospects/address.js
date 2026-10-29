/**
 * Whether an address is one a cold letter may be sent to.
 *
 * Moved to chainwork. It is the one module there that reaches a Node built-in,
 * since it asks DNS whether a domain can take mail, so it is server-side and
 * is imported by path rather than out of the core barrel.
 *
 * Nothing is decided here any more. This file is the path, and chainwork is
 * the code; see chainwork/core/prospects/address.js.
 */

export * from 'chainwork/core/prospects/address.js'
