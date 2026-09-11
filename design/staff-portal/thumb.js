/*
 * Enough behaviour to try the call screen rather than look at it.
 *
 * The five explorations were flat HTML on purpose: nothing wired, so nothing to
 * argue with but the layout. This one is the direction that was picked, and the
 * questions left are about sequence rather than arrangement - whether the tags
 * arriving only after the mark is right, whether gating Next on both answers is
 * help or obstruction, whether Back is reachable often enough to matter. None of
 * those can be read off a picture.
 *
 * So: the tags toggle, Needs Time opens its lengths, the mark reveals the two
 * questions, Next unlocks when both are answered, and Back and Next move between
 * two businesses. Nothing is stored and nothing is sent. It is a mockup that can
 * be held rather than a build.
 */

/**
 * One question. Pressing an answer selects it and clears the others, because
 * both questions take exactly one answer and a set that allows two is a set
 * somebody will put two in.
 *
 * @param {HTMLElement} group The element carrying data-group.
 * @param {() => void} changed What to run once the answer moved.
 */
function wireGroup(group, changed) {
  const tags = [...group.querySelectorAll('[data-answer]')]
  for (const tag of tags) {
    tag.addEventListener('click', () => {
      const already = tag.getAttribute('aria-pressed') === 'true'
      for (const other of tags) other.setAttribute('aria-pressed', 'false')
      // Pressing the selected answer again clears it. A representative who
      // pressed Yes by accident on the way past has to be able to take it back,
      // and the alternative is a screen where the only way out is the answer.
      tag.setAttribute('aria-pressed', already ? 'false' : 'true')
      changed()
    })
  }
}

/** The answer selected in a question, or null where none is. */
function answerIn(group) {
  const on = group?.querySelector('[data-answer][aria-pressed="true"]')
  return on ? on.dataset.answer : null
}

/**
 * One call screen.
 *
 * @param {HTMLElement} app The element carrying data-call.
 */
function wireCall(app) {
  const answers = app.querySelector('[data-answers]')
  const outcome = app.querySelector('[data-group="outcome"]')
  const standing = app.querySelector('[data-group="standing"]')
  const range = app.querySelector('[data-range]')
  const length = app.querySelector('[data-group="length"]')
  const mark = app.querySelector('[data-mark]')
  const next = app.querySelector('[data-next]')
  const back = app.querySelector('[data-back]')
  const note = app.querySelector('[data-foot-note]')
  const businesses = [...app.querySelectorAll('[data-business]')]

  let at = 0

  /** What the foot says and what it will let happen, from where the call is. */
  function settle() {
    const marked = app.dataset.state === 'marked'
    const both = Boolean(answerIn(outcome)) && Boolean(answerIn(standing))

    if (answers) answers.hidden = !marked
    // The lengths belong to one answer and appear with it. A business that needs
    // time needs a length of it, and nothing else on the screen needs one.
    if (range) range.hidden = answerIn(standing) !== 'needs-time'

    if (mark) mark.hidden = marked
    if (next) {
      next.hidden = !marked
      next.disabled = !both
    }
    if (back) back.disabled = at === 0

    if (!note) return
    if (!marked) {
      note.textContent = 'Back and Next open once this call is marked.'
      return
    }
    if (!both) {
      note.textContent = 'Answer both before you move on.'
      return
    }
    // A length is asked for and never required. `calls.js` settled this once
    // already for a call back nobody timed - it files at a default rather than
    // refusing - and a screen that refuses here gets a made-up length typed into
    // it, which is worse than the shortest one.
    if (answerIn(standing) === 'needs-time' && !answerIn(length)) {
      note.textContent = 'No length picked. We ring them again in two weeks.'
      return
    }
    const following = businesses[at + 1]
    note.textContent = following
      ? `Next up is ${following.dataset.business}.`
      : "That is the last one on today's list."
  }

  /** Show one business and put the call back to the start of itself. */
  function show(index) {
    at = Math.min(Math.max(index, 0), businesses.length - 1)
    businesses.forEach((one, i) => {
      one.hidden = i !== at
    })
    // A business arriving is a call that has not happened, so every answer from
    // the last one goes with it. Carrying them forward is how a whole afternoon
    // ends up tagged the same way.
    app.dataset.state = 'ready'
    for (const tag of app.querySelectorAll('[data-answer]')) {
      tag.setAttribute('aria-pressed', 'false')
    }
    const scroll = app.querySelector('.app-scroll')
    if (scroll) scroll.scrollTop = 0
    const where = app.querySelector('[data-where]')
    if (where) where.textContent = `${27 + at} of 60 · ${34 - at} left`
    settle()
  }

  if (outcome) wireGroup(outcome, settle)
  if (standing) wireGroup(standing, settle)
  if (length) wireGroup(length, settle)

  mark?.addEventListener('click', () => {
    app.dataset.state = 'marked'
    settle()
    answers?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })

  next?.addEventListener('click', () => show(at + 1))
  back?.addEventListener('click', () => show(at - 1))

  show(0)
}

for (const app of document.querySelectorAll('[data-call]')) wireCall(app)
