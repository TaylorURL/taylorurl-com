/**
 * When the day's messages go out, across the window rather than in a burst.
 *
 * Moved to chainwork. The window, the drift and the slot arithmetic are
 * unchanged, and the zone it reads them in is the project's own.
 *
 * Nothing is decided here any more. This file is the path, and chainwork is
 * the code; see chainwork/core/sending/schedule.js.
 */

export * from 'chainwork/core/sending/schedule.js'
