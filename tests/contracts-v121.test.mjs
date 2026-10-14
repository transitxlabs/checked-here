import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import en from '../js/locales/en.mjs';
import second from '../js/locales/second.mjs';
import {questionSource} from '../js/questions.mjs';
import {printableCardHTML} from '../js/card.mjs';
import {validateCheckin, validateAction, demoRecords, currentActions, exportCSV, exportJSON, prepareImport, dictionary, dictionaryMarkdown, parseCSV, boardCSV} from '../js/core.mjs';
const readme=()=>readFileSync(new URL('../README.md',import.meta.url),'utf8');
const now='2026-10-13';
const card=()=>({...demoRecords(new Date('2026-10-13T20:00:00Z')).checkins[0],reasons:[]});

test('N02 question 2 error describes only the maximum and distinctness rule',()=>{
  assert.equal(en.invalidReasons,'Choose at most three different reasons.');
  const row=card();assert.deepEqual(validateCheckin(row,[],now),{});
  assert.equal(validateCheckin({...row,reasons:['lighting','lighting']},[],now).reasons,'invalidReasons');
  assert.equal(validateCheckin({...row,reasons:['lighting','help','crowding','waiting']},[],now).reasons,'invalidReasons');
});

test('N22 zero question 2 ticks save and round trip as no answer',()=>{
  const row=card();assert.deepEqual(validateCheckin(row,[],now),{});
  assert.deepEqual(prepareImport(exportJSON([row],[]),'json',undefined,now).checkins[0].reasons,[]);
  const csv=exportCSV([row]);const [header,values]=parseCSV(csv);
  for(let i=0;i<header.length;i++)if(header[i].startsWith('reason_'))assert.equal(values[i],'');
  assert.deepEqual(prepareImport(csv,'csv',undefined,now).checkins[0].reasons,[]);
});

test('N07 action reasons are required only for Not done and optional for both other statuses',()=>{
  const event={...demoRecords(new Date('2026-10-13T20:00:00Z')).action_log[0]};
  for(const status of ['planned','checked'])for(const reason of ['', 'Access checked with staff.'])assert.deepEqual(validateAction({...event,status,reason},[],`${now}T23:59:59.999Z`),{});
  for(const status of ['planned','checked','not-done'])assert.equal(validateAction({...event,status,reason:' '},[],`${now}T23:59:59.999Z`).reason,'invalidReason');
  assert.equal(validateAction({...event,status:'not-done',reason:''},[],`${now}T23:59:59.999Z`).reason,'invalidReason');
  assert.match(en.invalidReason,/required for Not done and optional for Planned and Checked/);
  assert.match(en.a_reason,/optional for Planned and Checked; required for Not done/);
  assert.match(en.d_action_reason,/required for Not done and optional for Planned and Checked/);
});

test('N15 synthetic Not done reasons explain why work will not go ahead now',()=>{
  const actions=currentActions(demoRecords(new Date('2026-10-13T20:00:00Z')).action_log);
  const notDone=actions.filter(row=>row.status==='not-done');assert.equal(notDone.length,4);
  for(const row of notDone){assert.match(row.reason,/will not go ahead now because/);assert.match(row.reason,/closed/);assert.doesNotMatch(row.reason,/rescheduled/);}
});

test('N16 the short board name is used word for word in question 4 and README',()=>{
  assert.equal(en.boardHeading,'Station action board');
  assert.ok(questionSource()[3].prompt.includes(en.boardHeading));
  assert.ok(readme().includes(`**${en.boardHeading}**`));
});

test('N17 question 6 places the distinct correct meaning after a distractor and keeps Not sure last',()=>{
  const choices=questionSource()[5].choices;
  assert.deepEqual(choices.map(c=>c.value),['rated-safe','on-site','problem-fixed','not-sure']);
  assert.equal(choices.find(c=>c.value==='on-site').label,'A staff member inspected the completed work in person');
  assert.ok(!en.legendChecked.includes(choices.find(c=>c.value==='on-site').label));
  assert.equal(choices.at(-1).label,'Not sure');
});

test('N18 the legend explains verified action without claiming a solved problem or safe station',()=>{
  assert.match(en.legendChecked,/staff verified the action on the status date/);
  assert.match(en.legendChecked,/does not mean the problem is solved or the station is safe/);
});

test('N19 help awareness is documented as prompted and looking back after help',()=>{
  const row=dictionary().find(row=>row.dataset==='checkins'&&row.column==='knows_help');
  assert.match(row.description,/Prompted, looking-back/);assert.match(row.description,/given after the card help box/);assert.match(row.description,/not unaided prior awareness/);
  assert.match(readme(),/prompted, looking-back answer/);assert.match(readme(),/given after the card help box/);
  const html=printableCardHTML();assert.ok(html.indexOf(en.riderHelp)<html.indexOf(en.knows_help));
});

