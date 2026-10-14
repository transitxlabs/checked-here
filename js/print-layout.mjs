import {escape} from './board.mjs';
import * as core from './core.mjs';

const INCH = 96;
const PAGE = {
  letter: {width: 7.6 * INCH, height: 10.1 * INCH, minimum: 18},
  tabloid: {width: 16 * INCH, height: 10 * INCH, minimum: 18}
};

const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const number = value => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function readAttr(element, name) {
  if (!element) return '';
  if (typeof element.getAttribute === 'function') return element.getAttribute(name) ?? '';
  return element.dataset?.[name.replace(/^data-/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] ?? '';
}

function rowSignature(row, index) {
  const card = row?.querySelector?.('.action-card');
  return [
    index,
    readAttr(row, 'data-action-id'),
    readAttr(row, 'data-status'),
    readAttr(row, 'data-status-date'),
    readAttr(row, 'data-withheld'),
    readAttr(card, 'data-action-id'),
    readAttr(card, 'data-status'),
    readAttr(card, 'data-status-date'),
    readAttr(card, 'data-withheld'),
    text(row?.textContent)
  ].join('|');
}

export function hashSource(source = '') {
  const value = String(source);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function hashContent(board, rows) {
  const station = readAttr(board, 'data-station');
  const date = readAttr(board, 'data-newest-status-date');
  const heading = text(board.querySelector?.('.poster-heading')?.textContent);
  const footer = text(board.querySelector?.('.board-footer')?.textContent);
  const source = [station, date, heading, footer, ...rows.map(rowSignature)].join('\u001f');
  return hashSource(source);
}

function statusDate(board) {
  return readAttr(board, 'data-newest-status-date') || 'undated';
}

function sizeFor(document, options) {
  const requested = String(options.size ?? document?.body?.dataset?.boardPrint ?? '').toLowerCase();
  if (options.size !== undefined) return requested === 'tabloid' ? 'tabloid' : 'letter';
  return requested === 'tabloid' || document?.body?.classList?.contains?.('print-tabloid') ? 'tabloid' : 'letter';
}

function styleHeight(node) {
  if (!node) return 0;
  const direct = number(readAttr(node, 'data-print-height'));
  if (direct) return direct;
  const rect = node.getBoundingClientRect?.();
  if (rect?.height > 0) return rect.height;
  if (node.offsetHeight > 0) return node.offsetHeight;
  const view = node.ownerDocument?.defaultView;
  const style = view?.getComputedStyle?.(node);
  if (style?.height && style.height !== 'auto') return number(style.height);
  return 0;
}

function estimatedTextHeight(row, width, minimum = 18) {
  const content = text(row?.textContent ?? row);
  const charsPerLine = Math.max(18, Math.floor(width / (minimum * 0.56)));
  const lines = Math.max(1, Math.ceil(content.length / charsPerLine));
  return Math.max(minimum * 1.55, lines * minimum * 1.28 + minimum * 1.1);
}

function rowHeight(row, index, width, options, page) {
  if (Number(row?.height) > 0) return Number(row.height);
  if (typeof options.measure === 'function') {
    const measured = Number(options.measure(row, index, page));
    if (Number.isFinite(measured) && measured > 0) return measured;
  }
  if (typeof options.measureRow === 'function') {
    const measured = Number(options.measureRow(row, index, page));
    if (Number.isFinite(measured) && measured > 0) return measured;
  }
  if (Array.isArray(options.rowHeights) && Number(options.rowHeights[index]) > 0) return Number(options.rowHeights[index]);
  return styleHeight(row) || estimatedTextHeight(row, width, page.minimum);
}

/** Greedy, contiguous row packing. Rows are never reordered or split. */
export function printPanels(rows = [], options = {}) {
  const values = Array.from(rows);
  if (!values.length) return [];
  const available = Number(options.availableHeight ?? options.contentHeight ?? Number.POSITIVE_INFINITY);
  const heights = Array.isArray(options.heights)
    ? options.heights.map(value => Number(value) || 0)
    : values.map((row, index) => rowHeight(row, index, Number(options.contentWidth ?? 640), options, options.page ?? {minimum: 18}));
  const panels = [];
  let panel = [];
  let used = 0;
  values.forEach((row, index) => {
    const height = heights[index] > 0 ? heights[index] : 1;
    const fits = !Number.isFinite(available) || used === 0 || used + height <= available;
    if (!fits) {
      panels.push(panel);
      panel = [];
      used = 0;
    }
    panel.push(row);
    used += height;
  });
  if (panel.length) panels.push(panel);
  return panels;
}

function createElement(document, tag, className, content = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.innerHTML = content;
  return element;
}

function remapIds(page, index) {
  const ids = new Map();
  page.querySelectorAll?.('[id]').forEach(element => {
    const old = element.id;
    const next = `print-${index}-${old}`;
    ids.set(old, next);
    element.id = next;
  });
  page.querySelectorAll?.('[aria-labelledby],[aria-describedby],[for]').forEach(element => {
    for (const attribute of ['aria-labelledby', 'aria-describedby', 'for']) {
      const value = element.getAttribute?.(attribute);
      if (!value) continue;
      element.setAttribute(attribute, value.split(/\s+/).map(id => ids.get(id) ?? id).join(' '));
    }
  });
}

function addSheetMetadata(page, sheet, total, revision) {
  const document = page.ownerDocument;
  const heading = page.querySelector?.('.poster-heading');
  if (!heading || !document?.createElement) return;
  heading.querySelector?.('.print-sheet-meta')?.remove?.();
  heading.querySelector?.('.print-banner-row')?.remove?.();
  const sheetLabel = readAttr(page, 'data-print-sheet-label') || 'Sheet';
  const ofLabel = readAttr(page, 'data-print-of-label') || 'of';
  const revisionLabel = readAttr(page, 'data-print-revision-label') || 'Print revision';
  const meta = createElement(document, 'div', 'print-sheet-meta', `<p><strong>${escape(sheetLabel)}</strong> ${sheet} ${escape(ofLabel)} ${total}</p><p><strong>${escape(revisionLabel)}</strong>: <code>${escape(revision)}</code></p>`);
  const banner = heading.querySelector?.('.synthetic-banner');
  const row = createElement(document, 'div', 'print-banner-row');
  if (banner?.after) {
    banner.after(row);
    banner.remove?.();
    row.append(banner);
  } else {
    heading.append(row);
    if (banner) {
      banner.remove?.();
      row.append(banner);
    }
  }
  row.append(meta);
}

function moveNoticeToFooter(page) {
  const notice = core.BOARD_NOTICE;
  page.querySelectorAll?.('.board-notice').forEach(element => element.remove?.());
  const footer = page.querySelector?.('.board-footer');
  if (!footer) return;
  footer.querySelector?.('.print-notice')?.remove?.();
  const document = page.ownerDocument;
  const invitation = footer.querySelector?.('.board-invitation');
  const printed = createElement(document, 'p', 'print-notice', escape(notice));
  if (invitation?.after) invitation.after(printed); else footer.append(printed);
}

function removeRowsExcept(page, panel, rows) {
  const pageRows = Array.from(page.querySelectorAll?.('.board-list > tr') ?? []);
  const included = new Set(panel.map(row => rows.indexOf(row)).filter(index => index >= 0));
  pageRows.forEach((row, index) => { if (!included.has(index)) row.remove?.(); });
}

function dimensions(size) {
  return PAGE[size] ?? PAGE.letter;
}

function boardRows(board) {
  return Array.from(board.querySelectorAll?.('.board-list > tr') ?? []);
}

function printMeasureClone(document, board, size, page, revision, rows, options) {
  if (!document?.body?.append || !board?.cloneNode) return null;
  const clone = board.cloneNode(true);
  clone.classList.add('print-board-page', 'print-measure');
  clone.dataset.printMeasure = 'true';
  clone.style.position = 'absolute';
  clone.style.visibility = 'hidden';
  clone.style.display = 'block';
  clone.style.width = `${page.width}px`;
  clone.style.height = 'auto';
  clone.style.minHeight = '0';
  clone.style.overflow = 'visible';
  clone.style.setProperty('--print-content-width', `${page.width}px`);
  clone.style.setProperty('--print-content-height', `${page.height}px`);
  moveNoticeToFooter(clone);
  addSheetMetadata(clone, 1, Math.max(1, rows.length), revision);
  document.body.append(clone);
  const measuredRows = boardRows(clone);
  const headerRow = clone.querySelector?.('.poster-table thead > tr');
  const footerRow = clone.querySelector?.('.poster-table tfoot > tr');
  const header = styleHeight(headerRow) || styleHeight(clone.querySelector?.('.poster-heading'));
  const footer = styleHeight(footerRow) || styleHeight(clone.querySelector?.('.board-footer'));
  const result = {
    header,
    footer,
    rows: measuredRows.map((row, index) => rowHeight(row, index, page.width, options, page))
  };
  clone.remove?.();
  return result;
}

/**
 * Build print-only pages from the live board. The live board is kept intact
 * and is restored by clearBoardPrint after window.print completes.
 */
export function prepareBoardPrint(document, options = {}) {
  clearBoardPrint(document);
  const board = document?.querySelector?.('.station-board');
  if (!board) return null;
  const rows = boardRows(board);
  const size = sizeFor(document, options);
  const page = dimensions(size);
  const contentWidth = Number(options.contentWidth ?? page.width);
  const revision = `${statusDate(board)}-${hashContent(board, rows)}`;
  const measured = printMeasureClone(document, board, size, {...page, width: contentWidth}, revision, rows, options);
  const measuredHeader = measured?.header || Number(options.headerHeight ?? 0);
  const measuredFooter = measured?.footer || Number(options.footerHeight ?? 0);
  const measuredRows = measured?.rows ?? rows.map((row, index) => rowHeight(row, index, contentWidth, options, page));
  const reserve = Number(options.availableHeight ?? page.height - measuredHeader - measuredFooter);
  const panels = printPanels(rows, {
    ...options,
    contentWidth,
    heights: measuredRows,
    availableHeight: Math.max(1, reserve),
    page
  });
  const pages = document.createElement('div');
  pages.className = 'board-print-pages';
  pages.setAttribute('aria-hidden', 'true');
  pages.dataset.printRevision = revision;
  pages.dataset.printSize = size;
  panels.forEach((panel, index) => {
    const sheet = board.cloneNode(true);
    sheet.classList.add('print-board-page');
    sheet.dataset.sheet = String(index + 1);
    sheet.dataset.sheetCount = String(panels.length);
    sheet.dataset.printRevision = revision;
    sheet.style.width = `${contentWidth}px`;
    sheet.style.minHeight = `${page.height}px`;
    sheet.style.overflow = 'visible';
    sheet.style.setProperty('--print-content-width', `${contentWidth}px`);
    sheet.style.setProperty('--print-content-height', `${page.height}px`);
    removeRowsExcept(sheet, panel, rows);
    addSheetMetadata(sheet, index + 1, panels.length, revision);
    moveNoticeToFooter(sheet);
    const panelHeights = panel.map(row => measuredRows[rows.indexOf(row)] ?? rowHeight(row, rows.indexOf(row), contentWidth, options, page));
    if (panelHeights.some(height => height > reserve)) {
      sheet.classList.add('print-row-oversized');
      sheet.dataset.oversizedRow = 'true';
      sheet.dataset.printWarning = 'row-exceeds-sheet';
    }
    remapIds(sheet, index);
    pages.append(sheet);
  });
  board.classList.add('board-print-original');
  board.after(pages);
  return {board, pages, panels, revision, size, contentWidth, contentHeight: page.height};
}

export function clearBoardPrint(document) {
  document?.querySelector?.('.board-print-pages')?.remove?.();
  document?.querySelector?.('.board-print-original')?.classList?.remove?.('board-print-original');
}

export {hashContent};
