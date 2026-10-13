import test from 'node:test';
import {questionsHTML,updateConditionalQuestions,conditionalAnswers} from '../js/form.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import en from '../js/locales/en.mjs';
import second from '../js/locales/second.mjs';
import {validateCheckin,validateShift,quota,riderCounts,exportCSV,exportJSON,parseCSV,prepareImport,dictionary,dictionaryCSV,dictionaryMarkdown,COLUMNS,SHIFT_COLUMNS,REASONS,demoRecords,toCSV,csvCell} from '../js/core.mjs';
const now='2026-10-13';
const fixture=()=>({id:'12345678-1234-4234-8234-123456789012',source:'staff',synthetic:true,station:'S2',round:1,date:'2026-10-01',time_band:'weekday-morning',staff_code:'F01',card_number:1,safety:8,reasons:['lighting','help'],knows_help:'yes',noticed_board:'yes',trust:3,checked_meaning:'on-site'});
const bundle=rows=>exportJSON(rows,[]);
const read=r=>prepareImport(bundle(r),'json',undefined,now);

test('V01 required answers and permitted choices',()=>{
  const r=fixture(); assert.deepEqual(validateCheckin(r,[],now),{});
  for(const [field,value] of [['station',''],['round',null],['time_band',''],['staff_code',''],['card_number',0],['knows_help',''],['noticed_board',''],['checked_meaning','']]) assert.ok(validateCheckin({...r,[field]:value},[],now)[field],field);
  assert.ok(validateCheckin({...r,names:'unwanted'},[],now).record);
  assert.ok(validateCheckin({...r,source:'unknown'},[],now).record);
  assert.ok(validateCheckin({...r,synthetic:false},[],now).synthetic);
});
test('V02 numeric safety and trust ranges',()=>{
  for(const safety of [0,11,1.5,NaN,'8']) assert.equal(validateCheckin({...fixture(),safety},[],now).safety,'invalidSafety');
  for(const trust of [0,6,1.5,NaN,'3','']) assert.equal(validateCheckin({...fixture(),trust},[],now).trust,'invalidTrust');
  for(const safety of [1,10]) assert.equal(validateCheckin({...fixture(),safety},[],now).safety,undefined);
  assert.equal(validateCheckin({...fixture(),trust:'no-opinion'},[],now).trust,undefined);
});
test('V03 one to three distinct listed reasons',()=>{
  for(const reasons of [[],['lighting','help','waiting','crowding'],['lighting','lighting'],['unknown'],null]) assert.equal(validateCheckin({...fixture(),reasons},[],now).reasons,'invalidReasons');
  assert.equal(validateCheckin({...fixture(),reasons:REASONS.slice(0,3)},[],now).reasons,undefined);
});
test('V04 future and impossible dates',()=>{
  for(const date of ['2026-10-14','2026-02-30','','2026-13-01']) assert.equal(validateCheckin({...fixture(),date},[],now).date,'invalidDate');
  assert.equal(validateCheckin({...fixture(),date:now},[],now).date,undefined);
  assert.equal(validateCheckin({...fixture(),date:'2024-02-29'},[],now).date,undefined);
});
test('V05 card uniqueness scoped to station and round',()=>{
  const r=fixture(); assert.equal(validateCheckin(r,[r],now).card_number,'duplicateCard');
  assert.equal(validateCheckin({...r,station:'S3'},[r],now).card_number,undefined);
  assert.equal(validateCheckin({...r,round:2},[r],now).card_number,undefined);
});
test('V06 rider route has no staff identifiers',()=>{
  const r={...fixture(),source:'rider-link',round:null,staff_code:null,card_number:null};
  assert.deepEqual(validateCheckin(r,[],now),{});
  assert.equal(validateCheckin({...r,card_number:1},[],now).record,'invalidRecord');
});
test('V07 shift counts and refusal constraint',()=>{
  const r={id:fixture().id,synthetic:true,station:'S2',round:1,date:now,time_band:'weekend',staff_code:'F01',asks:10,refusals:2};
  assert.deepEqual(validateShift(r,now),{});
  for(const asks of [-1,1.5,NaN,'3']) assert.equal(validateShift({...r,asks},now).asks,'invalidCount');
  assert.equal(validateShift({...r,refusals:11},now).refusals,'invalidRefusals');
  assert.equal(validateShift({...r,date:'2026-10-14'},now).date,'invalidDate');
});
test('Q01 staffed quota excludes rider links and splits bands',()=>{
  const r=fixture(),q=quota([r,{...r,source:'rider-link'},{...r,round:2},{...r,station:'S1'},{...r,time_band:'weekend'}]);
  assert.equal(q.length,8); const row=q.find(x=>x.station==='S2'&&x.round===1);
  assert.equal(row.completed,2); assert.equal(row.target,75); assert.equal(row.remaining,73);
  assert.equal(row.bands['weekday-morning'],1);assert.equal(row.bands.weekend,1);
});
test('Q02 rider counts are separate',()=>{
  const rows=riderCounts([fixture(),{...fixture(),source:'rider-link'}]);
  assert.equal(rows.find(r=>r.station==='S2').count,1);assert.equal(rows.reduce((n,r)=>n+r.count,0),1);
});
test('E01 CSV has all columns and binary reasons',()=>{
  const rows=parseCSV(exportCSV([fixture()]));assert.deepEqual(rows[0],COLUMNS);assert.equal(rows.length,2);
  const r=Object.fromEntries(rows[0].map((c,i)=>[c,rows[1][i]]));
  for(const reason of REASONS) assert.equal(r[`reason_${reason}`],fixture().reasons.includes(reason)?'1':'0');
  assert.deepEqual(prepareImport(exportCSV([fixture()]),'csv',undefined,now).checkins,[fixture()]);
});
test('E02 CSV quoting and malformed inputs',()=>{
  assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');
  assert.deepEqual(parseCSV('x,y\r\n"a,""b""\nc",d\r\n'),[['x','y'],['a,"b"\nc','d']]);
  for(const text of ['"unterminated','a"b,c','"x"z,c']) assert.throws(()=>parseCSV(text));
});
test('E03 JSON schema preserves check-ins and shifts',()=>{
  const demo=demoRecords(); const json=exportJSON([fixture()],demo.shifts.slice(0,1));
  assert.deepEqual(JSON.parse(json),{schema_version:1,checkins:[fixture()],shifts:demo.shifts.slice(0,1)});
  assert.deepEqual(prepareImport(json,'json',undefined,now).shifts,demo.shifts.slice(0,1));
  assert.deepEqual(prepareImport(toCSV(demo.shifts,SHIFT_COLUMNS),'csv',undefined,now).shifts,demo.shifts);
});
test('D01 dictionary lists every column with type and values',()=>{
  const d=dictionary(); assert.deepEqual(d.filter(r=>r.dataset==='checkins').map(r=>r.column),COLUMNS);
  assert.deepEqual(d.filter(r=>r.dataset==='shifts').map(r=>r.column),SHIFT_COLUMNS);
  for(const row of d) for(const key of ['dataset','column','type','allowed_values','description']) assert.equal(typeof row[key],'string');
  assert.equal(d.find(r=>r.column==='reason_lighting').allowed_values,'0; 1');
  assert.equal(d.find(r=>r.column==='source').allowed_values,'staff; rider-link');
  const csv=parseCSV(dictionaryCSV()); assert.equal(csv.length,d.length+1);
  assert.equal(readFileSync(new URL('../data-dictionary.csv',import.meta.url),'utf8'),dictionaryCSV());
  assert.equal(readFileSync(new URL('../DATA_DICTIONARY.md',import.meta.url),'utf8'),dictionaryMarkdown());
  const md=dictionaryMarkdown(); for(const row of d) assert.ok(md.includes(`| ${row.dataset} | ${row.column} |`));
});
test('I01 repeated IDs and card keys are detected',()=>{
  const r=fixture(),existing={checkins:[r],shifts:[]};
  const duplicate=prepareImport(bundle([r]),'json',existing,now);assert.equal(duplicate.duplicates,1);assert.equal(duplicate.checkins.length,0);
  const sameCard={...r,id:'22345678-1234-4234-8234-123456789012'};
  assert.equal(prepareImport(bundle([sameCard]),'json',existing,now).duplicates,1);
  assert.equal(read([r,r]).duplicates,1);
  const demo=demoRecords();assert.equal(prepareImport(exportJSON([],demo.shifts),'json',{checkins:[],shifts:demo.shifts},now).duplicates,8);
});
test('I02 conflicts abort and input data stays unchanged',()=>{
  const r=fixture(),existing={checkins:[r],shifts:[]},snapshot=structuredClone(existing);
  assert.throws(()=>prepareImport(bundle([{...r,safety:2}]),'json',existing,now),/conflict/);
  assert.throws(()=>prepareImport(bundle([{...r,id:'22345678-1234-4234-8234-123456789012',safety:2}]),'json',existing,now),/conflict/);
  assert.deepEqual(existing,snapshot);
});
test('I03 malformed imports and personal fields are rejected',()=>{
  for(const text of ['{}','null',JSON.stringify({schema_version:2,checkins:[],shifts:[]}),JSON.stringify({schema_version:1,checkins:[],shifts:[],extra:'text'})]) assert.throws(()=>prepareImport(text,'json',undefined,now),/invalidFile/);
  assert.throws(()=>read([{...fixture(),email:'unwanted'}]),/invalidFile/);
  assert.throws(()=>read([{...fixture(),synthetic:false}]),/invalidSynthetic/);
  assert.throws(()=>read([{...fixture(),safety:0}]),/invalidFile/);
  assert.throws(()=>prepareImport(exportCSV([fixture()]).replace('reason_lighting','other'),'csv',undefined,now),/invalidFile/);
  assert.throws(()=>prepareImport(exportCSV([fixture()]).replace(',true,',',false,'),'csv',undefined,now),/invalidSynthetic/);
});
test('S01 synthetic demo fills 600 staffed and 8 separate riders',()=>{
  const d=demoRecords();assert.equal(d.checkins.length,608);assert.equal(d.shifts.length,8);
  assert.equal(new Set([...d.checkins,...d.shifts].map(r=>r.id)).size,616);
  for(const q of quota(d.checkins)) assert.equal(q.completed,75);
  for(const r of d.checkins) assert.deepEqual(validateCheckin(r,[],now),{});
  assert.equal(prepareImport(exportJSON(d.checkins,d.shifts),'json',undefined,now).duplicates,0);
});
test('L01 second locale has matching pending keys',()=>{
  assert.deepEqual(Object.keys(second).sort(),Object.keys(en).sort());
  assert.ok(Object.values(second).every(v=>v==='translation pending'));
});
test('O01 service worker caches every runtime module',()=>{
  const worker=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  for(const file of ['index.html','styles.css','icon.svg','js/app.mjs','js/form.mjs','js/core.mjs','js/storage.mjs','js/locales/en.mjs','js/locales/second.mjs']) assert.ok(worker.includes(`'./${file}'`),file);
  assert.ok(worker.includes("event.request.mode==='navigate'"));
});

