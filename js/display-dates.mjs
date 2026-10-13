import {DEFAULT_TIME_ZONE,stationDate} from './dates.mjs';

const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

export function dateWords(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError('invalidDate');
  const date=new Date(`${value}T00:00:00.000Z`);
  if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value) throw new RangeError('invalidDate');
  return `${MONTHS[date.getUTCMonth()]} ${Number(value.slice(8,10))}, ${value.slice(0,4)}`;
}

export function wordDate(timestamp,timeZone=DEFAULT_TIME_ZONE) {
  const value=stationDate(timestamp,timeZone),match=value.match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})(.*)$/);
  return match?`${match[2]} ${match[1]}, ${match[3]}${match[4]}`:value;
}

export function boardDate(event,timeZone=DEFAULT_TIME_ZONE) {
  if(event?.status_date) return dateWords(event.status_date);
  const match=stationDate(event?.updated_at,timeZone).match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})/);
  if(!match) return stationDate(event?.updated_at,timeZone);
  const month=MONTHS.indexOf(match[2])+1;
  return dateWords(`${match[3]}-${String(month).padStart(2,'0')}-${String(Number(match[1])).padStart(2,'0')}`);
}
