/**
 * The layouts the media library is drawn in, as HTML strings.
 *
 * One chassis (`sheet.css`) carries the grid, the registration marks, the label
 * rail and the footer rail, and every template here is handed the box between
 * the rails and nothing else. That is what keeps eighty images reading as one
 * set: the furniture never moves, only what sits inside it.
 *
 * Copy arrives as plain strings. `*word*` sets that word in the accent colour,
 * which is how a card names its one blue word where the copy is written rather
 * than by an index into it. Everything else is escaped.
 */

export const IMAGE = { width: 1080, height: 1350 }
export const VIDEO = { width: 1080, height: 1920 }

const escape = value =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Copy with `*accent*` runs, as markup. */
export const rich = value => escape(value).replace(/\*([^*]+)\*/g, '<span class="a">$1</span>')

/** The same copy as a reader hears it: the accent markers gone. */
export const plain = value => String(value).replace(/\*/g, '')

/** Copy split into word spans, so a video can bring a headline in one word at a time. */
export const words = value =>
  rich(value)
    .split(/(<span class="a">[^<]*<\/span>|\s+)/)
    .filter(part => part && !/^\s+$/.test(part))
    .map(part => {
      const accent = part.startsWith('<span class="a">')
      const text = accent ? part.replace(/<[^>]+>/g, '') : part
      return text
        .split(/\s+/)
        .map(word => `<span class="w${accent ? ' a' : ''}">${word}</span>`)
        .join(' ')
    })
    .join(' ')

/**
 * A whole page: the chassis, then whatever the template put in the box.
 *
 * @param {object} options
 * @param {{width: number, height: number}} options.size
 * @param {string} options.eyebrow The label in the top rail.
 * @param {string} [options.counter] Right-hand side of the top rail.
 * @param {boolean} [options.dark]
 * @param {string} options.inner Markup for the content box.
 * @param {string} options.css Extra styles for this template.
 * @param {object} shared Fonts, chassis CSS and the wordmark, read once per run.
 * @param {string} [script] Runtime appended to the page.
 */