test('V08 questions 5 and 6 required after Yes on both routes',()=>{
  for(const source of ['staff','rider-link']) {
    const r=source==='staff'?fixture():{...fixture(),source,round:null,staff_code:null,card_number:null};
    assert.deepEqual(validateCheckin(r,[],now),{});
    for(const k of ['trust','checked_meaning']) for(const value of [null,'',undefined]) assert.ok(validateCheckin({...r,[k]:value},[],now)[k]);
  }
});
test('V09 questions 5 and 6 empty and not required otherwise',()=>{
  for(const source of ['staff','rider-link']) for(const noticed_board of ['no','not-sure']) {
    const r={...fixture(),source,noticed_board,trust:null,checked_meaning:null,...(source==='rider-link'?{round:null,staff_code:null,card_number:null}:{})};
    assert.deepEqual(validateCheckin(r,[],now),{});
  }
});
test('V10 values when question 4 is not Yes rejected on save',()=>{
  for(const source of ['staff','rider-link']) for(const noticed_board of ['no','not-sure']) for(const k of ['trust','checked_meaning']) {
    const r={...fixture(),source,noticed_board,trust:null,checked_meaning:null,...(source==='rider-link'?{round:null,staff_code:null,card_number:null}:{})};
    for(const value of [fixture()[k],'',undefined]) assert.ok(validateCheckin({...r,[k]:value},[],now)[k]);
  }
});
test('I04 questions 5 and 6 required after Yes on import',()=>{
  for(const source of ['staff','rider-link']) for(const k of ['trust','checked_meaning']) {
    const r={...fixture(),source,[k]:null,...(source==='rider-link'?{round:null,staff_code:null,card_number:null}:{})};
    for(const format of ['json','csv']) assert.throws(()=>prepareImport(format==='json'?bundle([r]):exportCSV([r]),format,undefined,now),/invalidFile/);
  }
});
test('I05 empty conditional answers round trip on import',()=>{
  for(const source of ['staff','rider-link']) for(const noticed_board of ['no','not-sure']) {
    const r={...fixture(),source,noticed_board,trust:null,checked_meaning:null,...(source==='rider-link'?{round:null,staff_code:null,card_number:null}:{})};
    for(const format of ['json','csv']) assert.deepEqual(prepareImport(format==='json'?bundle([r]):exportCSV([r]),format,undefined,now).checkins,[r]);
  }
});
test('I06 values when question 4 is not Yes rejected on import',()=>{
  for(const source of ['staff','rider-link']) for(const noticed_board of ['no','not-sure']) for(const k of ['trust','checked_meaning']) {
    const r={...fixture(),source,noticed_board,trust:null,checked_meaning:null,[k]:fixture()[k],...(source==='rider-link'?{round:null,staff_code:null,card_number:null}:{})};
    for(const format of ['json','csv']) assert.throws(()=>prepareImport(format==='json'?bundle([r]):exportCSV([r]),format,undefined,now),/invalidFile/);
  }
});
test('E04 conditional answers export as empty CSV cells',()=>{
  for(const noticed_board of ['no','not-sure']) {
    const [header,row]=parseCSV(exportCSV([{...fixture(),noticed_board,trust:null,checked_meaning:null}]));
    for(const k of ['trust','checked_meaning']) assert.equal(row[header.indexOf(k)],'');
  }
});
test('D02 dictionary explains conditional answers and emptiness',()=>{
  for(const column of ['trust','checked_meaning']) {
    const row=dictionary().find(r=>r.column===column);
    assert.match(row.description,/Asked only after a Yes on question 4; empty \(null\) otherwise\./);
    assert.match(row.allowed_values,/empty unless noticed_board=yes/);
  }
});
test('S02 demo has all question 4 choices and consistent follow-ups',()=>{
  for(const source of ['staff','rider-link']) {
    const rows=demoRecords().checkins.filter(r=>r.source===source);
    assert.deepEqual([...new Set(rows.map(r=>r.noticed_board))].sort(),['no','not-sure','yes']);
    for(const r of rows) {
      if(r.noticed_board==='yes') {assert.notEqual(r.trust,null);assert.notEqual(r.checked_meaning,null);}
      else {assert.equal(r.trust,null);assert.equal(r.checked_meaning,null);}
    }
  }
});

