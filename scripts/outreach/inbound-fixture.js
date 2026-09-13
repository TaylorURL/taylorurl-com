/**
 * A reply as the mailbox hands it to the watch job.
 *
 * Two checks run the job over a mailbox - one for the writes a reply makes and
 * one for the notice that puts it in front of a person - and both start from
 * the same reply to a letter the studio sent, and read the same report of a
 * letter that never arrived. What the mailbox holds arrives as a list rather
 * than over a socket, so nothing is read from a real mailbox.
 */

/**
 * One inbound message, shaped the way the mailbox reader hands them over. What
 * `over` names takes the place of the reply's own, an envelope whole.
 */
export const inbound = (body, over = {}) => ({
  uid: 1,
  envelope: {
    messageId: '<reply-1@example.com>',
    subject: 'Re: your website',
    from: [{ address: 'owner@example.com' }],
    to: [{ address: 'studio@example.com' }],
    date: '2026-08-29T15:00:00.000Z',
  },
  headerText: '',
  bounce: false,
  body,
  ...over,
})

/**
 * A mail server's report of a permanent failure to the owner's address, which
 * the reader has already told apart from a reply by the time the job sees it.
 */
export const bounceReport = () =>
  inbound('Final-Recipient: rfc822; owner@example.com\nStatus: 5.1.1\n', {
    bounce: true,
    envelope: {
      messageId: '<bounce-1@example.com>',
      subject: 'Delivery Status Notification (Failure)',
      from: [{ address: 'mailer-daemon@example.com' }],
      to: [{ address: 'studio@example.com' }],
      date: '2026-08-29T15:00:00.000Z',
    },
  })
