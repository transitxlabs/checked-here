import {createServer} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const library=process.env.BROWSER_LIBRARY;
if(!library)throw Error('Set BROWSER_LIBRARY to an existing browser automation module.');
const {chromium}=await import(pathToFileURL(library));
const oldCache='transitx-checkin-v1.1.1',newCache='transitx-checkin-v1.2.0';
const prefix='/checkin-prototype/';
const source_commit=execSync('git rev-parse HEAD',{encoding:'utf8'}).trim();
const requestedSource=process.env.ROOT_SOURCE_COMMIT?.trim();
if(requestedSource&&requestedSource!==source_commit)throw Error(`ROOT_SOURCE_COMMIT ${requestedSource} does not match HEAD ${source_commit}`);
const legacyWorker=`const CACHE='${oldCache}';
const FILES=['./','./index.html','./styles.css','./icon.svg','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./js/app.mjs','./js/form.mjs','./js/core.mjs','./js/storage.mjs','./js/board.mjs','./js/dates.mjs','./js/questions.mjs','./js/card.mjs','./js/locales/en.mjs'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith((async()=>{const cache=await caches.open(CACHE);const request=event.request.mode==='navigate'?new URL('./index.html',self.location.href).href:event.request;return await cache.match(request)||fetch(event.request);})());});`;
let legacy=true,browser,server;
const result={version:'1.2.0',source_commit,finalRun:!!requestedSource,prefix,oldCache,newCache,before:[],after:[],preserved:{},cacheFiles:[],routes:[],passed:false};
const types={html:'text/html',mjs:'text/javascript',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json'};
const serverHandler=(request,response)=>{
  const pathname=new URL(request.url,'http://localhost').pathname;
  if(!pathname.startsWith(prefix)){response.writeHead(404);response.end();return;}
  const file=decodeURIComponent(pathname.slice(prefix.length))||'index.html';
  response.setHeader('Cache-Control','no-store');
  if(file==='legacy.html'){response.setHeader('Content-Type','text/html');response.end('<!doctype html><html lang="en"><title>Upgrade fixture</title><body>Local upgrade fixture</body></html>');return;}
  if(file.includes('..')||!['index.html','styles.css','icon.svg','manifest.webmanifest','sw.js'].includes(file)&&!file.startsWith('js/')&&!file.startsWith('icons/')){response.writeHead(404);response.end();return;}
  try{response.setHeader('Content-Type',types[file.split('.').pop()]||'application/octet-stream');response.end(file==='sw.js'&&legacy?legacyWorker:readFileSync(new URL('../'+file,import.meta.url)));}catch{response.writeHead(404);response.end();}
};
await new Promise(resolve=>{server=createServer(serverHandler);server.listen(0,'127.0.0.1',resolve);});
const origin=`http://127.0.0.1:${server.address().port}`,url=origin+prefix;
try {
  browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--disable-default-apps','--disable-features=MediaRouter','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  const context=await browser.newContext();await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage();
  await page.goto(url+'legacy.html');
  await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
    const core=await import('./js/core.mjs'),demo=core.demoRecords();
    await new Promise((resolve,reject)=>{const open=indexedDB.open('transitx-checkin-prototype',1);open.onupgradeneeded=()=>{const db=open.result;db.createObjectStore('checkins',{keyPath:'id'}).createIndex('cardKey','cardKey',{unique:true});db.createObjectStore('shifts',{keyPath:'id'});db.createObjectStore('action_log',{keyPath:'id'});};open.onsuccess=()=>{const db=open.result,tx=db.transaction(['checkins','shifts','action_log'],'readwrite');tx.objectStore('checkins').add({...demo.checkins[0],cardKey:core.cardKey(demo.checkins[0])});tx.objectStore('shifts').add(demo.shifts[0]);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});
  });
  result.before=await page.evaluate(async()=>({keys:await caches.keys(),files:(await(await caches.open('transitx-checkin-v1.1.1')).keys()).map(r=>new URL(r.url).pathname)}));assert.deepEqual(result.before.keys,[oldCache]);assert.ok(result.before.files.every(path=>path.startsWith(prefix)));
  legacy=false;
  await page.evaluate(async()=>{const previous=navigator.serviceWorker.controller,registration=await navigator.serviceWorker.getRegistration();await registration.update();if(navigator.serviceWorker.controller===previous)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  await page.waitForFunction(async([oldName,newName])=>(await caches.keys()).includes(newName)&&!(await caches.keys()).includes(oldName),[oldCache,newCache]);
  await page.goto(url+'#board');await page.waitForFunction(()=>document.querySelector('#offline')?.textContent.includes('Offline ready'));
  result.after=await page.evaluate(async name=>({keys:await caches.keys(),files:(await(await caches.open(name)).keys()).map(r=>new URL(r.url).pathname)}),newCache);assert.deepEqual(result.after.keys,[newCache]);assert.ok(result.after.files.every(path=>path.startsWith(prefix)));result.cacheFiles=result.after.files;
  const data=await page.evaluate(async()=>await(await import('./js/storage.mjs')).readAll());assert.equal(data.checkins.length,1);assert.equal(data.shifts.length,1);assert.equal(data.action_log.length,0);result.preserved={checkins:data.checkins.length,shifts:data.shifts.length,action_log:data.action_log.length};
  result.manifest=await page.evaluate(async name=>{const cache=await caches.open(name);return await(await cache.match('./manifest.webmanifest')).json();},newCache);assert.equal(result.manifest.scope,'./');
  await new Promise(resolve=>server.close(resolve));
  for(const route of ['home','staff','rider','board','card','quota','data']){await page.goto(url+'#'+route);await page.reload();await page.waitForFunction(()=>document.querySelector('#offline')?.textContent.includes('Offline ready'));result.routes.push({route,heading:await page.locator('#view h2').first().textContent(),offline:true,reloaded:true});}
  await page.goto(url+'?board=S1');await page.waitForFunction(()=>document.querySelector('#view h2'));result.phoneBoard={heading:await page.locator('#view h2').first().textContent(),nav:await page.locator('nav').count(),staffControls:await page.locator('#capture,#board-form,#exportJSON,#import').count()};assert.equal(result.phoneBoard.nav,0);assert.equal(result.phoneBoard.staffControls,0);
  result.passed=true;
}catch(error){result.passed=false;result.failure=error.stack;process.exitCode=1;}
finally{writeFileSync('evidence/v1.2.0-upgrade-results.json',JSON.stringify(result,null,2)+'\n');await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));process.stdout.write(JSON.stringify(result,null,2)+'\n');}