test('F01 rider help-line placeholder before the first question',()=>{
  const line='[Emergency and non-emergency help lines approved by the client go here]';
  const html=questionsHTML(false);assert.ok(html.includes(`<p>${line}</p>`));assert.ok(html.indexOf(line)<html.indexOf('<fieldset>'));
  assert.ok(!questionsHTML(true).includes(line));
});
test('F02 rider urgent-help notice before the first question',()=>{
  const line='Nobody watches this form for urgent help.';
  const html=questionsHTML(false);assert.ok(html.includes(`<p>${line}</p>`));assert.ok(html.indexOf(line)<html.indexOf('<fieldset>'));
  assert.ok(!questionsHTML(true).includes(line));
});
test('F03 conditional form hides clears and requires follow-ups',()=>{
  for(const staff of [true,false]) {
    const html=questionsHTML(staff),hint='Answer 5 and 6 only if you answered Yes to question 4.';
    assert.ok(html.includes(hint));assert.ok(html.indexOf(hint)<html.indexOf('name="trust"'));
    const section={hidden:true},errors={trust:{},checked_meaning:{}},elements={noticed_board:{value:'yes'},trust:{value:'3',removeAttribute(){}},checked_meaning:{value:'on-site',removeAttribute(){}}};
    const form={elements,querySelector:s=>s==='#conditional-questions'?section:errors[s.slice(7)]};
    updateConditionalQuestions(form);assert.equal(section.hidden,false);
    for(const k of ['trust','checked_meaning']) {assert.equal(elements[k].required,true);assert.equal(elements[k].disabled,false);assert.notEqual(elements[k].value,'');}
    for(const answer of ['no','not-sure','']) {
      elements.noticed_board.value=answer;elements.trust.value='3';elements.checked_meaning.value='on-site';
      updateConditionalQuestions(form);assert.equal(section.hidden,true);
      for(const k of ['trust','checked_meaning']) {assert.equal(elements[k].required,false);assert.equal(elements[k].disabled,true);assert.equal(elements[k].value,'');assert.equal(errors[k].hidden,true);}
    }
  }
});
test('F04 form stores null conditional answers when not asked',()=>{
  assert.deepEqual(conditionalAnswers('yes',3,'on-site'),{trust:3,checked_meaning:'on-site'});
  for(const answer of ['no','not-sure','']) assert.deepEqual(conditionalAnswers(answer,3,'on-site'),{trust:null,checked_meaning:null});
  const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');
  assert.ok(app.includes('...conditionalAnswers(form.elements.noticed_board.value,'));
  assert.ok(app.includes("addEventListener('change',()=>updateConditionalQuestions(captureForm))"));
});
test('F05 both card headers use the short voluntary wording',()=>{
  assert.equal(en.cardHeader,'A short, voluntary card.');
  const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');
  assert.ok(app.includes("<p>${escape(t('cardHeader'))}</p>"));
});

