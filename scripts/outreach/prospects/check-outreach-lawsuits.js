/**
 * Proves the lawsuits source reads a suit the way the letter written for it
 * needs, and that a business in a suit hears that letter and no other.
 *
 * The failures worth catching are quiet ones. A snippet read for the wrong
 * host sends a letter about somebody's lawsuit to a stranger's site. A
 * lawsuit row drawn the introduction reads as a studio that has not noticed
 * why it is writing, and an ordinary row drawn the lawsuit letter accuses a
 * business of being sued. None of them throws.
 *
 *   npm run check:outreach-lawsuits
 */
import {
  LAWSUIT_SOURCE,
  courtPhrase,
  defendantOf,
  isShopify,
  prospectOfSuit,
  websiteIn,
} from '../../../lib/outreach/prospects/lawsuits.js'
import {
  filedOn,
  lawsuitFollowUpOpener,
  lawsuitOpener,
} from '../../../lib/outreach/openers/plain/lawsuit.js'
import { SUED_RANK, rankOf } from '../../../lib/outreach/sending/rank.js'
import { SEGMENTS } from '../../../lib/outreach/segments.js'
import {
  VARIANTS,
  familyAhead,
  fits,
  liveAhead,
  pickVariant,
} from '../../../lib/outreach/variants.js'
import { check, finish, ok, same } from '../../harness/checks.js'

/** A suit the way CourtListener's search answers with one. */
const SUIT = {
  docket_id: 70000001,
  caseName: 'Doe v. Riverside Dance Studio, Inc.',
  docketNumber: '1:26-cv-00001',
  court: 'District Court, S.D. New York',
  dateFiled: '2026-09-14',
  docket_absolute_url: '/docket/70000001/doe-v-riverside-dance-studio-inc/',
}

const sued = over => ({
  id: 'p1',
  name: 'Riverside Dance Studio, Inc.',
  website: 'https://riversidedance.example',
  site_kind: 'own',
  audit_score: 62,
  email: 'info@riversidedance.example',
  source: LAWSUIT_SOURCE,
  case_name: SUIT.caseName,
  case_number: SUIT.docketNumber,
  case_court: SUIT.court,
  case_filed_on: SUIT.dateFiled,
  ...over,
})

check('the defendant is read off the caption', () => {
  same(
    defendantOf('Doe v. Riverside Dance Studio, Inc.'),
    'Riverside Dance Studio, Inc.',
    'one defendant'
  )
  same(
    defendantOf('Roe v. Harbor Cafe Two, LLC. et, al.'),
    'Harbor Cafe Two, LLC',
    'et, al. dropped, and the stop behind it'
  )
  same(defendantOf('Smith v. Acme Corp. et al.'), 'Acme Corp.', 'et al. dropped')
  same(defendantOf('In re Something'), null, 'a caption with no defendant')
})

check('the site is read out of the complaint snippet', () => {
  same(
    websiteIn(
      'Because Defendant’s interactive website, <mark>https</mark>://riversidedance.<mark>example</mark>/, including all'
    ),
    'https://riversidedance.example',
    'a scheme'
  )
  same(
    websiteIn(
      'its e-<mark>commerce</mark> Website, <mark>www</mark>.soapworks.<mark>example</mark> is accessible'
    ),
    'https://soapworks.example',
    'a www across marks, past e-commerce'
  )
  same(
    websiteIn(
      'conform to the guidelines at https://www.w3.org/TR/WCAG21/ and www.skincare.example'
    ),
    'https://skincare.example',
    'the standard the complaint cites is not the site'
  )
  same(
    websiteIn('Defendant.The website was not accessible'),
    null,
    'a sentence run together is not a host'
  )
  same(websiteIn(''), null, 'an empty snippet')
})

check('a Shopify store is told apart from a site that can be rebuilt', () => {
  ok(isShopify('<link href="//cdn.shopify.com/s/files/1/theme.css">'), 'the theme CDN')
  ok(isShopify('<script>window.Shopify = window.Shopify || {}</script>'), 'the window global')
  ok(!isShopify('<link href="/wp-content/themes/studio/style.css">'), 'a WordPress site')
  ok(!isShopify(null), 'a page that would not load')
})

