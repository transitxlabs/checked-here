export const ROUTES=['home','staff','rider','board','card','quota','data'];
export {printPanels,prepareBoardPrint,clearBoardPrint} from './print-layout.mjs';
export function routeFromHash(hash) {const value=hash.replace(/^#/,'');return ROUTES.includes(value)?value:null;}
export function focusLink(event,target) {
  event.preventDefault();
  if(!target)return;
  if(!target.matches('input,select,button,a,[tabindex]'))target.setAttribute('tabindex','-1');
  target.focus();target.scrollIntoView?.({block:'start'});
}
export function createAnnouncer(element,schedule=setTimeout,cancel=clearTimeout) {
  let pending;
  return text=>{cancel(pending);element.textContent='';pending=schedule(()=>{element.textContent=text;},30);};
}
export function pageTitle(name,title,errors=false) {return `${errors?'Error: ':''}${name} | ${title}`;}
export function resetCard(form,staff) {
  const keys=['station','round','date','time_band','staff_code'];
  const context=Object.fromEntries(keys.filter(k=>form.elements[k]).map(k=>[k,form.elements[k].value]));
  const next=staff?String(Number(form.elements.card_number.value)+1):null;
  form.reset();
  for(const [key,value] of Object.entries(context))form.elements[key].value=value;
  if(staff){form.elements.card_number.value=next;form.elements.card_number.focus();}
}
export function createRunner({document,onError,onIdle=()=>{}}) {
  let busy=false;
  return {get busy(){return busy;},async run(action,event) {
    event?.preventDefault();if(busy)return;
    busy=true;
    const invoking=event?.submitter??document.activeElement;
    const previous=invoking?.getAttribute?.('aria-disabled');
    invoking?.setAttribute?.('aria-disabled','true');
    try{return await action();}catch(error){onError(error);}finally{
      if(previous===null)invoking?.removeAttribute?.('aria-disabled');
      else if(previous!==undefined)invoking?.setAttribute?.('aria-disabled',previous);
      busy=false;await onIdle();
    }
  }};
}
export function withDeadline(work,milliseconds=15000,schedule=setTimeout,cancel=clearTimeout) {
  let timer;
  return Promise.race([work,new Promise((_,reject)=>{timer=schedule(()=>reject(Error('offlineTimeout')),milliseconds);})]).finally(()=>cancel(timer));
}
async function waitForControl(serviceWorker, registration, previousController) {
  await serviceWorker.ready;
  const pending = registration?.installing || registration?.waiting;
  const needsControl = worker => !!worker && worker !== previousController;
  if (needsControl(pending) || !serviceWorker.controller) {
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        serviceWorker.removeEventListener?.('controllerchange', onChange);
        if (error) reject(error); else resolve();
      };
      const onChange = () => {
        if (!previousController || serviceWorker.controller !== previousController) finish();
      };
      serviceWorker.addEventListener?.('controllerchange', onChange);
      if ((!pending && serviceWorker.controller && serviceWorker.controller !== previousController) ||
          (pending && pending.state === 'activated' && serviceWorker.controller !== previousController)) finish();
    });
  }
  if (!serviceWorker.controller) throw Error('offlineNoController');
}

export async function offlineFiles({serviceWorker,caches,base,cacheName='transitx-checkin-v1.2.1',milliseconds=15000}) {
  if(!serviceWorker)throw Error('offlineUnavailable');
  return withDeadline((async()=>{
    const previousController = serviceWorker.controller;
    const registration=await serviceWorker.register(new URL('./sw.js',base).href);
    const failed=new Promise((_,reject)=>{
      const watch=worker=>worker?.addEventListener?.('statechange',()=>{
        if(worker.state==='redundant')reject(Error('offlineInstall'));
      });
      watch(registration.installing);watch(registration.waiting);
      registration.addEventListener?.('updatefound',()=>watch(registration.installing));
    });
    const ready=(async()=>{
      await waitForControl(serviceWorker, registration, previousController);
      const asset = new URL('./js/card.mjs',base).href;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const cache = await caches.open(cacheName);
        if (await cache.match(asset)) return true;
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      throw Error('offlineMissing');
    })();
    return Promise.race([ready,failed]);
  })(),milliseconds);
}