import {validateAction,appendAction,currentActions,boardCSV,actionLogCSV,ACTION_COLUMNS,BOARD_COLUMNS,BOARD_NOTICE} from '../js/core.mjs';
import {stationBoardHTML} from '../js/board.mjs';
const action=()=>({id:'33333333-1234-4234-8234-123456789012',action_id:'44444444-1234-4234-8234-123456789012',synthetic:true,station:'S1',title:'Inspect lights',concern:'lighting',status:'planned',reason:'',updated_at:'2026-01-01T09:00:00.000Z'});
test('B01 Not done needs a short reason and all board fields validate',()=>{
  const r=action();assert.deepEqual(validateAction(r,[],now+'T12:00:00.000Z'),{});
  for(const reason of ['', ' ', 'x'.repeat(161)]) assert.ok(validateAction({...r,status:'not-done',reason}).reason);
  assert.deepEqual(validateAction({...r,status:'not-done',reason:'Visit rescheduled'},[],now+'T12:00:00.000Z'),{});
  for(const [key,value] of [['title',''],['concern','unknown'],['status','unknown'],['station','S5'],['synthetic',false],['updated_at','2026-02-30T00:00:00.000Z']]) assert.ok(Object.keys(validateAction({...r,[key]:value})).length,key);
});
test('B02 status history is retained and current board uses latest date',()=>{
  const first=action(),history=[first],snapshot=structuredClone(history),next={...first,id:'55555555-1234-4234-8234-123456789012',status:'checked',updated_at:'2026-01-02T09:00:00.000Z'};
  const result=appendAction(history,next);assert.equal(result.length,2);assert.deepEqual(history,snapshot);assert.deepEqual(result[0],first);assert.deepEqual(currentActions(result,'S1'),[next]);assert.deepEqual(currentActions(result,'S2'),[]);
  for(const bad of [{...next,title:'Changed title'},{...next,updated_at:first.updated_at},{...next,status:'planned'}]) assert.throws(()=>appendAction(history,bad));
});
test('B03 board and action log CSV have the specified columns and synthetic markers',()=>{
  const demo=demoRecords();const [boardHeader,...rows]=parseCSV(boardCSV(demo.action_log,'S1'));
  assert.deepEqual(boardHeader,BOARD_COLUMNS);assert.equal(rows.length,3);assert.ok(rows.every(r=>r[boardHeader.indexOf('synthetic')]==='true'));
  const [logHeader,...logRows]=parseCSV(actionLogCSV(demo.action_log,'S1'));assert.deepEqual(logHeader,ACTION_COLUMNS);assert.equal(logRows.length,5);
  const html=stationBoardHTML(demo.action_log,'S1',en);assert.ok(html.includes(BOARD_NOTICE));assert.ok(html.includes('2026-01-02'));assert.ok(html.includes('Demonstration: synthetic data'));
});
test('B04 board log exports round trip and conflicts preserve append-only history',()=>{
  const demo=demoRecords(),json=exportJSON(demo.checkins,demo.shifts,demo.action_log);
  assert.deepEqual(prepareImport(json,'json',undefined,now).action_log,demo.action_log.slice().sort((a,b)=>a.updated_at.localeCompare(b.updated_at)));
  const log=prepareImport(actionLogCSV(demo.action_log),'csv',undefined,now).action_log;assert.equal(log.length,20);
  assert.equal(prepareImport(json,'json',demo,now).duplicates,636);
  const changed=structuredClone(demo);changed.action_log[0].title='Conflict';assert.throws(()=>prepareImport(exportJSON([],[],changed.action_log),'json',demo,now),/conflict/);
});

