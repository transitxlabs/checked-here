import {cardKey,exportJSON} from './core.mjs';
let database;
export async function openStorage() {
  database = await new Promise((resolve,reject)=>{
    const request=indexedDB.open('transitx-checkin-prototype',1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      const checkins=db.createObjectStore('checkins',{keyPath:'id'});
      checkins.createIndex('cardKey','cardKey',{unique:true});
      db.createObjectStore('shifts',{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('blocked'));
  });
  database.onversionchange=()=>database.close();
}
export function readAll() {
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(['checkins','shifts'],'readonly');
    const c=tx.objectStore('checkins').getAll(),s=tx.objectStore('shifts').getAll();
    tx.oncomplete=()=>resolve({checkins:c.result.map(({cardKey:_,...r})=>r),shifts:s.result});
    tx.onabort=()=>reject(tx.error); tx.onerror=()=>reject(tx.error);
  });
}
export function addRecords(bundle) {
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(['checkins','shifts'],'readwrite');
    for(const r of bundle.checkins ?? []) { const key=cardKey(r); tx.objectStore('checkins').add(key?{...r,cardKey:key}:r); }
    for(const r of bundle.shifts ?? []) tx.objectStore('shifts').add(r);
    tx.oncomplete=resolve; tx.onabort=()=>reject(tx.error); tx.onerror=()=>reject(tx.error);
  });
}
export function clearRecords(expectedExport) {
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(['checkins','shifts'],'readwrite');
    const c=tx.objectStore('checkins').getAll(),s=tx.objectStore('shifts').getAll();
    let finished=0,changed=false;
    function verify() {
      if(++finished!==2) return;
      const records=c.result.map(({cardKey:_,...r})=>r);
      if(exportJSON(records,s.result)!==expectedExport) {changed=true;tx.abort();return;}
      tx.objectStore('checkins').clear();tx.objectStore('shifts').clear();
    }
    c.onsuccess=verify;s.onsuccess=verify;
    tx.oncomplete=resolve;
    tx.onabort=()=>reject(changed?Error('clearNeedExport'):tx.error);
    tx.onerror=()=>reject(tx.error);
  });
}
