import test from 'node:test';
import {questionsHTML,updateConditionalQuestions,conditionalAnswers} from '../js/form.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import en from '../js/locales/en.mjs';
import second from '../js/locales/second.mjs';
import {validateCheckin,validateShift,quota,riderCounts,exportCSV,exportJSON,parseCSV,prepareImport,dictionary,dictionaryCSV,dictionaryMarkdown,COLUMNS,SHIFT_COLUMNS,REASONS,demoRecords,toCSV,csvCell,BOARD_ANSWERS,CHECKED,ACTION_COLUMNS,isBlankCard,compareActionEvents} from '../js/core.mjs';
import {ROUTES,routeFromHash,focusLink,createAnnouncer,pageTitle,resetCard,createRunner,withDeadline,offlineFiles,printPanels} from '../js/ui.mjs';
import {dateWords,wordDate,boardDate} from '../js/display-dates.mjs';
import {boardActions,statusBadgeHTML,actionLogHTML,stationBoardHTML} from '../js/board.mjs';
import {questionSource} from '../js/questions.mjs';
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
  assert.equal(validateCheckin({...fixture(),safety:null},[],now).safety,undefined);
  assert.equal(validateCheckin({...fixture(),trust:null,checked_meaning:null},[],now).trust,undefined);
  for(const safety of [1,10]) assert.equal(validateCheckin({...fixture(),safety},[],now).safety,undefined);
  assert.equal(validateCheckin({...fixture(),trust:'no-opinion'},[],now).trust,undefined);
});
test('V03 one to three distinct listed reasons',()=>{
  for(const reasons of [['lighting','help','waiting','crowding'],['lighting','lighting'],['unknown'],null]) assert.equal(validateCheckin({...fixture(),reasons},[],now).reasons,'invalidReasons');
  assert.equal(validateCheckin({...fixture(),reasons:[]},[],now).reasons,undefined);
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
  const demo=demoRecords(new Date('2026-10-13T12:00:00.000Z')); const json=exportJSON([fixture()],demo.shifts.slice(0,1));
  assert.deepEqual(JSON.parse(json),{schema_version:1,checkins:[fixture()],shifts:demo.shifts.slice(0,1)});
  assert.deepEqual(prepareImport(json,'json',undefined,now).shifts,demo.shifts.slice(0,1));
  assert.deepEqual(prepareImport(toCSV(demo.shifts,SHIFT_COLUMNS),'csv',undefined,now).shifts,demo.shifts);
});
test('D01 dictionary lists every column with type and values',()=>{
  const d=dictionary(); assert.deepEqual(d.filter(r=>r.dataset==='checkins').map(r=>r.column),COLUMNS);
  assert.deepEqual(d.filter(r=>r.dataset==='shifts').map(r=>r.column),SHIFT_COLUMNS);
  for(const row of d) for(const key of ['dataset','column','type','allowed_values','description']) assert.equal(typeof row[key],'string');
  assert.equal(d.find(r=>r.column==='reason_lighting').allowed_values,'0; 1; empty when no question 2 answer');
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
  const demo=demoRecords(new Date('2026-10-13T12:00:00.000Z'));assert.equal(prepareImport(exportJSON([],demo.shifts),'json',{checkins:[],shifts:demo.shifts},now).duplicates,8);
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
  const d=demoRecords(new Date('2026-10-13T12:00:00.000Z'));assert.equal(d.checkins.length,608);assert.equal(d.shifts.length,8);
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
  for(const file of ['index.html','styles.css','icon.svg','js/app.mjs','js/form.mjs','js/core.mjs','js/storage.mjs','js/locales/en.mjs','js/ui.mjs','js/display-dates.mjs']) assert.ok(worker.includes(`'./${file}'`),file);
  assert.ok(worker.includes("event.request.mode==='navigate'"));
});

test('V08 questions 5 and 6 remain optional after Yes on both routes',()=>{
  for(const source of ['staff','rider-link']) {
    const r=source==='staff'?fixture():{...fixture(),source,round:null,staff_code:null,card_number:null};
    assert.deepEqual(validateCheckin(r,[],now),{});
    for(const k of ['trust','checked_meaning']) assert.equal(validateCheckin({...r,[k]:null},[],now)[k],undefined);
  }
});
test('V09 questions 5 and 6 empty and not required otherwise',()=>{
  for(const source of ['staff','rider-link']) for(const noticed_board of ['yes-unread','no','not-sure',null]) {
    const r={...fixture(),source,noticed_board,trust:null,checked_meaning:null,...(source==='rider-link'?{round:null,staff_code:null,card_number:null}:{})};
    assert.deepEqual(validateCheckin(r,[],now),{});
  }
});
test('V10 values when question 4 is not Yes rejected on save',()=>{
  for(const source of ['staff','rider-link']) for(const noticed_board of ['yes-unread','no','not-sure',null]) for(const k of ['trust','checked_meaning']) {
    const r={...fixture(),source,noticed_board,trust:null,checked_meaning:null,...(source==='rider-link'?{round:null,staff_code:null,card_number:null}:{})};
    for(const value of [fixture()[k],'',undefined]) assert.ok(validateCheckin({...r,[k]:value},[],now)[k]);
  }
});
test('I04 questions 5 and 6 may be blank after Yes on import',()=>{
  for(const source of ['staff','rider-link']) for(const k of ['trust','checked_meaning']) {
    const r={...fixture(),source,[k]:null,...(source==='rider-link'?{round:null,staff_code:null,card_number:null}:{})};
    for(const format of ['json','csv']) assert.deepEqual(prepareImport(format==='json'?bundle([r]):exportCSV([r]),format,undefined,now).checkins,[r]);
  }
});
test('I05 empty conditional answers round trip on import',()=>{
  for(const source of ['staff','rider-link']) for(const noticed_board of ['yes-unread','no','not-sure',null]) {
    const r={...fixture(),source,noticed_board,trust:null,checked_meaning:null,...(source==='rider-link'?{round:null,staff_code:null,card_number:null}:{})};
    for(const format of ['json','csv']) assert.deepEqual(prepareImport(format==='json'?bundle([r]):exportCSV([r]),format,undefined,now).checkins,[r]);
  }
});
test('I06 values when question 4 is not Yes rejected on import',()=>{
  for(const source of ['staff','rider-link']) for(const noticed_board of ['yes-unread','no','not-sure',null]) for(const k of ['trust','checked_meaning']) {
    const r={...fixture(),source,noticed_board,trust:null,checked_meaning:null,[k]:fixture()[k],...(source==='rider-link'?{round:null,staff_code:null,card_number:null}:{})};
    for(const format of ['json','csv']) assert.throws(()=>prepareImport(format==='json'?bundle([r]):exportCSV([r]),format,undefined,now),/invalidFile/);
  }
});
test('E04 conditional answers export as empty CSV cells',()=>{
  for(const noticed_board of ['yes-unread','no','not-sure',null]) {
    const [header,row]=parseCSV(exportCSV([{...fixture(),noticed_board,trust:null,checked_meaning:null}]));
    for(const k of ['trust','checked_meaning']) assert.equal(row[header.indexOf(k)],'');
  }
});
test('D02 dictionary explains conditional answers and emptiness',()=>{
  for(const column of ['trust','checked_meaning']) {
    const row=dictionary().find(r=>r.column===column);
    assert.match(row.description,/Asked only after Yes, and I read it on question 4; empty \(null\) otherwise\./);
    assert.match(row.allowed_values,/empty unless noticed_board=yes/);
  }
});
test('S02 demo has all question 4 choices and consistent follow-ups',()=>{
  for(const source of ['staff','rider-link']) {
    const rows=demoRecords().checkins.filter(r=>r.source===source);
    assert.deepEqual([...new Set(rows.map(r=>r.noticed_board))].sort(),['no','not-sure','yes','yes-unread']);
    for(const r of rows) {
      if(r.noticed_board==='yes') {assert.notEqual(r.trust,null);assert.notEqual(r.checked_meaning,null);}
      else {assert.equal(r.trust,null);assert.equal(r.checked_meaning,null);}
    }
  }
});

