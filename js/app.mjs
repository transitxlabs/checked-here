import strings from './locales/en.mjs';
import {questionsHTML,updateConditionalQuestions,conditionalAnswers} from './form.mjs';
import {STATIONS,BANDS,today,validateCheckin,validateShift,quota,riderCounts,exportCSV,exportJSON,toCSV,SHIFT_COLUMNS,dictionaryCSV,dictionaryMarkdown,prepareImport,demoRecords} from './core.mjs';
import {openStorage,readAll,addRecords,clearRecords} from './storage.mjs';
const t = key => strings[key];
const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const labelFor = value => t(value.replaceAll('-','_')) ?? value;
const view=document.querySelector('#view'),status=document.querySelector('#status');
let data={checkins:[],shifts:[]},route=new URL(location.href).searchParams.has('s')?'rider':'staff',lastExport=null,busy=false;
const stationFromURL=new URL(location.href).searchParams.get('s');
document.title=t('title');
document.querySelectorAll('[data-text]').forEach(el=>el.textContent=t(el.dataset.text));
document.querySelector('#navigation').setAttribute('aria-label',t('navigation'));
function message(key,values={}) { status.textContent=Object.entries(values).reduce((s,[k,v])=>s.replaceAll(`{${k}}`,v),t(key)); }
const errorHTML=k=>`<p class="error" id="error-${k}" hidden></p>`;
function select(k,values,hint='') {
  return `<label for="${k}">${escape(t(k))}</label><select id="${k}" name="${k}" aria-describedby="error-${k}${hint?` hint-${k}`:''}"><option value="">${escape(t('choose'))}</option>${values.map(v=>`<option value="${escape(v)}">${escape(labelFor(String(v)))}</option>`).join('')}</select>${hint?`<p class="hint" id="hint-${k}">${escape(t(hint))}</p>`:''}${errorHTML(k)}`;
}
function input(k,type,hint='',attrs='') {
  return `<label for="${k}">${escape(t(k))}</label><input id="${k}" name="${k}" type="${type}" ${attrs} aria-describedby="error-${k}${hint?` hint-${k}`:''}">${hint?`<p class="hint" id="hint-${k}">${escape(t(hint))}</p>`:''}${errorHTML(k)}`;
}
function context(staff, shift=false) {
  return `<div class="context"><div>${select('station',STATIONS)}</div>${staff?`<div>${select('round',[1,2])}</div><div>${input('date','date','',`max="${today()}"`)}</div>`:''}<div>${select('time_band',BANDS)}</div>${staff?`<div>${input('staff_code','text','staffHint','maxlength="5" autocomplete="off" pattern="[A-Z][0-9]{2,4}"')}</div>${shift?'':`<div>${input('card_number','number','cardHint','min="1" step="1"')}</div>`}`:''}</div>`;
}
function capture() {
  const staff=route==='staff';
  view.innerHTML=`<h2>${escape(t(staff?'staffRoute':'riderRoute'))}</h2><p>${escape(t(staff?'staffIntro':'riderIntro'))}</p><p>${escape(t('cardHeader'))}</p><p class="badge-local">${escape(t('routeContext'))}</p><form id="capture" novalidate>${context(staff)}${questionsHTML(staff,strings)}<button type="submit">${escape(t('save'))}</button></form>${staff?`<section><h2>${escape(t('shiftHeading'))}</h2><p>${escape(t('shiftIntro'))}</p><form id="shift" novalidate>${context(true,true)}<div class="context"><div>${input('asks','number','','min="0" step="1"')}</div><div>${input('refusals','number','','min="0" step="1"')}</div></div><button type="submit">${escape(t('shiftSave'))}</button></form></section>`:''}`;
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
    form.reset(); if(staff) form.elements.date.value=today(); if(STATIONS.includes(stationFromURL)) form.elements.station.value=stationFromURL;
    updateConditionalQuestions(form);
    message('saved');
  },event));
  shiftForm?.addEventListener('submit',event=>run(async()=>{
    event.preventDefault(); const form=event.currentTarget;
    const r={id:crypto.randomUUID(),synthetic:true,...contextFrom(form),asks:numberFrom(form,'asks'),refusals:numberFrom(form,'refusals')};
    if(showErrors(form,validateShift(r))) return;
    await addRecords({shifts:[r]}); lastExport=null; await refresh(); form.reset(); form.elements.date.value=today(); message('shiftSaved');
  },event));
}
function numberFrom(form,k) { return form.elements[k].value === '' ? NaN : Number(form.elements[k].value); }
function contextFrom(form) { return {station:form.elements.station.value,round:numberFrom(form,'round'),date:form.elements.date.value,time_band:form.elements.time_band.value,staff_code:form.elements.staff_code.value}; }
function recordFrom(form,staff) {
  return {id:crypto.randomUUID(),source:staff?'staff':'rider-link',synthetic:true,...(staff?contextFrom(form):{station:form.elements.station.value,round:null,date:today(),time_band:form.elements.time_band.value,staff_code:null}),card_number:staff?numberFrom(form,'card_number'):null,safety:numberFrom(form,'safety'),reasons:[...form.querySelectorAll('[name="reasons"]:checked')].map(el=>el.value),knows_help:form.elements.knows_help.value,noticed_board:form.elements.noticed_board.value,...conditionalAnswers(form.elements.noticed_board.value,form.elements.trust.value==='no-opinion'?'no-opinion':numberFrom(form,'trust'),form.elements.checked_meaning.value)};
}
function showErrors(form,errors) {
  form.querySelectorAll('.error').forEach(el=>{el.hidden=true;el.textContent='';});
  form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
  for(const [k,key] of Object.entries(errors)) {
    const el=form.querySelector(`[id$="error-${k}"]`); if(el) {el.textContent=t(key);el.hidden=false;}
    form.querySelectorAll(`[name="${k}"]`).forEach(el=>el.setAttribute('aria-invalid','true'));
  }
  if(Object.keys(errors).length) { message('formErrors'); form.querySelector('[aria-invalid="true"]')?.focus(); return true; }
  return false;
}
function table(caption,headers,rows) { return `<div class="table-scroll" tabindex="0" role="region" aria-label="${escape(caption)}"><table><caption>${escape(caption)}</caption><thead><tr>${headers.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>i===0?`<th scope="row">${escape(v)}</th>`:`<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
function quotas() {
  view.innerHTML=`<h2>${escape(t('quotaHeading'))}</h2><p>${escape(t('quotaIntro'))}</p>${table(t('quotaHeading'),[t('station'),t('round'),t('completed'),t('target'),t('remaining'),...BANDS.map(labelFor)],quota(data.checkins).map(r=>[r.station,r.round,r.completed,r.target,r.remaining,...BANDS.map(b=>r.bands[b])]))}${table(t('riderSeparate'),[t('station'),t('count')],riderCounts(data.checkins).map(r=>[r.station,r.count]))}${table(t('shiftTotals'),[t('station'),t('round'),t('asks'),t('refusals')],STATIONS.flatMap(s=>[1,2].map(round=>{const shifts=data.shifts.filter(r=>r.station===s&&r.round===round);return [s,round,shifts.reduce((n,r)=>n+r.asks,0),shifts.reduce((n,r)=>n+r.refusals,0)];})))}<p>${escape(t('prototype'))}</p>`;
}
function download(name,content,type) {
  const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function dataView() {
  view.innerHTML=`<h2>${escape(t('dataHeading'))}</h2><p>${escape(t('dataIntro'))}</p><p>${escape(t('prototype'))}</p><div class="actions">${['exportCSV','exportJSON','exportShifts','dictionaryCSV','dictionaryMD'].map(k=>`<button type="button" id="${k}">${escape(t(k))}</button>`).join('')}</div><form id="import"><label for="file">${escape(t('importLabel'))}</label><input id="file" type="file" accept=".csv,.json,text/csv,application/json" required><div class="actions"><button>${escape(t('importAction'))}</button></div></form><section><h2>${escape(t('demo'))}</h2><p>${escape(t('demoIntro'))}</p><button type="button" id="demo">${escape(t('demo'))}</button></section><section><h2>${escape(t('clear'))}</h2><p>${escape(t('clearIntro'))}</p><button type="button" class="danger" id="clear">${escape(t('clear'))}</button><form class="confirm" id="confirm" hidden><label class="check"><input type="checkbox" id="confirm-check" required>${escape(t('clearConfirm'))}</label><div class="actions"><button class="danger">${escape(t('clearAction'))}</button><button type="button" id="cancel">${escape(t('cancel'))}</button></div></form></section>`;
  for(const k of ['exportCSV','exportJSON','exportShifts','dictionaryCSV','dictionaryMD']) view.querySelector(`#${k}`).onclick=()=>run(async()=>{
    await refresh();
    const actions={exportCSV:()=>download('checkins.csv',exportCSV(data.checkins),'text/csv'),exportJSON:()=>{const content=exportJSON(data.checkins,data.shifts);download('device-data.json',content,'application/json');lastExport=content;},exportShifts:()=>download('shifts.csv',toCSV(data.shifts,SHIFT_COLUMNS),'text/csv'),dictionaryCSV:()=>download('data-dictionary.csv',dictionaryCSV(),'text/csv'),dictionaryMD:()=>download('data-dictionary.md',dictionaryMarkdown(),'text/markdown')};
    actions[k](); message('exportDone');
  });
  view.querySelector('#import').onsubmit=event=>run(async()=>{
    event.preventDefault(); const file=view.querySelector('#file').files[0]; if(!file) {message('noFile');return;}
    await refresh();
    try {
      const bundle=prepareImport(await file.text(),file.name.toLowerCase().endsWith('.csv')?'csv':'json',data);
      await addRecords(bundle); if(bundle.checkins.length+bundle.shifts.length) lastExport=null; await refresh();
      message('imported',{added:bundle.checkins.length+bundle.shifts.length,duplicates:bundle.duplicates});
    } catch(e) {message('importFailed',{reason:t(e.message)??t('invalidFile')});}
  },event);
  view.querySelector('#demo').onclick=()=>run(async()=>{
    await refresh(); const demo=demoRecords(),bundle=prepareImport(exportJSON(demo.checkins,demo.shifts),'json',data);
    await addRecords(bundle); if(bundle.checkins.length+bundle.shifts.length) lastExport=null; await refresh(); message('demoDone',{added:bundle.checkins.length+bundle.shifts.length,duplicates:bundle.duplicates});
  });
  view.querySelector('#clear').onclick=()=>run(async()=>{
    await refresh(); if(lastExport!==exportJSON(data.checkins,data.shifts)) {message('clearNeedExport');return;}
    view.querySelector('#confirm').hidden=false; view.querySelector('#confirm-check').focus();
  });
  view.querySelector('#cancel').onclick=()=>{view.querySelector('#confirm').hidden=true;view.querySelector('#confirm-check').checked=false;view.querySelector('#clear').focus();};
  view.querySelector('#confirm').onsubmit=event=>run(async()=>{
    event.preventDefault(); if(!view.querySelector('#confirm-check').checked) return;
    await refresh(); if(lastExport!==exportJSON(data.checkins,data.shifts)) {message('clearNeedExport');return;}
    await clearRecords(lastExport); lastExport=null; await refresh(); dataView(); message('cleared');
  },event);
}
async function refresh() {data=await readAll();}
async function run(action,event) {
  event?.preventDefault(); if(busy) return; busy=true;
  const buttons=[...document.querySelectorAll('button')]; buttons.forEach(b=>b.disabled=true);
  try {await action();} catch(e) {message(e.message==='clearNeedExport'?'clearNeedExport':'storageError');} finally {busy=false;buttons.forEach(b=>b.disabled=false);}
}
function render() {
  document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.route===route?'page':'false'));
  if(route==='quota') quotas(); else if(route==='data') dataView(); else capture();
}
for(const [key,name] of [['staff','staffRoute'],['rider','riderRoute'],['quota','quotaRoute'],['data','dataRoute']]) {
  const b=document.createElement('button');b.type='button';b.textContent=t(name);b.dataset.route=key;
  b.onclick=()=>run(async()=>{await refresh();route=key;status.textContent='';render();document.querySelector('#main').focus();});
  document.querySelector('nav').append(b);
}
message('loading');
try {await openStorage();await refresh();status.textContent='';render();} catch {message('storageError');document.querySelectorAll('nav button').forEach(b=>b.disabled=true);}
const offline=document.querySelector('#offline');offline.textContent=t('offlinePreparing');
if('serviceWorker' in navigator) {
  try {const existing=await navigator.serviceWorker.getRegistration();
    const registration=existing?.active?existing:await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;
    if(registration.active) offline.textContent=t('offlineReady');
    navigator.serviceWorker.addEventListener('controllerchange',()=>offline.textContent=t('offlineReady'));
  } catch {offline.textContent=t('offlineError');}
} else offline.textContent=t('offlineError');
