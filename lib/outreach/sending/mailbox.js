/**
 * The cold mailbox itself: whether Gmail is letting it send.
 *
 * Moved to chainwork. The refusal classification, the rest windows and the
 * one-minute reading are unchanged.
 *
 * Nothing is decided here any more. This file is the path, and chainwork is
 * the code; see chainwork/core/sending/mailbox.js.
 */

export * from 'chainwork/core/sending/mailbox.js'
