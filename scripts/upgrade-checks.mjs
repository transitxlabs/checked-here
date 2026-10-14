import {createServer} from 'node:http';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(new URL('..',import.meta.url).pathname);
const library=process.env.BROWSER_LIBRARY;
if(!library)throw Error('Set BROWSER_LIBRARY to an existing browser automation module.');
const {chromium}=await import(pathToFileURL(library));
const originalCommit='fb2a5c368523308e4f0229cd0e625c74f01a40ea';
const oldCache='transitx-checkin-v1.2.0',newCache='transitx-checkin-v1.2.1';
const prefix='/checkin-prototype/';
const workRoot=process.env.TRANSITX_WORK_ROOT||join(root,'.work');
const evidenceDir=process.env.EVIDENCE_DIR||join(workRoot,'evidence');
const logDir=process.env.LOG_DIR||join(workRoot,'logs');
const tmpRoot=process.env.TMPDIR||join(workRoot,'tmp');
const discardedDir=join(evidenceDir,'intermediate');
mkdirSync(evidenceDir,{recursive:true});mkdirSync(logDir,{recursive:true});mkdirSync(tmpRoot,{recursive:true});mkdirSync(discardedDir,{recursive:true});
const artifactPath=name=>join(evidenceDir,name);
function writeArtifact(name,value){const target=artifactPath(name);if(existsSync(target)){let index=0,backup;do{backup=join(discardedDir,`${Date.now()}-${process.pid}-${index++}-${name}`);}while(existsSync(backup));renameSync(target,backup);}writeFileSync(target,value);return target;}
function diskGuard(label){const output=execFileSync('df',['-g','/'],{encoding:'utf8'});const row=output.trim().split(/\n/).at(-1)?.trim().split(/\s+/);const free=Number(row?.[3]);if(!Number.isFinite(free)||free<49)throw Error(`${label}: df -g / reports ${Number.isFinite(free)?free:'unknown'} GB free; stopping below 49 GB`);return free;}
function logLine(value){appendFileSync(join(logDir,'upgrade-checks-v1.2.1.log'),`${new Date().toISOString()} ${value}\n`);}
const source_commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirty_fields=execFileSync('git',['status','--porcelain=v1'],{cwd:root,encoding:'utf8'}).trim().split(/\n/).filter(Boolean);
const requestedSource=process.env.ROOT_SOURCE_COMMIT?.trim();
if(requestedSource&&requestedSource!==source_commit)throw Error(`ROOT_SOURCE_COMMIT ${requestedSource} does not match HEAD ${source_commit}`);
const finalRun=!!requestedSource||process.argv.includes('--final');
const profileRoot=process.env.BROWSER_PROFILE_DIR||join(tmpRoot,'browser-profiles');mkdirSync(profileRoot,{recursive:true});
const profileDir=join(profileRoot,`upgrade-${Date.now()}-${process.pid}`);mkdirSync(profileDir,{recursive:true});

