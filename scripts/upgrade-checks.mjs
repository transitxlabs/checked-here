import {createServer} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.BROWSER_LIBRARY));
const originalWorker=execFileSync('git',['show','75dc869:sw.js'],{encoding:'utf8'});
let legacy=true,browser;const prefix='/checkin-prototype/';const result={};
const types={html:'text/html',mjs:'text/javascript',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json'};
const server=createServer((request,response)=>{
  const pathname=new URL(request.url,'http://localhost').pathname;
  if(!pathname.startsWith(prefix)){response.writeHead(404);response.end();return;}
  const file=decodeURIComponent(pathname.slice(prefix.length))||'index.html';
  response.setHeader('Cache-Control','no-store');
  if(file==='legacy.html'){response.setHeader('Content-Type','text/html');response.end('<!doctype html><html lang="en"><title>Upgrade fixture</title><body>Local upgrade fixture</body></html>');return;}
  if(file.includes('..')||!['index.html','styles.css','icon.svg','manifest.webmanifest','sw.js'].includes(file)&&!file.startsWith('js/')&&!file.startsWith('icons/')){response.writeHead(404);response.end();return;}
  try{response.setHeader('Content-Type',types[file.split('.').pop()]||'application/octet-stream');response.end(file==='sw.js'&&legacy?originalWorker:readFileSync(new URL('../'+file,import.meta.url)));}catch{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`,url=origin+prefix;
try {
  browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  const context=await browser.newContext();await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage();
  await page.goto(url+'legacy.html');
  await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
    const core=await import('./js/core.mjs'),demo=core.demoRecords();
    await new Promise((resolve,reject)=>{const open=indexedDB.open('transitx-checkin-prototype',1);open.onupgradeneeded=()=>{const db=open.result;db.createObjectStore('checkins',{keyPath:'id'}).createIndex('cardKey','cardKey',{unique:true});db.createObjectStore('shifts',{keyPath:'id'});};open.onsuccess=()=>{const db=open.result,tx=db.transaction(['checkins','shifts'],'readwrite');tx.objectStore('checkins').add({...demo.checkins[0],cardKey:core.cardKey(demo.checkins[0])});tx.objectStore('shifts').add(demo.shifts[0]);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});
  });
  result.before=await page.evaluate(()=>caches.keys());assert.deepEqual(result.before,['transitx-checkin-v4']);
  legacy=false;
  await page.evaluate(async()=>{const previous=navigator.serviceWorker.controller,registration=await navigator.serviceWorker.getRegistration();await registration.update();if(navigator.serviceWorker.controller===previous)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  await page.waitForFunction(async()=>!(await caches.keys()).includes('transitx-checkin-v4')&&(await caches.keys()).includes('transitx-checkin-v1.1.1'));
  await page.goto(url+'#board');await page.waitForFunction(()=>document.querySelector('#offline')?.textContent.includes('Offline ready'));
  result.after=await page.evaluate(()=>caches.keys());assert.deepEqual(result.after,['transitx-checkin-v1.1.1']);
  const data=await page.evaluate(async()=>await(await import('./js/storage.mjs')).readAll());assert.equal(data.checkins.length,1);assert.equal(data.shifts.length,1);assert.equal(data.action_log.length,0);result.preserved={checkins:data.checkins.length,shifts:data.shifts.length,action_log:data.action_log.length};
  result.manifest=await page.evaluate(async()=>{const cache=await caches.open('transitx-checkin-v1.1.1');return await(await cache.match('./manifest.webmanifest')).json();});assert.equal(result.manifest.scope,'./');
  await new Promise(resolve=>server.close(resolve));
  result.routes=[];
  for(const route of ['home','staff','rider','board','card','quota','data']){await page.goto(url+'#'+route);await page.reload();await page.waitForFunction(()=>document.querySelector('#offline')?.textContent.includes('Offline ready'));result.routes.push({route,heading:await page.locator('#view h2').first().textContent(),offline:true,reloaded:true});}
  await page.goto(url+'?s=S3#board');assert.equal(await page.locator('nav [aria-current=page]').textContent(),'Station board');
  await page.goto(url+'?s=S3');assert.equal(await page.locator('#station').inputValue(),'S3');assert.equal(await page.locator('nav [aria-current=page]').textContent(),'Rider phone form');
  result.passed=true;
}catch(error){result.passed=false;result.failure=error.stack;process.exitCode=1;}
finally{writeFileSync('evidence/v1.1-upgrade-results.json',JSON.stringify(result,null,2)+'\n');await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));process.stdout.write(JSON.stringify(result,null,2)+'\n');}