import {questionSource} from '../js/questions.mjs';
import {printableCardHTML} from '../js/card.mjs';
test('C01 printable card and both forms use the same six-question source',()=>{
  const questions=questionSource();assert.equal(questions.length,6);assert.deepEqual(questions[1].choices.map(c=>c.value),REASONS);
  const card=printableCardHTML();for(const q of questions){const prompt=q.prompt.replaceAll('"','&quot;');assert.ok(card.includes(prompt));assert.ok(questionsHTML(true).includes(prompt));assert.ok(questionsHTML(false).includes(prompt));for(const c of q.choices)assert.ok(card.includes(c.label));}
  assert.ok(card.includes('Emergency: call 911.'));assert.ok(card.includes(en.riderHelp));assert.ok(card.includes(en.notice));assert.ok(card.includes('Otherwise you are done: thank you.'));
  assert.equal(questions[0].prompt,'How safe do you feel at this station right now?');assert.equal(questions[1].prompt,'What affects how safe you feel here today? Tick up to 3.');assert.equal(questions[4].prompt,'How much do you trust the updates posted at this station?');
  for(const module of ['form','card'])assert.ok(readFileSync(new URL(`../js/${module}.mjs`,import.meta.url),'utf8').includes('questionSource(locale)'));
});

import {storageDouble} from './helpers/storage.mjs';
import {openStorage,readAll,addRecords,clearRecords} from '../js/storage.mjs';
test('M01 demo spans four stations two rounds and dated synthetic board states',()=>{
  const demo=demoRecords();assert.equal(demo.action_log.length,20);assert.equal(currentActions(demo.action_log).length,12);
  for(const station of ['S1','S2','S3','S4']) {
    assert.deepEqual([...new Set(demo.checkins.filter(r=>r.station===station&&r.source==='staff').map(r=>r.round))].sort(),[1,2]);
    assert.deepEqual(currentActions(demo.action_log,station).map(r=>r.status).sort(),['checked','not-done','planned']);
  }
  for(const r of [...demo.checkins,...demo.shifts,...demo.action_log])assert.equal(r.synthetic,true);
  assert.ok(demo.action_log.every(r=>r.updated_at.startsWith('2026-01-')));
});
test('M02 loading and clearing retains transaction safeguards and clears every dataset',async()=>{
  const previous=globalThis.indexedDB;globalThis.indexedDB=storageDouble();
  try {
    await openStorage();const demo=demoRecords();await addRecords(demo);
    let data=await readAll();assert.equal(data.checkins.length,608);assert.equal(data.shifts.length,8);assert.equal(data.action_log.length,20);
    const snapshot=exportJSON(data.checkins,data.shifts,data.action_log);
    await addRecords({action_log:[action()]});
    await assert.rejects(clearRecords(snapshot),/clearNeedExport/);data=await readAll();assert.equal(data.action_log.length,21);assert.equal(data.checkins.length,608);
    await clearRecords(exportJSON(data.checkins,data.shifts,data.action_log));
    assert.deepEqual(await readAll(),{checkins:[],shifts:[],action_log:[]});
  } finally {globalThis.indexedDB=previous;}
});

