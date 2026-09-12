/**
 * The one subresource on this site that nobody was catching.
 *
 * Every hashed file the page asks for has a recovery behind it. A route chunk
 * has `lazyWithRetry`, a piece of chrome has `QuietBoundary`, and the import
 * the whole application hangs off has `bootSource`, which asks again twice and
 * then asks for the document. The stylesheet had none of the three: it was
 * asked for once, and whatever came back was the answer for the life of the
 * page.
 *
 * What that costs is hidden by the thing that makes the page fast. Beasties
 * writes the rules this route's markup needs into a `<style>` in the head and
 * leaves the sheet itself on `media="print"`, fetched without holding the
 * paint and switched to `all` when it lands. A sheet that never lands never
 * switches, so `onload` simply does not fire and nothing anywhere says so. The
 * reader is left on the inlined subset: 462 of the stylesheet's 1735 rules,
 * measured on `/services`.
 *
 * On the route the subset was computed for that is very nearly invisible,
 * which is why it stood - the markup Beasties read is the markup on the
 * screen, so it is dressed. The damage is in the next thing the reader does.
 * A route reached without a new document is rendered against the previous
 * route's subset, and `/portfolio` reached that way computes differently on
 * 10.3% of its elements: headings at 16px where the page sets 32, a section
 * that should stand 144px off its neighbour flush against it, the rules under
 * the rows gone. Every panel, dialog and hover state after that is in the
 * sheet alone.
 *
 * So the sheet is asked again, at a `retry` address for the same reason the
 * boot uses one - a link that failed is a URL the browser has an answer for,
 * and the reporter strips the marker in `settled` so the attempts stay one
 * fault rather than three tickets.
 *
 * The attempt number carries a token drawn once per document, because the
 * number on its own restarts at 1 in every document and so names the same three
 * addresses every time. A 404 under /assets/ is served `public,
 * max-age=31536000, immutable` - `vercel.json` matches by path and Vercel
 * applies a header rule whatever the status - so a document that spent its
 * ladder during an outage leaves three refusals in the browser's cache for a
 * year, and the next document's ladder is answered out of them without sending
 * anything. The token is what makes the second document's attempts requests
 * rather than replays. It rides inside the `retry` value rather than beside it
 * as a parameter of its own, so `settled` still drops the whole marker and the
 * fault still files at the address the build wrote. #570 is where that was
 * measured.
 *
 * Twice quickly, and then once more on a wait, and the two are counted apart.
 * The quick pair is for a request that was dropped and lands on the next ask;
 * they are spent 350ms and 700ms after the first failure, so the whole of them
 * is over inside eleven hundred milliseconds. The failures this actually sees
 * last two or three seconds - a laptop changing networks, a phone leaving a
 * lift, a proxy that refuses for a moment - and a recovery that finishes in one
 * second is a recovery spent entirely inside the outage. Served this build and
 * refused for three seconds, all three of those attempts went while the file
 * was still refusing, the file answered a second and a half later, and nobody
 * asked it again: the reader sat on 397 of the stylesheet's rules for the life
 * of the page with the sheet on the server the whole time. So there is a third
 * attempt five seconds out, which is the same reading `LateChrome` was given
 * for the chunk and the same interval, and it is what carries the recovery past
 * the outage rather than into it.
 *
 * It does not reload the document. A sheet a deploy has deleted is gone from
 * every address, and the file that would replace it is named only in a newer
 * document - but that deploy took the entry bundle with it, so `bootSource` is
 * already asking for that document one frame later. Reloading here as well
 * would be a second tab-wide reload racing the first over the same deploy, and
 * on a sheet that failed for any other reason it would be a reload that fixes
 * nothing and can happen again. The retry is what answers the failure this
 * actually sees: a sheet that is still on the server, still answering, and did
 * not arrive this once.
 *
 * The fault is filed here, when the ladder is spent, rather than by the
 * reporter when the first request fails. Every other recovery on the site
 * reports that way round - `bootSource` rejects only after its retries and its
 * reload, `lazyWithRetry` reports on the last attempt - and the sheet was the
 * one that reported at attempt zero, before its own recovery had run. A sheet
 * that failed once and arrived on the retry left the reader fully dressed and
 * filed a ticket that read exactly like a stylesheet nobody could load, which
 * is what #543 was: a fault against a page that was never broken, carrying the
 * history of one that had been. Held while the attempts run and filed when they
 * are gone, the ticket means the thing its title says.
 *
 * And asked for at a priority that will not be declined. `media="print"` is
 * what makes the first request cheap: the browser is told the sheet is not
 * needed for this medium and gives it the lowest priority it has. Every
 * attempt after the first inherited that from the link it replaced, so the
 * recovery for a reader who had already lost their styling was three further
 * requests in exactly the class a client short of time or bandwidth drops
 * first - the same reading the reporter applies to a hint, where being the
 * first thing dropped when something has to give is what the priority is for.
 * Measured in Chromium against this build, the sheet and all three of its
 * retries went out at VeryLow, and the same file asked for as an ordinary
 * stylesheet went out at VeryHigh. That is #555: the one VeryLow request on
 * the page refused four times across six seconds while the file answered 200
 * at each of those four addresses, to every other caller, throughout.
 *
 * `fetchpriority` is what raises it, and it is raised on the attempts alone.
 * Taking `media="print"` off would raise it further, to VeryHigh, by making
 * the attempt an ordinary stylesheet - and an ordinary stylesheet inserted
 * into the head holds the paint until it settles, which is the cost the
 * inlining exists to avoid and a worse thing to hand a reader whose page has
 * already painted. High, and still deferred, is the whole of what is wanted.
 *
 * Written as an attribute on the link rather than a listener attached beside
 * it. A `load` or `error` on a subresource is dispatched whenever the network
 * settles it, which can be before any script in the head has run; an attribute
 * is on the element from the moment the parser reads the tag, so there is no
 * window where the sheet can fail unwatched.
 *
 * The sheet the document was served with is left in the head, dead, rather
 * than swapped out for the attempt that replaces it. Rollup's preload helper
 * skips a stylesheet it can already find by exact href and appends its own
 * when it cannot, so a head holding `index-Cekis8dW.css?retry=1` and nothing
 * at the plain address gets a second copy of the address that has just failed
 * - which fails again, files again, and rejects the chunk import that asked
 * for it. A stylesheet failing is then a route failing, which is a good deal
 * worse than the thing being fixed. Left where it is, the helper finds it and
 * appends nothing; it has already failed, so it fetches nothing further and
 * dresses nothing. Only a link this recovery wrote itself is cleared away,
 * which is what `data-sheet` distinguishes.
 */

