/**
 * Turning a site reading into what an owner is told.
 *
 * `api/site-audit` returns measurements and facts and no sentences at all, so
 * every judgement lives here: what counts as too slow, what a missing tag
 * actually costs, and which of the three service pages repairs it. Keeping the
 * wording on this side means the copy can be rewritten without redeploying a
 * function, and the same reading can be shown more than one way.
 *
 * Two rules hold the tone honest. A check that passes is reported passing,
 * because a report that manufactures bad news for a site that is fine is worth
 * less than no report and is the kind of page an owner forwards to whoever
 * built the site. And a check that could not be taken is reported as not taken
 * rather than as a failure, because an unread thing and a broken thing are
 * different, and only one of them is the owner's problem.
 */

const SEO = '/services/seo'
const REDESIGN = '/services/redesign'
const CARE = '/services/care'

// Google's own threshold for largest contentful paint, at the point where a
// reading stops being good.
const LCP_GOOD_MS = 2500

// What a search result actually shows before it truncates.
const TITLE_MAX = 60
const TITLE_MIN = 15
const DESCRIPTION_MAX = 160
const DESCRIPTION_MIN = 70

const RANK = { fail: 0, warn: 1, pass: 2, unknown: 3 }

// What each check that reads the page answers when the page did not come back.
const PAGE_NOT_READ = {
  state: 'unknown',
  detail: 'The page did not come back. Run the check again in a minute.',
}

const seconds = ms => `${(ms / 1000).toFixed(1)} seconds`

/** The reading a finding should speak from: real visitors where Google holds
 *  enough of them, and the lab measurement otherwise. */
function loadingReading(reading) {
  const field = reading?.mobile?.field
  if (field && typeof field.lcpMs === 'number') {
    return { ms: field.lcpMs, fromVisitors: true }
  }
  const lab = reading?.mobile?.lab?.lcpMs
  return typeof lab === 'number' ? { ms: lab, fromVisitors: false } : null
}

/**
 * Every check, in the order they are defined, each answering with the state it
 * found and the words for it. `damage` orders the failures against each other,
 * lowest first, so the report opens on what is costing the most.
 */