test('F01 rider help-line placeholder before the first question',()=>{
  const line='[Help lines approved by the transit agency go here]';
  const html=questionsHTML(false);assert.ok(html.includes(`<p>${line}</p>`));assert.ok(html.indexOf(line)<html.indexOf('<fieldset'));
  assert.ok(!questionsHTML(true).includes(line));
});
test('F02 rider urgent-help notice before the first question',()=>{
  const line='This card is not monitored. To report an incident or get help, use the help lines below. In an emergency, call 911.';
  const html=questionsHTML(false);assert.ok(html.includes(`<p>${line}</p>`));assert.ok(html.indexOf(line)<html.indexOf('<fieldset'));
  assert.ok(!questionsHTML(true).includes(line));
});
test('F03 conditional form hides clears and requires follow-ups',()=>{
  for(const staff of [true,false]) {
    const html=questionsHTML(staff),hint='Answer 5 and 6 only if you answered &quot;Yes, and I read it&quot; to question 4. Otherwise you are done: thank you.';
    assert.ok(html.includes(hint));assert.ok(html.indexOf(hint)<html.indexOf('name="trust"'));
    const section={hidden:true},errors={trust:{},checked_meaning:{}},elements={noticed_board:{value:'yes'},trust:{value:'3',removeAttribute(){}},checked_meaning:{value:'on-site',removeAttribute(){}}};
    const form={elements,querySelector:s=>s==='#conditional-questions'?section:errors[s.slice(7)]};
    updateConditionalQuestions(form);assert.equal(section.hidden,false);
    for(const k of ['trust','checked_meaning']) {assert.equal(elements[k].required,false);assert.equal(elements[k].disabled,false);}
    for(const answer of ['yes-unread','no','not-sure','']) {
      elements.noticed_board.value=answer;elements.trust.value='3';elements.checked_meaning.value='on-site';
      updateConditionalQuestions(form);assert.equal(section.hidden,true);
      for(const k of ['trust','checked_meaning']) {assert.equal(elements[k].required,false);assert.equal(elements[k].disabled,true);assert.equal(elements[k].value,'');assert.equal(errors[k].hidden,true);}
    }
  }
});
test('F04 form stores null conditional answers when not asked',()=>{
  assert.deepEqual(conditionalAnswers('yes',3,'on-site'),{trust:3,checked_meaning:'on-site'});
  for(const answer of ['yes-unread','no','not-sure','',null]) assert.deepEqual(conditionalAnswers(answer,3,'on-site'),{trust:null,checked_meaning:null});
  const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');
  assert.ok(app.includes('...conditionalAnswers(form.elements.noticed_board.value,'));
  assert.ok(app.includes("addEventListener('change',updateConditionals)"));
});
test('F05 both card headers use the short voluntary wording',()=>{
  assert.equal(en.cardHeader,'A short, voluntary card.');
  const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');
  assert.ok(app.includes("<p>${escape(t('cardHeader'))}</p>"));
});

import {validateAction,appendAction,currentActions,boardCSV,actionLogCSV,BOARD_COLUMNS,BOARD_NOTICE} from '../js/core.mjs';
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
  assert.throws(()=>appendAction(history,{...next,title:'Changed title'}));
});
test('B03 board and action log CSV have the specified columns and synthetic markers',()=>{
  const demo=demoRecords();const [boardHeader,...rows]=parseCSV(boardCSV(demo.action_log,'S1'));
  assert.deepEqual(boardHeader,BOARD_COLUMNS);assert.equal(rows.length,3);assert.ok(rows.every(r=>r[boardHeader.indexOf('synthetic')]==='true'));
  const [logHeader,...logRows]=parseCSV(actionLogCSV(demo.action_log,'S1'));assert.deepEqual(logHeader,ACTION_COLUMNS);assert.equal(logRows.length,5);
  const html=stationBoardHTML(demo.action_log,'S1',en);assert.ok(html.includes(BOARD_NOTICE));assert.ok(html.includes('Updated'));assert.ok(html.includes('Demonstration: synthetic data'));
});
test('B04 board log exports round trip and conflicts preserve append-only history',()=>{
  const demo=demoRecords(new Date('2026-10-13T12:00:00.000Z')),json=exportJSON(demo.checkins,demo.shifts,demo.action_log);
  assert.deepEqual(prepareImport(json,'json',undefined,now).action_log,demo.action_log.slice().sort((a,b)=>a.updated_at.localeCompare(b.updated_at)));
  const log=prepareImport(actionLogCSV(demo.action_log),'csv',undefined,now).action_log;assert.equal(log.length,20);
  assert.equal(prepareImport(json,'json',demo,now).duplicates,636);
  const changed=structuredClone(demo);changed.action_log[0].title='Conflict';assert.throws(()=>prepareImport(exportJSON([],[],changed.action_log),'json',demo,now),/conflict/);
});

