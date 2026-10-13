import en from './locales/en.mjs';
export const STATIONS = ['S1', 'S2', 'S3', 'S4'];
export const BANDS = ['weekday-morning', 'weekday-midday', 'weekday-evening', 'weekend'];
export const REASONS = ['lighting', 'staff_nearby', 'crowding', 'too_few_people', 'behaviour', 'cleanliness', 'waiting', 'information', 'help', 'something_else'];
export const ANSWERS = ['yes', 'no', 'not-sure'];
export const CHECKED = ['on-site', 'rated-safe', 'not-sure'];
export const COLUMNS = ['id', 'source', 'synthetic', 'station', 'round', 'date', 'time_band', 'staff_code', 'card_number', 'safety', ...REASONS.map(r => `reason_${r}`), 'knows_help', 'noticed_board', 'trust', 'checked_meaning'];
export const SHIFT_COLUMNS = ['id', 'synthetic', 'station', 'round', 'date', 'time_band', 'staff_code', 'asks', 'refusals'];
const recordKeys = ['id', 'source', 'synthetic', 'station', 'round', 'date', 'time_band', 'staff_code', 'card_number', 'safety', 'reasons', 'knows_help', 'noticed_board', 'trust', 'checked_meaning'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function cardKey(r) { return r.source === 'staff' ? `${r.station}/${r.round}/${r.card_number}` : null; }
function validDate(s, now) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0,10) === s && s <= now; }
function contextErrors(r, now, staffed) {
  const e = {};
  if (!STATIONS.includes(r.station)) e.station = 'invalidStation';
  if (staffed && ![1,2].includes(r.round)) e.round = 'invalidRound';
  if (!validDate(r.date, now)) e.date = 'invalidDate';
  if (!BANDS.includes(r.time_band)) e.time_band = 'invalidBand';
  if (staffed && !/^[A-Z]\d{2,4}$/.test(r.staff_code ?? '')) e.staff_code = 'invalidStaff';
  return e;
}
export function validateCheckin(r, existing = [], now = today()) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return {record: 'invalidRecord'};
  const staff = r.source === 'staff';
  const e = contextErrors(r, now, staff);
  if (!uuid.test(r.id ?? '') || !['staff','rider-link'].includes(r.source) || Object.keys(r).some(k => !recordKeys.includes(k))) e.record = 'invalidRecord';
  if (r.synthetic !== true) e.synthetic = 'invalidSynthetic';
  if (!staff && (r.round !== null || r.staff_code !== null || r.card_number !== null)) e.record = 'invalidRecord';
  if (staff && (!Number.isSafeInteger(r.card_number) || r.card_number < 1)) e.card_number = 'invalidCard';
  if (staff && existing.some(x => cardKey(x) === cardKey(r))) e.card_number = 'duplicateCard';
  if (!Number.isInteger(r.safety) || r.safety < 1 || r.safety > 10) e.safety = 'invalidSafety';
  if (!Array.isArray(r.reasons) || r.reasons.length < 1 || r.reasons.length > 3 || new Set(r.reasons).size !== r.reasons.length || r.reasons.some(x => !REASONS.includes(x))) e.reasons = 'invalidReasons';
  for (const k of ['knows_help','noticed_board']) if (!ANSWERS.includes(r[k])) e[k] = 'invalidAnswer';
  if (!(Number.isInteger(r.trust) && r.trust >= 1 && r.trust <= 5) && r.trust !== 'no-opinion') e.trust = 'invalidTrust';
  if (!CHECKED.includes(r.checked_meaning)) e.checked_meaning = 'invalidAnswer';
  return e;
}
export function validateShift(r, now = today()) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return {record:'invalidRecord'};
  const e = contextErrors(r, now, true);
  if (!uuid.test(r.id ?? '') || Object.keys(r).some(k => !SHIFT_COLUMNS.includes(k))) e.record = 'invalidRecord';
  if (r.synthetic !== true) e.synthetic = 'invalidSynthetic';
  for (const k of ['asks','refusals']) if (!Number.isSafeInteger(r[k]) || r[k] < 0) e[k] = 'invalidCount';
  if (r.refusals > r.asks) e.refusals = 'invalidRefusals';
  return e;
}
export function quota(records) {
  return STATIONS.flatMap(station => [1,2].map(round => {
    const group = records.filter(r => r.source === 'staff' && r.station === station && r.round === round);
    return {station, round, completed:group.length, target:75, remaining:Math.max(0,75-group.length), bands:Object.fromEntries(BANDS.map(b => [b,group.filter(r => r.time_band === b).length]))};
  }));
}
export function riderCounts(records) { return STATIONS.map(station => ({station,count:records.filter(r => r.source === 'rider-link' && r.station === station).length})); }
export function csvCell(v) { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; }
export function toCSV(rows, columns) { return [columns, ...rows.map(r => columns.map(c => r[c]))].map(row => row.map(csvCell).join(',')).join('\r\n')+'\r\n'; }
export function checkinRows(records) { return records.map(r => Object.fromEntries(COLUMNS.map(c => [c, c.startsWith('reason_') ? Number(r.reasons.includes(c.slice(7))) : r[c]]))); }
export function exportCSV(records) { return toCSV(checkinRows(records), COLUMNS); }
export function exportJSON(checkins, shifts = []) { return JSON.stringify({schema_version:1,checkins,shifts},null,2)+'\n'; }
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/,'');
  for (let i=0; i<text.length; i++) {
    const c=text[i];
    if (quoted) { if (c === '"') { if (text[i+1] === '"') { cell+='"'; i++; } else { quoted=false; closed=true; } } else cell+=c; }
    else if (c === '"') { if (cell || closed) throw Error('invalidFile'); quoted=true; }
    else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell=''; closed=false;
      if (c !== ',') { rows.push(row); row=[]; if (c === '\r' && text[i+1] === '\n') i++; }
    } else { if (closed) throw Error('invalidFile'); cell+=c; }
  }
  if (quoted) throw Error('invalidFile');
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  return rows;
}
function sameKeys(o, keys) { return o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o,k)); }
function csvBundle(text) {
  const [header,...rows] = parseCSV(text);
  const shift = header?.join(',') === SHIFT_COLUMNS.join(',');
  if (!shift && header?.join(',') !== COLUMNS.join(',')) throw Error('invalidFile');
  const records = rows.map(row => {
    if (row.length !== header.length) throw Error('invalidFile');
    const r = Object.fromEntries(header.map((k,i)=>[k,row[i]]));
    if (r.synthetic !== 'true') throw Error('invalidSynthetic'); r.synthetic=true;
    for (const k of (shift ? ['round','asks','refusals'] : ['round','card_number','safety'])) {
      if (r[k] === '' && !shift && ['round','card_number'].includes(k)) r[k]=null;
      else { if (!/^\d+$/.test(r[k])) throw Error('invalidFile'); r[k]=Number(r[k]); }
    }
    if (!shift) {
      r.staff_code = r.staff_code || null;
      r.trust = /^[1-5]$/.test(r.trust) ? Number(r.trust) : r.trust;
      r.reasons=[];
      for (const reason of REASONS) { const k=`reason_${reason}`; if (!['0','1'].includes(r[k])) throw Error('invalidFile'); if (r[k] === '1') r.reasons.push(reason); delete r[k]; }
    }
    return r;
  });
  return {schema_version:1,checkins:shift?[]:records,shifts:shift?records:[]};
}
function canonical(r) { return JSON.stringify(Object.fromEntries(Object.keys(r).sort().map(k => [k,k === 'reasons' ? [...r[k]].sort() : r[k]]))); }
export function prepareImport(text, format, existing = {checkins:[],shifts:[]}, now=today()) {
  let bundle;
  try { bundle = format === 'csv' ? csvBundle(text) : JSON.parse(text); } catch(e) { throw Error(e.message === 'invalidSynthetic' ? e.message : 'invalidFile'); }
  if (!sameKeys(bundle,['schema_version','checkins','shifts']) || bundle.schema_version !== 1 || !Array.isArray(bundle.checkins) || !Array.isArray(bundle.shifts)) throw Error('invalidFile');
  const result={checkins:[],shifts:[],duplicates:0};
  const ids=new Map([...existing.checkins,...existing.shifts].map(r=>[r.id,canonical(r)]));
  const cards=new Map(existing.checkins.filter(r=>r.source==='staff').map(r=>[cardKey(r),canonical(r)]));
  for (const kind of ['checkins','shifts']) for (const r of bundle[kind]) {
    if (!sameKeys(r,kind === 'checkins' ? recordKeys : SHIFT_COLUMNS)) throw Error('invalidFile');
    const errors=kind === 'checkins' ? validateCheckin(r,[],now) : validateShift(r,now);
    if (Object.keys(errors).length) throw Error(errors.synthetic ?? 'invalidFile');
    const signature=canonical(r), key=kind === 'checkins' ? cardKey(r) : null;
    if (ids.has(r.id) || (key && cards.has(key))) {
      const previous=ids.get(r.id) ?? cards.get(key);
      // Card duplicates with different IDs are accepted only when all answers match.
      const equivalent=(a,b)=>canonical({...JSON.parse(a),id:r.id}) === canonical({...JSON.parse(b),id:r.id});
      if (!equivalent(previous,signature) || (ids.has(r.id) && ids.get(r.id)!==signature) || (key && cards.has(key) && !equivalent(cards.get(key),signature))) throw Error('conflict');
      result.duplicates++; continue;
    }
    ids.set(r.id,signature); if(key) cards.set(key,signature); result[kind].push(r);
  }
  return result;
}
export function dictionary(locale=en) {
  const typeFor=c => c==='id'?'uuid':c==='synthetic'?'boolean':c==='date'?'date':c==='staff_code'?'code':(c.startsWith('reason_')?'binary':['round','card_number','safety','asks','refusals'].includes(c)?'integer':'enum');
  const allowedFor=c => c.startsWith('reason_')?'binary':({id:'uuid',source:'source',synthetic:'synthetic',station:'station',round:'round',date:'date',time_band:'band',staff_code:'staff',card_number:'card',safety:'safety',knows_help:'answer',noticed_board:'answer',trust:'trust',checked_meaning:'checked',asks:'count',refusals:'count'}[c]);
  return [['checkins',COLUMNS],['shifts',SHIFT_COLUMNS]].flatMap(([dataset,cols])=>cols.map(column=>({dataset,column,type:locale[`t_${typeFor(column)}`],allowed_values:locale[`a_${dataset==='shifts'&&column==='round'?'shift_round':dataset==='shifts'&&column==='staff_code'?'shift_staff':allowedFor(column)}`],description:locale[`d_${column.startsWith('reason_')?'reason':column}`]})));
}
export function dictionaryCSV(locale=en) { return toCSV(dictionary(locale),['dataset','column','type','allowed_values','description']); }
export function dictionaryMarkdown(locale=en) { return `# ${locale.dictionaryTitle}\n\n| ${locale.dataset} | ${locale.column} | ${locale.type} | ${locale.allowed} | ${locale.description} |\n| --- | --- | --- | --- | --- |\n`+dictionary(locale).map(r=>`| ${Object.values(r).join(' | ')} |`).join('\n')+'\n'; }
export function demoRecords() {
  const checkins=[],shifts=[]; let sequence=1;
  const id=()=>`00000000-0000-4000-8000-${String(sequence++).padStart(12,'0')}`;
  for (const station of STATIONS) for (const round of [1,2]) {
    for(let card_number=1;card_number<=75;card_number++) checkins.push({id:id(),source:'staff',synthetic:true,station,round,date:'2026-01-01',time_band:BANDS[(card_number-1)%4],staff_code:'F01',card_number,safety:1+(card_number%10),reasons:[REASONS[card_number%10]],knows_help:ANSWERS[card_number%3],noticed_board:ANSWERS[(card_number+1)%3],trust:card_number%6 === 0?'no-opinion':1+(card_number%5),checked_meaning:CHECKED[card_number%3]});
    shifts.push({id:id(),synthetic:true,station,round,date:'2026-01-01',time_band:'weekday-morning',staff_code:'F01',asks:100,refusals:25});
  }
  for(const station of STATIONS) for(let i=0;i<2;i++) checkins.push({id:id(),source:'rider-link',synthetic:true,station,round:null,date:'2026-01-01',time_band:'weekend',staff_code:null,card_number:null,safety:7,reasons:['lighting'],knows_help:'yes',noticed_board:'not-sure',trust:'no-opinion',checked_meaning:'not-sure'});
  return {checkins,shifts};
}
