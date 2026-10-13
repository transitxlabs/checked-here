import {currentActions,BOARD_NOTICE} from './core.mjs';
import {stationDate,DEFAULT_TIME_ZONE} from './dates.mjs';
export const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const icons={checked:'<path d="m5 12 4 4L19 6"/>',planned:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>','not-done':'<path d="m6 6 12 12M18 6 6 18"/>'};
export function statusBadgeHTML(status,locale) {
  return `<span class="status-badge status-${escape(status)}"><svg data-icon="${escape(status)}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${icons[status]}</svg><span>${escape(locale[status.replaceAll('-','_')])}</span></span>`;
}
export function boardActions(history,station) {
  const order={checked:0,planned:1,'not-done':2};
  return currentActions(history,station).sort((a,b)=>order[a.status]-order[b.status]||b.updated_at.localeCompare(a.updated_at)||a.action_id.localeCompare(b.action_id));
}
export function actionLogHTML(history,station,locale,timeZone=DEFAULT_TIME_ZONE) {
  const rows=history.filter(r=>r.station===station).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
  return `<div class="table-scroll action-log" tabindex="0" role="region" aria-label="${escape(locale.actionLog)}"><table><caption>${escape(locale.actionLog)}. ${escape(locale.logScrollHint)}</caption><thead><tr>${[locale.titleField,locale.action_status,locale.reason,locale.updated].map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${escape(r.title)}</th><td>${statusBadgeHTML(r.status,locale)}</td><td>${escape(r.reason)}</td><td><time datetime="${escape(r.updated_at)}">${escape(stationDate(r.updated_at,timeZone))}</time></td></tr>`).join('')}</tbody></table></div>`;
}
export function stationBoardHTML(history,station,locale,timeZone=DEFAULT_TIME_ZONE) {
  const actions=boardActions(history,station),newest=actions.reduce((latest,r)=>r.updated_at>latest?r.updated_at:latest,'');
  return `<article class="station-board print-surface" aria-label="Station board for ${escape(station)}"><table class="poster-table" role="presentation"><thead><tr><td><div class="poster-heading"><p class="synthetic-banner">${escape(locale.syntheticBanner)}</p><div class="poster-header-grid"><div class="station-title"><p class="poster-kicker">${escape(locale.boardHeading)}</p><h2>${escape(station)}</h2></div><div class="poster-context"><p class="last-updated">${escape(locale.lastUpdated)}: ${newest?`<time datetime="${escape(newest)}">${escape(stationDate(newest,timeZone))}</time>`:escape(locale.noUpdates)}</p><p class="station-zone">${escape(locale.localTime)}: ${escape(timeZone)}</p><div class="board-legend" aria-label="${escape(locale.statusLegend)}">${['checked','planned','not-done'].map(s=>statusBadgeHTML(s,locale)).join('')}</div></div></div></div></td></tr></thead><tfoot><tr><td><div class="board-footer"><p>${escape(BOARD_NOTICE)}</p><p>${escape(locale.riderInvitation)}</p></div></td></tr></tfoot><tbody class="board-list">${actions.length?actions.map(r=>`<tr><td><div class="action-card">${statusBadgeHTML(r.status,locale)}<h3>${escape(r.title)}</h3><p><strong>${escape(locale.youToldUs)}</strong> ${escape(locale[r.concern])}</p>${r.status==='not-done'?`<p><strong>${escape(locale.why)}</strong> ${escape(r.reason)}</p>`:''}<p class="update-date">${escape(locale.statusChanged)}: <time datetime="${escape(r.updated_at)}">${escape(stationDate(r.updated_at,timeZone))}</time></p></div></td></tr>`).join(''):`<tr><td><p>${escape(locale.noActions)}</p></td></tr>`}</tbody></table></article>`;
}