import {readdirSync} from 'node:fs';
test('O02 offline cache covers every page module manifest and icon',()=>{
  const root=new URL('../',import.meta.url),worker=readFileSync(new URL('sw.js',root),'utf8');
  const assets=['index.html','styles.css','icon.svg','manifest.webmanifest',...readdirSync(new URL('icons/',root)).map(f=>`icons/${f}`)];
  const walk=(dir)=>{for(const file of readdirSync(new URL(dir+'/',root),{withFileTypes:true})){const path=`${dir}/${file.name}`;if(file.isDirectory())walk(path);else assets.push(path);}};walk('js');
  for(const file of assets)assert.ok(worker.includes(`'./${file}'`),file);
  assert.ok(worker.includes("const CACHE = 'transitx-checkin-v1.1.1'"));assert.ok(!worker.includes('fetch(event.request)'));
  const manifest=JSON.parse(readFileSync(new URL('manifest.webmanifest',root),'utf8'));assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.icons.length,3);
});

import {runInNewContext} from 'node:vm';
test('O03 worker installs assets deletes old caches and serves relative paths offline',async()=>{
  const handlers={},entries=new Map([['transitx-checkin-v4',new Map()],['unrelated-cache',new Map()]]),base='http://localhost/checkin-prototype/';let skipped=false,claimed=false;
  const caches={keys:async()=>[...entries.keys()],delete:async key=>entries.delete(key),open:async key=>{if(!entries.has(key))entries.set(key,new Map());const store=entries.get(key);return {addAll:async files=>{for(const file of files)store.set(new URL(file,base).href,new Response('cached '+file));},match:async request=>store.get(typeof request==='string'?request:request.url)};}};
  const self={location:{origin:'http://localhost',href:base+'sw.js'},addEventListener:(type,handler)=>handlers[type]=handler,skipWaiting:async()=>{skipped=true;},clients:{claim:async()=>{claimed=true;}}};
  runInNewContext(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),{self,caches,URL,Response});
  const lifecycle=async type=>{let work;handlers[type]({waitUntil:promise=>work=promise});await work;};await lifecycle('install');await lifecycle('activate');
  assert.equal(skipped,true);assert.equal(claimed,true);assert.deepEqual([...entries.keys()].sort(),['transitx-checkin-v1.1.1','unrelated-cache']);
  const request=async(url,mode)=>{let response;handlers.fetch({request:{method:'GET',url,mode},respondWith:promise=>response=promise});return await response;};
  assert.equal(await(await request(base+'?s=S2','navigate')).text(),'cached ./index.html');assert.equal((await request(base+'js/card.mjs','cors')).status,200);assert.equal((await request(base+'missing.txt','cors')).status,404);assert.equal((await request('https://example.invalid/','cors')).status,403);
});

