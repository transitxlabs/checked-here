import * as core from './core.mjs';
import {wordDate, dateWords, boardDate} from './display-dates.mjs';
import {offsetTimestamp, DEFAULT_TIME_ZONE} from './dates.mjs';
import en from './locales/en.mjs';

export const escape = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const icons = {
  checked: '<path d="m5 12 4 4L19 6"/>',
  planned: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  'not-done': '<path d="m6 6 12 12M18 6 6 18"/>'
};

const eventTime = event => event?.entry_time ?? event?.entrytime ?? event?.updated_at ?? event?.timestamp ?? '';

function compareEvents(a, b) {
  if (typeof core.compareActionEvents === 'function') return core.compareActionEvents(a, b);
  const at = String(eventTime(a));
  const bt = String(eventTime(b));
  if (at !== bt) return at.localeCompare(bt);
  const an = Number(a?.event_number ?? 0);
  const bn = Number(b?.event_number ?? 0);
  if (an !== bn) return an - bn;
  return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
}

function statusDate(action, timeZone = DEFAULT_TIME_ZONE) {
  const explicit = String(action?.status_date ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) {
    try { dateWords(explicit); return explicit; } catch { /* use the recorded timestamp */ }
  }
  const timestamp = eventTime(action);
  if (!timestamp) return '';
  try { return offsetTimestamp(timestamp, timeZone).slice(0, 10); } catch { return ''; }
}

function statusDateWords(action, timeZone = DEFAULT_TIME_ZONE) {
  const value = statusDate(action, timeZone);
  if (value) {
    try { return dateWords(value); } catch { /* fall through to timestamp text */ }
  }
  try { return boardDate(action, timeZone); } catch { return ''; }
}

export function statusBadgeHTML(status, locale = en) {
  const key = status === 'not-done' ? 'not_done' : status;
  return `<span class="status-badge status-${escape(status)}"><svg data-icon="${escape(status)}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${icons[status] ?? ''}</svg><span>${escape(locale[key] ?? '')}</span></span>`;
}

export function boardActions(history = [], station, timeZone = DEFAULT_TIME_ZONE) {
  const rows = typeof core.currentActions === 'function'
    ? core.currentActions(history, station)
    : [...history].filter(event => !station || event.station === station);
  return rows
    .filter(event => event?.withheld !== true)
    .slice()
    .sort((a, b) => statusDate(b, timeZone).localeCompare(statusDate(a, timeZone)) || compareEvents(b, a));
}

function statusCounts(actions, locale) {
  const counts = actions.reduce((result, action) => {
    result[action.status] = (result[action.status] ?? 0) + 1;
    return result;
  }, {});
  return ['checked', 'planned', 'not-done']
    .map(status => `${counts[status] ?? 0} ${locale[status === 'not-done' ? 'not_done' : status] ?? ''}`)
    .join(', ');
}

function reasonLabel(action, locale) {
  const key = action.concern ?? action.reason_code ?? '';
  return locale[key.replaceAll('-', '_')] ?? key;
}

function updatedMarkup(action, locale, timeZone) {
  const display = statusDateWords(action, timeZone);
  const label = locale.status_date ?? locale.updated;
  return `<p class="update-date"><strong>${escape(label)}</strong>: <time datetime="${escape(statusDate(action, timeZone))}">${escape(display)}</time></p>`;
}

function dueMarkup(action, locale) {
  if (action?.status !== 'planned' || !action?.due_date) return '';
  let due = String(action.due_date);
  try { due = dateWords(due); } catch { /* invalid dates are rejected by core, keep import-safe text */ }
  return `<p class="due-date"><strong>${escape(locale.due_date)}</strong>: ${escape(due)}</p>`;
}

function plainLegend(locale) {
  const items = [locale.legendChecked, locale.legendPlanned, locale.legendNotDone];
  return `<section class="board-legend-wrap" aria-labelledby="board-legend-heading"><h3 id="board-legend-heading">${escape(locale.statusLegend)}</h3><ul class="board-legend">${items.map(item => `<li>${escape(item)}</li>`).join('')}</ul></section>`;
}

function logStatusDate(action, locale, timeZone) {
  const display = statusDateWords(action, timeZone);
  const label = locale.status_date ?? locale.updated;
  return `<strong>${escape(label)}</strong>: <time class="status-date" datetime="${escape(statusDate(action, timeZone))}">${escape(display)}</time>`;
}

