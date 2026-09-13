/**
 * The plain first letter to a measured site.
 *
 * What the site did on a phone, in seconds; what causes most of it, in words;
 * one site to look at; and one question. A site that came up fast is told so,
 * and asked the other question instead.
 */

import { isClean } from '../speed.js'
import { YES, bareHost, causesLine, loadLine, plainLetter, workLine } from './shared.js'

export function plainSpeedOpener(prospect, where, shot, context = {}) {
  const host = bareHost(prospect.website) ?? 'your site'
  const subject = `${host} load time`

  if (isClean(prospect)) {
    return plainLetter(subject, [
      `We loaded ${host} on a phone connection this week and it came up fast. That's rarer than it sounds, so there's nothing to fix there.`,
      `If there's something the site isn't doing for the business yet, a page it needs or a form nobody fills in, that's the thing we'd be worth a note on. We build and look after sites for small businesses ${where}.`,
      `Anything like that? A one-line reply is plenty.`,
    ])
  }

  return plainLetter(subject, [
    loadLine(prospect),
    causesLine(prospect),
    [`We build and look after sites for small businesses ${where}.`, workLine(context)]
      .filter(Boolean)
      .join(' '),
    `Want the list of what we'd change, in order, with what each takes? ${YES}`,
  ])
}
