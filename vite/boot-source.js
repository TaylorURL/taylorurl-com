/**
 * The one `import()` on this site that nobody was holding.
 *
 * `check-chunk-recovery` sweeps `src/app` for a bare `import()` because a
 * rejection with nothing holding it reaches `unhandledrejection`, is filed as a
 * fault a reader met, and recovers nothing. It never read this file, and the
 * import written here is the whole application: every hashed chunk on the site
 * hangs off it, so the one that was written the least carefully was the one
 * that could take the most with it.
 *
 * What it costs is invisible from the outside, which is why it stood. The
 * document is finished markup - eighty links that answer on their own and
 * twenty-eight controls that do not - so a boot that never lands leaves a page
 * that looks entirely correct and does nothing when it is pressed. Nothing is
 * blank, nothing says so, and the reader reads it as a site that ignores them.
 *
 * Three failures reach here and they want different answers:
 *
 * A fetch that did not land. Asked again a third of a second later it usually
 * does - at a `retry` address, because the module map files a rejection against
 * a URL and hands the same one back forever, so repeating the address sends
 * nothing. The marker is the one `lazyWithRetry` and the capture frames use,
 * and the reporter strips it before filing so the attempts stay one fault.
 *
 * The number alone is not enough to make that address new, and this is the
 * second layer rather than a detail of the first. A count that restarts at 0 in
 * every document has every document asking at the same handful of addresses,
 * and the refusals are kept: `vercel.json` stamps `public, max-age=31536000,
 * immutable` on everything under /assets/ by path pattern, which Vercel applies
 * whatever the status, so a 404 at one of those addresses is one the browser is
 * told to hold for a year without revalidating. The reload below then asks at
 * addresses the cache already answers, gets the refusal back with nothing sent,
 * and the reader is on a dead document on every visit until the hash changes.
 * The per-document token is what stops the ladder inheriting the last
 * document's answers; see `lazyWithRetry.js`, where the same thing was measured
 * end to end. #570 was that.
 *
 * A chunk a deploy has deleted. No address recovers it, because the name is
 * gone from the disk it was served off; only a newer document carries the name
 * that replaced it. So the document is asked for again, once per tab, and the
 * flag clearing on a start that succeeds is what lets a second deploy an hour
 * later be recovered the same way. A document that is itself stale in a cache
 * comes back identical and does not get a second reload. Nor does a reader the
 * browser knows is offline: the document in front of them is readable and the
 * one a reload would put there is the browser's own network page.
 *
 * A bundle the engine cannot parse. It parses no better at another address and
 * no better after a reload - a reload is how that becomes an endless one - so
 * it is neither retried nor reloaded. #525 was this: a `SyntaxError` on a token
 * every browser the site targets has understood since 2020, off a client years
 * older than the syntax, and the bare import filed it with no sentence on it.
 *
 * That last one is two different faults wearing one error, and which it is the
 * page can settle for itself. A build that ships broken syntax is refused by
 * every engine on earth and has to be filed the moment it reaches one. An
 * engine from before the syntax refuses a build that is perfectly good, and
 * will refuse every build this site ever ships, because es2022 is a decision
 * `vite.config.js` states and defends. Filing the second is filing a fault
 * against the site for a browser the site has already declined to support, and
 * it files a fresh one on every visit: the message is the fingerprint, so the
 * count that would show a reader what it is never accumulates. #525 and #532
 * are one client class, seven hours and two data-centre addresses apart, and
 * they arrived as two unrelated first sightings.
 *
 * So the entry's `SyntaxError` is put to the engine directly: compile the
 * syntax the bundle is built out of, here, now. Refused, the engine cannot run
 * any build of this site and the reader is told so - the one thing they were
 * never given, on a document that is eighty readable links and twenty-eight
 * controls that will not answer. Compiled, the engine is one this site targets
 * and the fault is the deploy's, which is filed exactly as loudly as before.
 *
 * The probe is `Function` rather than a literal because a literal is read by
 * the same parser as the file around it, and a boot that cannot parse itself
 * never runs to report anything. A page whose policy refuses `Function` throws
 * something other than a `SyntaxError`, which is not the engine failing to
 * understand the syntax, so it is filed rather than blamed on the reader.
 *
 * When none of that lands the failure is re-thrown rather than swallowed. It
 * still reaches the reporter, and it now arrives saying which of the three it
 * was instead of reading as whatever the engine happened to say.
 *
 * And one more ask, on the far side of the reload rather than beside it.
 *
 * The quick pair is for a request that was dropped and lands on the next one,
 * and the whole of it is over inside eleven hundred milliseconds. The outages
 * this actually meets last two or three seconds - an edge that has not got the
 * new build yet, a phone changing networks, a proxy refusing for a moment - so
 * a ladder that finishes in one second is a ladder spent entirely inside the
 * outage. `lazyWithRetry` and the stylesheet were each given a rung five
 * seconds out for exactly that reading, and the entry was the last one asking
 * three times in a second.
 *
 * It goes after the reload and not before it, which is the whole of the
 * placement. A chunk a deploy has deleted is gone from every address, so five
 * seconds spent asking is five seconds of a reader sitting on dead controls
 * while the one recovery that works waits its turn. The reload comes first and
 * comes at once. The rung is for the case where it is not available at all -
 * spent on this tab already, refused by a browser that will not give the boot
 * storage, or useless to a reader the browser knows is offline - and there the
 * asking is not delaying anything, because there is nothing else left.
 *
 * #562 was that gap: three asks gone by 1,069ms, no reload to be had, and the
 * file answering from three seconds with nothing left to ask it.
 *
 * Spent, the reader is told. A boot that never landed leaves the finished
 * document this file opens by describing - eighty links that answer and
 * twenty-eight controls that do not - and until now the only reader ever given
 * a sentence about it was the one on a browser too old to run the bundle.
 * Everybody else got the same dead page with nothing said, which is the state
 * the notice exists for. A build that shipped broken syntax is still told
 * nothing here, because the sentence would be a guess: the page is not coming
 * back on a reload and the reader's browser is not the reason.
 */
