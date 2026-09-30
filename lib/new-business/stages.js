/**
 * The stages a new business can stand at, in the order it moves through them.
 * The constraint on `new_business_leads.stage` holds the same list.
 */
export const LEAD_STAGES = Object.freeze([
  'waiting',
  'emailable',
  'phone_only',
  'contacted',
  'replied',
  'unsubscribed',
  'bounced',
  'undeliverable',
  'gave_up',
])
