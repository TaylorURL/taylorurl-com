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
 * When none of that lands the failure is re-thrown rather than swallowed. It
 * still reaches the reporter, and it now arrives saying which of the three it
 * was instead of reading as whatever the engine happened to say.
 */
export function bootSource(src) {
  return `(function(){
var entry=${JSON.stringify(src)}
var RELOADED='taylorurl.boot.reload'
var attempts=0
function parseFailure(error){return Boolean(error)&&error.name==='SyntaxError'}
function start(address){
return import(address).catch(function(error){
if(parseFailure(error)||attempts>=2)throw error
attempts+=1
return new Promise(function(resolve){setTimeout(resolve,350*attempts)}).then(function(){
return start(entry+'?retry='+attempts)
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
requestAnimationFrame(function(){requestAnimationFrame(function(){
start(entry).then(done,function(error){
if(!parseFailure(error)&&navigator.onLine!==false&&once()){location.reload();return}
var said=(error&&error.message)||String(error)
return Promise.reject(new Error('The page could not start: '+said))
})
})})
})()`
}
