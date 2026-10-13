export const ROUTES=['home','staff','rider','board','card','quota','data'];
export function printPanels(rows) {return rows.map(row=>[row]);}
export function clearBoardPrint(document) {
  document.querySelector('.board-print-pages')?.remove();
  document.querySelector('.board-print-original')?.classList.remove('board-print-original');
}
export function prepareBoardPrint(document) {
  clearBoardPrint(document);
  const board=document.querySelector('.station-board');if(!board)return;
  const rows=[...board.querySelectorAll('.board-list>tr')];
  const pages=document.createElement('div');pages.className='board-print-pages';pages.setAttribute('aria-hidden','true');
  printPanels(rows).forEach((panel,index)=>{
    const page=board.cloneNode(true);page.classList.add('print-board-page');
    [...page.querySelectorAll('.board-list>tr')].forEach((row,i)=>{if(!panel.includes(rows[i]))row.remove();});
    page.querySelectorAll('[id]').forEach(element=>{const old=element.id;const next=`print-${index}-${old}`;element.id=next;page.querySelectorAll('[aria-labelledby]').forEach(label=>{label.setAttribute('aria-labelledby',label.getAttribute('aria-labelledby').split(' ').map(id=>id===old?next:id).join(' '));});});
    pages.append(page);
  });
  board.classList.add('board-print-original');board.after(pages);
}
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
export async function offlineFiles({serviceWorker,caches,base,cacheName='transitx-checkin-v1.2.0',milliseconds=15000}) {
  if(!serviceWorker)throw Error('offlineUnavailable');
  return withDeadline((async()=>{
    const registration=await serviceWorker.register(new URL('./sw.js',base).href);
    const failed=new Promise((_,reject)=>{
      const watch=worker=>worker?.addEventListener('statechange',()=>{if(worker.state==='redundant')reject(Error('offlineInstall'));});
      watch(registration.installing);registration.addEventListener('updatefound',()=>watch(registration.installing));
    });
    const ready=(async()=>{
      await serviceWorker.ready;
      if(!serviceWorker.controller)await new Promise(resolve=>serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
      const cache=await caches.open(cacheName);
      if(!await cache.match(new URL('./js/card.mjs',base).href))throw Error('offlineMissing');
      return true;
    })();
    return Promise.race([ready,failed]);
  })(),milliseconds);
}