// What the link is rewritten to call. Short, because it is written into the
// markup of every prerendered page on the site.
export const SHEET_HANDLER = '__sheetLost'

// The sheet as Beasties leaves it: fetched on a media query that matches
// nothing and switched on when it lands. The copy in the `<noscript>` beside it
// carries no media and is not matched, which is right - it is the sheet for a
// reader running no script, and no script could recover it for them anyway.
const DEFERRED_SHEET = /<link\b(?=[^>]*\brel="stylesheet")(?=[^>]*\bmedia="print")[^>]*>/g

export function sheetSource() {
  return `(function(){
var ATTEMPTS=2
var WAITS=1
var WAIT_MS=5000
var TOKEN=Math.random().toString(36).slice(2,8)
function swap(link,attempt){
var href=link.getAttribute('data-sheet')||link.href
var next=document.createElement('link')
next.rel='stylesheet'
if(link.crossOrigin)next.crossOrigin=link.crossOrigin
next.media=link.media||'print'
next.setAttribute('data-sheet',href)
next.setAttribute('onload',"this.media='all'")
next.setAttribute('fetchpriority','high')
next.setAttribute('onerror',${JSON.stringify(SHEET_HANDLER + '(this,')}+attempt+')')
next.href=href+(href.indexOf('?')<0?'?':'&')+'retry='+attempt+'.'+TOKEN
if(!link.parentNode)return
link.parentNode.insertBefore(next,link.nextSibling)
if(link.getAttribute('data-sheet'))link.parentNode.removeChild(link)
else link.removeAttribute('onerror')
}
function lost(link){
var href=link.getAttribute('data-sheet')||link.href
setTimeout(function(){
throw new Error('The page could not load its stylesheet: '+href)
})
}
window.${SHEET_HANDLER}=function(link,attempt){
var made=Number(attempt||0)+1
if(!link)return
if(made>ATTEMPTS+WAITS){lost(link);return}
setTimeout(function(){swap(link,made)},made>ATTEMPTS?WAIT_MS:350*made)
}
})()`
}

/**
 * Puts the catch on every sheet Beasties deferred, and the handler ahead of
 * the first of them.
 *
 * Ahead rather than beside. The attribute is on the element as soon as the
 * parser reads the tag, which is what makes it race-free, but it names a
 * function - and a function not yet defined when the error dispatches is a
 * `ReferenceError` in place of the retry. Declaring it first costs the parser
 * a few hundred bytes it is already reading several kilobytes of inline script
 * through.
 */
export function sheetRecovery(html) {
  let seen = 0
  return String(html).replace(DEFERRED_SHEET, tag => {
    seen += 1
    const watched = /\bonerror=/.test(tag)
      ? tag
      : tag.replace(/>$/, ` onerror="${SHEET_HANDLER}(this,0)">`)
    return seen === 1 ? `<script>${sheetSource()}</script>${watched}` : watched
  })
}