const oldWorker=execFileSync('git',['show',`${originalCommit}:sw.js`],{cwd:root,encoding:'utf8'});
const oldAssets=new Map();
for(const match of oldWorker.matchAll(/'\.\/(.*?)'/g)) {
  const file=match[1];
  if(file==='')continue;
  try{oldAssets.set(file,execFileSync('git',['show',`${originalCommit}:${file}`],{cwd:root}));}catch{}
}
oldAssets.set('sw.js',Buffer.from(oldWorker));
const finalUiSource=readFileSync(join(root,'js/ui.mjs'),'utf8').replace(/^import[^\n]*\n/gm,'').replace(/^export\s+\{[^\n]*\}\s+from[^\n]*\n/gm,'');
const types={html:'text/html',mjs:'text/javascript',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json'};
let sourceState='old',delayNewAssets=false,server;
const serverHandler=(request,response)=>{
  const pathname=new URL(request.url,'http://localhost').pathname;
  if(!pathname.startsWith(prefix)){response.writeHead(404);response.end();return;}
  const file=decodeURIComponent(pathname.slice(prefix.length))||'index.html';
  if(file.includes('..')||(!['index.html','styles.css','icon.svg','manifest.webmanifest','sw.js','legacy.html'].includes(file)&&!file.startsWith('js/')&&!file.startsWith('icons/'))){response.writeHead(404);response.end();return;}
  const finish=()=>{
    if(file==='legacy.html'){response.setHeader('Content-Type','text/html');response.end('<!doctype html><html lang="en"><title>Upgrade fixture</title><body>Local upgrade fixture</body></html>');return;}
    try {
      const value=sourceState==='old'?oldAssets.get(file):readFileSync(join(root,file));
      if(!value)throw Error('missing');
      response.setHeader('Cache-Control','no-store');response.setHeader('Content-Type',types[file.split('.').pop()]||'application/octet-stream');response.end(value);
    } catch {response.writeHead(404);response.end();}
  };
  if(sourceState==='new'&&delayNewAssets&&file!=='sw.js')setTimeout(finish,Number(process.env.UPGRADE_INSTALL_DELAY_MS||300));else finish();
};
await new Promise(resolve=>{server=createServer(serverHandler);server.listen(0,'127.0.0.1',resolve);});
const origin=`http://127.0.0.1:${server.address().port}`,url=origin+prefix;
const gotoCommit=(page,target)=>page.goto(target,{waitUntil:'commit',timeout:60000});
const waitOfflineReady=page=>page.waitForFunction(()=>document.querySelector('#offline')?.textContent.includes('Offline ready'),null,{timeout:30000});
const result={version:'1.2.1',source_commit,finalRun,dirty_fields,originalCommit,oldCache,newCache,prefix,profileDir,profileRetained:false,navigationDiagnostics:{initial:{},responses:[],failed:[]},before:[],after:[],preserved:{},cacheFiles:[],routes:[],passed:false,externalRequests:[],helper:{}};
let browser;
try {
  const freeGB=diskGuard('upgrade browser launch');result.diskFreeGB=freeGB;logLine(`command=node scripts/upgrade-checks.mjs --${finalRun?'final':'check'} free_gb=${freeGB} profile=${profileDir}`);
  const retainedContext=await chromium.launchPersistentContext(profileDir,{executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,viewport:{width:1280,height:900},args:['--no-proxy-server','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--disable-default-apps','--disable-features=MediaRouter']});
  browser=retainedContext.browser();
  const context=await browser.newContext({viewport:{width:1280,height:900}});context.setDefaultNavigationTimeout(60000);await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());const page=await context.newPage();let initialNavigationActive=false,initialNavigationStarted=0;
  page.on('response',response=>{if(!initialNavigationActive||!response.url().startsWith(origin))return;const parsed=new URL(response.url());if(result.navigationDiagnostics.responses.length<100)result.navigationDiagnostics.responses.push({elapsedMs:Date.now()-initialNavigationStarted,path:parsed.pathname,status:response.status(),resourceType:response.request().resourceType()});});
  page.on('requestfailed',request=>{if(!initialNavigationActive||!request.url().startsWith(origin))return;const parsed=new URL(request.url());result.navigationDiagnostics.failed.push({elapsedMs:Date.now()-initialNavigationStarted,path:parsed.pathname,error:request.failure()?.errorText||'unknown'});});
  page.on('request',request=>{if(!request.url().startsWith(origin)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))result.externalRequests.push(request.url());});
  page.on('pageerror',error=>result.externalRequests.push(`pageerror:${error.message}`));

  // Boot the actual 1.2.0 assets from the original commit, then seed every
  // store with real records before the worker is switched.
  initialNavigationStarted=Date.now();initialNavigationActive=true;result.navigationDiagnostics.initial={target:url+'legacy.html',startedAt:new Date(initialNavigationStarted).toISOString()};
  try {const initialResponse=await gotoCommit(page,url+'legacy.html');result.navigationDiagnostics.initial.commitMs=Date.now()-initialNavigationStarted;result.navigationDiagnostics.initial.status=initialResponse?.status()??null;result.navigationDiagnostics.initial.completed=true;} catch(error) {result.navigationDiagnostics.initial.failure={elapsedMs:Date.now()-initialNavigationStarted,message:error.message};logLine(`initial-navigation-failure ${JSON.stringify(result.navigationDiagnostics)}`);throw error;} finally {initialNavigationActive=false;}
  const beforeData=await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
    const storage=await import('./js/storage.mjs'),core=await import('./js/core.mjs');await storage.openStorage();const demo=core.demoRecords(new Date('2026-01-02T12:00:00.000Z'));await storage.addRecords(demo);return await storage.readAll();
  });
  await gotoCommit(page,url+'#data');await waitOfflineReady(page);result.oldApp={heading:await page.locator('#view h2').first().textContent(),cache:oldCache,originalCommit};
  result.before=await page.evaluate(async name=>({keys:await caches.keys(),files:(await(await caches.open(name)).keys()).map(request=>new URL(request.url).pathname)}),oldCache);
  assert.deepEqual(result.before.keys,[oldCache]);assert.ok(result.before.files.length>0&&result.before.files.every(file=>file.startsWith(prefix)));assert.ok(result.before.files.includes(`${prefix}js/ui.mjs`));
  result.preserved.beforeCounts={checkins:beforeData.checkins.length,shifts:beforeData.shifts.length,action_log:beforeData.action_log.length};
  result.preserved.beforeData=beforeData;

  // Switch the served worker while the old worker still controls the page.
  // Delay the final asset responses so installing/waiting is observable.
  await page.evaluate(finalUiSource.replace(/^export\s+/gm,'')+';window.__upgradeOfflineFiles=offlineFiles;');
  sourceState='new';delayNewAssets=true;
  const helperResult=await page.evaluate(async({newCache,source})=>{
    const registration=await navigator.serviceWorker.getRegistration();if(!registration)throw Error('missing upgrade registration');
    const previous=navigator.serviceWorker.controller;let changed=false;const change=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>{changed=true;resolve(true)},{once:true}));
    const updatePromise=registration.update().catch(error=>({error:String(error)}));
    for(let i=0;i<100&&!registration.installing&&!registration.waiting;i++)await new Promise(resolve=>setTimeout(resolve,20));
    if(!registration.installing&&!registration.waiting)throw Error('new worker did not enter installing or waiting state');
    const opens=[];const originalOpen=caches.open.bind(caches);const wrappedCaches={open:async name=>{opens.push({name:String(name),beforeController:!changed,controller:previous===navigator.serviceWorker.controller});return originalOpen(name);}};
    const outcome=await window.__upgradeOfflineFiles({serviceWorker:navigator.serviceWorker,caches:wrappedCaches,base:location.href,cacheName:newCache,milliseconds:20000});await updatePromise;await change.catch(()=>{});return {outcome,opens,controllerChanged:changed};
  },{newCache,source:finalUiSource});
  result.helper=helperResult;assert.equal(helperResult.controllerChanged,true);assert.ok(helperResult.opens.length>0);assert.ok(helperResult.opens.every(open=>open.beforeController===false),JSON.stringify(helperResult.opens));
  delayNewAssets=false;

  await gotoCommit(page,url+'#board');await page.reload({waitUntil:'commit',timeout:60000});await waitOfflineReady(page);
  result.after=await page.evaluate(async name=>({keys:await caches.keys(),files:(await(await caches.open(name)).keys()).map(request=>new URL(request.url).pathname)}),newCache);result.cacheFiles=result.after.files;
  assert.deepEqual(result.after.keys,[newCache]);assert.ok(result.after.files.length>0&&result.after.files.every(file=>file.startsWith(prefix)));assert.ok(!result.after.files.includes(`${prefix}js/locales/second.mjs`));
  const afterData=await page.evaluate(async()=>await(await import('./js/storage.mjs')).readAll());result.preserved.afterCounts={checkins:afterData.checkins.length,shifts:afterData.shifts.length,action_log:afterData.action_log.length};assert.deepEqual(afterData,beforeData,'upgrade must preserve every stored value');
  result.preserved.exact=true;
  result.manifest=await page.evaluate(async name=>await(await(await caches.open(name)).match('./manifest.webmanifest')).json(),newCache);assert.equal(result.manifest.scope,'./');

  await new Promise(resolve=>server.close(resolve));
  for(const route of ['home','staff','rider','board','card','quota','data']) {await gotoCommit(page,url+'#'+route);await page.reload({waitUntil:'commit',timeout:60000});await waitOfflineReady(page);result.routes.push({route,heading:await page.locator('#view h2').first().textContent(),offline:true,reloaded:true});}
  await gotoCommit(page,url+'?board=S1');await page.waitForFunction(()=>document.querySelector('#view h2'),null,{timeout:30000});result.phoneBoard={heading:await page.locator('#view h2').first().textContent(),nav:await page.locator('nav').count(),staffControls:await page.locator('#capture,#board-form,#exportJSON,#import').count()};assert.equal(result.phoneBoard.nav,0);assert.equal(result.phoneBoard.staffControls,0);
  assert.equal(result.externalRequests.length,0,JSON.stringify(result.externalRequests));result.passed=true;
} catch(error){result.passed=false;result.failure=error.stack;process.exitCode=1;}
finally {result.profileRetained=existsSync(profileDir);writeArtifact('v1.2.1-upgrade-results.json',JSON.stringify(result,null,2)+'\n');await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));process.stdout.write(JSON.stringify(result,null,2)+'\n');}