const CHECKS = [
  {
    id: 'loading',
    label: 'Loading Speed on a Phone',
    damage: 0,
    fixes: REDESIGN,
    read(reading) {
      const found = loadingReading(reading)
      if (!found)
        return {
          state: 'unknown',
          detail: 'Nothing came back to time. Run the check again in a minute.',
        }

      const source = found.fromVisitors ? 'Measured from real visitors' : 'Measured on a test phone'
      if (found.ms <= LCP_GOOD_MS) {
        return {
          state: 'pass',
          headline: `Your site becomes usable in ${seconds(found.ms)} on a phone.`,
          detail: `${source}. Google's threshold is ${seconds(LCP_GOOD_MS)}, and you are inside it.`,
        }
      }
      return {
        state: 'fail',
        headline: `Your site takes ${seconds(found.ms)} to become usable on a phone.`,
        detail: `Google's threshold is ${seconds(LCP_GOOD_MS)}. ${source}.`,
      }
    },
  },
  {
    id: 'business-details',
    label: 'Business Details Google Can Read',
    damage: 1,
    fixes: SEO,
    read(reading) {
      if (!reading.page) return PAGE_NOT_READ
      const carries = reading.page.schemaCarries || {}

      // What decides this is whether the business is described, not which word
      // it picked for itself. schema.org carries about a hundred LocalBusiness
      // subtypes, so a barber shop calling itself a HairSalon is correct, and a
      // check against a list of type names would call it missing.
      if (carries.address || carries.telephone) {
        const held = [
          carries.address && 'address',
          carries.telephone && 'phone',
          carries.hours && 'opening hours',
        ].filter(Boolean)
        return {
          state: 'pass',
          headline: 'Google can read who and where your business is.',
          detail: `Your ${held.join(', ')} ${held.length === 1 ? 'is' : 'are'} in the page in the form Google reads, so ${held.length === 1 ? 'it' : 'they'} can show in search results.`,
        }
      }
      if (reading.page.schemaTypes?.length) {
        return {
          state: 'warn',
          headline: 'Google knows what you are but not where you are.',
          detail:
            'Your site says what kind of business it is, but carries no address or phone number in the form Google reads, so neither shows in search results.',
        }
      }
      return {
        state: 'fail',
        headline: "Google can't tell what your business is.",
        detail:
          "There's no business information in your site's code, so your hours, address and phone don't show in search results.",
      }
    },
  },
  {
    id: 'share-card',
    label: 'How Your Link Looks When Shared',
    damage: 2,
    fixes: SEO,
    read(reading) {
      if (!reading.page) return PAGE_NOT_READ
      if (reading.page.ogImage) {
        return {
          state: 'pass',
          headline: 'Your link shows a picture when somebody shares it.',
          detail: 'Posting your address on Facebook or sending it in a text shows a proper card.',
        }
      }
      return {
        state: 'fail',
        headline: 'Sharing your link on Facebook shows a blank box.',
        detail:
          'No share picture is set, so your address posts as a bare line of text wherever anybody shares it.',
      }
    },
  },
  {
    id: 'title',
    label: 'The Headline in Search Results',
    damage: 3,
    fixes: SEO,
    read(reading) {
      if (!reading.page) return PAGE_NOT_READ
      const title = reading.page.title
      if (!title) {
        return {
          state: 'fail',
          headline: 'Your home page has no title.',
          detail:
            'The title is the blue line somebody clicks in search results. Without one, Google writes its own from whatever it finds.',
        }
      }
      if (title.length > TITLE_MAX) {
        return {
          state: 'warn',
          headline: `Your title is cut off in search results.`,
          detail: `It runs to ${title.length} characters and results show about ${TITLE_MAX}, so the end of it is never read.`,
        }
      }
      if (title.length < TITLE_MIN) {
        return {
          state: 'warn',
          headline: 'Your title is too short to say much.',
          detail: `At ${title.length} characters there is no room for what you do or where you are, and both are what people search.`,
        }
      }
      return {
        state: 'pass',
        headline: 'Your title fits what search results show.',
        detail: `${title.length} characters, inside the ${TITLE_MAX} a result displays.`,
      }
    },
  },
  {
    id: 'description',
    label: 'The Description Under the Headline',
    damage: 4,
    fixes: SEO,
    read(reading) {
      if (!reading.page) return PAGE_NOT_READ
      const description = reading.page.description
      if (!description) {
        return {
          state: 'fail',
          headline: 'Your home page has no description.',
          detail:
            'Google fills the gap with whatever sentence it finds first, which is rarely the one that would bring somebody in.',
        }
      }
      if (description.length > DESCRIPTION_MAX) {
        return {
          state: 'warn',
          headline: 'Your description is cut off in search results.',
          detail: `It runs to ${description.length} characters and results show about ${DESCRIPTION_MAX}.`,
        }
      }
      if (description.length < DESCRIPTION_MIN) {
        return {
          state: 'warn',
          headline: 'Your description is shorter than the space you are given.',
          detail: `At ${description.length} characters you are leaving most of the ${DESCRIPTION_MAX} a result shows unused.`,
        }
      }
      return {
        state: 'pass',
        headline: 'Your description fits the space a result gives it.',
        detail: `${description.length} characters, inside the ${DESCRIPTION_MAX} a result displays.`,
      }
    },
  },
  {
    id: 'https',
    label: 'The Padlock',
    damage: 5,
    fixes: CARE,
    read(reading) {
      if (reading.site.https) {
        return {
          state: 'pass',
          headline: 'Your site loads securely.',
          detail: 'Browsers show the padlock rather than a warning.',
        }
      }
      return {
        state: 'fail',
        headline: 'Your site is not secure.',
        detail:
          'Browsers mark it Not Secure in the address bar, and Google ranks an insecure site below a secure one.',
      }
    },
  },
  {
    id: 'one-address',
    label: 'One Address, Not Two',
    damage: 6,
    fixes: CARE,
    read(reading) {
      const hosts = reading.hosts
      if (!hosts || !hosts.reachable) {
        return {
          state: 'unknown',
          detail:
            'Neither spelling of the address answered. Open it in a browser to see what it does, then run this again.',
        }
      }
      if (hosts.agree) {
        return {
          state: 'pass',
          headline: 'Both spellings of your address land in the same place.',
          detail: 'With and without the www, visitors and Google end up on one site.',
        }
      }
      // A canonical tag is not a redirect, but it does name which address
      // counts, so the standing is not actually split and the finding is worth
      // less than a site with neither.
      if (reading.page?.canonical) {
        return {
          state: 'warn',
          headline: 'Your site answers at two addresses, with a note naming which counts.',
          detail:
            'With and without the www both answer. A canonical tag names the one that counts, which stops your standing being split, but sending one address to the other is the repair.',
        }
      }
      return {
        state: 'fail',
        headline: 'Your site answers at two different addresses.',
        detail:
          'With and without the www do not end up in the same place, so Google treats them as two sites and splits your standing between them.',
      }
    },
  },
  {
    id: 'headings',
    label: 'The Heading on the Page',
    damage: 7,
    fixes: SEO,
    read(reading) {
      if (!reading.page) return PAGE_NOT_READ
      const count = reading.page.h1Count
      if (count === 1) {
        return {
          state: 'pass',
          headline: 'Your page has one main heading.',
          detail: 'Google can tell what the page is about from its own heading.',
        }
      }
      if (count === 0) {
        return {
          state: 'warn',
          headline: 'Your page has no main heading.',
          detail: 'Nothing on the page states what it is, so Google works it out from the rest.',
        }
      }
      return {
        state: 'warn',
        headline: `Your page has ${count} main headings.`,
        detail: 'Several competing headings leave Google to pick which one the page is about.',
      }
    },
  },
  {
    id: 'mobile-usable',
    label: 'Usable on a Phone',
    damage: 8,
    fixes: REDESIGN,
    read(reading) {
      const checks = reading.mobile?.checks
      if (!checks)
        return {
          state: 'unknown',
          detail: 'Nothing came back to measure. Run the check again in a minute.',
        }
      const { viewport, viewportSized } = checks
      if (viewport === false) {
        return {
          state: 'fail',
          headline: 'Your site is not built for a phone.',
          detail:
            'The page renders at desktop width and is then shrunk, so everything arrives too small to read and has to be pinched.',
        }
      }
      if (viewportSized === false) {
        return {
          state: 'warn',
          headline: 'Your site does not sit right on a phone screen.',
          detail:
            'The page lays out for a phone but not to the screen it is given, so a visitor scrolls sideways or pinches to read.',
        }
      }
      if (viewport === null && viewportSized === null) {
        return {
          state: 'unknown',
          detail: 'The phone reading did not come back. Run the check again in a minute.',
        }
      }
      return {
        state: 'pass',
        headline: 'Your site works on a phone.',
        detail: 'It lays out for the screen it is given rather than being shrunk to fit.',
      }
    },
  },
  {
    id: 'images',
    label: 'Picture Weight',
    damage: 9,
    fixes: REDESIGN,
    read(reading) {
      const wasted = reading.mobile?.imageBytes
      if (typeof wasted !== 'number') {
        return {
          state: 'unknown',
          detail: 'The pictures could not be weighed. Run the check again in a minute.',
        }
      }
      const kilobytes = Math.round(wasted / 1024)
      if (kilobytes < 100) {
        return {
          state: 'pass',
          headline: 'Your pictures are sized for the web.',
          detail: 'Nothing substantial is being downloaded that does not need to be.',
        }
      }
      return {
        state: 'warn',
        headline: `Your pictures are ${kilobytes} KB heavier than they need to be.`,
        detail:
          'That is downloaded before the page finishes, on a phone signal, every time somebody visits.',
      }
    },
  },
  {
    id: 'alt-text',
    label: 'Pictures Google Can Read',
    damage: 10,
    fixes: SEO,
    read(reading) {
      if (!reading.page) return PAGE_NOT_READ
      const { imageCount, imagesWithAlt } = reading.page
      if (imageCount === 0) {
        return { state: 'unknown', detail: 'The page carries no pictures to check.' }
      }
      const missing = imageCount - imagesWithAlt
      if (missing === 0) {
        return {
          state: 'pass',
          headline: 'Every picture has a description.',
          detail: 'Google and screen readers can both tell what your pictures show.',
        }
      }
      return {
        state: 'warn',
        headline: `${missing} of your ${imageCount} pictures have no description.`,
        detail:
          'Google cannot see a picture, so an undescribed one says nothing about your business, and a screen reader skips it.',
      }
    },
  },
  {
    id: 'sitemap',
    label: 'A Map for Google',
    damage: 11,
    fixes: SEO,
    read(reading) {
      const hasSitemap = reading.sitemap?.present
      const hasRobots = reading.robots?.present
      if (hasSitemap && hasRobots) {
        return {
          state: 'pass',
          headline: 'Google has a map of your site.',
          detail:
            'A sitemap and a robots file are both in place, so pages get found rather than stumbled on.',
        }
      }
      if (!hasSitemap) {
        return {
          state: 'warn',
          headline: 'Your site has no sitemap.',
          detail:
            'A sitemap lists your pages for Google. Without one, pages are found only by following links, and new ones wait longer.',
        }
      }
      return {
        state: 'warn',
        headline: 'Your site has no robots file.',
        detail:
          'It is the first thing Google looks for, and it is where a sitemap is usually named.',
      }
    },
  },
]

