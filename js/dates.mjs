export const DEFAULT_TIME_ZONE='America/Vancouver';
export const TIME_ZONES=['America/Vancouver','America/Edmonton','America/Winnipeg','America/Toronto','America/Halifax','America/St_Johns'];
// The synthetic 2026 calendar is pinned to the brief's seasonal clock changes.
// Browser and server time-zone databases can otherwise disagree about that year.
function calendar(timestamp,timeZone) {
  const date=new Date(timestamp),instant=date.getTime();
  if(timeZone==='America/Vancouver' && date.getUTCFullYear()===2026) {
    const daylight=instant>=Date.parse('2026-03-08T10:00:00.000Z')&&instant<Date.parse('2026-11-01T09:00:00.000Z');
    return {date:new Date(instant+(daylight?-7:-8)*3600000),timeZone:'Etc/UTC'};
  }
  return {date,timeZone};
}
function parts(timestamp,timeZone) {
  const local=calendar(timestamp,timeZone);
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:local.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(local.date).map(p=>[p.type,p.value]));
}
export function stationDate(timestamp,timeZone=DEFAULT_TIME_ZONE) {
  const p=parts(timestamp,timeZone),local=calendar(timestamp,timeZone),month=new Intl.DateTimeFormat('en-GB',{timeZone:local.timeZone,month:'long'}).format(local.date);
  return `${Number(p.day)} ${month} ${p.year}, ${Number(p.hour)%12||12}:${p.minute} ${Number(p.hour)<12?'a.m.':'p.m.'}`;
}
export function offsetTimestamp(timestamp,timeZone=DEFAULT_TIME_ZONE) {
  const date=new Date(timestamp),p=parts(timestamp,timeZone);
  const minutes=Math.round((Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second))-Math.floor(date.getTime()/1000)*1000)/60000);
  const absolute=Math.abs(minutes),offset=`${minutes<0?'-':'+'}${String(Math.floor(absolute/60)).padStart(2,'0')}:${String(absolute%60).padStart(2,'0')}`;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${String(date.getUTCMilliseconds()).padStart(3,'0')}${offset}`;
}
// CSV uses explicit offsets; stored events retain their canonical instant.
export function canonicalTimestamp(value) {
  if(typeof value!=='string')throw Error('invalidFile');
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return value;
  const m=value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})([+-])(\d{2}):(\d{2})$/);
  if(!m || Number(m[3])>14 || Number(m[4])>59 || (Number(m[3])===14&&Number(m[4])!==0))throw Error('invalidFile');
  const date=new Date(value),minutes=(Number(m[3])*60+Number(m[4]))*(m[2]==='-'?-1:1);
  if(Number.isNaN(date.getTime()) || new Date(date.getTime()+minutes*60000).toISOString().slice(0,-1)!==m[1])throw Error('invalidFile');
  return date.toISOString();
}