export function bootSource(src) {
  return `(function(){
var entry=${JSON.stringify(src)}
var RELOADED='taylorurl.boot.reload'
var WAIT_MS=5000
var TOO_OLD='This browser is too old to run this page. Its links still work. To use the buttons and forms, update it or open the page in a newer browser.'
var STALLED='This page did not finish loading. Its links still work. To use the buttons and forms, reload the page.'
var attempts=0
var TOKEN=Math.random().toString(36).slice(2,8)
function mark(n){return entry+'?retry='+n+'.'+TOKEN}
function parseFailure(error){return Boolean(error)&&error.name==='SyntaxError'}
function tooOld(){
try{Function('return {}?.a ?? 0');return false}
catch(error){return Boolean(error)&&error.name==='SyntaxError'}
}
function notice(words){
try{
var bar=document.createElement('div')
bar.setAttribute('role','status')
bar.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483647;margin:0;padding:12px 16px;background:#111214;color:#ffffff;font:400 14px/1.45 system-ui,-apple-system,Segoe UI,Arial,sans-serif;text-align:center'
bar.textContent=words
document.body.appendChild(bar)
}catch(ignored){}
}
function start(address){
return import(address).catch(function(error){
if(parseFailure(error)||attempts>=2)throw error
attempts+=1
return new Promise(function(resolve){setTimeout(resolve,350*attempts)}).then(function(){
return start(mark(attempts))
})
})
}
function once(){
try{
if(sessionStorage.getItem(RELOADED))return false
sessionStorage.setItem(RELOADED,'1')
return true
}catch(ignored){return false}
}
function done(){try{sessionStorage.removeItem(RELOADED)}catch(ignored){}}
function lost(error){
if(parseFailure(error)){if(tooOld()){notice(TOO_OLD);return}}
else notice(STALLED)
var said=(error&&error.message)||String(error)
return Promise.reject(new Error('The page could not start: '+said))
}
requestAnimationFrame(function(){requestAnimationFrame(function(){
start(entry).then(done,function(error){
if(parseFailure(error))return lost(error)
if(navigator.onLine!==false&&once()){location.reload();return}
attempts+=1
var late=mark(attempts)
return new Promise(function(resolve){setTimeout(resolve,WAIT_MS)}).then(function(){
return start(late).then(done,lost)
})
})
})})
})()`
}
