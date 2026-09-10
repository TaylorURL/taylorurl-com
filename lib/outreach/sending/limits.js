/**
 * What bounds outreach sending, held where every end of it reads the same
 * figures.
 *
 * There is no ceiling on the day. What one mailbox sends as cold mail before
 * the receiving side starts reading the sender rather than the message is a
 * judgement rather than an arithmetic fact, and it is taken in the console by
 * whoever is watching the bounce rate. A run's ceiling is the one bound left
 * here, and it is arithmetic: what one invocation of the send job can deliver
 * inside the function's own time limit. The day is spread across many runs by
 * lib/outreach/sending/schedule.js, so the two multiply out to what a day can
 * actually carry rather than either one saying it alone.
 *
 * The rest are the ramp's figures: the bounce rates a cap may rise and must
 * fall on, how much sending a rate has to be read over, how large a step is,
 * and how far the climb goes without a complaint signal to judge it by.
 * lib/outreach/sending/ramp.js decides with them and the console draws the same
 * thresholds it does.
 */

/**
 * Messages one invocation of the send job can carry.
 *
 * A first letter costs an MX lookup, a send timeout, and the spacing before
 * the next one: eight, twenty and twenty seconds at worst, which is
 * forty-eight. Five of those is two hundred and forty, inside the five minutes
 * api/outreach/send.js is given and clear of the writes around them.
 *
 * It used to be three, because a message also warmed a capture and waited up
 * to twenty-five seconds for it. The letter that sends is plain text and
 * renders no picture, so nothing is warmed for it and that quarter of the
 * budget came back. The wait is still paid by a laid-out letter, which is why
 * `warmShot` asks per letter rather than per run.
 *
 * This is a ceiling on the invocation, not a division of the day: the schedule
 * spreads the cap across the window and each run sends only what is due. At a
 * cap of a hundred and fifty the slots fall about three minutes apart and the
 * cron fires every ten, so a run has three or four due and the rest of the
 * allowance is the catch-up a missed run needs.
 *
 * With no ceiling on the day, this is also what decides how large a cap is
 * worth setting. The window runs nine hours and the cron fires every ten
 * minutes, which is fifty-four runs of five, so a day delivers two hundred and
 * sixty-five and no more however high the cap goes. Past that the schedule
 * lays out slots the runs behind them cannot reach and the day simply ends
 * short. scripts/outreach/sending/check-send-schedule.js is what counts it.
 *
 * It is not the only bound on an invocation. A run also owes reminders, and
 * both halves spend the same five minutes, so api/outreach/send.js holds them
 * to one deadline and stops short of it rather than letting the platform
 * decide where a run ends. A run killed partway is a queue held by claims
 * nobody released.
 */
export const SEND_PER_RUN_MAX = 5

/**
 * The trailing hard-bounce rate the cap may rise under, as a percentage.
 *
 * Under it the list is clean enough that the volume is the only thing changing,
 * which is the condition a step is allowed on. At or above it the next thing to
 * do is read the bounces rather than send more, so the ramp holds and the
 * console draws the figure as a warning.
 */
export const BOUNCE_STEPS_UNDER = 2

/**
 * The trailing hard-bounce rate that takes the cap back down, as a percentage.
 *
 * Five per cent is where a receiving side stops treating the sender as a
 * mailbox with a stale list and starts treating it as one that does not know
 * who it is writing to. Past it the damage is to the domain, which the
 * newsletter and the client mail share, so the ramp returns the cap to the last
 * level it proved clean and stops climbing until a person restarts it.
 */
export const BOUNCE_ROLLS_BACK_OVER = 5

/**
 * Sends the trailing window needs before its rate decides anything.
 *
 * Below fifty a single hard bounce is already at or over BOUNCE_STEPS_UNDER, so
 * "clean" would mean "no bounce at all" - and no bounce across a handful of
 * sends is an absence of evidence rather than evidence of health. Fifty is the
 * smallest window whose rate can tell a clean list from one unlucky address,
 * which is the only reading a step is worth making on.
 */
export const RAMP_MIN_SENDS = 50

/**
 * The share of the current cap one step adds.
 *
 * A fixed step is wrong at both ends of the range: two is a sixth of a cap of
 * twelve and a twentieth of a cap of forty, so the same number is a bold move
 * early and a stall later. A share holds the pace steady instead, and a quarter
 * is the rate a warming mailbox is normally taken up at.
 */