import {printableCardHTML} from '../js/card.mjs';
test('C01 printable card and both forms use the same six-question source',()=>{
  const questions=questionSource();assert.equal(questions.length,6);assert.deepEqual(questions[1].choices.map(c=>c.value),REASONS);
  const card=printableCardHTML();for(const q of questions){const prompt=q.prompt.replaceAll('"','&quot;');assert.ok(card.includes(prompt));assert.ok(questionsHTML(true).includes(prompt));assert.ok(questionsHTML(false).includes(prompt));for(const c of q.choices)assert.ok(card.includes(c.label));}
  assert.ok(card.includes('In an emergency, call 911.'));assert.ok(card.includes(en.riderHelp));assert.ok(card.includes(en.notice));assert.ok(card.includes('Otherwise you are done: thank you.'));
  assert.equal(questions[0].prompt,'How safe do you feel at this station right now?');assert.equal(questions[1].prompt,'What affects how safe you feel here today?');assert.equal(questions[1].hint,'Tick up to 3, or none.');assert.equal(questions[2].prompt,'Before today, did you know how to get help at this station?');assert.equal(questions[3].prompt,'Have you seen the Station action board here?');assert.equal(questions[4].prompt,'How much do you trust the updates posted at this station?');
  assert.deepEqual(questions[3].choices.map(c=>c.value),['yes','yes-unread','no','not-sure']);
  assert.match(questions[5].prompt,/Checked/);
  assert.deepEqual(questions[5].choices.map(c=>c.label),['The station has been rated safe','A staff member inspected the completed work in person','The safety problem has been fixed','Not sure']);
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
  assert.ok(demo.action_log.every(r=>r.updated_at <= new Date().toISOString()));
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
  const walk=(dir)=>{for(const file of readdirSync(new URL(dir+'/',root),{withFileTypes:true})){const path=`${dir}/${file.name}`;if(file.isDirectory())walk(path);else if(path!=='js/locales/second.mjs')assets.push(path);}};walk('js');
  for(const file of assets)assert.ok(worker.includes(`'./${file}'`),file);
  assert.ok(worker.includes("const CACHE = 'transitx-checkin-v1.2.1'"));assert.ok(!worker.includes('fetch(event.request)'));
  const manifest=JSON.parse(readFileSync(new URL('manifest.webmanifest',root),'utf8'));assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.icons.length,3);
});

import {runInNewContext} from 'node:vm';
test('O03 worker installs assets deletes old caches and serves relative paths offline',async()=>{
  const handlers={},entries=new Map([['transitx-checkin-v4',new Map()],['unrelated-cache',new Map()]]),base='http://localhost/checkin-prototype/';let skipped=false,claimed=false;
  const caches={keys:async()=>[...entries.keys()],delete:async key=>entries.delete(key),open:async key=>{if(!entries.has(key))entries.set(key,new Map());const store=entries.get(key);return {addAll:async files=>{for(const file of files)store.set(new URL(file,base).href,new Response('cached '+file));},match:async request=>store.get(typeof request==='string'?request:request.url)};}};
  const self={location:{origin:'http://localhost',href:base+'sw.js'},addEventListener:(type,handler)=>handlers[type]=handler,skipWaiting:async()=>{skipped=true;},clients:{claim:async()=>{claimed=true;}}};
  runInNewContext(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),{self,caches,URL,Response});
  const lifecycle=async type=>{let work;handlers[type]({waitUntil:promise=>work=promise});await work;};await lifecycle('install');await lifecycle('activate');
  assert.equal(skipped,true);assert.equal(claimed,true);assert.deepEqual([...entries.keys()].sort(),['transitx-checkin-v1.2.1','unrelated-cache']);
  const request=async(url,mode)=>{let response;handlers.fetch({request:{method:'GET',url,mode},respondWith:promise=>response=promise});return await response;};
  assert.equal(await(await request(base+'?s=S2','navigate')).text(),'cached ./index.html');assert.equal((await request(base+'js/card.mjs','cors')).status,200);assert.equal((await request(base+'missing.txt','cors')).status,404);assert.equal((await request('https://example.invalid/','cors')).status,403);
});

