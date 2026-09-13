/**
 * The six stages a build passes through, in the words a client reads them in.
 *
 * The same six are a check constraint in the database and a ranking function
 * beside it, which is what decides whether a stage may close. This file is
 * only their names and what each one means to the person waiting, so a stage
 * renamed on screen cannot move one in the record.
 *
 * The order is the order. Everything that draws a bar, sorts an item or asks
 * whether the work has passed a point counts positions in this array.
 */
export const STAGES = [
  {
    id: 'received',
    label: 'Received',
    blurb: 'Your payment landed and the project is open.',
  },
  {
    id: 'getting_started',
    label: 'Getting Started',
    blurb: 'Gathering what only you have: your logo, your words, your photographs.',
  },
  {
    id: 'design',
    label: 'Design',
    blurb: 'Drawing the look. You see full pages before anything is built.',
  },
  {
    id: 'build',
    label: 'Build',
    blurb: 'The pages go in for real, one at a time, and you watch them appear.',
  },
  {
    id: 'checks',
    label: 'Checks',
    blurb: 'Speed, search, accessibility and every screen size, before anyone sees it.',
  },
  {
    id: 'live',
    label: 'Live',
    blurb: 'Your web address points at the new site.',
  },
]

/** Where a stage sits in the order, counting from one. Zero for a name nothing uses. */
export function stageRank(id) {
  return STAGES.findIndex(stage => stage.id === id) + 1
}

/** One stage by name, or the first, so a bar always has something to draw. */
export function stageOf(id) {
  return STAGES.find(stage => stage.id === id) || STAGES[0]
}

/**
 * What a build has asked its client for so far: the client's own items, up to
 * and including the stage the work has reached. An item from a stage further
 * on is work the client cannot usefully do yet, so it is not asked for.
 */
export function clientAsks(project) {
  const reached = stageRank(project?.stage)
  return (project?.tasks || []).filter(
    task => task.owner === 'client' && stageRank(task.stage) <= reached
  )
}

/**
 * Which project the tracker should be showing.
 *
 * The one still being built, and the oldest of those when somebody is having
 * two sites made at once - the one that has been waiting longest is the one
 * they are wondering about. With nothing unfinished it is the most recently
 * launched, which is the history they would open.
 */
export function currentProject(projects) {
  if (!projects?.length) return null
  const open = projects.filter(project => project.status !== 'complete')
  if (open.length) {
    return open.reduce((oldest, project) =>
      project.created_at < oldest.created_at ? project : oldest
    )
  }
  return projects.reduce((newest, project) =>
    (project.launched_at || '') > (newest.launched_at || '') ? project : newest
  )
}

/** Whether this account is still waiting on a build rather than running one. */
export function inOnboarding(projects) {
  return Boolean(projects?.some(project => project.status !== 'complete'))
}
