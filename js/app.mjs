import {DEFAULT_TIME_ZONE,TIME_ZONES} from './dates.mjs';
import {ROUTES,routeFromHash,focusLink,createAnnouncer,pageTitle,resetCard,createRunner,offlineFiles,prepareBoardPrint,clearBoardPrint} from './ui.mjs';
import {printableCardHTML} from './card.mjs';
import {stationBoardHTML,actionLogHTML} from './board.mjs';
import strings from './locales/en.mjs';
import {questionsHTML,updateConditionalQuestions,conditionalAnswers} from './form.mjs';
import {STATIONS,BANDS,CONCERNS,ACTION_STATUSES,currentActions,validateAction,boardCSV,actionLogCSV,today,validateCheckin,validateShift,quota,riderCounts,exportCSV,exportJSON,toCSV,SHIFT_COLUMNS,dictionaryCSV,dictionaryMarkdown,prepareImport,demoRecords} from './core.mjs';
import {openStorage,readAll,addRecords,clearRecords} from './storage.mjs';
const t = key => strings[key];
const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const labelFor = value => t(value.replaceAll('-','_')) ?? value;
const view=document.querySelector('#view'),status=document.querySelector('#status');
const query=new URL(location.href).searchParams,phoneBoard=query.get('board');
const readOnly=STATIONS.includes(phoneBoard);
let data={checkins:[],shifts:[],action_log:[]},route=readOnly?'board':routeFromHash(location.hash)||(query.has('s')?'rider':'home'),lastExport=null,pendingRoute=null;
const routeLabels={home:'homeRoute',staff:'staffRoute',rider:'riderRoute',board:'boardRoute',card:'cardRoute',quota:'quotaRoute',data:'dataRoute'};
const announce=createAnnouncer(status);
document.documentElement.lang=t('lang');
document.body.classList.toggle('phone-board',readOnly);
const stationFromURL=new URL(location.href).searchParams.get('s');
function updateTitle(errors=!!view.querySelector('.error-summary')){document.title=pageTitle(t(routeLabels[route]),t(['rider','card'].includes(route)?'cardTitle':'title'),errors);}
document.querySelectorAll('[data-text]').forEach(el=>el.textContent=t(el.dataset.text));
document.querySelector('#navigation').setAttribute('aria-label',t('navigation'));
if(readOnly)document.querySelector('#navigation').remove();
function message(key,values={}) { announce(Object.entries(values).reduce((s,[k,v])=>s.replaceAll(`{${k}}`,v),t(key))); }
const errorHTML=k=>`<p class="error" id="error-${k}" hidden></p>`;
function select(k,values,hint='') {
  return `<label for="${k}">${escape(t(k))} <span class="required-mark">${escape(t('requiredMark'))}</span></label><select id="${k}" name="${k}" required aria-describedby="error-${k}${hint?` hint-${k}`:''}"><option value="">${escape(t('choose'))}</option>${values.map(v=>`<option value="${escape(v)}">${escape(labelFor(String(v)))}</option>`).join('')}</select>${hint?`<p class="hint" id="hint-${k}">${escape(t(hint))}</p>`:''}${errorHTML(k)}`;
}
function input(k,type,hint='',attrs='') {
  return `<label for="${k}">${escape(t(k==='title'?'titleField':k==='file'?'importLabel':k))} <span class="required-mark">${escape(t('requiredMark'))}</span></label><input id="${k}" name="${k}" type="${type}" required ${attrs} aria-describedby="error-${k}${hint?` hint-${k}`:''}">${hint?`<p class="hint" id="hint-${k}">${escape(t(hint))}</p>`:''}${errorHTML(k)}`;
}
function context(staff, shift=false) {
  return `<div class="context"><div>${select('station',STATIONS)}</div>${staff?`<div>${select('round',[1,2])}</div><div>${input('date','date','',`max="${today()}"`)}</div>`:''}<div>${select('time_band',BANDS,'timeBandHint')}</div>${staff?`<div>${input('staff_code','text','staffHint','maxlength="5" autocomplete="off" pattern="[A-Z][0-9]{2,4}"')}</div>${shift?'':`<div>${input('card_number','number','cardHint','min="1" step="1"')}</div>`}`:''}</div>`;
}
function capture() {
  const staff=route==='staff';
  view.innerHTML=`<h2>${escape(t(staff?'staffRoute':'riderRoute'))}</h2><p>${escape(t(staff?'staffIntro':'riderIntro'))}</p><p>${escape(t('cardHeader'))}</p><p>${escape(t('adultRiders'))} ${escape(t('optionalHint'))}</p><p class="badge-local">${escape(t('routeContext'))}</p><form id="capture" novalidate>${context(staff)}${questionsHTML(staff,strings)}<button type="submit">${escape(t('save'))}</button></form>${staff?`<section><h2>${escape(t('shiftHeading'))}</h2><p>${escape(t('shiftIntro'))}</p><form id="shift" novalidate>${context(true,true)}<div class="context"><div>${input('asks','number','','min="0" step="1"')}</div><div>${input('refusals','number','','min="0" step="1"')}</div></div><button type="submit">${escape(t('shiftSave'))}</button></form></section>`:''}`;
  // Separate form IDs keep labels and error descriptions unambiguous.
  const shiftForm=view.querySelector('#shift');
  if(shiftForm) {
    shiftForm.querySelectorAll('[id]').forEach(el=>el.id=`shift-${el.id}`);
    shiftForm.querySelectorAll('[for]').forEach(el=>el.htmlFor=`shift-${el.htmlFor}`);
    shiftForm.querySelectorAll('[aria-describedby]').forEach(el=>el.setAttribute('aria-describedby',el.getAttribute('aria-describedby').split(' ').map(id=>`shift-${id}`).join(' ')));
  }
  for(const form of view.querySelectorAll('form')) {
    if(form.elements.date) form.elements.date.value=today();
    if(STATIONS.includes(stationFromURL)) form.elements.station.value=stationFromURL;
  }
  const captureForm=view.querySelector('#capture');
  updateConditionalQuestions(captureForm);
  captureForm.elements.noticed_board.addEventListener('change',()=>updateConditionalQuestions(captureForm));
  captureForm.addEventListener('submit',event=>run(async()=>{
    event.preventDefault(); const form=event.currentTarget;
    await refresh(); const r=recordFrom(form,staff);
    if(showErrors(form,validateCheckin(r,data.checkins))) return;
    await addRecords({checkins:[r]}); lastExport=null; await refresh();
    const number=r.card_number;resetCard(form,staff);
    updateConditionalQuestions(form);updateTitle();
    message(staff?'savedCard':'saved',{number});
  },event));
  shiftForm?.addEventListener('submit',event=>run(async()=>{
    event.preventDefault(); const form=event.currentTarget;
    const r={id:crypto.randomUUID(),synthetic:true,...contextFrom(form),asks:numberFrom(form,'asks'),refusals:numberFrom(form,'refusals')};
    if(showErrors(form,validateShift(r))) return;
    await addRecords({shifts:[r]}); lastExport=null; await refresh(); form.reset(); form.elements.date.value=today(); message('shiftSaved');
  },event));
}
function numberFrom(form,k) { return form.elements[k].value === '' ? null : Number(form.elements[k].value); }
function contextFrom(form) { return {station:form.elements.station.value,round:numberFrom(form,'round'),date:form.elements.date.value,time_band:form.elements.time_band.value,staff_code:form.elements.staff_code.value}; }
function recordFrom(form,staff) {
  return {id:crypto.randomUUID(),source:staff?'staff':'rider-link',synthetic:true,...(staff?contextFrom(form):{station:form.elements.station.value,round:null,date:today(),time_band:form.elements.time_band.value,staff_code:null}),card_number:staff?numberFrom(form,'card_number'):null,safety:numberFrom(form,'safety'),reasons:[...form.querySelectorAll('[name="reasons"]:checked')].map(el=>el.value),knows_help:form.elements.knows_help.value||null,noticed_board:form.elements.noticed_board.value||null,...conditionalAnswers(form.elements.noticed_board.value,form.elements.trust.value==='no-opinion'?'no-opinion':numberFrom(form,'trust'),form.elements.checked_meaning.value||null)};
}
function showErrors(form,errors) {
  form.querySelector('.error-summary')?.remove();
  form.querySelectorAll('.error').forEach(el=>{el.hidden=true;el.textContent='';});
  form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
  const questionNumbers={safety:1,reasons:2,knows_help:3,noticed_board:4,trust:5,checked_meaning:6};
  const errorText=(k,key)=>`${questionNumbers[k]?`${questionNumbers[k]}. ${t(k)}`:(t(k==='title'?'titleField':k==='file'?'importLabel':k)??t('actionChoice'))}: ${t(key)}`;
  for(const [k,key] of Object.entries(errors)) {
    const el=form.querySelector(`[id$="error-${k}"]`);if(el){el.textContent=errorText(k,key);el.hidden=false;}
    form.querySelectorAll(`[name="${k}"]`).forEach(el=>el.setAttribute('aria-invalid','true'));
  }
  updateTitle(Object.keys(errors).length>0||!!view.querySelector('.error-summary'));
  if(!Object.keys(errors).length)return false;
  announce('');
  const summary=document.createElement('div');summary.className='error-summary';summary.setAttribute('role','alert');summary.tabIndex=-1;
  summary.innerHTML=`<p>${escape(t('formErrors'))}</p><ul>${Object.entries(errors).map(([k,key])=>{const field=form.querySelector(`[name="${k}"]`);return `<li><a href="#${field?.id??form.id}" data-focus="${field?.id??form.id}">${escape(errorText(k,key))}</a></li>`;}).join('')}</ul>`;
  form.prepend(summary);summary.focus();return true;
}
function table(caption,headers,rows) { return `<div class="table-scroll" tabindex="0" role="region" aria-label="${escape(caption)}"><table><caption>${escape(caption)}</caption><thead><tr>${headers.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>i===0?`<th scope="row">${escape(v)}</th>`:`<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
function quotas() {
  view.innerHTML=`<h2>${escape(t('quotaHeading'))}</h2><p>${escape(t('quotaIntro'))}</p>${table(t('quotaHeading'),[t('station'),t('round'),t('completed'),t('blankCards'),t('target'),t('remaining'),...BANDS.map(labelFor)],quota(data.checkins).map(r=>[r.station,r.round,r.completed,r.blank,r.target,r.remaining,...BANDS.map(b=>r.bands[b])]))}${table(t('riderSeparate'),[t('station'),t('count'),t('blankCards')],riderCounts(data.checkins).map(r=>[r.station,r.count,r.blank]))}${table(t('shiftTotals'),[t('station'),t('round'),t('asks'),t('refusals')],STATIONS.flatMap(s=>[1,2].map(round=>{const shifts=data.shifts.filter(r=>r.station===s&&r.round===round);return [s,round,shifts.reduce((n,r)=>n+r.asks,0),shifts.reduce((n,r)=>n+r.refusals,0)];})))}<p>${escape(t('prototype'))}</p>`;
}
function download(name,content,type) {
  const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function dataView() {
  view.innerHTML=`<h2>${escape(t('dataHeading'))}</h2><p>${escape(t('dataIntro'))}</p><p>${escape(t('prototype'))}</p><div class="actions">${['exportCSV','exportJSON','exportShifts','dictionaryCSV','dictionaryMD'].map(k=>`<button type="button" id="${k}">${escape(t(k))}</button>`).join('')}</div><form id="import" novalidate><label for="file">${escape(t('importLabel'))}</label><input id="file" name="file" aria-describedby="error-file" type="file" accept=".csv,.json,text/csv,application/json" required>${errorHTML('file')}<div class="actions"><button id="import-submit">${escape(t('importAction'))}</button></div></form><section><h2>${escape(t('demo'))}</h2><p>${escape(t('demoIntro'))}</p><button type="button" id="demo">${escape(t('demo'))}</button></section><section><h2>${escape(t('clear'))}</h2><p>${escape(t('clearIntro'))}</p><button type="button" class="danger" id="clear">${escape(t('clear'))}</button><form class="confirm" id="confirm" hidden><label class="check"><input type="checkbox" id="confirm-check" required>${escape(t('clearConfirm'))}</label><div class="actions"><button class="danger">${escape(t('clearAction'))}</button><button type="button" id="cancel">${escape(t('cancel'))}</button></div></form></section>`;
  for(const k of ['exportCSV','exportJSON','exportShifts','dictionaryCSV','dictionaryMD']) view.querySelector(`#${k}`).onclick=()=>run(async()=>{
    await refresh();
    const actions={exportCSV:()=>download('checkins.csv',exportCSV(data.checkins),'text/csv'),exportJSON:()=>{const content=exportJSON(data.checkins,data.shifts,data.action_log);download('device-data.json',content,'application/json');lastExport=content;},exportShifts:()=>download('shifts.csv',toCSV(data.shifts,SHIFT_COLUMNS),'text/csv'),dictionaryCSV:()=>download('data-dictionary.csv',dictionaryCSV(),'text/csv'),dictionaryMD:()=>download('data-dictionary.md',dictionaryMarkdown(),'text/markdown')};
    actions[k](); message('exportDone');
  });
  view.querySelector('#import').onsubmit=event=>run(async()=>{
    event.preventDefault(); const form=event.currentTarget,file=view.querySelector('#file').files[0];if(showErrors(form,file?{}:{file:'noFile'}))return;
    await refresh();
    try {
      const bundle=prepareImport(await file.text(),file.name.toLowerCase().endsWith('.csv')?'csv':'json',data);
      await addRecords(bundle); if(bundle.checkins.length+bundle.shifts.length+(bundle.action_log?.length??0)) lastExport=null; await refresh();
      message('imported',{added:bundle.checkins.length+bundle.shifts.length+(bundle.action_log?.length??0),duplicates:bundle.duplicates});
    } catch(e) {showErrors(form,{file:t(e.message)?e.message:'invalidFile'});}
  },event);
  view.querySelector('#demo').onclick=()=>run(loadDemo);
  view.querySelector('#clear').onclick=()=>run(async()=>{
    await refresh(); if(lastExport!==exportJSON(data.checkins,data.shifts,data.action_log)) {message('clearNeedExport');return;}
    view.querySelector('#confirm').hidden=false; view.querySelector('#confirm-check').focus();
  });
  view.querySelector('#cancel').onclick=()=>{view.querySelector('#confirm').hidden=true;view.querySelector('#confirm-check').checked=false;view.querySelector('#clear').focus();};
  view.querySelector('#confirm').onsubmit=event=>run(async()=>{
    event.preventDefault(); if(!view.querySelector('#confirm-check').checked) return;
    await refresh(); if(lastExport!==exportJSON(data.checkins,data.shifts,data.action_log)) {message('clearNeedExport');return;}
    await clearRecords(lastExport); lastExport=null; await refresh(); dataView(); message('cleared');
  },event);
}

let boardStation=readOnly?phoneBoard:'S1',boardTimeZone=DEFAULT_TIME_ZONE,boardPrintSize='letter';
function setPrintSize() {document.body.dataset.boardPrint=boardPrintSize;document.body.classList.toggle('print-tabloid',boardPrintSize==='tabloid');}
function boardView() {
  if(readOnly){view.innerHTML=stationBoardHTML(data.action_log.length?data.action_log:demoRecords().action_log,boardStation,strings,boardTimeZone);return;}
  const actions=currentActions(data.action_log,boardStation);
  view.innerHTML=`<div class="no-print"><h2>${escape(t('boardRoute'))}</h2><p>${escape(t('boardIntro'))}</p><label for="board-station">${escape(t('boardStation'))}</label><select id="board-station">${STATIONS.map(s=>`<option ${s===boardStation?'selected':''}>${s}</option>`).join('')}</select><div class="context board-settings"><div><label for="board-time-zone">${escape(t('boardTimeZone'))}</label><select id="board-time-zone">${TIME_ZONES.map(z=>`<option value="${escape(z)}" ${z===boardTimeZone?'selected':''}>${escape(z.split('/')[1].replaceAll('_',' '))} (${escape(z)})</option>`).join('')}</select></div><div><label for="board-print-size">${escape(t('printSize'))}</label><select id="board-print-size"><option value="letter" ${boardPrintSize==='letter'?'selected':''}>${escape(t('letterPortrait'))}</option><option value="tabloid" ${boardPrintSize==='tabloid'?'selected':''}>${escape(t('tabloidLandscape'))}</option></select></div></div><p class="hint">${escape(t('demoCalendar'))}</p><div class="actions"><button id="board-print">${escape(t('boardPrint'))}</button><button id="board-csv">${escape(t('exportBoard'))}</button><button id="log-csv">${escape(t('exportLog'))}</button></div></div>${stationBoardHTML(data.action_log,boardStation,strings,boardTimeZone)}<section class="no-print"><h2>${escape(t('boardForm'))}</h2><form id="board-form" novalidate><label for="action-choice">${escape(t('actionChoice'))}</label><select id="action-choice"><option value="">${escape(t('newAction'))}</option>${actions.map(r=>`<option value="${r.action_id}">${escape(r.title)}</option>`).join('')}</select><div class="context"><div>${input('title','text','','maxlength="100"')}</div><div>${select('concern',CONCERNS)}</div></div>${select('action_status',ACTION_STATUSES)}<div class="context"><div>${input('status_date','date','',`max="${today()}"`)}</div><div>${input('due_date','date')}</div></div><label class="check"><input id="withheld" name="withheld" type="checkbox">${escape(t('withheld'))}</label><p class="hint">${escape(t('withheldHint'))}</p><div id="reason-wrap" hidden>${input('reason','text','','maxlength="160"')}</div><button type="submit">${escape(t('boardSave'))}</button></form></section><section class="no-print"><h2>${escape(t('actionLog'))}</h2>${actionLogHTML(data.action_log,boardStation,strings,boardTimeZone)}</section>`;
  view.querySelector('#board-station').onchange=event=>run(async()=>{boardStation=event.target.value;await refresh();boardView();view.querySelector('#board-station').focus();});
  setPrintSize();
  view.querySelector('#board-time-zone').onchange=event=>{boardTimeZone=event.target.value;boardView();view.querySelector('#board-time-zone').focus();};
  view.querySelector('#board-print-size').onchange=event=>{boardPrintSize=event.target.value;setPrintSize();};
  view.querySelector('#board-print').onclick=()=>window.print();
  view.querySelector('#board-csv').onclick=()=>run(async()=>{await refresh();download(`board-${boardStation}.csv`,boardCSV(data.action_log,boardStation,boardTimeZone),'text/csv');message('exportDone');});
  view.querySelector('#log-csv').onclick=()=>run(async()=>{await refresh();download(`action-log-${boardStation}.csv`,actionLogCSV(data.action_log,boardStation,boardTimeZone),'text/csv');message('exportDone');});
  const form=view.querySelector('#board-form');
  form.elements.status_date.value=today();form.elements.due_date.value=today();
  const updateReason=()=>{const required=['planned','not-done'].includes(form.elements.action_status.value);view.querySelector('#reason-wrap').hidden=!required;form.elements.reason.disabled=!required;form.elements.reason.required=required;if(!required)form.elements.reason.value='';};
  form.elements.action_status.onchange=updateReason;updateReason();
  view.querySelector('#action-choice').onchange=event=>{
    const action=actions.find(r=>r.action_id===event.target.value);
    form.elements.title.value=action?.title??'';form.elements.concern.value=action?.concern??'';
    form.elements.title.readOnly=!!action;form.elements.concern.disabled=!!action;
    form.elements.action_status.value='';form.elements.status_date.value=today();form.elements.due_date.value=action?.due_date??today();form.elements.withheld.checked=action?.withheld??false;updateReason();
  };
  form.onsubmit=event=>run(async()=>{
    const action_id=view.querySelector('#action-choice').value||crypto.randomUUID();
    await refresh();
    const previous=currentActions(data.action_log).find(r=>r.action_id===action_id);
    const r={status_date:form.elements.status_date.value,due_date:form.elements.due_date.value,event_number:(previous?.event_number??0)+1,withheld:form.elements.withheld.checked,id:crypto.randomUUID(),action_id,synthetic:true,station:boardStation,title:form.elements.title.value.trim(),concern:form.elements.concern.value,status:form.elements.action_status.value,reason:form.elements.reason.value.trim(),updated_at:new Date().toISOString()};
    const errors=validateAction(r,data.action_log);if(!r.status_date)errors.status_date='invalidDate';if(!r.due_date)errors.due_date='invalidDueDate';if(['planned','not-done'].includes(r.status)&&!r.reason)errors.reason='invalidReason';if(errors.status){errors.action_status=errors.status;delete errors.status;}
    if(showErrors(form,errors))return;
    await addRecords({action_log:[r]});lastExport=null;await refresh();boardView();message('boardSaved');view.querySelector('#action-choice').focus();
  },event);
}
function cardView() {
  document.body.classList.remove('print-tabloid');
  view.innerHTML=`<div class="no-print"><h2>${escape(t('cardRoute'))}</h2><p>${escape(t('cardIntro'))}</p><button id="card-print">${escape(t('cardPrint'))}</button></div>${printableCardHTML(strings)}`;
  view.querySelector('#card-print').onclick=()=>window.print();
}
function home() {
  view.innerHTML=`<div class="home"><p class="eyebrow">${escape(t('homeEyebrow'))}</p><h2>${escape(t('homeIntro'))}</h2><div class="route-list">${[['staff','staffRoute','homeStaff'],['rider','riderRoute','homeRider'],['board','boardRoute','homeBoard']].map(([key,title,description],i)=>`<section><span class="route-number">0${i+1}</span><h3><a href="#${key}">${escape(t(title))}</a></h3><p>${escape(t(description))}</p></section>`).join('')}</div><p>${escape(t('homeMore'))}</p><div class="actions"><button id="home-demo">${escape(t('demo'))}</button><a class="button" href="#card">${escape(t('cardRoute'))}</a></div><p class="hint">${escape(t('demoIntro'))}</p><section class="pilot-steps"><h3>${escape(t('pilotHeading'))}</h3><ol>${['pilotCard','pilotStaff','pilotBoard','pilotNext'].map(k=>`<li>${escape(t(k))}</li>`).join('')}</ol></section></div>`;
  view.querySelector('#home-demo').onclick=()=>run(loadDemo);
}
async function loadDemo() {
  await refresh();const demo=demoRecords(),bundle=prepareImport(exportJSON(demo.checkins,demo.shifts,demo.action_log),'json',data);
  await addRecords(bundle);if(bundle.checkins.length+bundle.shifts.length+(bundle.action_log?.length??0))lastExport=null;
  await refresh();message('demoDone',{added:bundle.checkins.length+bundle.shifts.length+(bundle.action_log?.length??0),duplicates:bundle.duplicates});
}

async function refresh() {data=await readAll();}
const runner=createRunner({document,onError:error=>message(error.message==='clearNeedExport'?'clearNeedExport':'storageError'),onIdle:async()=>{if(pendingRoute!==null){const next=pendingRoute;pendingRoute=null;await changeRoute(next);}}});
const run=(action,event)=>runner.run(action,event);
async function changeRoute(next) {
  if(readOnly)return;
  if(runner.busy){pendingRoute=next;return;}
  await run(async()=>{await refresh();route=next;announce('');render();});
}
function render() {
  if(!ROUTES.includes(route))route='home';
  document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.route===route?'page':'false'));
  document.body.dataset.route=route;
  if(route==='card') cardView(); else if(route==='home') home(); else if(route==='board') boardView(); else if(route==='quota') quotas(); else if(route==='data') dataView(); else capture();
  updateTitle();const heading=view.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus();}
}
if(!readOnly)for(const [key,name] of [['home','homeRoute'],['staff','staffRoute'],['rider','riderRoute'],['board','boardRoute'],['card','cardRoute'],['quota','quotaRoute'],['data','dataRoute']]) {
  const b=document.createElement('button');b.type='button';b.textContent=t(name);b.dataset.route=key;
  b.onclick=()=>{location.hash=key;};
  document.querySelector('nav').append(b);
}
window.addEventListener('beforeprint',()=>{if(route==='board')prepareBoardPrint(document);});
window.addEventListener('afterprint',()=>clearBoardPrint(document));
document.querySelector('.skip').addEventListener('click',event=>focusLink(event,document.querySelector('#main')));
view.addEventListener('click',event=>{const link=event.target.closest('[data-focus]');if(link)focusLink(event,document.getElementById(link.dataset.focus));});
window.addEventListener('hashchange',()=>{const next=routeFromHash(location.hash);if(next)void changeRoute(next);});
message('loading');
try {await openStorage();await refresh();announce('');render();} catch {message('storageError');document.querySelectorAll('nav button').forEach(b=>b.disabled=true);}
const offline=document.querySelector('#offline');offline.textContent=t('offlinePreparing');
try {await offlineFiles({serviceWorker:navigator.serviceWorker,caches:globalThis.caches,base:location.href});offline.setAttribute('role','status');offline.setAttribute('aria-live','polite');createAnnouncer(offline)(t('offlineReady'));}
catch {offline.setAttribute('role','status');offline.setAttribute('aria-live','polite');createAnnouncer(offline)(t('offlineError'));}