import {stationDate,offsetTimestamp,canonicalTimestamp} from '../js/dates.mjs';
test('P01 station dates use plain words and the selected local zone',()=>{
  assert.equal(stationDate('2026-01-02T22:30:00.000Z'),'2 January 2026, 2:30 p.m.');
  assert.equal(stationDate('2026-01-02T22:30:00.000Z','America/Toronto'),'2 January 2026, 5:30 p.m.');
  assert.equal(stationDate('2026-01-03T08:00:00.000Z'),'3 January 2026, 12:00 a.m.');
  assert.equal(stationDate('2026-01-03T20:00:00.000Z'),'3 January 2026, 12:00 p.m.');
  const html=stationBoardHTML([{...action(),updated_at:'2026-01-02T22:30:00.000Z'}],'S1',en);
  assert.ok(html.includes('Updated'));assert.ok(html.includes('January 2, 2026'));assert.ok(!html.includes(' UTC'));
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
test('P03 board orders visible actions newest first regardless of status',()=>{
  const statuses=['not-done','planned','checked','checked','planned','not-done'];
  const history=statuses.map((status,i)=>({...action(),id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,action_id:`00000000-0000-4000-8001-${String(i+1).padStart(12,'0')}`,status,title:`Action ${i}`,updated_at:`2026-01-0${i+1}T09:00:00.000Z`,reason:status==='not-done'?'Visit deferred':''}));
  const original=structuredClone(history);
  assert.deepEqual(boardActions(history,'S1').map(r=>r.title),['Action 5','Action 4','Action 3','Action 2','Action 1','Action 0']);
  const html=stationBoardHTML(history,'S1',en);
  const titles=[...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map(m=>m[1]);
  assert.deepEqual(titles,['Action 5','Action 4','Action 3','Action 2','Action 1','Action 0']);assert.deepEqual(history,original);
  assert.ok(html.includes('January 6, 2026'));
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
  assert.ok(head.includes(BOARD_NOTICE));assert.ok(!foot.includes(BOARD_NOTICE));assert.ok(foot.includes('Tell us how safe you feel: [rider form link or code goes here]'));
  assert.ok(css.includes('.poster-table thead { display:table-header-group; }'));assert.ok(css.includes('.poster-table tfoot { display:table-footer-group; }'));
  assert.ok(!html.includes('Synthetic record'));assert.ok(!html.includes(' UTC'));
});
test('P06 action log has readable dates and a named keyboard scroll region',()=>{
  const html=actionLogHTML([{...action(),updated_at:'2026-01-02T22:30:00.000Z',title:'A'.repeat(100)}],'S1',en);
  assert.ok(html.includes('tabindex="0" role="region" aria-label="Action log"'));assert.ok(html.includes('<caption>Action log.'));
  assert.ok(html.includes('January 2, 2026, 2:30 p.m.'));assert.ok(!html.includes('Synthetic record'));
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');assert.match(css,/\.table-scroll\s*\{[^}]*overflow-x:auto/);
  assert.ok(css.includes('.action-log { max-width:100%; }'));assert.ok(css.includes('white-space:normal; overflow-wrap:anywhere;'));
});
test('P07 board and log CSV preserve explicit station offsets and round trip history',()=>{
  const demo=demoRecords();
  for(const csv of [boardCSV(demo.action_log,'S1'),actionLogCSV(demo.action_log,'S1')]) {
    const [header,...rows]=parseCSV(csv);assert.ok(rows.every(r=>/T\d{2}:\d{2}:\d{2}\.\d{3}-07:00$/.test(r[header.indexOf('updated_at')])));
  }
    const csv=actionLogCSV(demo.action_log,'S1','America/Toronto');assert.ok(csv.includes('-04:00'));
  assert.deepEqual(prepareImport(csv,'csv',undefined,now).action_log,demo.action_log.filter(r=>r.station==='S1').sort((a,b)=>a.updated_at.localeCompare(b.updated_at)));
  for(const iso of ['2026-11-01T08:30:00.000Z','2026-11-01T09:30:00.000Z'])assert.equal(canonicalTimestamp(offsetTimestamp(iso)),iso);
  for(const bad of ['2026-02-30T12:00:00.000-08:00','2026-01-02T12:00:00.000-14:30','2026-01-02T12:00:00.000-08:60'])assert.throws(()=>canonicalTimestamp(bad));
});
test('P08 board offers both print sizes with tabloid body type at least 18 pt',()=>{
  const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8'),css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  assert.ok(app.includes('id="board-print-size"'));assert.ok(app.includes('value="letter"'));assert.ok(app.includes('value="tabloid"'));
  assert.ok(css.includes('@page boardTabloid { size:17in 11in;'));assert.match(css,/\.print-board-page \{[^}]*font-size:18pt/);
  assert.ok(app.includes("['pilotCard','pilotStaff','pilotBoard','pilotNext']"));
});

test('V11 answer fields accept blank values and blank cards are identifiable',()=>{
  const blank={...fixture(),safety:null,reasons:[],knows_help:null,noticed_board:null,trust:null,checked_meaning:null};
  assert.deepEqual(validateCheckin(blank,[],now),{});
  assert.equal(isBlankCard(blank),true);
  for(const [key,value] of [['safety',1],['reasons',['lighting']],['knows_help','yes'],['noticed_board','no']]) {
    assert.equal(isBlankCard({...blank,[key]:value}),false,key);
  }
  assert.equal(isBlankCard({...blank,trust:3}),false);
});

test('E05 blank reason cells export empty and legacy binary cells import',()=>{
  const blank={...fixture(),safety:null,reasons:[],knows_help:null,noticed_board:null,trust:null,checked_meaning:null};
  const [header,row]=parseCSV(exportCSV([blank]));
  for(const reason of REASONS) assert.equal(row[header.indexOf(`reason_${reason}`)],'',reason);
  assert.deepEqual(prepareImport(exportCSV([blank]),'csv',undefined,now).checkins,[blank]);
  const legacy=parseCSV(exportCSV([fixture()]));
  assert.deepEqual(prepareImport(toCSV([Object.fromEntries(legacy[0].map((key,i)=>[key,legacy[1][i]]))],legacy[0]),'csv',undefined,now).checkins,[fixture()]);
});

test('Q03 quota counts blank cards separately and excludes them from completed bands',()=>{
  const blank={...fixture(),safety:null,reasons:[],knows_help:null,noticed_board:null,trust:null,checked_meaning:null};
  const row=quota([blank,fixture()]).find(x=>x.station==='S2'&&x.round===1);
  assert.equal(row.completed,1);assert.equal(row.blank,1);assert.equal(row.bands['weekday-morning'],1);
});

test('V12 board answer choices distinguish read from unread and checked meanings',()=>{
  assert.deepEqual(BOARD_ANSWERS,['yes','yes-unread','no','not-sure']);
  assert.deepEqual(CHECKED,['on-site','rated-safe','problem-fixed','not-sure']);
  for(const noticed_board of BOARD_ANSWERS) {
    const r={...fixture(),noticed_board,trust:null,checked_meaning:null};
    if(noticed_board==='yes') assert.deepEqual(validateCheckin({...r,trust:3,checked_meaning:'problem-fixed'},[],now),{});
    else assert.deepEqual(validateCheckin(r,[],now),{});
  }
});

test('B05 action columns accept status dates, due dates, event numbers and withheld rows',()=>{
  assert.deepEqual(ACTION_COLUMNS.slice(0,9),['id','action_id','synthetic','station','title','concern','status','reason','updated_at']);
  for(const column of ['status_date','due_date','event_number','withheld']) assert.ok(ACTION_COLUMNS.includes(column),column);
  const event={...action(),status:'planned',status_date:null,due_date:'2026-10-20',event_number:1,withheld:false};
  assert.deepEqual((awaitableValidateAction(event)),{});
});

function awaitableValidateAction(event) {
  // Keep this small helper synchronous so this contract test can run before browser integration.
  return validateAction(event,[],`${now}T23:59:59.999Z`);
}

test('B06 same-status rechecks append a later event and retain history',()=>{
  const first={...action(),status:'checked',status_date:'2026-10-01',event_number:1,withheld:false};
  const recheck={...first,id:'55555555-1234-4234-8234-123456789012',event_number:2,status_date:'2026-10-02',updated_at:'2026-10-02T09:00:00.000Z'};
  assert.deepEqual(validateAction(first,[],`${now}T23:59:59.999Z`),{});
  assert.deepEqual(validateAction(recheck,[first],`${now}T23:59:59.999Z`),{});
  const history=appendAction([first],recheck,`${now}T23:59:59.999Z`);
  assert.equal(history.length,2);assert.equal(history[0].status_date,'2026-10-01');assert.equal(history[1].status_date,'2026-10-02');
  assert.notDeepEqual(history[0],history[1]);
  assert.throws(()=>appendAction([first],{...recheck,id:'55555555-1234-4234-8234-123456789013',event_number:1,updated_at:first.updated_at},`${now}T23:59:59.999Z`),/invalidHistory/);
});

test('B07 action event comparison uses timestamp then event number then id',()=>{
  const same=(id,event_number,updated_at)=>({...action(),id,event_number,updated_at,status:'checked',status_date:'2026-10-01',withheld:false});
  const a=same('00000000-0000-4000-8000-000000000001',1,'2026-10-01T09:00:00.000Z');
  const b=same('00000000-0000-4000-8000-000000000002',2,a.updated_at);
  const c=same('00000000-0000-4000-8000-000000000003',1,'2026-10-02T09:00:00.000Z');
  assert.ok(compareActionEvents(a,b)<0);assert.ok(compareActionEvents(b,c)<0);assert.ok(compareActionEvents(a,c)<0);
});

test('B08 board filters withheld actions and orders visible actions newest first globally',()=>{
  const make=(id,title,status,updated_at,withheld=false)=>({...action(),id,action_id:id,title,status,updated_at,event_number:1,status_date:updated_at.slice(0,10),withheld,reason:status==='not-done'?'Deferred':''});
  const history=[
    make('00000000-0000-4000-8000-000000000011','Old checked','checked','2026-10-01T09:00:00.000Z'),
    make('00000000-0000-4000-8000-000000000012','Newest planned','planned','2026-10-03T09:00:00.000Z'),
    make('00000000-0000-4000-8000-000000000013','Hidden not done','not-done','2026-10-04T09:00:00.000Z',true),
    make('00000000-0000-4000-8000-000000000014','Middle not done','not-done','2026-10-02T09:00:00.000Z')
  ];
  assert.deepEqual(boardActions(history,'S1').map(r=>r.title),['Newest planned','Middle not done','Old checked']);
  assert.ok(!stationBoardHTML(history,'S1',en).includes('Hidden not done'));
});

test('B09 legacy action CSV imports with defaults for v1.2 optional columns',()=>{
  const old=['id','action_id','synthetic','station','title','concern','status','reason','updated_at'];
  const row={...action(),updated_at:'2026-10-01T09:00:00.000Z'};
  const imported=prepareImport(toCSV([row],old),'csv',undefined,now).action_log;
  assert.equal(imported.length,1);assert.equal(imported[0].id,row.id);assert.equal(imported[0].updated_at,row.updated_at);
  const canonicalJson={...row,status_date:null,due_date:null,event_number:null,withheld:false};
  assert.equal(prepareImport(exportJSON([],[],[canonicalJson]),'json',{checkins:[],shifts:[],action_log:imported},now).duplicates,1);
});

test('M03 demo records use a fixed clock for relative dates and stable identifiers',()=>{
  const clock=new Date('2026-10-13T12:00:00.000Z');
  const one=demoRecords(clock),two=demoRecords(clock);
  assert.equal(one.checkins.length,608);assert.equal(one.shifts.length,8);assert.equal(one.action_log.length,20);
  assert.equal(new Set(one.action_log.filter(r=>!r.withheld).map(r=>r.action_id)).size,12);
  assert.deepEqual(one,two);
  assert.ok(one.checkins.every(r=>r.date==='2026-10-13'));
  assert.ok(one.action_log.every(r=>r.updated_at <= clock.toISOString()));
  const planned=one.action_log.find(r=>r.status==='planned'),changed=one.action_log.find(r=>r.status==='checked');
  assert.equal(planned.status_date,'2026-10-10');assert.equal(planned.due_date,'2026-10-20');assert.equal(changed.status_date,'2026-10-12');
});

test('M04 demo clock uses the Pacific collection date across UTC midnight',()=>{
  const late=demoRecords(new Date('2026-10-13T23:00:00.000Z'));
  const early=demoRecords(new Date('2026-10-14T01:00:00.000Z'));
  assert.deepEqual(late,early);
  assert.equal(late.checkins[0].date,'2026-10-13');
});

test('U01 route hash parsing ignores unknown hashes and focus links preserve the route',()=>{
  assert.deepEqual(ROUTES,['home','staff','rider','board','card','quota','data']);
  assert.equal(routeFromHash('#staff'),'staff');assert.equal(routeFromHash('staff'),'staff');
  for(const hash of ['#','', '#field', '#staff?x']) assert.equal(routeFromHash(hash),null,hash);
  let prevented=0,focused=0,scrolled=0;const target={matches:()=>false,setAttribute:()=>{},focus:()=>focused++,scrollIntoView:()=>scrolled++};
  focusLink({preventDefault:()=>prevented++},target);
  assert.equal(prevented,1);assert.equal(focused,1);assert.equal(scrolled,1);
});

test('U02 announcer clears before each delayed status message',()=>{
  const scheduled=[];const cancelled=[];const element={textContent:'old'};
  const announce=createAnnouncer(element,fn=>{scheduled.push(fn);return scheduled.length;},id=>cancelled.push(id));
  announce('first');assert.equal(element.textContent,'');
  announce('second');assert.equal(element.textContent,'');assert.deepEqual(cancelled,[undefined,1]);
  scheduled[1]();assert.equal(element.textContent,'second');
});

test('U03 page titles prefix route names and form errors',()=>{
  assert.equal(pageTitle('Staff entry','Checked Here'), 'Staff entry | Checked Here');
  assert.equal(pageTitle('Staff entry','Checked Here',true), 'Error: Staff entry | Checked Here');
});

test('U04 card reset preserves context, clears answers, advances number and focuses it',()=>{
  const values={station:'S1',round:'2',date:'2026-10-13',time_band:'weekday-morning',staff_code:'F01',card_number:'11',safety:'8',reasons:'lighting'};
  const elements=Object.fromEntries(Object.keys(values).map(key=>[key,{value:values[key],focus(){this.focused=true;}}]));
  const form={elements,reset(){for(const key of Object.keys(values))this.elements[key].value='';}};
  resetCard(form,true);
  for(const key of ['station','round','date','time_band','staff_code']) assert.equal(elements[key].value,values[key],key);
  assert.equal(elements.card_number.value,'12');assert.equal(elements.safety.value,'');assert.equal(elements.reasons.value,'');assert.equal(elements.card_number.focused,true);
});

test('U05 runner guards repeats, marks only the invoking button and idles after completion',async()=>{
  let release,started=0,idle=0;const button={attrs:new Map(),getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null;},setAttribute(k,v){this.attrs.set(k,v);},removeAttribute(k){this.attrs.delete(k);}};
  const runner=createRunner({document:{activeElement:button},onError:()=>{},onIdle:async()=>{idle++;assert.equal(runner.busy,false);}});
  const action=()=>{started++;return new Promise(resolve=>{release=resolve;});};
  const event={submitter:button,preventDefault(){this.prevented=true;}};
  const pending=runner.run(action,event);assert.equal(runner.busy,true);assert.equal(button.getAttribute('aria-disabled'),'true');
  await runner.run(action,event);assert.equal(started,1);release();await pending;
  assert.equal(button.getAttribute('aria-disabled'),null);assert.equal(idle,1);assert.equal(event.prevented,true);
});

test('U06 deadline reports a timeout and cancels its timer',async()=>{
  let timer,cancelled;const never=new Promise(()=>{});
  const pending=withDeadline(never,15,fn=>{timer=fn;return 'timer';},id=>{cancelled=id;});
  timer();await assert.rejects(pending,/offlineTimeout/);assert.equal(cancelled,'timer');
});

test('U07 offline setup reports unavailable, install failure and missing cache',async()=>{
  await assert.rejects(offlineFiles({serviceWorker:null,caches:{},base:'https://demo.invalid/'}),/offlineUnavailable/);
  let stateChange;const installing={state:'installing',addEventListener(_type,fn){stateChange=fn;}};
  const registration={installing,addEventListener(){}};const serviceWorker={controller:{},register:async()=>registration,ready:new Promise(()=>{})};
  const failed=offlineFiles({serviceWorker,caches:{},base:'https://demo.invalid/',milliseconds:500});await new Promise(resolve=>setTimeout(resolve,0));installing.state='redundant';stateChange();await assert.rejects(failed,/offlineInstall/);
  const readyWorker={controller:{}};const missing=offlineFiles({serviceWorker:{...readyWorker,register:async()=>({installing:null,addEventListener(){}}),ready:Promise.resolve()},caches:{open:async()=>({match:async()=>null})},base:'https://demo.invalid/',milliseconds:500});
  await assert.rejects(missing,/offlineMissing/);
});

test('A01 in-page skip and error links focus targets without changing routes',()=>{
  const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');
  assert.ok(app.includes("document.querySelector('.skip').addEventListener('click',event=>focusLink(event,document.querySelector('#main')));"));
  assert.ok(app.includes("view.addEventListener('click',event=>{const link=event.target.closest('[data-focus]');if(link)focusLink(event,document.getElementById(link.dataset.focus));});"));
  assert.ok(app.includes("const next=routeFromHash(location.hash);if(next)void changeRoute(next);"));
  for(const route of ROUTES) assert.equal(routeFromHash(`#${route}`),route);
  assert.equal(routeFromHash('#main'),null);assert.equal(routeFromHash('#error-safety'),null);
  let prevented=0,focused=0;const target={matches:()=>true,focus:()=>focused++,scrollIntoView(){}};
  focusLink({preventDefault:()=>prevented++},target);assert.equal(prevented,1);assert.equal(focused,1);
});

test('A02 action runner keeps the invoking control available and save reset restores focus',()=>{
  const ui=readFileSync(new URL('../js/ui.mjs',import.meta.url),'utf8'),app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');
  assert.match(ui,/const invoking=event\?\.submitter\?\?document\.activeElement/);
  assert.match(ui,/invoking\?\.setAttribute\?\.\('aria-disabled','true'\)/);
  assert.match(ui,/if\(busy\)return/);
  assert.ok(app.includes('const runner=createRunner({document,onError:error=>message'));
  assert.ok(app.includes('const number=r.card_number;resetCard(form,staff);'));
  let release;const button={attrs:new Map(),getAttribute(k){return this.attrs.get(k)??null;},setAttribute(k,v){this.attrs.set(k,v);},removeAttribute(k){this.attrs.delete(k);}};
  const runner=createRunner({document:{activeElement:button},onError:()=>{}});const pending=runner.run(()=>new Promise(resolve=>{release=resolve;}),{submitter:button,preventDefault(){}});
  assert.equal(button.getAttribute('aria-disabled'),'true');assert.equal(runner.busy,true);release();return pending.then(()=>assert.equal(button.getAttribute('aria-disabled'),null));
});

test('A03 light form borders meet 3 to 1 contrast against the page and paper',()=>{
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  const value=name=>css.match(new RegExp(`${name}:#([0-9a-fA-F]{6})`))?.[1];
  const luminance=hex=>{const values=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4);return .2126*values[0]+.7152*values[1]+.0722*values[2];};
  const line=value('--line'),surface=value('--surface'),paper='ffffff';assert.ok(line&&surface);
  for(const background of [surface,paper]) {const a=luminance(line),b=luminance(background);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=3,`${line} vs ${background}`);}
});

