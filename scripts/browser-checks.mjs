import {writeFileSync,appendFileSync,mkdirSync,readFileSync,existsSync,renameSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

// This check is deliberately self contained. It uses only the existing local
// Playwright and axe copies and blocks every request that is not loopback.
const library=process.env.BROWSER_LIBRARY;
if(!library)throw Error('Set BROWSER_LIBRARY to an existing browser automation module.');
const {chromium}=await import(pathToFileURL(library));
const executable=process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const axePath=process.env.AXE_LIBRARY;
const port=Number(process.env.BROWSER_PORT||8917),url=`http://127.0.0.1:${port}/`;
const routes=['home','staff','rider','board','card','quota','data'];
const cacheName='transitx-checkin-v1.2.1';
const out='v1.2.1';
const workRoot=process.env.TRANSITX_WORK_ROOT||new URL('../.work',import.meta.url).pathname;
const evidenceDir=process.env.EVIDENCE_DIR||join(workRoot,'evidence');
const logDir=process.env.LOG_DIR||join(workRoot,'logs');
const tmpRoot=process.env.TMPDIR||join(workRoot,'tmp');
const discardedDir=join(evidenceDir,'intermediate');
mkdirSync(evidenceDir,{recursive:true});mkdirSync(logDir,{recursive:true});mkdirSync(tmpRoot,{recursive:true});mkdirSync(discardedDir,{recursive:true});
const source_commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dirty_fields=execFileSync('git',['status','--porcelain=v1'],{encoding:'utf8'}).trim().split(/\n/).filter(Boolean);
const requestedSource=process.env.ROOT_SOURCE_COMMIT?.trim();
if(requestedSource&&requestedSource!==source_commit)throw Error(`ROOT_SOURCE_COMMIT ${requestedSource} does not match HEAD ${source_commit}`);
const finalRun=process.argv.includes('--final')||!!requestedSource;
const profileRoot=process.env.BROWSER_PROFILE_DIR||join(tmpRoot,'browser-profiles');mkdirSync(profileRoot,{recursive:true});
const profileDir=join(profileRoot,`browser-${Date.now()}-${process.pid}`);mkdirSync(profileDir,{recursive:true});
const artifactPath=name=>join(evidenceDir,name);
function reserveArtifactPath(target){if(!existsSync(target))return target;const name=target.split('/').at(-1);let index=0,backup;do{backup=join(discardedDir,`${Date.now()}-${process.pid}-${index++}-${name}`);}while(existsSync(backup));renameSync(target,backup);return target;}
function writeArtifact(name,value){const target=reserveArtifactPath(artifactPath(name));writeFileSync(target,value);return target;}
function diskGuard(label){const output=execFileSync('df',['-g','/'],{encoding:'utf8'});const row=output.trim().split(/\n/).at(-1)?.trim().split(/\s+/);const free=Number(row?.[3]);if(!Number.isFinite(free)||free<49)throw Error(`${label}: df -g / reports ${Number.isFinite(free)?free:'unknown'} GB free; stopping below 49 GB`);return free;}
function logLine(value){appendFileSync(join(logDir,'browser-checks-v1.2.1.log'),`${new Date().toISOString()} ${value}\n`);}
let server,browser;
const results={version:'1.2.1',source_commit,finalRun,dirty_fields,profileDir,profileRetained:false,navigationDiagnostics:{initial:{},responses:[],failed:[]},layouts:[],keyboard:[],offline:[],controls:[],axe:[],errors:[],externalRequests:[],print:[],pdfDisk:[],poster:[],overflow:[],links:[],focus:[],blankCard:[],busyRoute:[],boardPhone:[],upgradeSemantics:[],forcedColours:[],confirmation:[],reasonRules:[]};
const pdfGuard=label=>{const freeGB=diskGuard(label);results.pdfDisk.push({label,freeGB});return freeGB;};
const startServer=()=>{
  server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
  return new Promise(async(resolve,reject)=>{
    server.once('error',reject);
    for(let i=0;i<100;i++){try{if((await fetch(url)).ok){resolve();return;}}catch{}await new Promise(r=>setTimeout(r,50));}
    reject(Error('Loopback server did not start'));
  });
};
const stopServer=()=>new Promise(resolve=>{if(!server||server.exitCode!==null||server.signalCode!==null){resolve();return;}server.once('exit',resolve);server.kill();});
const waitReady=page=>page.waitForFunction(()=>document.querySelector('#offline')?.textContent.includes('Offline ready'),null,{timeout:30000});
const gotoCommit=(page,target)=>page.goto(target,{waitUntil:'commit',timeout:60000});
const go=async(page,route)=>{await gotoCommit(page,`${url}#${route}`);await page.locator('#view h2').first().waitFor({state:'attached'});await waitReady(page);};
const goBoardPhone=async(page,station='S1')=>{await gotoCommit(page,`${url}?board=${encodeURIComponent(station)}`);await page.locator('#view h2').first().waitFor({state:'attached'});await waitReady(page);};
const snapshot=page=>page.evaluate(async()=>await(await import('./js/storage.mjs')).readAll());
const choose=async(page,selector,value)=>{await page.locator(selector).selectOption(value);};
const chooseLabel=async(page,selector,label)=>{const option=page.locator(`${selector} option`).filter({hasText:label}).first();await option.waitFor();await page.locator(selector).selectOption({label:await option.textContent()});};
const textOf=page=>page.locator('#view').innerText();
const visible=locator=>locator.evaluate(el=>!!el.getClientRects().length);
const axeCheck=async(page,label)=>{
  if(!axePath)return;
  await page.evaluate(readFileSync(axePath,'utf8'));
  const report=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return {violations:r.violations,incomplete:r.incomplete.map(x=>({id:x.id,nodes:x.nodes.length})),passes:r.passes.length};});
  results.axe.push({label,...report});assert.equal(report.violations.length,0,`${label}: ${report.violations.map(x=>x.id).join(', ')}`);
};
async function names(page,label) {
  const session=await page.context().newCDPSession(page);await session.send('Accessibility.enable');await session.send('DOM.enable');
  const {root}=await session.send('DOM.getDocument');const {nodeIds}=await session.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'input,select,button,textarea'});
  const {nodes}=await session.send('Accessibility.getFullAXTree');const checked=[];
  for(const nodeId of nodeIds) {
    const {node}=await session.send('DOM.describeNode',{nodeId});
    const ax=nodes.find(n=>n.backendDOMNodeId===node.backendNodeId&&!n.ignored);
    const {object}=await session.send('DOM.resolveNode',{nodeId});
    const visibility=await session.send('Runtime.callFunctionOn',{objectId:object.objectId,functionDeclaration:'function(){return this.getClientRects().length>0 && getComputedStyle(this).visibility!=="hidden";}',returnByValue:true});
    await session.send('Runtime.releaseObject',{objectId:object.objectId});
    if(!visibility.result.value)continue;
    assert.ok(ax,`${label}: visible ${node.nodeName} is missing from the accessibility tree`);
    const entry={tag:node.nodeName,attributes:node.attributes,role:ax.role?.value,name:ax.name?.value};
    checked.push(entry);assert.ok(entry.name?.trim(),`${label}: unnamed ${entry.tag}`);
  }
  results.controls.push({label,controls:checked});await session.detach();
}
async function keyboardFind(page,predicate) {
  for(let i=0;i<300;i++) {
    await page.keyboard.press('Tab');
    const focus=await page.evaluate(()=>({id:document.activeElement.id,route:document.activeElement.dataset.route,tag:document.activeElement.tagName,name:document.activeElement.name,text:document.activeElement.textContent.trim().slice(0,100)}));
    if(predicate(focus))return focus;
  }
  throw Error('Keyboard target not reached');
}
async function keySelect(page,id,sequence){await keyboardFind(page,f=>f.id===id);for(const key of sequence)await page.keyboard.press(key);}
async function keyText(page,id,text){await keyboardFind(page,f=>f.id===id);await page.keyboard.type(text);}
async function keyReplace(page,id,text){await keyboardFind(page,f=>f.id===id);await page.keyboard.press('ControlOrMeta+A');await page.keyboard.press('Backspace');await page.keyboard.type(text);}
async function clickAndDownload(page,selector,path) {const target=reserveArtifactPath(path);const download=page.waitForEvent('download');await page.locator(selector).click();await (await download).saveAs(target);}
function controlId(locator){return locator.evaluate(el=>el.id||el.getAttribute('name')||el.type||el.textContent.trim());}
async function assertFocusAfter(page,action,expected,record) {await action();const id=await page.evaluate(()=>document.activeElement.id);assert.equal(id,expected,`expected focus on ${expected}, got ${id}`);record.push({expected,actual:id});}