test('N20 paper handling prevents cross-collector duplicate numbers and never guesses marks',()=>{
  const html=dictionaryMarkdown();assert.match(html,/one allocation register assigns non-overlapping card-number blocks/);assert.match(html,/for each station and round before cards are issued/);
  assert.match(html,/Save unreadable or conflicting marks as no answer, never guess/);
  assert.match(readme(),/two collectors cannot issue the same station, round and card number/);
  assert.match(readme(),/Save unreadable or conflicting marks as no answer, never guess/);
});

test('N23 dictionary and README agree on dates by status and matching print sets',()=>{
  const rows=dictionary().filter(r=>r.dataset==='board');
  assert.match(rows.find(r=>r.column==='status_date').description,/shown on every public action line/);
  assert.match(rows.find(r=>r.column==='due_date').description,/only for Planned/);assert.match(rows.find(r=>r.column==='due_date').description,/Checked and Not done show no due date/);
  for(const sentence of ['Every line shows its status date.','Only Planned lines show a due date, labelled "Due by".','Checked lines show no due date.','Not done lines show their reason and no due date.','After any change, staff replace and check the whole matching set.'])assert.ok(readme().includes(sentence),sentence);
});

test('N24 the documented title and concern correction limit remains explicit',()=>{
  assert.match(readme(),/A title or concern correction event is unavailable in this demonstration/);
});

test('N26 conditional hint quotes the answer and obsolete locale keys are absent',()=>{
  assert.ok(en.conditionalHint.includes('"Yes, and I read it"'));
  for(const key of ['lastUpdated','statusChanged','dueDateNotRecorded']){assert.equal(Object.hasOwn(en,key),false);assert.equal(Object.hasOwn(second,key),false);}
});

test('N13 board Updated uses the newest shown status date instead of recorded time',async()=>{
  const {stationBoardHTML}=await import('../js/board.mjs');
  const a=demoRecords(new Date('2026-10-13T20:00:00Z')).action_log[0];
  const history=[{...a,status_date:'2026-10-03',updated_at:'2026-10-13T15:00:00.000Z'}, {...a,id:'11111111-1111-4111-8111-111111111111',action_id:'22222222-2222-4222-8222-222222222222',status_date:'2026-10-06',updated_at:'2026-10-07T15:00:00.000Z'}];
  const html=stationBoardHTML(history,'S1');
  const updated=html.match(/class="last-updated"[^>]*>(.*?)<\/p>/s)[1];
  assert.match(updated,/October 6, 2026/);assert.doesNotMatch(updated,/October 7|October 13/);
});

test('N01 each action uses its status date and legacy rows use the recorded date',async()=>{
  const {stationBoardHTML}=await import('../js/board.mjs');
  const a=demoRecords(new Date('2026-10-13T20:00:00Z')).action_log[0];
  const html=stationBoardHTML([{...a,status_date:'2026-10-03',updated_at:'2026-10-13T15:00:00.000Z'}],'S1');
  const line=html.match(/class="update-date"[^>]*>(.*?)<\/p>/s)[1];
  assert.match(line,/Status date/);assert.match(line,/October 3, 2026/);assert.doesNotMatch(line,/October 13/);
  const legacy=stationBoardHTML([{...a,status_date:null,updated_at:'2026-10-13T01:00:00.000Z'}],'S1');
  assert.match(legacy.match(/class="update-date"[^>]*>(.*?)<\/p>/s)[1],/October 12, 2026/);
});

test('N14 history status date remains separate from the recorded date and time',async()=>{
  const {actionLogHTML}=await import('../js/board.mjs');
  const a=demoRecords(new Date('2026-10-13T20:00:00Z')).action_log[0];
  const html=actionLogHTML([{...a,status_date:'2026-10-03',updated_at:'2026-10-13T15:30:00.000Z'}],'S1');
  assert.match(html.match(/class="status-date"[^>]*>(.*?)<\/time>/s)[1],/October 3, 2026/);
  assert.match(html.match(/class="recorded-at"[^>]*>(.*?)<\/time>/s)[1],/October 13, 2026, 8:30 a\.m\./);
  assert.match(html,/Status date/);assert.match(html,/Recorded at/);
});


test('N30 current board CSV hides legacy due dates for Checked and Not done',()=>{
  const rows=currentActions(demoRecords(new Date('2026-10-13T20:00:00Z')).action_log,'S1').map(row=>({...row,due_date:'2026-10-30'}));
  const [header,...csv]=parseCSV(boardCSV(rows,'S1'));
  for(const row of csv)assert.equal(row[header.indexOf('due_date')],row[header.indexOf('status')]==='planned'?'2026-10-30':'');
  assert.ok(rows.every(row=>row.due_date==='2026-10-30'));
});
