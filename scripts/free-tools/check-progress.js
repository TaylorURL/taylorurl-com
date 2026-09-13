/**
 * The pacing of the presence check's wait.
 *
 * A reader waits most of a minute on a reading that reports no progress, and
 * decides somewhere in there whether the page has died. So what the wait claims
 * has to hold: the bar only ever moves forward, it never fills before the report
 * exists, the clock is exact, and every stage is reached rather than jumped
 * over.
 *
 * That last one is not hypothetical. Keying the stages to how full the bar was
 * rather than to the time on the clock skipped the two short ones outright,
 * because the bar eases and time does not.
 */
import { STAGES, TYPICAL_MS, clock, creep, stageAt } from '../../src/app/tools/lib/progress.js'
import { expect as check, finish } from '../harness/checks.js'

// A run sampled every quarter second out to five minutes, which is past
// anything the endpoint will still be waiting on.
const SAMPLES = []
for (let ms = 0; ms <= 300_000; ms += 250) SAMPLES.push(ms)

let previous = -1
for (const ms of SAMPLES) {
  const share = creep(ms)
  if (share < previous) {
    check(false, `the bar went backwards at ${ms}ms`)
    break
  }
  previous = share
}

check(creep(0) === 0, 'the bar did not start empty')
check(
  SAMPLES.every(ms => creep(ms) < 1),
  'the bar filled before the report existed'
)
check(creep(TYPICAL_MS) > 0.7, 'a typical run looked barely started when it was nearly done')
check(creep(300_000) > 0.95, 'a five-minute run did not look nearly done')

// Every stage is reached, in order, and none is skipped.
const walked = []
for (const ms of SAMPLES) {
  const index = stageAt(ms)
  if (walked.length === 0 || walked[walked.length - 1] !== index) walked.push(index)
}
check(
  walked.length === STAGES.length,
  `${walked.length} of ${STAGES.length} stages were reached: ${walked.join(', ')}`
)
check(
  walked.every((index, at) => index === at),
  `the stages did not run in order: ${walked.join(', ')}`
)
check(stageAt(0) === 0, 'a run did not open on its first stage')
check(stageAt(600_000) === STAGES.length - 1, 'a long run left the last stage')
check(
  STAGES.every(stage => stage.label && stage.label === stage.label.trim()),
  'a stage carries no label'
)

check(clock(0) === '00:00', `clock(0) is ${clock(0)}`)
check(clock(45_000) === '00:45', `clock(45s) is ${clock(45_000)}`)
check(clock(60_000) === '01:00', `clock(60s) is ${clock(60_000)}`)
check(clock(125_400) === '02:05', `clock(125.4s) is ${clock(125_400)}`)
check(clock(-500) === '00:00', `a clock running before the start reads ${clock(-500)}`)

await finish()
console.log(
  `progress: bar rises and never fills, all ${STAGES.length} stages reached in order, clock exact`
)
