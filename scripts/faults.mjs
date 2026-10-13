// Faults are planted only in disposable local copies, never in the delivered source.
export default [
 ['V01','js/core.mjs',"if(!STATIONS.includes(r.station))e.station='invalidStation'","if(false)e.station='invalidStation'"],
 ['V02','js/core.mjs','v>=1&&v<=10','v>=1&&v<=11'],
 ['V03','js/core.mjs','r.reasons.length>3','r.reasons.length>4'],
 ['V04','js/core.mjs','value<=String(now).slice(0,10)','true'],
 ['V05','js/core.mjs',"if(staff&&existing.some(x=>cardKey(x)===cardKey(r)))e.card_number='duplicateCard'","if(false)e.card_number='duplicateCard'"],
 ['V06','js/core.mjs',"if(!staff&&(r.round!==null||r.staff_code!==null||r.card_number!==null))e.record='invalidRecord'","if(false)e.record='invalidRecord'"],
 ['V07','js/core.mjs',"if(r.refusals>r.asks)e.refusals='invalidRefusals'","if(false)e.refusals='invalidRefusals'"],
 ['Q01','js/core.mjs',"r.source==='staff'&&r.station===station&&r.round===round","r.station===station&&r.round===round"],
 ['Q02','js/core.mjs',"r.source==='rider-link'&&r.station===station","r.station===station"],
 ['E01','js/core.mjs','Number(r.reasons.includes(c.slice(7)))','0'],
 ['E02','js/core.mjs',"s.replaceAll('\"','\"\"')","s"],
 ['E03','js/core.mjs','schema_version:1,checkins,shifts','schema_version:2,checkins,shifts'],
 ['D01','js/core.mjs',"[['checkins',COLUMNS],['shifts',SHIFT_COLUMNS]]","[['checkins',COLUMNS.slice(1)],['shifts',SHIFT_COLUMNS]]"],
 ['I01','js/core.mjs','result.duplicates++;continue;','continue;'],
 ['I02','js/core.mjs',"throw Error('conflict');","continue;"],
 ['I03','js/core.mjs','bundle.schema_version!==1','false'],
 ['S01','js/core.mjs','card_number<=75','card_number<=74'],
 ['L01','js/locales/second.mjs','"title": "translation pending",',''],
 ['V08','js/core.mjs',"if(r.noticed_board==='yes')",'if(false)'],
 ['V09','js/core.mjs',"if(r.trust!==null)e.trust='invalidRecord'","if(r.trust===null)e.trust='invalidRecord'"],
 ['V10','js/core.mjs',"if(r.trust!==null)e.trust='invalidRecord'","if(false)e.trust='invalidRecord'"],
 ['I04','js/core.mjs',"if(!optionalScalar(r.trust,v=>(Number.isInteger(v)&&v>=1&&v<=5)||v==='no-opinion'))e.trust='invalidTrust'","if(r.trust===null||!optionalScalar(r.trust,v=>(Number.isInteger(v)&&v>=1&&v<=5)||v==='no-opinion'))e.trust='invalidTrust'"],
 ['I05','js/core.mjs',"r.checked_meaning=r.checked_meaning===''?null:r.checked_meaning","r.checked_meaning=r.checked_meaning===''?'':r.checked_meaning"],
 ['I06','js/core.mjs',"if(r.trust!==null)e.trust='invalidRecord'","if(false)e.trust='invalidRecord'"],
 ['E04','js/core.mjs',"v==null?'':String(v)","v==null?'null':String(v)"],
 ['D02','js/locales/en.mjs','Asked only after Yes, and I read it on question 4; empty (null) otherwise.','Always required.'],
 ['S02','js/core.mjs',"trust:noticed_board==='yes'?(card_number%6===0?'no-opinion':1+(card_number%5)):null","trust:1+(card_number%5)"],
 ['F01','js/form.mjs','escape(locale.riderHelp)',"escape('')"],
 ['F02','js/form.mjs','escape(locale.cardUrgent)',"escape('')"],
 ['F03','js/form.mjs','control.required = false','control.required = true'],
 ['F04','js/form.mjs',"if (noticedBoard !== 'yes') return {trust: null, checked_meaning: null};","if (false) return {trust: null, checked_meaning: null};"],
 ['F05','js/locales/en.mjs',"cardHeader: 'A short, voluntary card.'", "cardHeader: 'About one minute.'"],
 ['O03','sw.js',"k.startsWith('transitx-checkin-')&&k!==CACHE",'false'],
 ['O02','sw.js',"'./manifest.webmanifest',",''],
 ['M01','js/core.mjs','action_log:demoActions(clock)','action_log:[]'],
 ['M02','js/storage.mjs',"for(const name of stores) tx.objectStore(name).clear();","for(const name of ['checkins','shifts']) tx.objectStore(name).clear();"],
 ['C01','js/questions.mjs','prompt: locale.safety,',"prompt:'Wrong question',"],
 ['B01','js/core.mjs',"(r.status==='not-done'&&!r.reason.trim())",'false'],
 ['B02','js/core.mjs','return [...history,{...event}];','return [{...event}];'],
 ['B03','js/core.mjs','updated_at:offsetTimestamp(r.updated_at,timeZone)})),BOARD_COLUMNS)', 'updated_at:offsetTimestamp(r.updated_at,timeZone)})),ACTION_COLUMNS)'],
 ['B04','js/core.mjs','result.action_log.push(r);',''],
 ['P01','js/dates.mjs',"Number(p.hour)<12?'a.m.':'p.m.'", "'a.m.'"],
 ['P02','js/dates.mjs','const absolute=Math.abs(minutes)', 'const absolute=420'],
 ['P03','js/board.mjs','sort((a, b) => shownDate(b).localeCompare(shownDate(a))||compareEvents(b, a))','sort((a, b) => shownDate(a).localeCompare(shownDate(b))||compareEvents(b, a))'],
 ['P04','js/board.mjs','${icons[status] ?? \'\'}','${icons.checked}'],
 ['P05','js/board.mjs','escape(locale.syntheticBanner)',"escape(locale.noActions)"],
 ['P06','js/board.mjs','tabindex="0" role="region"','tabindex="-1" role="region"'],
 ['P07','js/core.mjs','updated_at:offsetTimestamp(r.updated_at,timeZone)','updated_at:r.updated_at'],
 ['P08','styles.css','page:boardTabloid; font-size:18pt;','page:boardTabloid; font-size:12pt;'],
 ['P09','js/dates.mjs','instant>=VANCOUVER_UTC7_FROM?-7:-8','instant>=VANCOUVER_UTC7_FROM&&instant<Date.parse(\'2026-11-01T09:00:00.000Z\')?-7:-8'],
 ['O01','sw.js',"'./js/storage.mjs',",'']
 ,['A01','js/app.mjs',"view.addEventListener('click',event=>{const link=event.target.closest('[data-focus]');if(link)focusLink(event,document.getElementById(link.dataset.focus));});",'']
 ,['A02','js/ui.mjs','const invoking=event?.submitter??document.activeElement','const invoking=null']
 ,['A03','styles.css','--line:#5f746a','--line:#a7b5ae']
 ,['A04','js/locales/en.mjs',"legendChecked: 'Checked on site: staff went to the station and confirmed this action was done, on the date shown.'","legendChecked: 'Checked.'"]
 ,['B10','js/board.mjs',"return ['checked', 'planned', 'not-done']","return ['planned', 'checked', 'not-done']"]
 ,['B11','js/app.mjs',"if(readOnly)document.querySelector('#navigation').remove();","if(false)document.querySelector('#navigation').remove();"]
 ,['B12','js/locales/en.mjs',"cardTitle: 'How safe do you feel at this station?'","cardTitle: 'How safe do you feel?'" ]
 ,['B13','js/core.mjs',"export const BOARD_ANSWERS = ['yes', 'yes-unread', 'no', 'not-sure'];","export const BOARD_ANSWERS = ['yes', 'no', 'not-sure'];"]
 ,['B14','js/locales/en.mjs',"weekday_morning: 'Weekday morning (06:00 to 09:59)'","weekday_morning: 'Weekday morning'"]
 ,['B15','js/app.mjs','const questionNumbers={safety:1,reasons:2,knows_help:3,noticed_board:4,trust:5,checked_meaning:6};','const questionNumbers={safety:1};']
 ,['B16','styles.css','body.print-tabloid .board-legend-wrap h3,body.print-tabloid .board-legend,body.print-tabloid .board-notice { font-size:24pt; }','body.print-tabloid .board-legend-wrap h3,body.print-tabloid .board-legend,body.print-tabloid .board-notice { font-size:17pt; }']
 ,['B17','js/core.mjs',"title:'Replace two dark lights at the north stairs'","title:'Replace lights'"]
 ,['B18','README.md',"Application records stay in this browser's IndexedDB.","Application records stay on the server."]
 ,['B19','js/display-dates.mjs','return `${MONTHS[date.getUTCMonth()]} ${Number(value.slice(8,10))}, ${value.slice(0,4)}`;','return `${value.slice(0,4)}-${MONTHS[date.getUTCMonth()]}-${Number(value.slice(8,10))}`;']
 ,['M04','js/core.mjs','const d=new Date(`${clockDate(clock,days)}T00:00:00.000Z`);','const d=new Date(clock instanceof Date?clock.getTime():clock);']
 ,['B20','js/core.mjs',"!(Number(r.event_number??0)>Number(previous.event_number??0))","Number(r.event_number??0)<Number(previous.event_number??0)"]
 ,['B21','js/core.mjs','r.status_date=null;r.due_date=null;r.event_number=null','r.status_date=null;r.due_date=null;r.event_number=1']
 ,['B22','js/core.mjs',"if(Object.hasOwn(r,'due_date')&&r.due_date!==null&&!dateIsValid(r.due_date))e.due_date='invalidDueDate';","if(Object.hasOwn(r,'due_date')&&r.due_date!==null&&(!dateIsValid(r.due_date)||(r.status_date&&dateIsValid(r.status_date)&&r.due_date<r.status_date)))e.due_date='invalidDueDate';"]
 ,['V11','js/core.mjs',"record.safety===null","record.safety!==null"]
 ,['E05','js/core.mjs',"r.reasons.length?Number(r.reasons.includes(c.slice(7))):''","r.reasons.length?Number(r.reasons.includes(c.slice(7))):0"]
 ,['Q03','js/core.mjs','completed=group.filter(r=>!isBlankCard(r))','completed=group']
 ,['V12','js/core.mjs',"export const CHECKED = ['on-site', 'rated-safe', 'problem-fixed', 'not-sure'];","export const CHECKED = ['on-site', 'rated-safe', 'not-sure'];"]
 ,['B05','js/core.mjs',"const ACTION_OPTIONAL_COLUMNS = ['status_date','due_date','event_number','withheld'];","const ACTION_OPTIONAL_COLUMNS = ['status_date','due_date','event_number'];"]
 ,['B06','js/core.mjs','return [...history,{...event}];','return [...history];']
 ,['B07','js/core.mjs','Number(a?.event_number??0)-Number(b?.event_number??0)','Number(b?.event_number??0)-Number(a?.event_number??0)']
 ,['B08','js/board.mjs','event?.withheld !== true','event?.withheld === true']
 ,['B09','js/core.mjs',"const isAction=header.join(',')===ACTION_COLUMNS.join(',')||header.join(',')===LEGACY_ACTION_COLUMNS.join(',');","const isAction=header.join(',')===ACTION_COLUMNS.join(',');"]
 ,['M03','js/core.mjs','const collectionDate=clockDate(clock);',"const collectionDate=clockDate(new Date('2026-01-01T00:00:00.000Z')); "]
 ,['U01','js/ui.mjs','return ROUTES.includes(value)?value:null;','return value;']
 ,['U02','js/ui.mjs',"element.textContent='';","element.textContent='stale';"]
 ,['U03','js/ui.mjs',"${errors?'Error: ':''}","${errors?'':''}"]
 ,['U04','js/ui.mjs','form.reset();',"form.elements.safety.value='';"]
 ,['U05','js/ui.mjs','if(busy)return;','if(false)return;']
 ,['U06','js/ui.mjs',"reject(Error('offlineTimeout'))","reject(Error('offlineInstall'))"]
 ,['U07','js/ui.mjs',"if(!await cache.match(new URL('./js/card.mjs',base).href))throw Error('offlineMissing');","if(false)throw Error('offlineMissing');"]
 ,['B23','js/board.mjs','const shownDate=event=>event.status_date??offsetTimestamp(eventTime(event),timeZone).slice(0,10);','const shownDate=event=>offsetTimestamp(eventTime(event),timeZone).slice(0,10);']
 ,['U08','js/ui.mjs','export function printPanels(rows) {return rows.map(row=>[row]);}','export function printPanels(rows) {return rows;}']
];