try {
  await startServer();
  const freeGB=diskGuard('browser launch');results.diskFreeGB=freeGB;logLine(`command=node scripts/browser-checks.mjs --${finalRun?'final':'check'} free_gb=${freeGB} profile=${profileDir}`);
  const retainedContext=await chromium.launchPersistentContext(profileDir,{executablePath:executable,headless:true,acceptDownloads:true,viewport:{width:1280,height:900},args:['--no-proxy-server','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--disable-default-apps','--disable-features=MediaRouter']});
  browser=retainedContext.browser();
  const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});context.setDefaultNavigationTimeout(60000);
  await context.route('**/*',request=>{if(request.request().url()===url+'setup-fixture.html')return request.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html lang="en"><title>Local setup</title><body>Local setup</body></html>'});return new URL(request.request().url()).hostname==='127.0.0.1'?request.continue():request.abort();});
  const page=await context.newPage();
  let initialNavigationActive=false,initialNavigationStarted=0;
  page.on('response',response=>{if(!initialNavigationActive||!response.url().startsWith(url))return;const parsed=new URL(response.url());if(results.navigationDiagnostics.responses.length<100)results.navigationDiagnostics.responses.push({elapsedMs:Date.now()-initialNavigationStarted,path:parsed.pathname,status:response.status(),resourceType:response.request().resourceType()});});
  page.on('requestfailed',request=>{if(!initialNavigationActive||!request.url().startsWith(url))return;const parsed=new URL(request.url());results.navigationDiagnostics.failed.push({elapsedMs:Date.now()-initialNavigationStarted,path:parsed.pathname,error:request.failure()?.errorText||'unknown'});});
  page.on('pageerror',e=>results.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')results.errors.push(m.text());});
  page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('blob:'))results.externalRequests.push(r.url());});

  // Start from a clean browser service-worker/cache state without deleting app data.
  initialNavigationStarted=Date.now();initialNavigationActive=true;results.navigationDiagnostics.initial={target:url,startedAt:new Date(initialNavigationStarted).toISOString()};
  try {
    await page.goto(url+'setup-fixture.html',{waitUntil:'load',timeout:90000});
    await page.evaluate(async()=>{if((await navigator.serviceWorker.getRegistrations()).length)throw Error('Fresh profile has a worker');await caches.open('transitx-checkin-v4');});
    const response=await gotoCommit(page,url);results.navigationDiagnostics.initial.commitMs=Date.now()-initialNavigationStarted;results.navigationDiagnostics.initial.status=response?.status()??null;
    await waitReady(page);results.navigationDiagnostics.initial.readyMs=Date.now()-initialNavigationStarted;results.navigationDiagnostics.initial.completed=true;
  } catch(error) {
    results.navigationDiagnostics.initial.failure={elapsedMs:Date.now()-initialNavigationStarted,message:error.message};logLine(`initial-navigation-failure ${JSON.stringify(results.navigationDiagnostics)}`);throw error;
  } finally {initialNavigationActive=false;}
  const firstLoadFocus=await page.evaluate(()=>({tag:document.activeElement?.tagName||'',id:document.activeElement?.id||''}));assert.equal(firstLoadFocus.tag,'BODY','first page load must leave focus on body');results.focus.push({action:'first-load',...firstLoadFocus});
  await go(page,'home');
  const demo=page.locator('#home-demo,#demo').first();await demo.click();await page.locator('#status').filter({hasText:/Synthetic demo loaded|demo loaded/i}).waitFor();
  let data=await snapshot(page);assert.equal(data.checkins.length,608);assert.equal(data.shifts.length,8);assert.equal(data.action_log.length,20);
  await demo.click();await page.locator('#status').filter({hasText:/Duplicates skipped: 636/i}).waitFor();

  // A fresh document keeps body focus. A real hash route change moves focus to
  // that route's heading, which is the only automatic heading focus allowed.
  await gotoCommit(page,`${url}#home`);await waitReady(page);await page.evaluate(()=>{location.hash='#staff';});await page.locator('#view h2').first().waitFor();await page.waitForFunction(()=>document.activeElement?.matches('#view h2'));
  results.focus.push({action:'route-change',route:'staff',headingFocus:await page.evaluate(()=>document.activeElement?.matches('#view h2'))});

  // Every route is captured at all required widths and colour schemes.
  for(const scheme of ['light','dark'])for(const width of [320,768,1280])for(const route of routes) {
    await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'});await go(page,route);
    const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,heading:document.querySelector('#view h2').textContent,duplicateIds:[...document.querySelectorAll('[id]')].map(e=>e.id).filter((id,i,a)=>a.indexOf(id)!==i),focusableSmall:[...document.querySelectorAll('button,input,select,a,textarea')].filter(e=>e.getClientRects().length&&getComputedStyle(e).position!=='absolute').map(e=>({id:e.id,tag:e.tagName,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})).filter(e=>e.width<24||e.height<24)}));
    results.layouts.push({route,scheme,...layout});assert.equal(layout.scrollWidth,width);assert.equal(layout.duplicateIds.length,0);assert.equal(layout.focusableSmall.length,0,JSON.stringify(layout.focusableSmall));
    await page.screenshot({path:reserveArtifactPath(artifactPath(`${out}-${route}-${scheme}-${width}.png`)),fullPage:true});await names(page,`${route}-${scheme}-${width}`);await axeCheck(page,`${route}-${scheme}-${width}`);
  }

  // Staff context is required while rider questions, including question 2,
  // remain optional. The import file is a required field as well.
  await go(page,'staff');
  const staffRequired=await page.evaluate(()=>['station','round','date','time_band','staff_code','card_number'].map(name=>({name,required:!!document.querySelector(`#capture [name="${name}"]`)?.required})));
  assert.ok(staffRequired.every(row=>row.required),JSON.stringify(staffRequired));
  const staffQuestions=await page.locator('#capture [data-question] input, #capture [data-question] select').evaluateAll(es=>es.map(e=>({name:e.name,required:e.required})));
  assert.ok(staffQuestions.every(row=>!row.required),JSON.stringify(staffQuestions));
  assert.doesNotMatch(await page.locator('#view').innerText(),/Optional\. You may leave this blank\./i);
  await go(page,'rider');
  const riderControls=await page.locator('#capture [data-question] input, #capture [data-question] select').evaluateAll(es=>es.map(e=>({name:e.name,required:e.required})));
  assert.ok(riderControls.every(row=>!row.required),JSON.stringify(riderControls));
  assert.doesNotMatch(await page.locator('#view').innerText(),/quota|\bsource\b|check-in/i);
  const expectedBand=await page.evaluate(async()=>{const {riderTimeBand}=await import('./js/form.mjs');return riderTimeBand(new Date());});
  if(await page.locator('#time_band').count())assert.equal(await page.locator('#time_band').inputValue(),expectedBand,'rider time band should follow the device clock');
  if(await page.locator('#file').count()){await go(page,'data');assert.equal(await page.locator('#file').getAttribute('required'),'');}

  // Question 2 accepts no ticks as no answer and rejects more than three
  // distinct reasons with the actual cardinality rule.
  await page.setViewportSize({width:320,height:900});await page.emulateMedia({colorScheme:'light'});await go(page,'rider');await choose(page,'#station','S1');if(!await page.locator('#time_band').inputValue())await choose(page,'#time_band','weekday-evening');await page.locator('[name="safety"][value="7"]').check().catch(async()=>{await page.locator('#safety').fill('7');});
  await page.locator('#capture button[type=submit]').click();await page.locator('#status').filter({hasText:/answers were saved|saved on this device/i}).waitFor();
  const blankRider=(await snapshot(page)).checkins.at(-1);assert.equal(blankRider.source,'rider-link');assert.deepEqual(blankRider.reasons,[]);results.confirmation.push({blankQuestion2:true,storedReasons:blankRider.reasons});
  const confirmation=await page.evaluate(()=>{const e=document.querySelector('#save-confirmation');if(!e)return null;const r=e.getBoundingClientRect();return {tag:e.tagName,className:e.className,text:e.textContent.trim(),inViewport:r.top>=0&&r.bottom<=innerHeight,ariaLive:e.getAttribute('aria-live')};});assert.ok(confirmation?.inViewport,`rider confirmation is not visible: ${JSON.stringify(confirmation)}`);assert.equal(confirmation.ariaLive,null,'global status is the sole save announcement');results.confirmation[0].visibleConfirmation=confirmation;
  await go(page,'rider');await choose(page,'#station','S1');if(!await page.locator('#time_band').inputValue())await choose(page,'#time_band','weekday-evening');for(const value of ['lighting','staff_nearby','crowding','too_few_people'])if(await page.locator(`[name="reasons"][value="${value}"]`).count())await page.locator(`[name="reasons"][value="${value}"]`).check();await page.locator('[name="safety"][value="7"]').check().catch(async()=>{await page.locator('#safety').fill('7');});await page.locator('#capture button[type=submit]').click();await page.locator('.error-summary').waitFor();const q2Error=await page.locator('.error-summary').innerText();assert.match(q2Error,/at most three|three different/i);assert.doesNotMatch(q2Error,/at least one|one reason required/i);results.confirmation.push({q2FourReasonsError:q2Error});

  // In-page links focus their targets without changing the route hash or typed data.
  for(const route of routes) {
    await page.setViewportSize({width:768,height:900});await page.emulateMedia({colorScheme:'light'});await go(page,route);
    if(route==='staff')await page.locator('#staff_code').fill('F01');
    if(route==='rider')await page.locator('[name="safety"][value="7"]').check().catch(async()=>{await page.locator('#safety').first().fill('7');});
    if(route==='board')await page.locator('#title').fill('Keep this action');
    const hash=await page.evaluate(()=>location.hash);const before=await page.evaluate(()=>({staff:document.querySelector('#staff_code')?.value,safety:document.querySelector('[name="safety"]:checked')?.value??document.querySelector('#safety')?.value,title:document.querySelector('#title')?.value}));await page.locator('.skip').focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>location.hash),hash,`${route}: skip changed route hash`);assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
    const retained=await page.evaluate(()=>({staff:document.querySelector('#staff_code')?.value,safety:document.querySelector('[name="safety"]:checked')?.value??document.querySelector('#safety')?.value,title:document.querySelector('#title')?.value}));assert.deepEqual(retained,before,`${route}: skip changed typed input`);
    results.links.push({route,kind:'skip',hash,focus:'main',retained});
  }
  await go(page,'staff');await page.locator('#staff_code').fill('F01');await page.evaluate(()=>{location.hash='#not-a-route';});await page.waitForTimeout(80);assert.match(await page.locator('#view h2').first().textContent(),/Staff entry/i);assert.equal(await page.locator('#staff_code').inputValue(),'F01');results.links.push({route:'staff',kind:'unknown-hash-ignored',hash:'#not-a-route',heading:await page.locator('#view h2').first().textContent(),retained:true});

  // Error-summary links must retain input and focus the referenced field.
  for(const route of ['staff','rider','board']) {
    await go(page,route);const form=page.locator(route==='board'?'#board-form':'#capture');
    if(route==='staff')await page.locator('#staff_code').fill('F01');
    if(route==='rider')await page.locator('[name="safety"][value="7"]').check().catch(async()=>{await page.locator('#safety').first().fill('7');});
    if(route==='board')await page.locator('#title').fill('Keep this action');
    const hash=await page.evaluate(()=>location.hash);const before=await page.evaluate(()=>({staff:document.querySelector('#staff_code')?.value,safety:document.querySelector('[name="safety"]:checked')?.value??document.querySelector('#safety')?.value,title:document.querySelector('#title')?.value}));await form.locator('button[type=submit]').click();await page.locator('.error-summary').waitFor();
    const summary=page.locator('.error-summary');assert.notEqual(await summary.getAttribute('role'),'alert','error summary must not duplicate focus announcement with an alert role');
    const link=summary.locator('a').first();const href=await link.getAttribute('href');assert.ok(href?.startsWith('#'));const target=href.slice(1);await link.click();
    assert.equal(await page.evaluate(()=>location.hash),hash,`${route}: error link changed route hash`);assert.equal(await page.evaluate(()=>document.activeElement.id),target,`${route}: error link focus`);
    const retained=await page.evaluate(()=>({staff:document.querySelector('#staff_code')?.value,safety:document.querySelector('[name="safety"]:checked')?.value??document.querySelector('#safety')?.value,title:document.querySelector('#title')?.value}));assert.deepEqual(retained,before,`${route}: error summary changed typed input`);
    results.links.push({route,kind:'error-summary',hash,target,retained,summaryRole:await summary.getAttribute('role'),singleAnnouncement:true});await axeCheck(page,`${route}-errors`);
  }
  // Data import errors are included when the application exposes an import summary.
  await go(page,'data');const file=page.locator('#file');if(await visible(file)) {
    await file.setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
    const importButton=page.locator('#import button').first();await importButton.click();
    const summary=page.locator('.error-summary');await summary.waitFor();assert.notEqual(await summary.getAttribute('role'),'alert','import error summary must have one announcement path');const link=summary.locator('a').first();const href=await link.getAttribute('href');const hash=await page.evaluate(()=>location.hash);const before=await page.locator('#file').inputValue();await link.click();assert.equal(await page.evaluate(()=>location.hash),hash);assert.equal(await page.evaluate(()=>document.activeElement.id),href.slice(1));assert.equal(await page.locator('#file').inputValue(),before);results.links.push({route:'data',kind:'error-summary',hash,target:href.slice(1),retained:true,summaryRole:await summary.getAttribute('role')});
  }
  for(const route of ['home','card','quota']) {await go(page,route);assert.equal(await page.locator('.error-summary').count(),0,`${route}: unexpected error summary`);results.links.push({route,kind:'error-summary',notApplicable:true});}

  // Board display, date wording and long station-name containment.
  await go(page,'board');await page.setViewportSize({width:320,height:900});
  const station=page.locator('#board-station');if(await station.count()&&await station.locator('option').filter({hasText:'Riverside Exchange North Concourse'}).count()) await chooseLabel(page,'#board-station','Riverside Exchange North Concourse');
  const poster=await page.evaluate(()=>{
    const board=document.querySelector('.station-board'),stationHeading=board?.querySelector('.station-title h2');if(stationHeading)stationHeading.textContent='Riverside Exchange North Concourse';
    const cards=[...document.querySelectorAll('.action-card')],first=cards[0],badge=first?.querySelector('.status-badge'),title=first?.querySelector('h3'),notice=[...board?.querySelectorAll('*')??[]].find(e=>e.textContent?.trim()==='Checked means staff verified this action on site. It is not a safety rating.');
    const cs=e=>e&&getComputedStyle(e);const lineHeight=e=>parseFloat(cs(e).lineHeight)||parseFloat(cs(e).fontSize)*1.2;
    return {text:board?.textContent||'',statusFirst:first?.firstElementChild?.classList.contains('action-status')&&!!first?.firstElementChild?.querySelector('.status-badge'),statusSize:parseFloat(cs(badge)?.fontSize),titleSize:parseFloat(cs(title)?.fontSize),stationLines:Math.round((board?.querySelector('h2')?.getBoundingClientRect().height||0)/lineHeight(board?.querySelector('h2'))),noticeBeforeActions:!!notice&&(!first||notice.compareDocumentPosition(first)&Node.DOCUMENT_POSITION_FOLLOWING),noticeCount:[...document.querySelectorAll('.station-board *')].filter(e=>e.textContent?.trim()==='Checked means staff verified this action on site. It is not a safety rating.').length,boardCountLive:board?.querySelector('.board-count')?.getAttribute('aria-live'),footer:document.querySelector('.board-footer')?.textContent||'',utc:board?.textContent.includes('UTC'),dates:board?.textContent.match(/[A-Z][a-z]+ \d{1,2}, \d{4}|\d{1,2}:\d{2} (?:a\.m\.|p\.m\.)/g)||[]};
  });
  assert.ok(poster.statusFirst);assert.ok(poster.statusSize>=poster.titleSize);assert.equal(poster.noticeCount,1,'the screen board notice appears once');assert.ok(poster.noticeBeforeActions);assert.ok(!poster.footer.includes('Checked means staff verified this action on site. It is not a safety rating.'),'the footer invites riders without repeating the screen notice');assert.equal(poster.boardCountLive,'polite','board count must be announced by its live region');assert.equal(poster.utc,false);assert.ok(poster.stationLines<=2,`station uses ${poster.stationLines} lines`);
  const actionSemantics=await page.evaluate(()=>[...document.querySelectorAll('.action-card')].map(card=>{const text=card.querySelector('.status-badge')?.innerText||'',status=/Not done/i.test(text)?'not-done':/Checked/i.test(text)?'checked':'planned';return {status,statusFirst:card.firstElementChild?.classList.contains('action-status'),updated:!!card.querySelector('.update-date'),due:!!card.querySelector('.due-date'),notDoneReason:status!=='not-done'||!!card.querySelector('.action-reason')};}));assert.ok(actionSemantics.length>0);assert.ok(actionSemantics.every(row=>row.statusFirst&&row.updated&&(row.status==='planned'?row.due:!row.due)&&row.notDoneReason));poster.actionSemantics=actionSemantics;results.poster.push(poster);
  assert.ok(poster.dates.some(date=>/^[A-Z][a-z]+ \d{1,2}, \d{4}(?:, \d{1,2}:\d{2} (?:a\.m\.|p\.m\.))?$/.test(date)),`board date is not written as Month D, YYYY: ${poster.dates}`);assert.ok(!/\d{1,2} [A-Z][a-z]+ \d{4}/.test(poster.text));
  const boardText=poster.text;assert.match(boardText,/\d+ checked on site, \d+ planned, \d+ not done/i);assert.match(boardText,/Whole board/i);assert.match(boardText,/Updated/i);assert.match(boardText,/verified/i);assert.match(boardText,/(?:problem.*(?:solved|fixed)|station.*safe|not.*safety)/i);assert.doesNotMatch(boardText,/\bReason:/i);assert.match(boardText,/Why:/i);
  const boardUpdated=await page.locator('.last-updated time').innerText();const firstLineDate=await page.locator('.action-card .update-date time').first().innerText();assert.equal(boardUpdated,firstLineDate,'board Updated date must use newest visible status date');
  const checkedStyle=await page.locator('.action-card.status-checked,.action-card:has(.status-checked)').first().evaluate(el=>getComputedStyle(el.querySelector('.status-badge')).color).catch(()=>null);if(checkedStyle)assert.notEqual(checkedStyle,'rgb(27, 89, 74)','Checked uses a neutral style');
  if(await page.locator('.action-log').count()){const historyText=await page.locator('.action-log').innerText();assert.match(historyText,/Status date/i);assert.match(historyText,/Recorded at/i);assert.doesNotMatch(boardText,/Recorded at/i);}
  if(await page.locator('#board-form').count()) {
    for(const [status,required] of [['planned',false],['checked',false],['not-done',true]]) {await choose(page,'#action_status',status);assert.equal(await page.locator('#reason').evaluate(e=>e.required),required,`${status}: reason required state`);results.reasonRules.push({status,required});}
    const hintId=await page.locator('#withheld').getAttribute('aria-describedby');assert.ok(hintId&&await page.locator(`#${hintId.split(/\s+/)[0]}`).count(),'Withheld hint is associated with its checkbox');
    await page.locator('#title').fill('Missing reason semantic check');await choose(page,'#concern','other');await choose(page,'#action_status','not-done');await page.locator('#reason').fill('');await page.locator('#board-form button[type=submit]').click();await page.locator('.error-summary').waitFor();const reasonError=await page.locator('.error-summary').innerText();assert.match(reasonError,/reason|required/i);results.reasonRules.push({status:'not-done',blankError:reasonError});
  }
  if(await page.locator('#board-form').count()) {await page.locator('#title').fill('Withheld synthetic sensitive action');await choose(page,'#concern','other');await choose(page,'#action_status','not-done');await page.locator('#reason').fill('Synthetic safety concern withheld from the public board.');await page.locator('#withheld').check();await page.locator('#board-form button[type=submit]').click();await page.locator('#status').filter({hasText:/saved/i}).waitFor();assert.equal((await page.locator('.station-board').innerText()).includes('Withheld synthetic sensitive action'),false);assert.ok((await page.locator('.action-log').innerText()).includes('Withheld synthetic sensitive action'));results.poster[0].withheldExcluded=true;}

  // Phone board route is read-only and exposes no staff controls or export actions.
  await goBoardPhone(page,'S1');const phone=await page.evaluate(()=>({heading:document.querySelector('#view h2')?.textContent,nav:!!document.querySelector('nav')&&[...document.querySelectorAll('nav button,a.button')].some(e=>e.getClientRects().length),controls:[...document.querySelectorAll('input,select,textarea,button')].filter(e=>e.getClientRects().length).map(e=>e.id||e.textContent.trim()).filter(x=>/staff|export|save|import|action update|print/i.test(x)),banner:document.querySelector('.station-board')?.textContent.includes('Checked means staff verified this action on site. It is not a safety rating.')||false}));
  assert.equal(phone.nav,false);assert.deepEqual(phone.controls,[]);assert.equal(phone.banner,true);assert.equal(await page.locator('.error-summary').count(),0);results.boardPhone.push(phone);results.links.push({route:'phone-board',kind:'error-summary',notApplicable:true});

  // Browser date and time-zone checks keep the pinned synthetic Pacific calendar visible.
  await go(page,'board');if(await page.locator('#board-time-zone').count()){const expectedToronto=await page.evaluate(async()=>{const s=await import('./js/storage.mjs'),core=await import('./js/core.mjs'),{boardDate}=await import('./js/display-dates.mjs');const data=await s.readAll(),station=document.querySelector('#board-station')?.value||'S1',events=core.currentActions(data.action_log,station).filter(row=>row.withheld!==true).sort((a,b)=>core.compareActionEvents(b,a));return boardDate(events[0],'America/Toronto');});await choose(page,'#board-time-zone','America/Toronto');assert.match(await page.locator('.last-updated').textContent(),new RegExp(expectedToronto.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));await choose(page,'#board-time-zone','America/Vancouver');}
  const dst=await page.evaluate(async()=>{const d=await import('./js/dates.mjs');const before=d.stationDate('2026-11-01T08:30:00.000Z'),after=d.stationDate('2026-11-01T09:30:00.000Z');return {before,after};});assert.equal(dst.before,'1 November 2026, 1:30 a.m.');assert.equal(dst.after,'1 November 2026, 2:30 a.m.');results.dst=dst;

  // Save a blank card: context persists, number advances, and quota names blank cards separately.
  await go(page,'staff');
  const contextFields=['#station','#round','#date','#time_band','#staff_code','#card_number'];for(const selector of contextFields)if(await page.locator(selector).count()) {const el=page.locator(selector);if((await el.getAttribute('type'))==='date')await el.fill(await el.inputValue()||'2026-01-02');else if(selector==='#station')await choose(page,selector,'S1');else if(selector==='#round')await choose(page,selector,'1');else if(selector==='#time_band')await choose(page,selector,'weekend');else if(selector==='#staff_code')await el.fill('F01');else if(selector==='#card_number')await el.fill('990');}
  const blankNumber=await page.locator('#card_number').inputValue();await page.locator('#capture button[type=submit]').click();await page.locator('#status').filter({hasText:/Card .* saved|saved on this device/i}).waitFor();
  const storedAfterBlank=await snapshot(page),savedBlank=storedAfterBlank.checkins.find(row=>row.source==='staff'&&String(row.card_number)===blankNumber&&row.staff_code==='F01');assert.ok(savedBlank,`blank card ${blankNumber} was not stored`);const afterBlank={data:savedBlank,station:await page.locator('#station').inputValue(),round:await page.locator('#round').inputValue(),time_band:await page.locator('#time_band').inputValue(),staff_code:await page.locator('#staff_code').inputValue(),card_number:await page.locator('#card_number').inputValue()};assert.equal(afterBlank.data.reasons?.length,0);assert.ok(afterBlank.data.safety===''||afterBlank.data.safety===null);assert.equal(afterBlank.card_number,String(Number(blankNumber)+1));await go(page,'quota');assert.match(await textOf(page),/blank/i);results.blankCard.push({saved:afterBlank.data,context:afterBlank});

  // Question 1 is tappable on both forms and Q4's unread branch leaves Q5/Q6 optional.
  for(const route of ['staff','rider']) {await go(page,route);const safety=page.locator('[name="safety"]');const safetyTypes=await safety.evaluateAll(es=>es.map(e=>e.type));assert.ok(safetyTypes.some(t=>t==='radio'||t==='range'||t==='number'),`${route}: question 1 has no usable control`);if(await page.locator('#noticed_board').count()) {await page.locator('#noticed_board').selectOption('yes-unread');for(const selector of ['[name="trust"]','[name="checked_meaning"]'])if(await page.locator(selector).count())assert.equal(await page.locator(selector).evaluateAll(es=>es.every(e=>e.disabled||!e.required||!e.getClientRects().length)),true);}}
  // The read branch exposes Q5/Q6; scan both colour schemes so conditional controls
  // receive the same accessible-name and AXE coverage as the default form.
  for(const scheme of ['light','dark']) for(const route of ['staff','rider']) {await page.setViewportSize({width:320,height:900});await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'});await go(page,route);if(await page.locator('#noticed_board').count()){await page.locator('#noticed_board').selectOption('yes');assert.ok(await page.locator('#conditional-questions').isVisible());await names(page,`${route}-${scheme}-conditional-read`);await axeCheck(page,`${route}-${scheme}-conditional-read`);await keyboardFind(page,f=>f.name==='trust');assert.equal(await page.evaluate(()=>document.activeElement.matches(':focus-visible')),true,`${route}-${scheme}: conditional radio lacks focus-visible state`);}}

  // Forced colours must leave the selected safety sign distinguishable without
  // relying on colour or :has(). The is-selected class is the portable fallback.
  await page.setViewportSize({width:320,height:900});await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});await go(page,'rider');const forced=page.locator('[name="safety"][value="7"]');await forced.check();const selected=forced.locator('xpath=ancestor::label[1]');const forcedState=await selected.evaluate(label=>{const input=label.querySelector('input');const style=getComputedStyle(label);const unselected=[...label.parentElement.querySelectorAll('label')].find(other=>!other.querySelector('input')?.checked);const unselectedStyle=unselected&&getComputedStyle(unselected);return {className:label.className,borderTopWidth:style.borderTopWidth,borderColor:style.borderTopColor,unselectedBorderTopWidth:unselectedStyle?.borderTopWidth,marker:getComputedStyle(label,'::after').content,checked:!!input?.checked,text:label.textContent.trim(),hasSelector:CSS.supports('selector(label:has(input:checked))')};});assert.ok(forcedState.checked);assert.ok(parseFloat(forcedState.borderTopWidth)>=3,JSON.stringify(forcedState));assert.ok(forcedState.marker?.includes('✓')||parseFloat(forcedState.unselectedBorderTopWidth||'0')<parseFloat(forcedState.borderTopWidth),JSON.stringify(forcedState));assert.ok(forcedState.className.includes('is-selected')||/✓|selected/i.test(forcedState.text),JSON.stringify(forcedState));await page.evaluate(()=>{for(const sheet of document.styleSheets){try{for(let index=sheet.cssRules.length-1;index>=0;index--)if(sheet.cssRules[index].selectorText?.includes(':has('))sheet.deleteRule(index);}catch{}}});const fallback=await selected.evaluate(label=>({border:getComputedStyle(label).borderTopWidth,marker:getComputedStyle(label,'::after').content}));assert.ok(parseFloat(fallback.border)>=3&&fallback.marker.includes('✓'),`selected scale lost its no-colour fallback: ${JSON.stringify(fallback)}`);results.forcedColours.push({...forcedState,fallback});await page.screenshot({path:reserveArtifactPath(artifactPath(`${out}-rider-forced-colours-320.png`)),fullPage:true});await page.emulateMedia({forcedColors:'none',colorScheme:'light',reducedMotion:'reduce'});

  // Focus stays with the invoking control after card save, export and import.
  await go(page,'staff');
  for(const selector of contextFields)if(await page.locator(selector).count()) {const el=page.locator(selector);if(selector==='#station')await choose(page,selector,'S1');else if(selector==='#round')await choose(page,selector,'1');else if(selector==='#time_band')await choose(page,selector,'weekend');else if(selector==='#staff_code')await el.fill('F01');else if(selector==='#card_number')await el.fill('991');}
  await page.locator('#capture button[type=submit]').click();await page.locator('#status').filter({hasText:/Card .* saved|saved on this device/i}).waitFor();assert.equal(await page.evaluate(()=>document.activeElement.id),'card_number');results.focus.push({action:'card-save',active:await page.evaluate(()=>document.activeElement.id)});
  await go(page,'data');const exportSelector='#exportJSON';if(await page.locator(exportSelector).count()){await assertFocusAfter(page,()=>clickAndDownload(page,exportSelector,artifactPath(`${out}-device-data-browser.json`)),'exportJSON',results.focus);}
  const importButton=page.locator('#import button').first();if(await importButton.count()){await page.locator('#file').setInputFiles({name:'empty.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema_version:1,checkins:[],shifts:[],action_log:[]}))});await assertFocusAfter(page,()=>importButton.click(),await controlId(importButton),results.focus);}
  if(await page.locator('#clear').count()){await page.locator('#clear').click();await page.locator('#confirm').waitFor({state:'visible'});await page.locator('#confirm-check').check();await page.locator('#confirm button:not([type=button])').click();await page.locator('#status').filter({hasText:/Device records cleared/i}).waitFor();const clearFocus=await page.evaluate(()=>({id:document.activeElement?.id||'',tag:document.activeElement?.tagName||'',visible:!!document.activeElement?.getClientRects().length}));assert.ok(clearFocus.visible&&(/data|clear/i.test(clearFocus.id)||clearFocus.tag==='H2'),JSON.stringify(clearFocus));results.focus.push({action:'clear-device',...clearFocus,announced:true});}

  // A delayed IndexedDB completion must queue rapid route changes and settle on
  // the latest request, with focus on the resulting route heading.
  await go(page,'data');await page.evaluate(()=>{const original=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');window.__restoreTransactionComplete=()=>Object.defineProperty(IDBTransaction.prototype,'oncomplete',original);Object.defineProperty(IDBTransaction.prototype,'oncomplete',{configurable:true,get(){return original.get.call(this);},set(handler){return original.set.call(this,typeof handler==='function'?(...args)=>setTimeout(()=>handler.apply(this,args),200):handler);}});});
  const delayedDownload=page.waitForEvent('download');await page.locator('#exportJSON').click();await page.evaluate(()=>{location.hash='#staff';location.hash='#rider';});await page.waitForFunction(()=>document.body.dataset.route==='rider');await page.waitForFunction(()=>document.activeElement.matches('#view h2'));const finalHeading=await page.locator('#view h2').first().textContent();assert.match(finalHeading,/Rider/i);const delayedFile=await delayedDownload;await delayedFile.saveAs(reserveArtifactPath(artifactPath(`${out}-busy-route-export.json`)));await page.evaluate(()=>window.__restoreTransactionComplete());results.busyRoute.push({queued:['staff','rider'],finalRoute:await page.evaluate(()=>document.body.dataset.route),heading:finalHeading,headingFocus:true});

  // Keyboard-only walkthrough uses real Tab and Enter, with heading focus after each route.
  await page.setViewportSize({width:768,height:900});
  for(const route of routes) {
    // Begin from a different route so Enter always exercises route activation,
    // including the home link itself.
    await go(page,route==='home'?'data':'home');const steps=[];steps.push(await keyboardFind(page,f=>f.route===route));await page.keyboard.press('Enter');await page.waitForFunction(r=>location.hash===`#${r}`,route);await page.locator('#view h2').first().waitFor();await page.waitForFunction(()=>document.activeElement.matches('#view h2'));assert.equal(await page.evaluate(()=>document.activeElement.matches('#view h2')),true,`${route}: route heading did not receive focus`);steps.push({headingFocus:true});
    if(route==='home'){steps.push(await keyboardFind(page,f=>f.id==='home-demo'||f.id==='demo'));await page.keyboard.press('Enter');await page.locator('#status').filter({hasText:/Duplicates skipped|Synthetic demo loaded/}).waitFor();}
    if(route==='staff'||route==='rider'){
      if(route==='staff'){steps.push(await keyboardFind(page,f=>f.id==='safety'));await page.keyboard.type('7');}else{steps.push(await keyboardFind(page,f=>f.name==='safety'));for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');}
      steps.push(await keyboardFind(page,f=>f.name==='reasons'));await page.keyboard.press('Space');await keySelect(page,'knows_help',['y']);await keySelect(page,'noticed_board',['y']);
      steps.push(await keyboardFind(page,f=>f.name==='trust'));await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');await keySelect(page,'checked_meaning',['s']);
      steps.push(await keyboardFind(page,f=>f.tag==='BUTTON'&&/Save (?:synthetic check-in|answers)/i.test(f.text)));await page.keyboard.press('Enter');await page.locator('.error-summary').waitFor();assert.equal(await page.evaluate(()=>document.activeElement.matches('.error-summary')),true);
      await keySelect(page,'station',['s']);if(route==='staff')await keySelect(page,'round',['1']);await keySelect(page,'time_band',['w']);if(route==='staff'){await keyReplace(page,'staff_code','F01');await keyReplace(page,'card_number','7999');}
      steps.push(await keyboardFind(page,f=>f.tag==='BUTTON'&&/Save (?:synthetic check-in|answers)/i.test(f.text)));await page.keyboard.press('Enter');await page.locator('#status').filter({hasText:/answers were saved|Check-in saved|Card .* saved/}).waitFor();
      if(route==='staff'){await keySelect(page,'shift-station',['s']);await keySelect(page,'shift-round',['1']);await keySelect(page,'shift-time_band',['w']);await keyReplace(page,'shift-staff_code','F01');await keyReplace(page,'shift-asks','5');await keyReplace(page,'shift-refusals','1');steps.push(await keyboardFind(page,f=>f.text==='Save synthetic shift log'));await page.keyboard.press('Enter');await page.locator('#status').filter({hasText:'Shift log saved'}).waitFor();}
    }
    if(route==='board'){
      steps.push(await keyboardFind(page,f=>f.id==='board-time-zone'));await page.keyboard.press('e');assert.equal(await page.locator('#board-time-zone').inputValue(),'America/Edmonton');
      steps.push(await keyboardFind(page,f=>f.id==='board-print-size'));await page.keyboard.press('t');assert.equal(await page.locator('#board-print-size').inputValue(),'tabloid');
      steps.push(await keyboardFind(page,f=>f.tag==='DIV'&&f.text.startsWith('Action log')));await page.keyboard.press('ArrowRight');
      await keyReplace(page,'title',`Keyboard synthetic action ${Date.now()}`);await keySelect(page,'concern',['l']);await keySelect(page,'action_status',['p']);await keyReplace(page,'reason','Waiting for the next maintenance window.');steps.push(await keyboardFind(page,f=>f.tag==='BUTTON'&&/Save synthetic action update/i.test(f.text)));await page.keyboard.press('Enter');await page.locator('#status').filter({hasText:'Previous status entries remain'}).waitFor();
    }
    if(route==='card'){steps.push(await keyboardFind(page,f=>f.id==='card-print'));assert.ok(await page.evaluate(()=>document.activeElement.matches(':focus-visible')));await page.keyboard.press('Enter');}
    if(route==='quota'){steps.push(await keyboardFind(page,f=>f.tag==='DIV'));await page.keyboard.press('ArrowRight');}
    if(route==='data'){steps.push(await keyboardFind(page,f=>f.id==='exportJSON'));const downloaded=page.waitForEvent('download');await page.keyboard.press('Enter');await (await downloaded).saveAs(reserveArtifactPath(artifactPath(`${out}-device-data-keyboard.json`)));}
    results.keyboard.push({route,steps,passed:true});
  }

  // Print samples use a pristine relative demo after interaction checks so
  // exploratory withheld/keyboard actions cannot leak into the deliverables.
  await page.evaluate(async()=>{const storage=await import('./js/storage.mjs'),core=await import('./js/core.mjs');const current=await storage.readAll();await storage.clearRecords(core.exportJSON(current.checkins,current.shifts,current.action_log));await storage.addRecords(core.demoRecords());});
  await go(page,'card');await page.emulateMedia({media:'print',colorScheme:'light'});pdfGuard('card PDF');await page.pdf({path:reserveArtifactPath(artifactPath(`${out}-card-print.pdf`)),preferCSSPageSize:true,printBackground:true});results.print.push({route:'card',pages:'one-or-two',navigationHidden:await page.locator('nav').isHidden()});
  await page.emulateMedia({media:'screen',colorScheme:'light'});await go(page,'board');
  for(const size of ['letter','tabloid']) {await page.emulateMedia({media:'screen'});if(await page.locator('#board-print-size').count())await choose(page,'#board-print-size',size);await page.emulateMedia({media:'print'});await page.evaluate(async()=>{const {prepareBoardPrint}=await import('./js/ui.mjs');prepareBoardPrint(document);});const metrics=await page.evaluate(()=>{const pages=[...document.querySelectorAll('.print-board-page')];const measure=page=>{const pageRect=page.getBoundingClientRect();const surface=page.matches('.station-board')?page:page.querySelector('.station-board')||page;const rows=[...surface.querySelectorAll('.board-list > tr')].map(row=>{const rect=row.getBoundingClientRect();return {top:rect.top-pageRect.top,bottom:rect.bottom-pageRect.top,height:rect.height};});const contiguous=rows.every((row,index)=>row.height>0&&(index===0||row.top>=rows[index-1].bottom-1));const clipped=rows.some(row=>row.top< -1||row.bottom>pageRect.height+1);const css=node=>node&&getComputedStyle(node);return {pageHeight:pageRect.height,rows,contiguous,clipped,bodyPt:parseFloat(css(surface)?.fontSize)*72/96,legendPt:parseFloat(css(surface.querySelector('.board-legend'))?.fontSize)*72/96,noticePt:parseFloat(css(surface.querySelector('.board-footer,.board-notice'))?.fontSize)*72/96,banner:surface.querySelector('.synthetic-banner')?.textContent,footer:surface.querySelector('.board-footer')?.textContent,headerDisplay:css(surface.querySelector('.poster-table thead'))?.display,footerDisplay:css(surface.querySelector('.poster-table tfoot'))?.display};};const measured=pages.map(measure);return {...measured[0],pages:measured,totalPages:pages.length};});assert.ok(metrics.pages.length>0,`board ${size} print helper produced no pages`);assert.ok(metrics.pages.every(pageMetrics=>!pageMetrics.clipped&&pageMetrics.contiguous&&pageMetrics.rows.every(row=>row.height>0)),`board ${size} print rows are clipped or non-contiguous: ${JSON.stringify(metrics.pages)}`);assert.ok(metrics.pages.some(pageMetrics=>pageMetrics.rows.length>=2),'the sample print set must pack several actions on a sheet');if(size==='tabloid'){assert.ok(metrics.pages.every(pageMetrics=>pageMetrics.rows[0].top*72/96+36<=792/3),'tabloid first action must start in the top third');assert.ok(metrics.bodyPt>=18);assert.ok(metrics.legendPt>=24);assert.ok(metrics.noticePt>=24);}pdfGuard(`board ${size} PDF`);await page.pdf({path:reserveArtifactPath(artifactPath(`${out}-board-${size}-print.pdf`)),preferCSSPageSize:true,printBackground:true});results.print.push({route:'board',size,...metrics,navigationHidden:await page.locator('nav').isHidden()});}
  await page.emulateMedia({media:'screen'});await page.evaluate(async()=>{const {stationBoardHTML}=await import('./js/board.mjs');const {demoActions}=await import('./js/core.mjs');const {default:locale}=await import('./js/locales/en.mjs');const source=demoActions(new Date('2026-01-02T12:00:00.000Z')).find(row=>row.station==='S1');const rows=Array.from({length:16},(_,i)=>({...source,id:`00000000-0000-4000-8000-${String(9000+i).padStart(12,'0')}`,action_id:`00000000-0000-4000-8000-${String(9100+i).padStart(12,'0')}`,title:`Synthetic pagination action ${i+1}: Replace two dark lights at the north stairs`,reason:'Visit deferred after a station access review.',event_number:1}));document.querySelector('.station-board').outerHTML=stationBoardHTML(rows,'S1',locale,'America/Vancouver');});
  for(const size of ['letter','tabloid']) {await page.emulateMedia({media:'screen'});if(await page.locator('#board-print-size').count())await choose(page,'#board-print-size',size);await page.emulateMedia({media:'print'});await page.evaluate(async()=>{const {prepareBoardPrint}=await import('./js/ui.mjs');prepareBoardPrint(document);});const metrics=await page.evaluate(()=>[...document.querySelectorAll('.print-board-page')].map(page=>{const pageRect=page.getBoundingClientRect();const surface=page.matches('.station-board')?page:page.querySelector('.station-board')||page;const rows=[...surface.querySelectorAll('.board-list > tr')].map(row=>{const rect=row.getBoundingClientRect();return {top:rect.top-pageRect.top,bottom:rect.bottom-pageRect.top,height:rect.height};});return {pageHeight:pageRect.height,rows,contiguous:rows.every((row,index)=>row.height>0&&(index===0||row.top>=rows[index-1].bottom-1)),clipped:rows.some(row=>row.top< -1||row.bottom>pageRect.height+1)};}));assert.ok(metrics.length>0&&metrics.every(pageMetrics=>!pageMetrics.clipped&&pageMetrics.contiguous&&pageMetrics.rows.every(row=>row.height>0)),`board ${size} stress rows are clipped or non-contiguous: ${JSON.stringify(metrics)}`);assert.ok(metrics.some(pageMetrics=>pageMetrics.rows.length>=2),`board ${size} stress must pack several actions per sheet`);pdfGuard(`board ${size} stress PDF`);await page.pdf({path:reserveArtifactPath(artifactPath(`${out}-board-${size}-multipage.pdf`)),preferCSSPageSize:true,printBackground:true});results.print.push({route:'board',size,multipage:true,pages:metrics});}

  // Full offline reload, including the phone board route, after the loopback server is stopped.
  await go(page,'board');const cache=await page.evaluate(async name=>({keys:await caches.keys(),files:(await(await caches.open(name)).keys()).map(r=>new URL(r.url).pathname)}),cacheName);results.cache=cache;assert.ok(cache.keys.includes(cacheName));assert.ok(cache.files.includes('/js/locales/en.mjs'));assert.ok(!cache.files.includes('/js/locales/second.mjs'));
  await stopServer();
  for(const target of [...routes,'phone-board']) {if(target==='phone-board')await goBoardPhone(page,'S1');else await gotoCommit(page,`${url}#${target}`);await page.reload({waitUntil:'commit',timeout:60000});await waitReady(page);const width=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));results.offline.push({route:target,reloaded:true,offlineReady:await page.locator('#offline').textContent(),heading:await page.locator('#view h2').first().textContent(),...width});assert.equal(width.width,width.scrollWidth);}
  assert.equal((await snapshot(page)).action_log.length>=20,true);assert.equal(results.externalRequests.length,0);assert.equal(results.errors.length,0,JSON.stringify(results.errors));results.passed=true;results.axeSource=axePath?'Existing local copy; no installation':'No existing local copy; not installed';
} catch(error){results.passed=false;results.failure=error.stack;process.exitCode=1;} finally {
  results.profileRetained=existsSync(profileDir);
  writeArtifact(`${out}-browser-results.json`,JSON.stringify(results,null,2)+'\n');
  writeArtifact(`${out}-keyboard-output.txt`,results.keyboard.map(r=>`${r.route}: ${r.passed?'PASS':'FAIL'}\n${r.steps.map(s=>`  ${s.headingFocus?'heading focus':`Tab to ${s.id||s.route||s.name||s.tag}`}`).join('\n')}`).join('\n')+'\n');
  writeArtifact(`${out}-offline-results.json`,JSON.stringify(results.offline,null,2)+'\n');
  await stopServer();await browser?.close();
  process.stdout.write(JSON.stringify({passed:results.passed,layouts:results.layouts.length,axeChecks:results.axe.length,controls:results.controls.length,keyboard:results.keyboard.length,offline:results.offline.length,links:results.links.length,focus:results.focus.length,errors:results.errors,failure:results.failure},null,2)+'\n');
}
