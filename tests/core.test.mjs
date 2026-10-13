import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import en from '../js/locales/en.mjs';
import second from '../js/locales/second.mjs';
import {validateCheckin,validateShift,quota,riderCounts,exportCSV,exportJSON,parseCSV,prepareImport,dictionary,dictionaryCSV,dictionaryMarkdown,COLUMNS,SHIFT_COLUMNS,REASONS,demoRecords,toCSV,csvCell} from '../js/core.mjs';
const now='2026-10-13';
const fixture=()=>({id:'12345678-1234-4234-8234-123456789012',source:'staff',synthetic:true,station:'S2',round:1,date:'2026-10-01',time_band:'weekday-morning',staff_code:'F01',card_number:1,safety:8,reasons:['lighting','help'],knows_help:'yes',noticed_board:'no',trust:3,checked_meaning:'on-site'});
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
  for(const file of ['index.html','styles.css','icon.svg','js/app.mjs','js/core.mjs','js/storage.mjs','js/locales/en.mjs','js/locales/second.mjs']) assert.ok(worker.includes(`'./${file}'`),file);
  assert.ok(worker.includes("event.request.mode==='navigate'"));
});