test('A04 board legend and question 6 use the full plain meanings',()=>{
  const html=stationBoardHTML([], 'S1', en);
  const legend=['Checked on site: staff verified the action on the status date. This does not mean the problem is solved or the station is safe. No due date.','Planned: the action is planned; status date and Due by are shown.','Not done: the action will not go ahead now; status date and Why are shown, without a due date.'];
  for(const line of legend) assert.ok(html.includes(line),line);
  assert.ok(html.indexOf(en.legendChecked)<html.indexOf(BOARD_NOTICE));
  assert.equal((html.match(new RegExp(BOARD_NOTICE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length,1);
  const q6=questionSource().find(q=>q.number===6);assert.deepEqual(q6.choices.map(c=>c.label),['The station has been rated safe','A staff member inspected the completed work in person','The safety problem has been fixed','Not sure']);
});

test('B10 board reading puts counts and status before dated action details',()=>{
  const rows=[
    {...action(),id:'33333333-1234-4234-8234-123456789013',action_id:'44444444-1234-4234-8234-123456789013',status:'checked',status_date:'2026-10-02',updated_at:'2026-10-02T09:00:00.000Z'},
    {...action(),id:'33333333-1234-4234-8234-123456789014',action_id:'44444444-1234-4234-8234-123456789014',status:'planned',due_date:'2026-10-20',updated_at:'2026-10-03T09:00:00.000Z',reason:'Work is scheduled.'},
    {...action(),id:'33333333-1234-4234-8234-123456789015',action_id:'44444444-1234-4234-8234-123456789015',status:'not-done',reason:'Access was closed.',updated_at:'2026-10-04T09:00:00.000Z'}
  ];
  const html=stationBoardHTML(rows,'S1',en),firstAction=html.indexOf('class="action-card"');
  assert.ok(html.includes('1 Checked on site, 1 Planned, 1 Not done'));
  assert.ok(html.indexOf('board-legend-wrap')<html.indexOf('board-notice'));assert.ok(html.indexOf('board-notice')<html.indexOf('<tbody'));
  assert.ok(firstAction>0&&html.indexOf('status-badge',firstAction)<html.indexOf('<h3>',firstAction));
  assert.ok(html.includes('Updated'));assert.ok(html.includes('Due by'));assert.ok(html.includes('October 20, 2026'));assert.ok(html.includes('Access was closed.'));
});

test('B11 phone board is read-only and contains no staff controls or exports',()=>{
  const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8'),css=readFileSync(new URL('../styles.css',import.meta.url),'utf8'),readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
  assert.ok(app.includes('const readOnly=STATIONS.includes(phoneBoard);'));assert.ok(app.includes("if(readOnly)document.querySelector('#navigation').remove();"));
  assert.ok(app.includes('if(readOnly){view.innerHTML=stationBoardHTML'));assert.ok(css.includes('body.phone-board > header,body.phone-board > footer,body.phone-board nav'));
  assert.ok(readme.includes('`?board=S1` opens a read-only phone board'));
  const html=stationBoardHTML(demoRecords(new Date('2026-10-13T12:00:00.000Z')).action_log,'S1',en);
  assert.ok(html.includes(BOARD_NOTICE));assert.ok(!html.includes('Record an action'));assert.ok(!html.includes('Export'));
});

test('B12 rider card carries its exact safety title, warning, audience and staff boundary',()=>{
  const card=printableCardHTML(),css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  const exact=['How safe do you feel at this station?','This card is not monitored. To report an incident or get help, use the help lines below. In an emergency, call 911.','[Help lines approved by the transit agency go here]','For adult riders','Staff only','Enter the code of the staff member who handed out this card.'];
  for(const text of exact) assert.ok(card.includes(text),text);
  assert.ok(card.indexOf('Staff only')<card.indexOf('Staff code'));assert.ok(!card.toLowerCase().includes('client'));
  assert.ok(card.includes('card-side-back'));assert.ok(css.includes('.rider-card {'));assert.ok(css.includes('.rider-card { font-size:12pt;'));
});

test('B13 question source keeps exact wording, choices and conditional branch',()=>{
  const questions=questionSource();
  assert.equal(questions[2].prompt,'Before today, did you know how to get help at this station?');
  assert.equal(questions[3].prompt,'Have you seen the Station action board here?');
  assert.deepEqual(questions[3].choices.map(c=>c.label),['Yes, and I read it','Yes, but I did not read it','No','Not sure']);
  assert.equal(questions[4].conditional,true);assert.equal(questions[5].conditional,true);
  assert.deepEqual(conditionalAnswers('yes',null,null),{trust:null,checked_meaning:null});
  for(const answer of ['yes-unread','no','not-sure',null]) assert.deepEqual(conditionalAnswers(answer,3,'on-site'),{trust:null,checked_meaning:null});
});

test('B14 time band choices state the four approved hour ranges',()=>{
  const hours={weekday_morning:'06:00 to 09:59',weekday_midday:'10:00 to 14:59',weekday_evening:'15:00 to 21:59',weekend:'06:00 to 21:59'};
  const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');assert.ok(app.includes("'timeBandHint'"));
  for(const [key,range] of Object.entries(hours)) assert.ok(en[key].includes(range),key);
  assert.ok(readFileSync(new URL('../README.md',import.meta.url),'utf8').includes('weekday morning 06:00 to 09:59'));
});

test('B15 form errors use numbered labels, a single summary announcement and route title state',()=>{
  const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');
  for(const [key,number] of Object.entries({safety:1,reasons:2,knows_help:3,noticed_board:4,trust:5,checked_meaning:6})) assert.ok(app.includes(`${key}:${number}`),key);
  assert.ok(app.includes("announce('');"));assert.ok(!app.includes("summary.setAttribute('role','alert')"));assert.ok(app.includes('summary.focus();'));
  assert.ok(app.includes('updateTitle(Object.keys(errors).length>0||!!view.querySelector(\'.error-summary\'));'));
  assert.equal(pageTitle('Staff entry','Checked Here',true),'Error: Staff entry | Checked Here');
});

test('B16 tabloid board typography gives the legend and notice 24 points and body text 18',()=>{
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  assert.match(css,/body\.print-tabloid \.print-board-page \.board-legend-wrap h3,body\.print-tabloid \.print-board-page \.board-legend \{ font-size:24pt; line-height:1; \}/);
  assert.match(css,/\.print-board-page \{[^}]*font-size:18pt/);
  assert.match(css,/body\.print-tabloid \.print-board-page \.action-card>\.action-status,body\.print-tabloid \.print-board-page \.action-card h3 \{ font-size:28pt; \}/);
  assert.match(css,/body\.print-tabloid \.print-board-page \.board-footer[^}]*font-size:24pt/);
});

test('B17 synthetic actions name a station place, bounded task and observable result',()=>{
  const rows=demoRecords(new Date('2026-10-13T12:00:00.000Z')).action_log;
  assert.equal(rows.length,20);for(const row of rows) {assert.match(row.title,/(at|beside|until|platform|entrance|stairs)/i);assert.ok(row.title.length>20);assert.ok(row.updated_at<='2026-10-13T12:00:00.000Z');}
  assert.ok(rows.some(row=>row.status==='checked'));assert.ok(rows.some(row=>row.status==='planned'));assert.ok(rows.some(row=>row.status==='not-done'));
});

test('B18 README states browser privacy, manual transfers, bounded accessibility and reprint guidance',()=>{
  const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
  for(const text of ["Application records stay in this browser's IndexedDB.",'Page and static-file requests still reach the site host','Saved exports remain wherever the user or browser puts them','They never reach staff devices or the staff quota.','Transfers between browsers are manual demonstration exports','no violations detected automatically in the tested states','Reprint the station poster after every board update.','This demonstration is not approved or ready for real collection or deployment.']) assert.ok(readme.includes(text),text);
  assert.ok(!readme.includes('Keep the same browser, origin and port to retain records.')||readme.includes('Application records stay in this browser'));
  assert.ok(!readme.includes('keep the local server running'));assert.ok(!readme.includes('The company publishes after its release check.'));assert.ok(!readme.includes('Released under Apache-2.0.'));
});

test('B19 rider-facing dates use word order and local times while boards show dates only',()=>{
  assert.equal(dateWords('2026-01-02'),'January 2, 2026');
  assert.equal(wordDate('2026-01-02T22:30:00.000Z'),'January 2, 2026, 2:30 p.m.');
  assert.equal(boardDate({updated_at:'2026-01-02T22:30:00.000Z'}),'January 2, 2026');
  const board=stationBoardHTML([{...action(),updated_at:'2026-01-02T22:30:00.000Z'}],'S1',en);assert.ok(board.includes('January 2, 2026'));assert.ok(!board.includes('p.m.'));
});

test('B20 same-clock events require a greater positive event number regardless of id',()=>{
  const first={...action(),status:'checked',event_number:4,updated_at:'2026-10-12T09:00:00.000Z',status_date:'2026-10-12',withheld:false};
  const recheckOne={...first,id:'55555555-1234-4234-8234-123456789099',event_number:5};
  const recheckTwo={...first,id:'55555555-1234-4234-8234-123456789098',event_number:6};
  assert.equal(Object.keys(validateAction(first,[],`${now}T23:59:59.999Z`)).length,0);
  assert.equal(Object.keys(validateAction(recheckOne,[first],`${now}T23:59:59.999Z`)).length,0);
  assert.equal(Object.keys(validateAction(recheckTwo,[first,recheckOne],`${now}T23:59:59.999Z`)).length,0);
  const history=appendAction(appendAction([first],recheckOne,`${now}T23:59:59.999Z`),recheckTwo,`${now}T23:59:59.999Z`);
  assert.deepEqual(history.map(r=>r.event_number),[4,5,6]);
  const csvRoundTrip=prepareImport(actionLogCSV(history,'S1'),'csv',undefined,now).action_log;
  assert.deepEqual(csvRoundTrip.map(r=>r.event_number),[4,5,6]);
  const jsonRoundTrip=prepareImport(exportJSON([],[],history),'json',undefined,now).action_log;
  assert.deepEqual(jsonRoundTrip.map(r=>r.id),history.map(r=>r.id));
  const duplicate={...recheckTwo,id:'55555555-1234-4234-8234-123456789097'};
  assert.match(validateAction(duplicate,history,`${now}T23:59:59.999Z`).record,/invalidHistory/);
});

test('B21 legacy action CSV and canonical JSON share duplicate identity',()=>{
  const old=['id','action_id','synthetic','station','title','concern','status','reason','updated_at'];
  const row={...action(),updated_at:'2026-10-01T09:00:00.000Z'};
  const legacy=prepareImport(toCSV([row],old),'csv',undefined,now).action_log;
  const canonical={...row,status_date:null,due_date:null,event_number:null,withheld:false};
  assert.equal(prepareImport(exportJSON([],[],[canonical]),'json',{checkins:[],shifts:[],action_log:legacy},now).duplicates,1);
});

test('B22 overdue action due dates remain valid when the status date is later',()=>{
  const event={...action(),status:'planned',reason:'Work is scheduled.',status_date:'2026-10-13',due_date:'2026-10-01',updated_at:'2026-10-13T09:00:00.000Z'};
  assert.deepEqual(validateAction(event,[],`${now}T23:59:59.999Z`),{});
});

test('B23 board sorts displayed status dates while selecting the newest entered snapshot',()=>{
  const actionId='66666666-1234-4234-8234-123456789001';
  const history=[
    {...action(),id:'66666666-1234-4234-8234-123456789011',action_id:actionId,title:'A earlier',status:'planned',status_date:'2026-10-14',updated_at:'2026-10-11T09:00:00.000Z',event_number:1,reason:'Work is scheduled.'},
    {...action(),id:'66666666-1234-4234-8234-123456789012',action_id:actionId,title:'A latest',status:'checked',status_date:'2026-10-10',updated_at:'2026-10-13T09:00:00.000Z',event_number:2},
    {...action(),id:'66666666-1234-4234-8234-123456789013',action_id:'66666666-1234-4234-8234-123456789002',title:'B current',status:'planned',status_date:'2026-10-12',due_date:'2026-10-20',updated_at:'2026-10-12T09:00:00.000Z',event_number:1,reason:'Work is scheduled.'}
  ];
  const actions=boardActions(history,'S1','America/Vancouver');
  assert.deepEqual(actions.map(row=>row.title),['B current','A latest']);
  assert.ok(!actions.some(row=>row.title==='A earlier'));
  const html=stationBoardHTML(history,'S1',en,'America/Vancouver');
  assert.ok(html.indexOf('B current')<html.indexOf('A latest'));
  assert.ok(html.includes('October 12, 2026'));
  const rows=parseCSV(boardCSV(history,'S1','America/Vancouver'));
  const titleIndex=rows[0].indexOf('title'),statusDateIndex=rows[0].indexOf('status_date');
  assert.equal(rows[1][titleIndex],'B current');
  assert.equal(rows[1][statusDateIndex],'2026-10-12');
});

test('U08 print panels pack as many complete actions as fit without mutating rows',()=>{
  const rows=[{id:'row-1'},{id:'row-2'}],original=structuredClone(rows);
  assert.deepEqual(printPanels(rows,{heights:[30,30],availableHeight:70}),[[rows[0],rows[1]]]);assert.deepEqual(printPanels(rows,{heights:[30,30],availableHeight:50}),[[rows[0]],[rows[1]]]);
  assert.deepEqual(rows,original);
  const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');
  assert.ok(app.includes("window.addEventListener('beforeprint',()=>{if(route==='board')prepareBoardPrint(document);});"));
  assert.ok(app.includes("window.addEventListener('afterprint',()=>clearBoardPrint(document));"));
});
