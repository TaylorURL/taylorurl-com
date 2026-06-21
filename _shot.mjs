import puppeteer from 'puppeteer'
const b=await puppeteer.launch({args:['--no-sandbox'],executablePath:'/usr/bin/chromium-browser'})
async function shot(w,h,name,dark){
  const p=await b.newPage()
  await p.setViewport({width:w,height:h,deviceScaleFactor:1})
  await p.emulateMediaFeatures([{name:'prefers-color-scheme',value:dark?'dark':'light'}])
  await p.evaluateOnNewDocument(()=>{ try{localStorage.setItem('taylorurl_email_popup_v1','dismissed')}catch(e){} })
  await p.goto('http://localhost:5177/',{waitUntil:'networkidle0',timeout:30000})
  await new Promise(r=>setTimeout(r,3500))
  await p.screenshot({path:name})
  await p.close()
  console.log('shot',name)
}
await shot(1440,900,'/tmp/hero_desktop.png',true)
await shot(390,844,'/tmp/hero_mobile.png',true)
await shot(1440,900,'/tmp/hero_desktop_light.png',false)
await b.close()