check('a suit becomes a row that names its case', () => {
  const row = prospectOfSuit(SUIT, 'https://riversidedance.example')
  same(row.source, LAWSUIT_SOURCE, 'source')
  same(row.source_ref, '70000001', 'the docket id is the identity')
  same(row.name, 'Riverside Dance Studio, Inc.', 'name')
  same(row.case_filed_on, '2026-09-14', 'filed on')
  same(
    row.case_url,
    'https://www.courtlistener.com/docket/70000001/doe-v-riverside-dance-studio-inc/',
    'docket link'
  )
  same(prospectOfSuit({ ...SUIT, caseName: 'nothing' }, null), null, 'no defendant, no row')
})

check('the court and the day read the way a person says them', () => {
  same(
    courtPhrase('District Court, S.D. New York'),
    'the Southern District of New York',
    'a sided district'
  )
  same(
    courtPhrase('District Court, D. New Jersey'),
    'the District of New Jersey',
    'a whole-state district'
  )
  same(courtPhrase(null), 'federal court', 'no court')
  same(filedOn('2026-09-14'), 'September 14', 'a date column')
  same(filedOn(null), null, 'no date')
})

check('the letter names the case, the site and nothing it cannot back', () => {
  const letter = lawsuitOpener(sued())
  const text = letter.paragraphs.join('\n')
  ok(letter.plain, 'a plain letter')
  same(letter.subject, 'the screen reader lawsuit', 'subject')
  ok(
    text.includes('the Southern District of New York on September 14 (case 1:26-cv-00001)'),
    'the case'
  )
  ok(text.includes('WCAG 2.1 AA'), 'the standard')
  ok(text.includes('legal advice'), 'says it is not legal advice')
  ok(!/Baytown|Houston|Texas/.test(text), 'no Texas service area in a letter to New York')

  const second = lawsuitFollowUpOpener(sued(), '', null, {
    prior: { subject: letter.subject },
    phone: '555',
  })
  same(second.subject, `Re: ${letter.subject}`, 'threads under the first')
  ok(second.paragraphs.join(' ').includes('555'), 'carries the number')
})

check('a business in a suit hears the lawsuit letters and nothing else', () => {
  for (const segment of SEGMENTS) {
    const row = sued({
      site_kind: segment === 'no-site' ? 'none' : 'own',
      audit_score: { 'slow-site': 20, 'fair-site': 60, 'sound-site': 95 }[segment] ?? null,
    })
    const first = pickVariant(row, VARIANTS, 0.5, 1)
    ok(first, `nothing drawn for a sued business in ${segment}`)
    same(first?.family, 'lawsuit', `first letter family in ${segment}`)
    const second = pickVariant({ ...row, variant_id: first?.id }, VARIANTS, 0.5, 2)
    same(second?.family, 'lawsuit', `second letter family in ${segment}`)
    ok(
      !liveAhead(VARIANTS, segment, 3, familyAhead(row, VARIANTS, 3), LAWSUIT_SOURCE),
      `the chain closes after two in ${segment}`
    )
  }
})

check('no other business is ever drawn a lawsuit letter', () => {
  for (const source of ['places', 'console', 'speed-check', null]) {
    const row = sued({ source, case_court: null, case_filed_on: null })
    for (const entry of VARIANTS.filter(item => item.family === 'lawsuit')) {
      ok(!fits(entry, row), `${entry.id} fits a ${source} row`)
    }
    same(
      pickVariant(row, VARIANTS, 0.5, 1)?.family,
      'introduction',
      `a ${source} row still gets the introduction`
    )
  }
})

check('a lawsuit goes to the front of the queue', () => {
  same(rankOf(sued()), SUED_RANK, 'rank')
  ok(rankOf(sued()) < rankOf({ source: 'speed-check' }), 'ahead of a business that asked')
})

finish()
