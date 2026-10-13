import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
// Point these variables at existing local copies. This script never installs packages.
const library=process.env.BROWSER_LIBRARY;
if(!library)throw Error('Set BROWSER_LIBRARY to an existing browser automation module.');
const {chromium}=await import(pathToFileURL(library));
const executable=process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const axePath=process.env.AXE_LIBRARY;
const port=8917,url=`http://127.0.0.1:${port}/`;
const routes=['home','staff','rider','board','card','quota','data'];
mkdirSync('evidence',{recursive:true});
let server,browser;
const startServer=()=>{
  server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
  return new Promise(async(resolve,reject)=>{
    server.once('error',reject);
    for(let i=0;i<100;i++){try{if((await fetch(url)).ok){resolve();return;}}catch{}await new Promise(r=>setTimeout(r,50));}
    reject(Error('Loopback server did not start'));
  });
};
const stopServer=()=>new Promise(resolve=>{if(!server||server.exitCode!==null||server.signalCode!==null){resolve();return;}server.once('exit',resolve);server.kill();});
const results={layouts:[],keyboard:[],offline:[],controls:[],axe:[],errors:[],externalRequests:[],print:[],poster:[],overflow:[]};
const waitReady=page=>page.waitForFunction(()=>document.querySelector('#offline')?.textContent.includes('Offline ready'));
const go=async(page,route)=>{await page.goto(`${url}#${route}`);await page.locator('#view h2').first().waitFor({state:'attached'});await waitReady(page);};
const snapshot=page=>page.evaluate(async()=>await(await import('./js/storage.mjs')).readAll());
const choose=async(page,selector,value)=>{await page.locator(selector).selectOption(value);};
const axeCheck=async(page,label)=>{
  if(!axePath)return;
  await page.evaluate(readFileSync(axePath,'utf8'));
  const report=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return {violations:r.violations,incomplete:r.incomplete.map(x=>({id:x.id,nodes:x.nodes.length})),passes:r.passes.length};});
  results.axe.push({label,...report});assert.equal(report.violations.length,0,`${label}: ${report.violations.map(x=>x.id).join(', ')}`);
};
async function names(page,label) {
  const session=await page.context().newCDPSession(page);await session.send('Accessibility.enable');await session.send('DOM.enable');
  const {root}=await session.send('DOM.getDocument');const {nodeIds}=await session.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'input,select,button'});
  const {nodes}=await session.send('Accessibility.getFullAXTree');const checked=[];
  for(const nodeId of nodeIds) {
    const {node}=await session.send('DOM.describeNode',{nodeId});
    const ax=nodes.find(n=>n.backendDOMNodeId===node.backendNodeId&&!n.ignored);
    const {object}=await session.send('DOM.resolveNode',{nodeId});
    const visibility=await session.send('Runtime.callFunctionOn',{objectId:object.objectId,functionDeclaration:'function(){return this.getClientRects().length>0;}',returnByValue:true});
    await session.send('Runtime.releaseObject',{objectId:object.objectId});
    if(!visibility.result.value)continue;
    assert.ok(ax,`${label}: visible ${node.nodeName} is missing from the accessibility tree`);
    const entry={tag:node.nodeName,attributes:node.attributes,role:ax.role?.value,name:ax.name?.value};
    checked.push(entry);assert.ok(entry.name?.trim(),`${label}: unnamed ${entry.tag}`);
  }
  results.controls.push({label,controls:checked});await session.detach();
}
async function keyboardFind(page,predicate) {
  for(let i=0;i<250;i++) {
    await page.keyboard.press('Tab');
    const focus=await page.evaluate(()=>({id:document.activeElement.id,route:document.activeElement.dataset.route,tag:document.activeElement.tagName,name:document.activeElement.name,text:document.activeElement.textContent.trim().slice(0,100)}));
    if(predicate(focus))return focus;
  }
  throw Error('Keyboard target not reached');
}
async function keySelect(page,id,sequence){await keyboardFind(page,f=>f.id===id);for(const key of sequence)await page.keyboard.press(key);}
async function keyText(page,id,text){await keyboardFind(page,f=>f.id===id);await page.keyboard.type(text);}
try {
  await startServer();
  browser=await chromium.launch({executablePath:executable,headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--disable-default-apps','--disable-features=MediaRouter','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
  await context.route('**/*',request=>new URL(request.request().url()).hostname==='127.0.0.1'?request.continue():request.abort());
  const page=await context.newPage();
  page.on('pageerror',e=>results.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')results.errors.push(m.text());});
  page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('blob:'))results.externalRequests.push(r.url());});
  await page.goto(url);await page.evaluate(()=>caches.open('transitx-checkin-v4'));await page.evaluate(async()=>{const registration=await navigator.serviceWorker.ready;await registration.unregister();for(const key of await caches.keys())if(key!=='transitx-checkin-v4')await caches.delete(key);});await page.reload();await waitReady(page);
  await go(page,'home');
  await page.locator('#home-demo').click();await page.locator('#status').filter({hasText:'Synthetic demo loaded'}).waitFor();
  let data=await snapshot(page);assert.equal(data.checkins.length,608);assert.equal(data.shifts.length,8);assert.equal(data.action_log.length,20);
  await page.locator('#home-demo').click();await page.locator('#status').filter({hasText:'Duplicates skipped: 636'}).waitFor();
  for(const scheme of ['light','dark'])for(const width of [320,768,1280])for(const route of routes) {
    await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'});await go(page,route);
    if(route==='board')assert.equal(await page.locator('#title').evaluate(el=>el.labels[0].textContent),'Action title');
    if(['staff','rider'].includes(route))await choose(page,'#noticed_board','yes');
    const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,heading:document.querySelector('#view h2').textContent,duplicateIds:[...document.querySelectorAll('[id]')].map(e=>e.id).filter((id,i,a)=>a.indexOf(id)!==i),focusableSmall:[...document.querySelectorAll('button,input,select,a')].filter(e=>e.getClientRects().length&&getComputedStyle(e).position!=='absolute').map(e=>({id:e.id,tag:e.tagName,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})).filter(e=>e.width<24||e.height<24)}));
    results.layouts.push({route,scheme,...layout});assert.equal(layout.scrollWidth,width);assert.equal(layout.duplicateIds.length,0);assert.equal(layout.focusableSmall.length,0,JSON.stringify(layout.focusableSmall));
    await page.screenshot({path:`evidence/v1.1-${route}-${scheme}-${width}.png`,fullPage:true});await names(page,`${route}-${scheme}-${width}`);await axeCheck(page,`${route}-${scheme}-${width}`);
  }
  // Exercise the station zone, repeated hour, contained log and print settings.
  await go(page,'board');
  assert.equal(await page.locator('#board-time-zone').inputValue(),'America/Vancouver');
  await choose(page,'#board-time-zone','America/Toronto');
  assert.ok((await page.locator('.last-updated').textContent()).includes('2 January 2026, 9:30 a.m.'));
  await choose(page,'#board-time-zone','America/Vancouver');
  for(const scheme of ['light','dark']) {
    await page.emulateMedia({colorScheme:scheme});await page.setViewportSize({width:320,height:900});
    const overflow=await page.evaluate(()=>{
      const region=document.querySelector('.action-log');region.focus();
      return {width:innerWidth,pageWidth:document.documentElement.scrollWidth,regionWidth:region.clientWidth,contentWidth:region.scrollWidth,tabIndex:region.tabIndex,role:region.getAttribute('role'),name:region.getAttribute('aria-label'),caption:region.querySelector('caption').textContent,focused:document.activeElement===region};
    });
    assert.equal(overflow.pageWidth,320);assert.ok(overflow.regionWidth<=320);assert.ok(overflow.contentWidth>overflow.regionWidth);assert.equal(overflow.tabIndex,0);assert.equal(overflow.focused,true);assert.equal(overflow.role,'region');assert.equal(overflow.name,'Action log');assert.ok(overflow.caption.includes('arrow keys'));
    await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.action-log').scrollLeft>0);
    results.overflow.push({scheme,...overflow,keyboardScrolled:true});
  }
  // Long permitted title and reason strings still stay inside the 320 px page.
  const stress=await page.evaluate(async()=>{
    const article=document.querySelector('.station-board'),log=document.querySelector('.action-log');
    const original={board:article.innerHTML,log:log.innerHTML};
    for(const title of article.querySelectorAll('h3'))title.textContent='A'.repeat(100);
    for(const cell of log.querySelectorAll('tbody th'))cell.textContent='A'.repeat(100);
    for(const cell of log.querySelectorAll('tbody td:nth-child(3)'))cell.textContent='B'.repeat(160);
    const measured={width:innerWidth,pageWidth:document.documentElement.scrollWidth,maximumTitle:100,maximumReason:160};
    article.innerHTML=original.board;log.innerHTML=original.log;return measured;
  });assert.equal(stress.width,320);assert.equal(stress.pageWidth,320);results.overflow.push({stress:true,...stress});
  const poster=await page.evaluate(()=>({
    header:document.querySelector('.poster-kicker').textContent,station:document.querySelector('.station-board h2').textContent,
    statuses:[...document.querySelectorAll('.action-card>.status-badge')].map(e=>({word:e.textContent,icon:e.querySelector('svg').dataset.icon})),
    banners:[...document.querySelectorAll('.app-banner,.synthetic-banner')].filter(e=>e.getClientRects().length).map(e=>e.textContent),
    utcVisible:document.querySelector('.station-board').textContent.includes('UTC'),
    typeSize:getComputedStyle(document.querySelector('.station-board h2')).fontSize
  }));
  assert.equal(poster.header,'Safety actions at this station');assert.deepEqual(poster.statuses.map(s=>s.icon),['checked','planned','not-done']);assert.deepEqual(poster.banners,['Demonstration: synthetic data']);assert.equal(poster.utcVisible,false);results.poster.push(poster);
  const dst=await page.evaluate(async()=>{const {stationDate,offsetTimestamp}=await import('./js/dates.mjs');return ['2026-11-01T08:30:00.000Z','2026-11-01T09:30:00.000Z'].map(t=>({date:stationDate(t),iso:offsetTimestamp(t)}));});
  assert.deepEqual(dst,[{date:'1 November 2026, 1:30 a.m.',iso:'2026-11-01T01:30:00.000-07:00'},{date:'1 November 2026, 1:30 a.m.',iso:'2026-11-01T01:30:00.000-08:00'}]);results.dst=dst;
  // Form errors are announced, link to controls and focus the first invalid field.
  for(const route of ['staff','rider']) {
    await go(page,route);await page.locator('#capture button[type=submit]').click();await page.locator('.error-summary').waitFor();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'station');
    assert.equal(await page.locator('.error-summary').getAttribute('role'),'alert');
    assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.error-summary a')].every(a=>document.querySelector(a.getAttribute('href')))));
    await axeCheck(page,`${route}-errors`);
    await choose(page,'#station','S1');await choose(page,'#time_band','weekend');await page.locator('#safety').fill('8');await page.locator('#reason-lighting').check();await choose(page,'#knows_help','yes');await choose(page,'#noticed_board','yes');await choose(page,'#trust','4');await choose(page,'#checked_meaning','on-site');
    await choose(page,'#noticed_board','no');assert.equal(await page.locator('#trust').inputValue(),'');assert.equal(await page.locator('#checked_meaning').inputValue(),'');
    if(route==='staff'){await choose(page,'#round','1');await page.locator('#staff_code').fill('F01');await page.locator('#card_number').fill('76');}
    await page.locator('#capture button[type=submit]').click();await page.locator('#status').filter({hasText:'Check-in saved'}).waitFor();
  }
  // Board creation and changes are written through the actual IndexedDB transaction.
  await go(page,'board');await page.locator('#title').fill('Synthetic access check');await choose(page,'#concern','other');await choose(page,'#action_status','not-done');await page.locator('#board-form button[type=submit]').click();await page.locator('#error-reason').filter({hasText:'short reason'}).waitFor();await names(page,'board-not-done-errors');await axeCheck(page,'board-not-done-errors');assert.equal(await page.evaluate(()=>document.activeElement.id),'reason');
  await page.locator('#reason').fill('Synthetic example: visit deferred.');await page.locator('#board-form button[type=submit]').click();await page.locator('#status').filter({hasText:'Previous status entries remain'}).waitFor();
  let current=await snapshot(page),action=current.action_log.find(r=>r.title==='Synthetic access check');assert.ok(action);
  await choose(page,'#action-choice',action.action_id);await choose(page,'#action_status','checked');await page.locator('#board-form button[type=submit]').click();await page.waitForFunction(async()=>{const s=await import('./js/storage.mjs');return (await s.readAll()).action_log.filter(r=>r.title==='Synthetic access check').length===2;});
  const download=page.waitForEvent('download');await page.locator('#log-csv').click();await (await download).saveAs('evidence/v1.1-action-log-browser.csv');
  // A real key event walkthrough of every view. No pointer events in this section.
  await page.setViewportSize({width:768,height:900});
  for(const route of routes) {
    await go(page,'home');const steps=[];
    steps.push(await keyboardFind(page,f=>f.route===route));await page.keyboard.press('Enter');await page.waitForFunction(r=>location.hash===`#${r}`,route);await page.locator('#view h2').first().waitFor();
    if(route==='home'){steps.push(await keyboardFind(page,f=>f.id==='home-demo'));await page.keyboard.press('Enter');await page.locator('#status').filter({hasText:'Duplicates skipped'}).waitFor();}
    if(route==='staff'||route==='rider'){
      await keyboardFind(page,f=>f.name==='safety');await page.keyboard.type('7');
      steps.push(await keyboardFind(page,f=>f.name==='reasons'));await page.keyboard.press('Space');
      await keySelect(page,'knows_help',['y']);await keySelect(page,'noticed_board',['y']);
      steps.push(await keyboardFind(page,f=>f.id==='trust'));await page.keyboard.press('4');
      steps.push(await keyboardFind(page,f=>f.id==='checked_meaning'));await page.keyboard.press('s');
      steps.push(await keyboardFind(page,f=>f.text==='Save synthetic check-in'));await page.keyboard.press('Enter');await page.locator('.error-summary').waitFor();assert.equal(await page.evaluate(()=>document.activeElement.id),'station');
      await keySelect(page,'station',['s']);
      if(route==='staff')await keySelect(page,'round',['1']);
      await keySelect(page,'time_band',['w']);
      if(route==='staff'){await keyText(page,'staff_code','F01');await keyText(page,'card_number','80');}
      steps.push(await keyboardFind(page,f=>f.text==='Save synthetic check-in'));await page.keyboard.press('Enter');await page.locator('#status').filter({hasText:'Check-in saved'}).waitFor();
      if(route==='staff'){
        await keySelect(page,'shift-station',['s']);await keySelect(page,'shift-round',['1']);await keySelect(page,'shift-time_band',['w']);
        await keyText(page,'shift-staff_code','F01');await keyText(page,'shift-asks','5');await keyText(page,'shift-refusals','1');
        steps.push(await keyboardFind(page,f=>f.text==='Save synthetic shift log'));await page.keyboard.press('Enter');await page.locator('#status').filter({hasText:'Shift log saved'}).waitFor();
      }
    }
    if(route==='board'){
      steps.push(await keyboardFind(page,f=>f.id==='board-time-zone'));await page.keyboard.press('e');await page.keyboard.press('Tab');
      assert.equal(await page.locator('#board-time-zone').inputValue(),'America/Edmonton');
      steps.push(await keyboardFind(page,f=>f.id==='board-print-size'));await page.keyboard.press('t');await page.keyboard.press('Tab');
      assert.equal(await page.locator('#board-print-size').inputValue(),'tabloid');
      steps.push(await keyboardFind(page,f=>f.tag==='DIV'&&f.text.startsWith('Action log')));await page.keyboard.press('ArrowRight');
      await keyText(page,'title','Keyboard synthetic action');await keySelect(page,'concern',['l']);await keySelect(page,'action_status',['p']);
      steps.push(await keyboardFind(page,f=>f.text==='Save synthetic action update'));await page.keyboard.press('Enter');await page.locator('#status').filter({hasText:'Previous status entries remain'}).waitFor();
    }
    if(route==='card'){
      steps.push(await keyboardFind(page,f=>f.id==='card-print'));assert.ok(await page.evaluate(()=>document.activeElement.matches(':focus-visible')));await page.keyboard.press('Enter');
    }
    if(route==='quota'){
      steps.push(await keyboardFind(page,f=>f.tag==='DIV'));await page.keyboard.press('ArrowRight');
    }
    if(route==='data'){
      steps.push(await keyboardFind(page,f=>f.id==='clear'));await page.keyboard.press('Enter');await page.locator('#status').filter({hasText:'Export all data as JSON'}).waitFor();
      steps.push(await keyboardFind(page,f=>f.id==='exportJSON'));const downloaded=page.waitForEvent('download');await page.keyboard.press('Enter');await (await downloaded).saveAs('evidence/v1.1-device-data-browser.json');
      steps.push(await keyboardFind(page,f=>f.id==='clear'));await page.keyboard.press('Enter');await page.locator('#confirm:not([hidden])').waitFor();assert.equal(await page.evaluate(()=>document.activeElement.id),'confirm-check');
      await page.keyboard.press('Space');steps.push(await keyboardFind(page,f=>f.text==='Confirm and clear device'));await page.keyboard.press('Enter');await page.locator('#status').filter({hasText:'Device records cleared'}).waitFor();
      assert.deepEqual(await snapshot(page),{checkins:[],shifts:[],action_log:[]});
    }
    results.keyboard.push({route,steps,passed:true});
  }
  // Prepare a populated station board for print and offline reload checks.
  await go(page,'home');await page.locator('#home-demo').click();await page.locator('#status').filter({hasText:'Synthetic demo loaded'}).waitFor();
  await go(page,'card');await page.emulateMedia({media:'print',colorScheme:'light'});
  await page.pdf({path:'evidence/v1.1-card-print.pdf',preferCSSPageSize:true,printBackground:true});
  results.print.push({route:'card',navigationHidden:await page.locator('nav').isHidden()});
  await page.emulateMedia({media:'screen',colorScheme:'light'});await go(page,'board');await choose(page,'#board-time-zone','America/Vancouver');
  for(const size of ['letter','tabloid']) {
    await page.emulateMedia({media:'screen'});await choose(page,'#board-print-size',size);await page.emulateMedia({media:'print'});
    const metrics=await page.evaluate(()=>({bodyPt:parseFloat(getComputedStyle(document.querySelector('.station-board')).fontSize)*72/96,banner:document.querySelector('.synthetic-banner').textContent,footer:document.querySelector('.board-footer').textContent,headerDisplay:getComputedStyle(document.querySelector('.poster-table thead')).display,footerDisplay:getComputedStyle(document.querySelector('.poster-table tfoot')).display}));
    if(size==='tabloid')assert.ok(metrics.bodyPt>=18);assert.equal(metrics.headerDisplay,'table-header-group');assert.equal(metrics.footerDisplay,'table-footer-group');
    await page.pdf({path:`evidence/v1.1-board-${size}-print.pdf`,preferCSSPageSize:true,printBackground:true});
    results.print.push({route:'board',size,...metrics,navigationHidden:await page.locator('nav').isHidden()});
  }
  // Stress pagination with maximum-length synthetic actions in the print surface only.
  await page.evaluate(async()=>{
    const {stationBoardHTML}=await import('./js/board.mjs'),{demoActions}=await import('./js/core.mjs'),{default:locale}=await import('./js/locales/en.mjs');
    const base=demoActions().find(r=>r.status==='not-done'),rows=Array.from({length:12},(_,i)=>({...base,id:`event-${i}`,action_id:`action-${i}`,title:`Synthetic pagination example ${i+1}: `+'Action text '.repeat(8).slice(0,65),reason:'A synthetic reason for this deferred action. '.repeat(4).slice(0,160)}));
    document.querySelector('.station-board').outerHTML=stationBoardHTML(rows,'S1',locale);
  });
  for(const size of ['letter','tabloid']) {
    await page.emulateMedia({media:'screen'});await choose(page,'#board-print-size',size);await page.emulateMedia({media:'print'});await page.pdf({path:`evidence/v1.1-board-${size}-multipage.pdf`,preferCSSPageSize:true,printBackground:true});
  }
  await go(page,'board');
  await page.emulateMedia({media:'screen',colorScheme:'light'});
  const cache=await page.evaluate(async()=>({keys:await caches.keys(),files:(await(await caches.open('transitx-checkin-v1.1.1')).keys()).map(r=>new URL(r.url).pathname)}));results.cache=cache;assert.deepEqual(cache.keys,['transitx-checkin-v1.1.1']);
  await stopServer();
  for(const route of routes) {
    await go(page,route);await page.reload();await waitReady(page);const width=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));results.offline.push({route,reloaded:true,offlineReady:await page.locator('#offline').textContent(),heading:await page.locator('#view h2').first().textContent(),...width});assert.equal(width.width,width.scrollWidth);
  }
  assert.equal((await snapshot(page)).action_log.length,20);assert.equal(results.externalRequests.length,0);assert.equal(results.errors.length,0,JSON.stringify(results.errors));
  results.passed=true;results.axeSource=axePath?'Existing local copy; no installation':'No existing local copy; not installed';
} catch(error){results.passed=false;results.failure=error.stack;process.exitCode=1;} finally {
  writeFileSync('evidence/v1.1-browser-results.json',JSON.stringify(results,null,2)+'\n');
  writeFileSync('evidence/v1.1-keyboard-output.txt',results.keyboard.map(r=>`${r.route}: ${r.passed?'PASS':'FAIL'}\n${r.steps.map(s=>`  Tab to ${s.id||s.route||s.name||s.tag}; ${s.text}`.trimEnd()).join('\n')}`).join('\n')+'\n');
  writeFileSync('evidence/v1.1-offline-results.json',JSON.stringify(results.offline,null,2)+'\n');
  await stopServer();await browser?.close();
  process.stdout.write(JSON.stringify({passed:results.passed,layouts:results.layouts.length,axeChecks:results.axe.length,controls:results.controls.length,keyboard:results.keyboard.length,offline:results.offline.length,errors:results.errors,failure:results.failure},null,2)+'\n');
}