export function page(
  { size, eyebrow, counter = '', dark = false, inner, css = '', progress = false },
  shared,
  script = ''
) {
  const markWidth = Math.round(40 * shared.mark.aspect)
  const markDrop = Math.round(40 * (1 - shared.mark.base))
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${shared.fontFaces}
:root { --w: ${size.width}px; --h: ${size.height}px; }
${shared.css}
.mark { width: ${markWidth}px; -webkit-mask-image: url(${shared.mark.url}); mask-image: url(${shared.mark.url}); transform: translateY(${markDrop}px); }
${css}
</style></head><body class="${dark ? 'dark' : ''}">
<div class="sheet"></div>
<i class="tick tl"></i><i class="tick tr"></i><i class="tick bl"></i><i class="tick br"></i>
<div class="eyebrow"><span class="lead">${rich(eyebrow)}</span><span class="count">${escape(counter)}</span></div>
<div class="rule top"></div>${progress ? '<div class="progress"></div>' : ''}
<div class="content" id="content">${inner}</div>
<div class="rule bottom"></div>
<div class="foot"><div class="mark"></div><div class="url">taylorurl.com</div></div>
${script ? `<script>${script}</script>` : ''}
</body></html>`
}

// ---------------------------------------------------------------------------
// Image cards, 1080 x 1350
// ---------------------------------------------------------------------------

const shrink = (px, min) =>
  `data-shrink data-size="${px}" data-min="${min}" style="font-size:${px}px"`

/** `number`: one figure, what it measures, and what it costs the reader. */
export function numberCard(item) {
  return {
    eyebrow: item.eyebrow,
    dark: item.dark,
    css: `
.content { justify-content: center; gap: 34px; }
.fig { font-weight: 600; letter-spacing: -0.05em; line-height: 0.86; color: var(--accent); white-space: nowrap; }
.what { font-weight: 600; letter-spacing: -0.02em; line-height: 1.12; max-width: 860px; }
.cost { padding-top: 30px; border-top: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.cost .label { margin-bottom: 14px; }`,
    inner: `
<div class="fig" ${shrink(item.figureSize ?? 300, 160)}>${rich(item.figure)}</div>
<div class="what" ${shrink(60, 40)}>${rich(item.label)}</div>
<div class="cost"><div class="label">What It Costs You</div><div class="body" ${shrink(36, 28)}>${rich(item.cost)}</div></div>
<div class="note">${rich(item.source)}</div>`,
  }
}

/** `check`: something a reader can do on their own phone, in numbered steps. */
export function checkCard(item) {
  return {
    eyebrow: item.eyebrow ?? 'Try This on Your Phone',
    counter: 'Under a Minute',
    dark: item.dark,
    css: `
.content { justify-content: center; gap: 44px; }
.steps { display: flex; flex-direction: column; }
.step { display: flex; gap: 30px; align-items: baseline; padding: 24px 0; border-top: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.step:last-child { border-bottom: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.step .n { font-family: 'Geist Mono', monospace; font-weight: 500; font-size: 26px; color: var(--accent); flex: none; width: 46px; }
.step .t { font-weight: 450; line-height: 1.3; }`,
    inner: `
<div class="head" ${shrink(item.headSize ?? 92, 60)}>${rich(item.headline)}</div>
<div class="steps">${item.steps
      .map(
        (step, index) =>
          `<div class="step"><span class="n">${String(index + 1).padStart(2, '0')}</span><span class="t" ${shrink(38, 28)}>${rich(step)}</span></div>`
      )
      .join('')}</div>`,
  }
}

/** `disagreement`: a belief the trade holds, struck through, and what happens instead. */
export function disagreementCard(item) {
  return {
    eyebrow: item.eyebrow ?? 'Heard in the Trade',
    dark: item.dark,
    css: `
.content { justify-content: center; gap: 46px; }
.belief { position: relative; align-self: flex-start; font-weight: 600; letter-spacing: -0.03em; line-height: 1.02; color: rgba(var(--fg-rgb), 0.42); }
.belief s { text-decoration: none; background-image: linear-gradient(var(--accent), var(--accent)); background-size: 100% 9px; background-position: 0 56%; background-repeat: no-repeat; padding: 0 4px; margin: 0 -4px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.instead .label { margin-bottom: 20px; }
.instead .head { margin-bottom: 26px; }`,
    inner: `
<div class="belief" ${shrink(item.beliefSize ?? 104, 64)}><s>${escape(item.belief)}</s></div>
<div class="instead"><div class="label">What Actually Happens</div>
<div class="head" ${shrink(item.headSize ?? 62, 44)}>${rich(item.headline)}</div>
<div class="body" ${shrink(36, 28)}>${rich(item.why)}</div></div>`,
  }
}

/** `before-after`: two stored PageSpeed readings of one site, as bars out of 100. */
export function beforeAfterCard(item) {
  const pair = ({ strategy, before, after }) => `
<div class="pair">
  <div class="label">${escape(strategy)}</div>
  ${[before, after]
    .map(
      (reading, index) => `
  <div class="row ${index ? 'after' : 'before'}">
    <div class="when mono">${escape(reading.when)}</div>
    <div class="track"><div class="fill" style="width:${reading.score}%"></div></div>
    <div class="score">${reading.score}</div>
  </div>`
    )
    .join('')}
</div>`
  return {
    eyebrow: item.eyebrow ?? 'Measured by Google',
    dark: item.dark,
    css: `
.content { justify-content: center; gap: 40px; }
.subject { margin-bottom: -18px; }
.pairs { display: flex; flex-direction: column; gap: 40px; }
.pair .label { margin-bottom: 18px; }
.row { display: grid; grid-template-columns: 210px 1fr 120px; align-items: center; gap: 22px; padding: 10px 0; }
.when { font-size: 22px; color: rgba(var(--fg-rgb), 0.6); }
.track { height: 34px; background: rgba(var(--fg-rgb), 0.07); }
.fill { height: 100%; background: rgba(var(--fg-rgb), 0.32); }
.after .fill { background: var(--accent); }
.score { font-weight: 600; font-size: 64px; letter-spacing: -0.03em; text-align: right; line-height: 1; color: rgba(var(--fg-rgb), 0.45); }
.after .score { color: var(--accent); }`,
    inner: `
<div class="label subject">${escape(item.subject)}</div>
<div class="head" ${shrink(item.headSize ?? 86, 56)}>${rich(item.headline)}</div>
<div class="pairs">${item.pairs.map(pair).join('')}</div>
<div class="note">${rich(item.source)}</div>`,
  }
}

/** `teaser`: an article cover. */
export function teaserCard(item) {
  return {
    eyebrow: item.eyebrow,
    counter: item.readTime,
    dark: item.dark,
    css: `
.content { justify-content: center; gap: 44px; }
.dek { border-left: 6px solid var(--accent); padding-left: 30px; }
.read { display: flex; align-items: center; gap: 16px; }
.read .arrow { width: 54px; height: 2px; background: var(--accent); position: relative; }
.read .arrow::after { content: ''; position: absolute; right: 0; top: -7px; width: 14px; height: 14px; border-top: 2px solid var(--accent); border-right: 2px solid var(--accent); transform: rotate(45deg); transform-origin: 70% 30%; }`,
    inner: `
<div class="head" ${shrink(item.headSize ?? 112, 64)}>${rich(item.headline)}</div>
<div class="dek body" ${shrink(38, 28)}>${rich(item.dek)}</div>
<div class="read label"><span class="arrow"></span>Read It on the Blog</div>`,
  }
}

/** `trade`: what a site for one trade has to let its customers do. */
export function tradeCard(item) {
  return {
    eyebrow: item.eyebrow,
    dark: item.dark,
    css: `
.content { justify-content: center; gap: 40px; }
.needs .label { margin-bottom: 8px; }
.need { display: flex; gap: 22px; align-items: baseline; padding: 22px 0; border-bottom: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.need::before { content: ''; flex: none; width: 10px; height: 10px; background: var(--accent); transform: translateY(-6px); }
.need span { line-height: 1.3; }`,
    inner: `
<div class="head" ${shrink(item.headSize ?? 92, 60)}>${rich(item.headline)}</div>
<div class="needs"><div class="label">${escape(item.listLabel)}</div>${item.items
      .map(entry => `<div class="need"><span ${shrink(36, 28)}>${rich(entry)}</span></div>`)
      .join('')}</div>`,
  }
}

/** `area`: one town we build in. */
export function areaCard(item) {
  return {
    eyebrow: item.eyebrow,
    dark: item.dark,
    css: `
.content { justify-content: center; gap: 34px; }
.town { font-weight: 600; letter-spacing: -0.045em; line-height: 0.9; white-space: nowrap; }
.title { font-weight: 600; letter-spacing: -0.02em; line-height: 1.12; }
.chips { display: flex; flex-wrap: wrap; gap: 12px; }
.chip { font-family: 'Geist Mono', monospace; font-size: 22px; letter-spacing: 0.06em; text-transform: uppercase; padding: 10px 16px; border: 1px solid rgba(var(--fg-rgb), 0.22); color: rgba(var(--fg-rgb), 0.7); }`,
    inner: `
<div class="town" ${shrink(item.townSize ?? 190, 110)}>${rich(item.town)}</div>
<div class="title" ${shrink(54, 40)}>${rich(item.title)}</div>
<div class="body" ${shrink(34, 27)}>${rich(item.lede)}</div>
<div class="chips">${item.chips.map(chip => `<span class="chip">${escape(chip)}</span>`).join('')}</div>`,
  }
}

/** `faq`: a question we get asked, and the short answer. */
export function faqCard(item) {
  return {
    eyebrow: item.eyebrow ?? 'Asked Often',
    dark: item.dark,
    css: `
.content { justify-content: center; gap: 46px; }
.q { display: flex; gap: 28px; align-items: flex-start; }
.q .mark-q { font-family: 'Geist Mono', monospace; font-weight: 500; font-size: 30px; color: var(--accent); padding-top: 14px; flex: none; }
.ans { padding-top: 40px; border-top: 1px solid rgba(var(--fg-rgb), var(--rule)); display: flex; gap: 28px; }
.ans .mark-q { font-family: 'Geist Mono', monospace; font-weight: 500; font-size: 30px; color: rgba(var(--fg-rgb), 0.45); padding-top: 6px; flex: none; }
.ans .body { color: rgba(var(--fg-rgb), 0.8); }`,
    inner: `
<div class="q"><span class="mark-q">Q.</span><div class="head" ${shrink(item.headSize ?? 92, 60)}>${rich(item.question)}</div></div>
<div class="ans"><span class="mark-q">A.</span><div class="body" ${shrink(40, 30)}>${rich(item.answer)}</div></div>`,
  }
}

// ---------------------------------------------------------------------------
// Cards drawn from live data, 1080 x 1350
// ---------------------------------------------------------------------------

/** The five points of a star, as a clip path, so a rating is drawn rather than typed. */
const STAR =
  'polygon(50% 0%, 61.2% 34.5%, 97.6% 34.5%, 68.2% 55.9%, 79.4% 90.5%, 50% 69.1%, 20.6% 90.5%, 31.8% 55.9%, 2.4% 34.5%, 38.8% 34.5%)'

/**
 * `review`: a client's own words from the Google listing, and the stars they gave.
 *
 * The quote is escaped rather than read as copy, because it is somebody else's
 * writing: an asterisk a reviewer typed is an asterisk, not an accent run. The
 * stars are shapes rather than characters, so no glyph a font or a guard could
 * read as an emoji stands in for the rating.
 */
export function reviewCard(item) {
  const stars = Array.from(
    { length: 5 },
    (_, index) => `<i class="star${index < item.stars ? ' on' : ''}"></i>`
  ).join('')
  return {
    eyebrow: item.eyebrow ?? 'Left on Google',
    counter: item.counter ?? '',
    dark: item.dark,
    css: `
.content { justify-content: center; gap: 48px; }
.stars { display: flex; gap: 16px; }
.star { width: 50px; height: 50px; background: rgba(var(--fg-rgb), 0.16); clip-path: ${STAR}; }
.star.on { background: var(--accent); }
.quote { display: flex; gap: 26px; align-items: flex-start; }
.quote .open { font-weight: 600; font-size: 150px; line-height: 0.78; color: var(--accent); flex: none; }
.quote .words { font-weight: 500; letter-spacing: -0.022em; line-height: 1.14; }
.by { padding-top: 30px; border-top: 1px solid rgba(var(--fg-rgb), var(--rule)); display: flex; flex-direction: column; gap: 14px; }`,
    inner: `
<div class="stars" role="img" aria-label="${item.stars} of 5 stars">${stars}</div>
<div class="quote"><span class="open">&ldquo;</span><div class="words" ${shrink(item.quoteSize ?? 70, 40)}>${escape(item.quote)}</div></div>
<div class="by"><div class="label">${escape(item.attribution)}</div><div class="note">${rich(item.source)}</div></div>`,
  }
}

/**
 * `proof`: the day's PageSpeed readings for the client sites the studio
 * keeps, each site by trade and town, with the average of both strategies.
 *
 * The table is the card. A reader is shown every reading the average was taken
 * over, so the two large figures are checkable against the rows under them
 * rather than being a number the studio asks to be taken on trust.
 */
export function proofCard(item) {
  // Past eight rows the table is set tighter and the figures above it smaller,
  // so a growing roster still fits one card rather than spilling onto a second
  // that would be read without the first.
  const dense = item.sites.length > 8
  const rows = item.sites
    .map(
      site =>
        `<div class="row"><span class="site" ${dense ? shrink(26, 19) : shrink(30, 22)}>${escape(site.label)}</span><span class="n">${site.mobile}</span><span class="n">${site.desktop}</span></div>`
    )
    .join('')
  const figure = dense ? shrink(130, 76) : shrink(190, 110)
  return {
    eyebrow: item.eyebrow ?? 'Measured by Google',
    counter: item.counter ?? '',
    dark: item.dark,
    css: `
.content { justify-content: center; gap: ${dense ? 22 : 34}px; }
.figs { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
.fig .v { font-weight: 600; letter-spacing: -0.05em; line-height: 0.86; color: var(--accent); white-space: nowrap; }
.fig .label { margin-top: ${dense ? 12 : 18}px; }
.table { display: flex; flex-direction: column; }
.row { display: grid; grid-template-columns: 1fr 130px 130px; align-items: baseline; gap: 16px; padding: ${dense ? 5 : 10}px 0; border-bottom: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.row.top { padding-top: 0; }
.row .n { font-family: 'Geist Mono', monospace; font-weight: 500; font-size: ${dense ? 24 : 28}px; text-align: right; }
.row.top .n { font-size: 21px; }
.row .site { font-weight: 450; line-height: 1.2; }`,
    inner: `
<div class="head" ${dense ? shrink(56, 40) : shrink(item.headSize ?? 66, 44)}>${rich(item.headline)}</div>
<div class="figs">
<div class="fig"><div class="v" ${figure}>${escape(item.mobile)}</div><div class="label">Phone, Average</div></div>
<div class="fig"><div class="v" ${figure}>${escape(item.desktop)}</div><div class="label">Desktop, Average</div></div>
</div>
<div class="table"><div class="row top label"><span>Trade and Town</span><span class="n">Phone</span><span class="n">Desktop</span></div>${rows}</div>
<div class="note">${rich(item.source)}</div>`,
  }
}

/**
 * The phone a launch is shown on: a bezel, an address bar carrying the site's
 * own address, and the page as a phone of 390 by 844 drew it.
 *
 * Drawn here rather than borrowed from the library's `.phone`, which is a
 * drawing of a site that does not exist and is shaped for one. This one holds
 * a picture of a real page, so its screen is the page's own shape, and the bar
 * above it says where the page was opened, which is the one thing a reader
 * would check.
 *
 * @param {object} options
 * @param {number} options.width The page's width on the sheet, in pixels.
 * @param {string} options.domain What the address bar reads.
 * @param {string} options.inner The picture: an `<img>` or a playing frame.
 */
function sitePhone({ width, domain, inner, at = null }) {
  const height = Math.round((width * 844) / 390)
  const bar = Math.round(width * 0.115)
  const lead = at === null ? '' : ` fx" data-fx="fade" data-at="${at}`
  return `<div class="lp${lead}" style="--lp-w:${width}px;--lp-h:${height}px;--lp-bar:${bar}px"><div class="lp-screen"><div class="lp-bar"><span class="lp-lock"></span>${escape(domain)}</div><div class="lp-page">${inner}</div></div></div>`
}

/** The phone's own measures, shared by the still and the video. */
const PHONE_CSS = `
.lp { flex: none; align-self: center; padding: calc(var(--lp-w) * 0.031); border-radius: calc(var(--lp-w) * 0.14); background: #141413; box-shadow: 0 40px 80px rgba(20,20,19,0.18); }
.lp-screen { width: var(--lp-w); border-radius: calc(var(--lp-w) * 0.11); overflow: hidden; background: #fff; }
.lp-bar { height: var(--lp-bar); display: flex; align-items: center; justify-content: center; gap: calc(var(--lp-bar) * 0.22); background: #efeee9; color: #3d3d3a; font-family: 'Geist Mono', monospace; font-size: calc(var(--lp-bar) * 0.4); letter-spacing: 0.01em; white-space: nowrap; overflow: hidden; }
.lp-lock { width: calc(var(--lp-bar) * 0.26); height: calc(var(--lp-bar) * 0.2); border-radius: 2px; background: #3d3d3a; position: relative; transform: translateY(calc(var(--lp-bar) * 0.05)); }
.lp-lock::before { content: ''; position: absolute; left: 18%; right: 18%; bottom: 80%; height: 75%; border: 2px solid #3d3d3a; border-bottom: 0; border-radius: 99px 99px 0 0; }
.lp-page { width: var(--lp-w); height: var(--lp-h); background: #fff; }
.lp-page img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }`

/**
 * `launch`: a client's new site, said without naming them.
 *
 * Used where the client did not say yes to being shown, so it carries no name,
 * no address and no picture of the site: what the business is and where, the
 * three things the site lets its customers do, and the day it went live.
 */
export function launchCard(item) {
  return {
    eyebrow: item.eyebrow ?? 'Just Launched',
    counter: item.counter ?? '',
    dark: item.dark,
    css: `
.content { justify-content: center; gap: 44px; }
.needs .label { margin-bottom: 8px; }
.need { display: flex; gap: 22px; align-items: baseline; padding: 22px 0; border-bottom: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.need::before { content: ''; flex: none; width: 10px; height: 10px; background: var(--accent); transform: translateY(-6px); }
.need span { line-height: 1.3; }`,
    inner: `
<div class="head" ${shrink(item.headSize ?? 92, 60)}>${rich(item.headline)}</div>
<div class="needs"><div class="label">${escape(item.listLabel)}</div>${item.items
      .map(entry => `<div class="need"><span ${shrink(38, 28)}>${escape(entry)}</span></div>`)
      .join('')}</div>
<div class="note">${escape(item.source)}</div>`,
  }
}

/**
 * `launch-site`: a client's new site, by name, with the site itself on a phone.
 *
 * The still the Business Profile carries for a launch the client said yes to,
 * because a profile post takes no video. The page on the phone is the site as
 * it stood once loaded, photographed on the same emulated phone the video
 * records, and the column beside it is the same three lines the video carries.
 */
export function launchSiteCard(item) {
  return {
    eyebrow: item.eyebrow ?? 'Just Launched',
    counter: item.counter ?? '',
    dark: item.dark,
    css: `${PHONE_CSS}
.lp { box-shadow: none; }
.content { flex-direction: row; align-items: center; gap: 44px; }
.side { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 30px; align-self: stretch; }
.needs .label { margin-bottom: 4px; }
.need { display: flex; gap: 18px; align-items: baseline; padding: 16px 0; border-bottom: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.need::before { content: ''; flex: none; width: 9px; height: 9px; background: var(--accent); transform: translateY(-5px); }
.need span { line-height: 1.28; }`,
    inner: `
<div class="side">
<div class="head" ${shrink(item.headSize ?? 76, 44)}>${rich(item.headline)}</div>
<div class="needs"><div class="label">${escape(item.listLabel)}</div>${item.items
      .map(entry => `<div class="need"><span ${shrink(30, 22)}>${escape(entry)}</span></div>`)
      .join('')}</div>
<div class="note">${escape(item.source)}</div>
</div>
${sitePhone({ width: 330, domain: item.domain, inner: `<img src="${item.shot}" alt="">` })}`,
  }
}

// ---------------------------------------------------------------------------
// Carousel slides, 1080 x 1350
// ---------------------------------------------------------------------------

/** The first slide: what the set is about, and a nudge to swipe. */
export function coverSlide(set, total) {
  return {
    eyebrow: set.eyebrow,
    counter: `01 / ${String(total).padStart(2, '0')}`,
    dark: set.dark,
    css: `
.content { justify-content: center; gap: 44px; }
.swipe { display: flex; align-items: center; gap: 18px; }
.swipe .bar { width: 120px; height: 2px; background: var(--accent); position: relative; }
.swipe .bar::after { content: ''; position: absolute; right: 0; top: -7px; width: 14px; height: 14px; border-top: 2px solid var(--accent); border-right: 2px solid var(--accent); transform: rotate(45deg); transform-origin: 70% 30%; }`,
    inner: `
<div class="head" ${shrink(set.coverSize ?? 120, 70)}>${rich(set.cover)}</div>
<div class="body" ${shrink(38, 28)}>${rich(set.sub)}</div>
<div class="swipe label"><span class="bar"></span>Swipe Through</div>`,
  }
}

/** A content slide: one or two numbered points. */
export function pointsSlide(set, slide, index, total) {
  const one = slide.points.length === 1
  return {
    eyebrow: set.eyebrow,
    counter: `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
    dark: set.dark,
    css: `
.content { justify-content: center; gap: ${one ? 0 : 56}px; }
.point { display: flex; flex-direction: column; gap: 22px; }
.point + .point { padding-top: 56px; border-top: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.point .n { font-family: 'Geist Mono', monospace; font-weight: 500; font-size: ${one ? 34 : 28}px; color: var(--accent); letter-spacing: 0.08em; }
.point .head { line-height: 1.02; }`,
    inner: slide.points
      .map(
        point => `
<div class="point"><div class="n">${escape(point.n)}</div>
<div class="head" ${shrink(one ? 104 : 74, 52)}>${rich(point.title)}</div>
<div class="body" ${shrink(one ? 40 : 35, 27)}>${rich(point.body)}</div></div>`
      )
      .join(''),
  }
}

/** The last slide: where the rest of it lives. */
export function closeSlide(set, total) {
  return {
    eyebrow: set.eyebrow,
    counter: `${String(total).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
    dark: true,
    css: `
.content { justify-content: center; gap: 44px; }
.path { font-family: 'Geist Mono', monospace; font-size: 34px; letter-spacing: 0.02em; color: var(--accent); padding: 26px 0; border-top: 1px solid rgba(var(--fg-rgb), var(--rule)); border-bottom: 1px solid rgba(var(--fg-rgb), var(--rule)); }`,
    inner: `
<div class="head" ${shrink(112, 70)}>${rich(set.close.headline)}</div>
<div class="body" ${shrink(38, 28)}>${rich(set.close.body)}</div>
<div class="path" ${shrink(34, 24)}>${escape(set.close.path)}</div>`,
  }
}

// ---------------------------------------------------------------------------
// Videos, 1080 x 1920
// ---------------------------------------------------------------------------

/**
 * The CSS every video shares. A scene is a layer over the content box; the
 * runtime fades whole scenes and moves the pieces inside them, and nothing is
 * left to a CSS animation, because a frame has to be the same frame every time
 * it is asked for.
 */
export const VIDEO_CSS = `
.content { overflow: hidden; }
.scene { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 48px; opacity: 0; }
.scene.top { gap: 64px; }
.w { display: inline-block; }
.fx { will-change: transform, opacity; }
.vhead { font-weight: 600; letter-spacing: -0.03em; line-height: 1.0; }
.vbody { font-size: 50px; line-height: 1.34; color: rgba(var(--fg-rgb), var(--soft)); }
.vfig { font-weight: 600; letter-spacing: -0.055em; line-height: 0.85; color: var(--accent); white-space: nowrap; font-variant-numeric: tabular-nums; }
.vlabel { font-family: 'Geist Mono', monospace; font-weight: 500; font-size: 28px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(var(--fg-rgb), var(--label)); }
.vnote { font-family: 'Geist Mono', monospace; font-size: 26px; line-height: 1.5; color: rgba(var(--fg-rgb), 0.5); }
.vstep { display: flex; gap: 34px; align-items: baseline; padding: 42px 0; border-top: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.vstep .n { font-family: 'Geist Mono', monospace; font-weight: 500; font-size: 34px; color: var(--accent); width: 60px; flex: none; }
.vstep .t { font-size: 58px; font-weight: 500; line-height: 1.2; }
.vsteps .vstep:last-child { border-bottom: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.vstep .box { width: 44px; height: 44px; border: 3px solid rgba(var(--fg-rgb), 0.35); flex: none; align-self: center; position: relative; }
.vstep .box i { position: absolute; inset: 6px; background: var(--accent); transform: scale(0); }
.strike { display: inline; background-image: linear-gradient(var(--accent), var(--accent)); background-repeat: no-repeat; background-position: 0 56%; background-size: 0% 12px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.vbelief { font-weight: 600; letter-spacing: -0.035em; line-height: 1.04; color: rgba(var(--fg-rgb), 0.45); position: relative; }
.vtrack { height: 72px; background: rgba(var(--fg-rgb), 0.08); position: relative; }
.vfill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: rgba(var(--fg-rgb), 0.32); }
.vfill.after { background: var(--accent); }
.vrow { display: flex; flex-direction: column; gap: 26px; padding: 24px 0; }
.vrow .top { display: flex; justify-content: space-between; align-items: baseline; }
.vrow .score { font-weight: 600; font-size: 170px; letter-spacing: -0.04em; line-height: 0.9; font-variant-numeric: tabular-nums; }
.vrow.after .score { color: var(--accent); }
.vrow.before .score { color: rgba(var(--fg-rgb), 0.45); }
.vpath { font-family: 'Geist Mono', monospace; font-size: 44px; color: var(--accent); padding: 34px 0; border-top: 1px solid rgba(var(--fg-rgb), var(--rule)); border-bottom: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.roll { position: relative; height: 1100px; overflow: hidden; -webkit-mask-image: linear-gradient(transparent, #000 18%, #000 82%, transparent); mask-image: linear-gradient(transparent, #000 18%, #000 82%, transparent); }
.roll .list { position: absolute; left: 0; right: 0; top: 0; }
.roll .item { height: 120px; display: flex; align-items: center; gap: 30px; font-size: 76px; font-weight: 600; letter-spacing: -0.03em; border-bottom: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.roll .item::before { content: ''; width: 14px; height: 14px; background: var(--accent); flex: none; }
.timeline { display: flex; flex-direction: column; }
.tl-step { display: grid; grid-template-columns: 80px 1fr auto; gap: 24px; align-items: baseline; padding: 46px 0; border-top: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.tl-step:last-child { border-bottom: 1px solid rgba(var(--fg-rgb), var(--rule)); }
.tl-step .n { font-family: 'Geist Mono', monospace; font-weight: 500; font-size: 36px; color: var(--accent); }
.tl-step .t { font-size: 70px; font-weight: 600; letter-spacing: -0.025em; }
.tl-step .d { font-family: 'Geist Mono', monospace; font-size: 30px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(var(--fg-rgb), 0.55); }
.phone { align-self: center; width: 560px; height: 1120px; border-radius: 72px; background: #141413; padding: 18px; position: relative; box-shadow: 0 40px 80px rgba(20,20,19,0.18); }
.phone .screen { position: absolute; inset: 18px; border-radius: 56px; overflow: hidden; background: #fbfaf7; }
.phone .status { position: absolute; left: 0; right: 0; top: 0; height: 96px; background: #fbfaf7; z-index: 2; }
.phone .notch { position: absolute; top: 34px; left: 50%; width: 150px; height: 40px; margin-left: -75px; border-radius: 20px; background: #141413; z-index: 3; }
.mock { position: absolute; left: 0; right: 0; top: 0; padding: 110px 34px 200px; color: #141413; }
.mock .bar { height: 22px; border-radius: 4px; background: rgba(20,20,19,0.12); margin-bottom: 14px; }
.mock .logo { width: 150px; height: 30px; border-radius: 6px; background: rgba(20,20,19,0.8); margin-bottom: 40px; }
.mock h3 { font-size: 46px; line-height: 1.05; letter-spacing: -0.02em; font-weight: 600; margin-bottom: 22px; }
.mock .card { border: 1px solid rgba(20,20,19,0.14); border-radius: 18px; padding: 26px; margin-top: 22px; background: #fff; }
.mock .card b { display: block; font-size: 30px; font-weight: 600; margin-bottom: 14px; }
.mock .photo { height: 230px; border-radius: 14px; background: linear-gradient(135deg, rgba(26,78,216,0.16), rgba(20,20,19,0.08)); margin: 26px 0 8px; }
.callbar { position: absolute; left: 22px; right: 22px; bottom: 26px; height: 104px; border-radius: 28px; background: #1a4ed8; color: #fff; display: flex; align-items: center; justify-content: center; gap: 18px; font-size: 36px; font-weight: 600; z-index: 4; }
.callbar svg { width: 36px; height: 36px; }
.ring { position: absolute; left: 22px; right: 22px; bottom: 26px; height: 104px; border-radius: 28px; border: 4px solid #1a4ed8; z-index: 3; opacity: 0; }
`

/**
 * A video's page: the chassis with every scene stacked in the content box, and
 * the timeline the runtime seeks through.
 */
export function videoPage(video, shared, runtime) {
  // A video that plays recorded pictures carries them as data, handed to the
  // runtime before it runs, so a frame never waits on a request.
  const frames = video.frames
    ? `window.__frameSets = ${JSON.stringify(video.frames).replace(/</g, '\\u003c')};\n`
    : ''
  const inner = video.scenes
    .map(
      (scene, index) =>
        `<div class="scene ${scene.align ?? ''}" data-scene="${index}" data-from="${scene.from}" data-to="${scene.to}"${scene.hold ? ' data-hold="1"' : ''}>${scene.html}</div>`
    )
    .join('')
  return page(
    {
      size: VIDEO,
      eyebrow: video.eyebrow,
      counter: video.counter ?? '',
      dark: video.dark,
      inner,
      css: `${VIDEO_CSS}${video.css ?? ''}`,
      progress: true,
    },
    shared,
    `${frames}${runtime}\nwindow.__duration = ${video.duration};`
  )
}

/** Pieces a video scene is assembled from. Each takes `at`, seconds into its scene. */
export const fx = {
  label: (text, at = 0) =>
    `<div class="vlabel fx" data-fx="fade" data-at="${at}">${rich(text)}</div>`,
  head: (text, at = 0, size = 120) =>
    `<div class="vhead" data-fx="words" data-at="${at}" ${shrink(size, 70)}>${words(text)}</div>`,
  body: (text, at = 0, size = 50) =>
    `<div class="vbody fx" data-fx="fade" data-at="${at}" ${shrink(size, 36)}>${rich(text)}</div>`,
  note: (text, at = 0) =>
    `<div class="vnote fx" data-fx="fade" data-at="${at}">${rich(text)}</div>`,
  figure: (to, { at = 0, from = 0, suffix = '', decimals = 0, dur = 1.6, size = 400 } = {}) =>
    `<div class="vfig fx" data-fx="count" data-at="${at}" data-from="${from}" data-to="${to}" data-dur="${dur}" data-decimals="${decimals}" data-suffix="${escape(suffix)}" ${shrink(size, 200)}>${from}${escape(suffix)}</div>`,
  steps: (steps, at = 0, every = 2.4, boxes = true) =>
    `<div class="vsteps">${steps
      .map(
        (step, index) =>
          `<div class="vstep fx" data-fx="fade" data-at="${at + index * every}">${
            boxes
              ? `<span class="box"><i class="fx" data-fx="pop" data-at="${at + index * every + 1.1}"></i></span>`
              : `<span class="n">${String(index + 1).padStart(2, '0')}</span>`
          }<span class="t" ${shrink(58, 38)}>${rich(step)}</span></div>`
      )
      .join('')}</div>`,
  belief: (text, at = 0, strikeAt = 1.6, size = 130) =>
    `<div class="vbelief fx" data-fx="fade" data-at="${at}" ${shrink(size, 80)}><span class="strike" data-fx="strike" data-at="${strikeAt}">${escape(text)}</span></div>`,
  bar: (label, score, { at = 0, after = false, dur = 1.6 } = {}) =>
    `<div class="vrow ${after ? 'after' : 'before'} fx" data-fx="fade" data-at="${at}">
  <div class="top"><span class="vlabel">${escape(label)}</span><span class="score fx" data-fx="count" data-at="${at + 0.3}" data-from="0" data-to="${score}" data-dur="${dur}" data-decimals="0" data-suffix="">0</span></div>
  <div class="vtrack"><div class="vfill ${after ? 'after' : ''} fx" data-fx="bar" data-at="${at + 0.3}" data-to="${score}" data-dur="${dur}"></div></div>
</div>`,
  path: (text, at = 0) =>
    `<div class="vpath fx" data-fx="type" data-at="${at}" data-text="${escape(text)}"></div>`,
}

/**
 * `launch`: the video a launch the client said yes to goes out as, about
 * fifteen seconds long.
 *
 * Three scenes. The business's name over the site loading on a phone, played
 * as it was recorded, then a slow scroll down the page once it has settled; the
 * three things the site lets its customers do; and who built it, with the
 * number. The first scene is already standing at the first frame, because the
 * first frame is the cover a feed shows before anybody presses play, and a
 * cover of an empty sheet says nothing.
 *
 * @param {object} item
 * @param {string} item.key What a refusal names.
 * @param {string} item.name The business, as the client wrote it.
 * @param {string} item.domain The site's address, as the phone's bar reads it.
 * @param {string[]} item.lines The three lines, as the card sets them.
 * @param {{at: number, src: string}[]} item.frames The recording, from
 *   `frameTimeline`, timed from the moment it starts playing, half a second in.
 * @param {string} item.counter The date in the top rail.
 * @param {string} item.close The last scene's line, and `path` what types under it.
 */
export function launchClip(item) {
  const play = 0.5
  const opens = -0.5
  return {
    key: item.key,
    eyebrow: 'Just Launched',
    counter: item.counter,
    duration: 15,
    poster: 3,
    css: `${PHONE_CSS}
.scene.launch { gap: 40px; }`,
    frames: { site: item.frames },
    scenes: [
      {
        from: opens,
        to: 8.6,
        align: 'launch',
        // The name is the client's and can run long, so its floor sits below
        // the library's: a name on four lines still leaves the phone its room.
        html: `<div class="vhead" data-fx="words" data-at="-1" ${shrink(92, 52)}>${words(`*${item.name}* is live.`)}</div>${sitePhone(
          {
            width: 500,
            domain: item.domain,
            at: -1,
            inner: `<img class="fx" data-fx="frames" data-frames="site" data-at="${play - opens}" alt="">`,
          }
        )}${fx.note('I opened the site on a mid-range phone over 4G.', 0.6)}`,
      },
      {
        from: 8.6,
        to: 12.4,
        align: 'top',
        html: `${fx.head('What customers can *do* now.', 0.1, 104)}${fx.steps(item.lines, 0.8, 0.8, false)}`,
      },
      {
        from: 12.4,
        to: 15,
        hold: true,
        html: `${fx.head(item.close, 0.1, 104)}${fx.path(item.path, 0.9)}`,
      },
    ],
  }
}