/**
 * The reading as an ordered report.
 *
 * Failures come first in damage order, then warnings, then what passed, then
 * what could not be read. An owner scrolling only the top of the page should
 * find the thing costing them the most.
 *
 * @param {object} reading - The body `api/site-audit` returned.
 * @returns {{ findings: Array<object>, counts: { fail: number, warn: number,
 *   pass: number, unknown: number } }}
 */
export function reportFor(reading) {
  const findings = CHECKS.map(check => {
    const found = check.read(reading)
    return {
      id: check.id,
      label: check.label,
      fixes: check.fixes,
      damage: check.damage,
      state: found.state,
      headline: found.headline || check.label,
      detail: found.detail,
    }
  }).sort((a, b) => RANK[a.state] - RANK[b.state] || a.damage - b.damage)

  const counts = { fail: 0, warn: 0, pass: 0, unknown: 0 }
  for (const finding of findings) counts[finding.state] += 1

  return { findings, counts }
}

/**
 * The report as the lines an inquiry carries, so the message names what the
 * check found rather than asking the reader to describe it again.
 */
export function enquiryLines(report) {
  const wording = { fail: 'Failing', warn: 'Needs work', pass: 'Passing', unknown: 'Not read' }
  return report.findings
    .filter(finding => finding.state === 'fail' || finding.state === 'warn')
    .map(finding => ({
      label: finding.label,
      value: `${wording[finding.state]} - ${finding.headline}`,
    }))
}
