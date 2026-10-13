import {cardKey,exportJSON,validateAction} from './core.mjs';
let database;
const stores=['checkins','shifts','action_log'];
export async function openStorage() {
  database = await new Promise((resolve,reject)=>{
    const request=indexedDB.open('transitx-checkin-prototype',2);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('checkins')) {
        const checkins=db.createObjectStore('checkins',{keyPath:'id'});
        checkins.createIndex('cardKey','cardKey',{unique:true});
        db.createObjectStore('shifts',{keyPath:'id'});
      }
      if(!db.objectStoreNames.contains('action_log')) db.createObjectStore('action_log',{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('blocked'));
  });
  database.onversionchange=()=>database.close();
}
const records=rows=>rows.map(({cardKey:_,...r})=>r);
export function readAll() {
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(stores,'readonly');
    const c=tx.objectStore('checkins').getAll(),s=tx.objectStore('shifts').getAll(),a=tx.objectStore('action_log').getAll();
    tx.oncomplete=()=>resolve({checkins:records(c.result),shifts:s.result,action_log:a.result.sort((x,y)=>x.updated_at.localeCompare(y.updated_at))});
    tx.onabort=()=>reject(tx.error); tx.onerror=()=>reject(tx.error);
  });
}
export function addRecords(bundle) {
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(stores,'readwrite');let invalid=false;
    for(const r of bundle.checkins ?? []) {const key=cardKey(r);tx.objectStore('checkins').add(key?{...r,cardKey:key}:r);}
    for(const r of bundle.shifts ?? []) tx.objectStore('shifts').add(r);
    const request=tx.objectStore('action_log').getAll();
    request.onsuccess=()=>{
      const history=request.result;
      for(const r of bundle.action_log??[]) {
        if(Object.keys(validateAction(r,history)).length) {invalid=true;tx.abort();return;}
        tx.objectStore('action_log').add(r);history.push(r);
      }
    };
    tx.oncomplete=resolve;tx.onabort=()=>reject(invalid?Error('invalidHistory'):tx.error);tx.onerror=()=>reject(tx.error);
  });
}
export function clearRecords(expectedExport) {
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(stores,'readwrite');
    const requests=stores.map(k=>tx.objectStore(k).getAll());let finished=0,changed=false;
    function verify() {
      if(++finished!==stores.length) return;
      const [c,s,a]=requests.map(r=>r.result);
      a.sort((x,y)=>x.updated_at.localeCompare(y.updated_at));
      if(exportJSON(records(c),s,a)!==expectedExport) {changed=true;tx.abort();return;}
      for(const name of stores) tx.objectStore(name).clear();
    }
    requests.forEach(r=>r.onsuccess=verify);
    tx.oncomplete=resolve;tx.onabort=()=>reject(changed?Error('clearNeedExport'):tx.error);tx.onerror=()=>reject(tx.error);
  });
}