import {stationDate,offsetTimestamp,canonicalTimestamp} from '../js/dates.mjs';
import {boardActions,statusBadgeHTML,actionLogHTML} from '../js/board.mjs';
test('P01 station dates use plain words and the selected local zone',()=>{
  assert.equal(stationDate('2026-01-02T22:30:00.000Z'),'2 January 2026, 2:30 p.m.');
  assert.equal(stationDate('2026-01-02T22:30:00.000Z','America/Toronto'),'2 January 2026, 5:30 p.m.');
  assert.equal(stationDate('2026-01-03T08:00:00.000Z'),'3 January 2026, 12:00 a.m.');
  assert.equal(stationDate('2026-01-03T20:00:00.000Z'),'3 January 2026, 12:00 p.m.');
  const html=stationBoardHTML([{...action(),updated_at:'2026-01-02T22:30:00.000Z'}],'S1',en);
  assert.ok(html.includes('Last updated: <time'));assert.ok(html.includes('2 January 2026, 2:30 p.m.'));assert.ok(!html.includes(' UTC'));
});
test('P02 Vancouver moves to UTC-7 on 8 March 2026 without changing the instant',()=>{
  assert.equal(offsetTimestamp('2026-03-08T09:59:59.000Z'),'2026-03-08T01:59:59.000-08:00');
  assert.equal(offsetTimestamp('2026-03-08T10:00:00.000Z'),'2026-03-08T03:00:00.000-07:00');
  assert.equal(offsetTimestamp('2026-11-01T09:30:00.000Z','America/St_Johns'),'2026-11-01T06:00:00.000-03:30');
});
test('P09 Vancouver does not fall back on 1 November 2026 and stays at UTC-7 in winter',()=>{
  const before='2026-11-01T08:30:00.000Z',after='2026-11-01T09:30:00.000Z';
  assert.equal(stationDate(before),'1 November 2026, 1:30 a.m.');assert.equal(stationDate(after),'1 November 2026, 2:30 a.m.');
  assert.equal(offsetTimestamp(before),'2026-11-01T01:30:00.000-07:00');
  assert.equal(offsetTimestamp(after),'2026-11-01T02:30:00.000-07:00');
  assert.equal(offsetTimestamp('2027-01-15T19:00:00.000Z'),'2027-01-15T12:00:00.000-07:00');
  assert.equal(stationDate('2027-01-15T19:00:00.000Z'),'15 January 2027, 12:00 p.m.');
});
test('P03 board groups statuses and orders the latest snapshots newest first',()=>{
  const statuses=['not-done','planned','checked','checked','planned','not-done'];
  const history=statuses.map((status,i)=>({...action(),id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,action_id:`00000000-0000-4000-8001-${String(i+1).padStart(12,'0')}`,status,title:`Action ${i}`,updated_at:`2026-01-0${i+1}T09:00:00.000Z`,reason:status==='not-done'?'Visit deferred':''}));
  const original=structuredClone(history);
  assert.deepEqual(boardActions(history,'S1').map(r=>r.title),['Action 3','Action 2','Action 4','Action 1','Action 5','Action 0']);
  const html=stationBoardHTML(history,'S1',en);
  const titles=[...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map(m=>m[1]);
  assert.deepEqual(titles,['Action 3','Action 2','Action 4','Action 1','Action 5','Action 0']);assert.deepEqual(history,original);
  assert.ok(html.includes('6 January 2026, 1:00 a.m.'));
});
test('P04 every status pairs its distinct inline symbol and word in board and log',()=>{
  const symbols={checked:'m5 12 4 4L19 6',planned:'M12 6v6l4 2','not-done':'m6 6 12 12M18 6 6 18'};
  for(const [status,symbol] of Object.entries(symbols)) {
    const badge=statusBadgeHTML(status,en),word=en[status.replaceAll('-','_')];
    assert.ok(badge.includes(`<span>${word}</span>`));assert.ok(badge.includes(`<svg data-icon="${status}"`));assert.ok(badge.includes(symbol));
    assert.ok(badge.includes('aria-hidden="true"'));assert.ok(badge.includes('focusable="false"'));
    const row={...action(),status,reason:status==='not-done'?'Visit deferred':''};
    assert.ok(stationBoardHTML([row],'S1',en).includes(badge));assert.ok(actionLogHTML([row],'S1',en).includes(badge));
  }
});
test('P05 each printed board repeats the synthetic banner and required footer',()=>{
  const html=stationBoardHTML(demoRecords().action_log,'S1',en),css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  const head=html.match(/<thead>(.*?)<\/thead>/s)[1],foot=html.match(/<tfoot>(.*?)<\/tfoot>/s)[1];
  assert.ok(head.includes('Demonstration: synthetic data'));assert.equal((html.match(/Demonstration: synthetic data/g)||[]).length,1);
  assert.ok(foot.includes(BOARD_NOTICE));assert.ok(foot.includes('Tell us how safe you feel: [rider form link or code goes here]'));
  assert.ok(css.includes('.poster-table thead { display:table-header-group; }'));assert.ok(css.includes('.poster-table tfoot { display:table-footer-group; }'));
  assert.ok(!html.includes('Synthetic record'));assert.ok(!html.includes(' UTC'));
});
test('P06 action log has readable dates and a named keyboard scroll region',()=>{
  const html=actionLogHTML([{...action(),updated_at:'2026-01-02T22:30:00.000Z',title:'A'.repeat(100)}],'S1',en);
  assert.ok(html.includes('tabindex="0" role="region" aria-label="Action log"'));assert.ok(html.includes('<caption>Action log.'));
  assert.ok(html.includes('2 January 2026, 2:30 p.m.'));assert.ok(!html.includes('Synthetic record'));
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');assert.match(css,/\.table-scroll\s*\{[^}]*overflow-x:auto/);
  assert.ok(css.includes('.action-log { max-width:100%; }'));assert.ok(css.includes('white-space:normal; overflow-wrap:anywhere;'));
});
test('P07 board and log CSV preserve explicit station offsets and round trip history',()=>{
  const demo=demoRecords();
  for(const csv of [boardCSV(demo.action_log,'S1'),actionLogCSV(demo.action_log,'S1')]) {
    const [header,...rows]=parseCSV(csv);assert.ok(rows.every(r=>/T\d{2}:\d{2}:\d{2}\.\d{3}-08:00$/.test(r[header.indexOf('updated_at')])));
  }
  const csv=actionLogCSV(demo.action_log,'S1','America/Toronto');assert.ok(csv.includes('-05:00'));
  assert.deepEqual(prepareImport(csv,'csv',undefined,now).action_log,demo.action_log.filter(r=>r.station==='S1').sort((a,b)=>a.updated_at.localeCompare(b.updated_at)));
  for(const iso of ['2026-11-01T08:30:00.000Z','2026-11-01T09:30:00.000Z'])assert.equal(canonicalTimestamp(offsetTimestamp(iso)),iso);
  for(const bad of ['2026-02-30T12:00:00.000-08:00','2026-01-02T12:00:00.000-14:30','2026-01-02T12:00:00.000-08:60'])assert.throws(()=>canonicalTimestamp(bad));
});
test('P08 board offers both print sizes with tabloid body type at least 18 pt',()=>{
  const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8'),css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  assert.ok(app.includes('id="board-print-size"'));assert.ok(app.includes('value="letter"'));assert.ok(app.includes('value="tabloid"'));
  assert.ok(css.includes('@page boardTabloid { size:17in 11in;'));assert.ok(css.includes('body.print-tabloid .station-board { page:boardTabloid; font-size:18pt; }'));
  assert.ok(app.includes("['pilotCard','pilotStaff','pilotBoard','pilotNext']"));
});
