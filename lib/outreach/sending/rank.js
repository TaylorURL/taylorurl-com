/**
 * Where a prospect falls in the send queue.
 *
 * Moved to chainwork, with the opportunity reading it leans on. The axis is
 * unchanged, and the read in lib/outreach/sending/queue.js still takes it from
 * the same place the comparator does - which is the whole reason it is one
 * module rather than an expression.
 *
 * Nothing is decided here any more. This file is the path, and chainwork is
 * the code; see chainwork/core/sending/rank.js.
 */

export * from 'chainwork/core/sending/rank.js'
