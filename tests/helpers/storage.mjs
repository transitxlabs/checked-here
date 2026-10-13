// Small asynchronous storage double for transaction boundary checks.
// Writes are committed together, or all discarded on abort.
export function storageDouble() {
  const state=new Map();
  const db={
    objectStoreNames:{contains:name=>state.has(name)},
    createObjectStore(name){state.set(name,new Map());return {createIndex(){}};},
    close(){},
    transaction(names) {
      const working=new Map(names.map(name=>[name,new Map([...state.get(name)].map(([k,v])=>[k,structuredClone(v)]))]));
      let aborted=false;
      const tx={
        objectStore(name) {
          if(!working.has(name))throw Error('Missing store');
          const rows=working.get(name);
          return {
            getAll(){const request={};queueMicrotask(()=>{request.result=structuredClone([...rows.values()]);request.onsuccess?.();});return request;},
            add(row){if(rows.has(row.id)){tx.error=Error('Duplicate key');tx.abort();return;}rows.set(row.id,structuredClone(row));},
            clear(){rows.clear();}
          };
        },
        abort(){aborted=true;queueMicrotask(()=>tx.onabort?.());}
      };
      setTimeout(()=>{if(aborted)return;for(const [name,rows] of working)state.set(name,rows);tx.oncomplete?.();},0);
      return tx;
    }
  };
  return {open(){const request={};setTimeout(()=>{request.result=db;request.onupgradeneeded?.();request.onsuccess?.();},0);return request;}};
}