function logRecordedAt(action, locale, timeZone) {
  const timestamp = eventTime(action);
  let display = timestamp;
  try { display = wordDate(timestamp, timeZone); } catch { /* legacy or incomplete rows keep their raw value */ }
  return `<strong>${escape(locale.recordedAt)}</strong>: <time class="recorded-at" datetime="${escape(timestamp)}">${escape(display)}</time>`;
}

export function actionLogHTML(history = [], station, locale = en, timeZone = DEFAULT_TIME_ZONE) {
  const rows = history
    .filter(event => !station || event.station === station)
    .slice()
    .sort((a, b) => compareEvents(b, a));
  const headers = [locale.titleField, locale.action_status, locale.reason, locale.status_date ?? locale.updated, locale.recordedAt];
  return `<div class="table-scroll action-log" tabindex="0" role="region" aria-label="${escape(locale.actionLog)}"><table><caption>${escape(locale.actionLog)}. ${escape(locale.logScrollHint)}</caption><thead><tr>${headers.map(header => `<th scope="col">${escape(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(action => `<tr class="${action.withheld === true ? 'withheld-row' : ''}"><th scope="row">${escape(action.title)}</th><td>${statusBadgeHTML(action.status, locale)}</td><td>${escape(action.reason ?? '')}${action.withheld === true ? ` <span class="withheld-label">${escape(locale.withheld)}</span>` : ''}</td><td>${logStatusDate(action, locale, timeZone)}</td><td>${logRecordedAt(action, locale, timeZone)}</td></tr>`).join('')}</tbody></table></div>`;
}

function actionMarkup(action, locale, timeZone) {
  const reason = action?.reason
    ? `<p class="action-reason"><strong>${escape(locale.why ?? 'Why:')}</strong> ${escape(action.reason)}</p>`
    : '';
  const concern = action?.concern
    ? `<p class="action-concern"><strong>${escape(locale.youToldUs)}</strong> ${escape(reasonLabel(action, locale))}</p>`
    : '';
  return `<article class="action-card" data-action-id="${escape(action.action_id ?? action.id)}" data-status="${escape(action.status)}" data-status-date="${escape(statusDate(action, timeZone))}"${action.withheld === true ? ' data-withheld="true"' : ''}><div class="action-status">${statusBadgeHTML(action.status, locale)}</div><h3>${escape(action.title)}</h3>${concern}${reason}${updatedMarkup(action, locale, timeZone)}${dueMarkup(action, locale)}</article>`;
}

export function stationBoardHTML(history = [], station, locale = en, timeZone = DEFAULT_TIME_ZONE) {
  const actions = boardActions(history, station, timeZone);
  const newestStatusDate = actions.length ? statusDate(actions[0], timeZone) : '';
  const notice = core.BOARD_NOTICE;
  const latestText = newestStatusDate ? dateWords(newestStatusDate) : locale.noUpdates;
  const body = actions.length
    ? actions.map(action => `<tr data-action-id="${escape(action.action_id ?? action.id)}" data-status="${escape(action.status)}" data-status-date="${escape(statusDate(action, timeZone))}"${action.withheld === true ? ' data-withheld="true"' : ''}><td>${actionMarkup(action, locale, timeZone)}</td></tr>`).join('')
    : `<tr class="empty-board-row"><td><p>${escape(locale.noActions)}</p></td></tr>`;
  return `<article class="station-board print-surface" data-station="${escape(station)}" data-newest-status-date="${escape(newestStatusDate)}" data-print-sheet-label="${escape(locale.sheet ?? 'Sheet')}" data-print-of-label="${escape(locale.of ?? 'of')}" data-print-revision-label="${escape(locale.printRevision ?? 'Print revision')}" aria-label="${escape(locale.boardAria)}"><table class="poster-table" role="presentation"><thead><tr><td><div class="poster-heading"><p class="synthetic-banner">${escape(locale.syntheticBanner)}</p><div class="poster-header-grid"><div class="station-title"><p class="poster-kicker">${escape(locale.boardHeading)}</p><h2>${escape(station)}</h2></div><div class="poster-context"><p class="last-updated"><strong>${escape(locale.updated)}</strong>: <time datetime="${escape(newestStatusDate)}">${escape(latestText)}</time></p><p class="board-count" aria-live="polite"><strong>${escape(locale.wholeBoard ?? 'Whole board')}</strong>: ${escape(statusCounts(actions, locale))}</p></div></div>${plainLegend(locale)}<p class="board-notice">${escape(notice)}</p></div></td></tr></thead><tbody class="board-list">${body}</tbody><tfoot><tr><td><div class="board-footer"><p class="board-invitation">${escape(locale.riderInvitation)}</p></div></td></tr></tfoot></table></article>`;
}

export {eventTime, statusDate};