export const RAMP_STEP_SHARE = 0.25

/**
 * The smallest step worth a day.
 *
 * daily_cap is a ceiling rather than a quota: the send job delivers whatever is
 * due up to it, so a day whose queue runs one short looks exactly like a day
 * one message under the cap. A step of one is inside that noise and would spend
 * a day proving nothing, so the ramp moves by at least two. It only binds below
 * a cap of eight, where a quarter rounds under two.
 */
export const RAMP_STEP_MIN = 2

/**
 * The highest cap the ramp climbs to on its own.
 *
 * Where a person sets the cap is a statement about reputation, and reputation
 * is carried far more by complaints than by bounces: a hard bounce says an
 * address does not exist, which is a fact about the list, while a complaint
 * says a person who read the message reported it, which is the fact the
 * plateau is about. Gmail SMTP runs no feedback loop, so nothing here can read
 * a complaint, and outreach_messages has no column that could hold one. Google
 * Postmaster Tools is the only route to that signal and it is not set up.
 *
 * That is why the ramp keeps a ceiling the settings no longer have. A person
 * raising the cap by hand has decided to carry the risk; a ramp raising it
 * unattended has only ever read bounces, and it should not spend a domain on
 * the half it cannot see.
 *
 * Twenty a day is the steady state a single Workspace mailbox sends cold mail
 * at without the volume itself being the thing the receiving side reads. Above
 * it, whether mail lands is decided by sender reputation rather than by list
 * quality, and that is exactly the half with no reading behind it. So the ramp
 * climbs to twenty unattended and stops there with the reason recorded. Going
 * past it takes the complaint signal, not a larger number here.
 */
export const RAMP_BLIND_MAX = 20

/**
 * Businesses the rotation is being grown to.
 *
 * The rotation is every business hearing from the studio once a month, and it
 * only ever grows: a business joins it the day its introduction goes out and
 * leaves only by replying or taking itself off. So this is a destination
 * rather than a ceiling, and nothing enforces it. It is here because the
 * console draws progress against it, and a target drawn from a number written
 * in one place is a target that means the same thing everywhere it is read.
 *
 * It is worth saying what it costs, because the figure is easy to set and hard
 * to serve. Ten thousand businesses at one letter a month is about three
 * hundred and eighty-five reminders a day on top of the day's introductions,
 * and that is far past what one mailbox sends cold mail from. The rotation
 * reaches its own limit long before it reaches this number, and the limit is a
 * sending one rather than anything in this file.
 */
export const ROTATION_TARGET = 10_000

/**
 * Fresh leads the queue is meant to be holding at any moment.
 *
 * The queue is what feeds the rotation: every business standing in it is one
 * introduction away from joining. Held here, a day can always send a full day,
 * and the pipeline behind it has a day of slack to find the next hundred and
 * fifty. Below it the sourcing and the enrichment are not keeping up with the
 * sending, which is the one thing that stops the rotation growing.
 *
 * It used to be written as the day's ceiling, on the reasoning that a floor
 * under the queue lower than the day's cap is a floor a single day could sweep
 * straight through. There is no ceiling on the day any more, so the figure
 * stands on its own: a hundred and fifty is what the sourcing is being asked to
 * keep ahead of the sending, and it is the console that draws the queue against
 * it. A cap set above it is a cap the queue has to be grown to meet.
 */
export const QUEUE_FLOOR = 150

/**
 * Days between one letter to a business and the next.
 *
 * A month, because the letter says a month. What arrives is the introduction
 * again rather than the next thing in a sequence, and the point of it is that
 * the number stays somewhere findable, so anything tighter is the same words
 * arriving often enough to read as pressure - which is the one thing the
 * letter promises it is not.
 *
 * Thirty days rather than a calendar month, since a chain counts from the day
 * a business was last written to and no two businesses share that day.
 */
export const FOLLOW_UP_DAYS = 30

/**
 * Reminders one invocation sends, after the first letters it owes.
 *
 * They run outside the daily cap and the ramp, so this is the only thing that
 * bounds them, and it is set by the time an invocation has left once its
 * first letters and their captures are done.
 */
export const FOLLOW_UPS_PER_RUN = 4

/** Businesses due a reminder read in one invocation, ahead of the ones it sends. */
export const FOLLOW_UP_LIMIT = 40
