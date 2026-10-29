/**
 * What bounds outreach sending.
 *
 * Moved to chainwork, where the schedule and the ramp that read these figures
 * also live. The path stays so nothing that imports it has to move.
 *
 * Nothing is decided here any more. This file is the path, and chainwork is
 * the code; see chainwork/core/sending/limits.js.
 */

export * from 'chainwork/core/sending/limits.js'
