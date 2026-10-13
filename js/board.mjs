import {currentActions,BOARD_NOTICE} from './core.mjs';
export const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function stationBoardHTML(history,station,locale) {
  const actions=currentActions(history,station);
  return `<article class="station-board print-surface" aria-label="Station board for ${escape(station)}"><p class="eyebrow">${escape(locale.syntheticBoard)}</p><h2>${escape(locale.boardRoute)} / ${escape(station)}</h2><p class="board-notice">${escape(BOARD_NOTICE)}</p>${actions.length?`<ul class="board-list">${actions.map(r=>`<li><p class="action-status">${escape(locale[r.status.replaceAll('-','_')])}</p><h3>${escape(r.title)}</h3><p>${escape(locale.concern)}: ${escape(locale[r.concern])}</p>${r.reason?`<p>${escape(locale.reason)}: ${escape(r.reason)}</p>`:''}<p class="update-date">${escape(locale.updated)} <time datetime="${r.updated_at}">${r.updated_at.slice(0,10)} ${r.updated_at.slice(11,16)} UTC</time> / ${escape(locale.syntheticRecord)}</p></li>`).join('')}</ul>`:`<p>${escape(locale.noActions)}</p>`}</article>`;
}
