import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stationBoardHTML, actionLogHTML} from '../js/board.mjs';
import {printPanels, prepareBoardPrint, clearBoardPrint, hashSource} from '../js/print-layout.mjs';
import en from '../js/locales/en.mjs';
import {BOARD_NOTICE} from '../js/core.mjs';

const action = (overrides = {}) => ({
  id: '33333333-1234-4234-8234-123456789012',
  action_id: '44444444-1234-4234-8234-123456789012',
  synthetic: true,
  station: 'S1',
  title: 'Inspect lights',
  concern: 'lighting',
  status: 'planned',
  reason: '',
  updated_at: '2026-10-02T16:00:00.000Z',
  status_date: '2026-10-02',
  due_date: '2026-10-20',
  event_number: 1,
  withheld: false,
  ...overrides
});

test('R01 public lines use status dates, status-specific due markup, and plain Why', () => {
  const html = stationBoardHTML([
    action({action_id: 'planned', status: 'planned', status_date: '2026-10-02', due_date: '2026-10-20'}),
    action({action_id: 'checked', status: 'checked', status_date: '2026-10-03', due_date: '2026-10-21', updated_at: '2026-10-03T16:00:00.000Z'}),
    action({action_id: 'not-done', status: 'not-done', status_date: '2026-10-04', due_date: '2026-10-22', reason: 'Access was closed.', updated_at: '2026-10-04T16:00:00.000Z'})
  ], 'S1', en, 'America/Vancouver');
  assert.match(html, /Updated.*October 4, 2026/);
  assert.match(html, /Due by<\/strong>: October 20, 2026/);
  assert.equal((html.match(/Due by<\/strong>:/g) ?? []).length, 1);
  assert.match(html, /Why:<\/strong> Access was closed\./);
  assert.equal((html.match(/Checked means staff verified this action on site\. It is not a safety rating\./g) ?? []).length, 1);
  assert.ok(html.indexOf('board-notice') < html.indexOf('action-card'));
  assert.ok(!html.includes('due date not recorded'));
});

test('R03 print packing is greedy, contiguous, and does not mutate rows', () => {
  const rows = [{id: 'a'}, {id: 'b'}, {id: 'c'}, {id: 'd'}];
  const snapshot = rows.map(row => ({...row}));
  const panels = printPanels(rows, {heights: [30, 30, 45, 20], availableHeight: 70});
  assert.deepEqual(panels, [[rows[0], rows[1]], [rows[2], rows[3]]]);
  assert.deepEqual(rows, snapshot);
  assert.deepEqual(printPanels(rows.slice(0, 2), {heights: [80, 20], availableHeight: 70}), [[rows[0]], [rows[1]]]);
  assert.equal(hashSource('same-board-content'), hashSource('same-board-content'));
  assert.notEqual(hashSource('same-board-content'), hashSource('changed-board-content'));
});

test('R13 print pages carry stable common revision and Sheet labels', () => {
  const rendered = stationBoardHTML([
    action({action_id: 'older', status_date: '2026-10-02'}),
    action({action_id: 'newer', status_date: '2026-10-04', updated_at: '2026-10-04T16:00:00.000Z'})
  ], 'S1', en, 'America/Vancouver');
  assert.match(rendered, /<strong>Updated<\/strong>: <time datetime="2026-10-04">October 4, 2026<\/time>/);
  const document = boardDocument();
  const first = prepareBoardPrint(document, {size: 'letter', availableHeight: 120});
  assert.equal(first.panels.length, 2);
  for (const [index, page] of first.pages.children.entries()) {
    assert.match(page.textContent, new RegExp(`Sheet ${index + 1} of 2`));
    assert.match(page.textContent, /Print revision/);
    assert.ok(page.querySelector('.print-banner-row'));
    assert.equal(page.querySelector('.poster-context .print-sheet-meta'), null);
    assert.equal((page.textContent.match(new RegExp(BOARD_NOTICE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 1);
  }
  const revision = first.revision;
  clearBoardPrint(document);
  document.querySelector('.board-list > tr').textContent = 'Changed title';
  const second = prepareBoardPrint(document, {size: 'letter', availableHeight: 120});
  assert.notEqual(second.revision, revision);
  clearBoardPrint(document);
  document.querySelector('.station-board').setAttribute('data-station', 'S2');
  const third = prepareBoardPrint(document, {size: 'letter', availableHeight: 120});
  assert.notEqual(third.revision, second.revision);
  clearBoardPrint(document);
  document.querySelector('.board-footer').textContent = 'Changed invitation';
  const fourth = prepareBoardPrint(document, {size: 'letter', availableHeight: 120});
  assert.notEqual(fourth.revision, third.revision);
});

test('R14 action log labels status date and recorded-at time separately', () => {
  const html = actionLogHTML([action({status_date: '2026-10-03', updated_at: '2026-10-03T16:30:00.000Z'})], 'S1', en, 'America/Vancouver');
  assert.match(html, /Status date/);
  assert.match(html, /Recorded at/);
  assert.match(html, /October 3, 2026/);
  assert.match(html, /9:30 a\.m\./);
});

test('R18 checked screen status uses a neutral ink colour', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.status-checked \{ color:var\(--ink\); \}/);
  assert.doesNotMatch(css, /\.status-checked \{ color:var\(--accent\); \}/);
});

test('R29 board print surfaces keep the required type floors and page geometry', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.print-board-page \{ width:7\.6in!important; height:10\.1in; min-height:10\.1in;[^}]*overflow:visible/);
  assert.match(css, /body\.print-tabloid \.print-board-page \{ width:16in!important; height:10in; min-height:10in;/);
  assert.match(css, /body \{ font-size:18pt;/);
  assert.match(css, /body\.print-tabloid \.print-board-page \.action-card>\.action-status,body\.print-tabloid \.print-board-page \.action-card h3 \{ font-size:28pt; \}/);
  assert.match(css, /body\.print-tabloid \.print-board-page \.board-footer,body\.print-tabloid \.print-board-page \.print-notice,body\.print-tabloid \.print-board-page \.board-invitation \{ font-size:24pt; \}/);
});

class Element {
  constructor(document, tag = 'div') {
    this.ownerDocument = document;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this._text = '';
    this.style = {setProperty: (key, value) => { this.style[key] = value; }};
    this.classList = {
      add: (...names) => names.forEach(name => { this.attributes.class = `${this.attributes.class ?? ''} ${name}`.trim(); }),
      remove: (...names) => names.forEach(name => { this.attributes.class = (this.attributes.class ?? '').split(/\s+/).filter(value => value && value !== name).join(' '); }),
      contains: name => (this.attributes.class ?? '').split(/\s+/).includes(name)
    };
  }
  set className(value) { this.attributes.class = value; }
  get className() { return this.attributes.class ?? ''; }
  set id(value) { this.attributes.id = value; }
  get id() { return this.attributes.id ?? ''; }
  set dataset(value) { this._dataset = value; }
  get dataset() { return this._dataset ?? (this._dataset = {}); }
  set innerHTML(value) { this._text = String(value).replace(/<[^>]*>/g, ''); }
  get innerHTML() { return this._text; }
  set textContent(value) { this.children = []; this._text = String(value ?? ''); }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  append(...nodes) { nodes.forEach(node => { if (!node) return; node.parentNode = this; this.children.push(node); }); }
  after(node) { const index = this.parentNode.children.indexOf(this); node.parentNode = this.parentNode; this.parentNode.children.splice(index + 1, 0, node); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  cloneNode(deep = false) {
    const copy = new Element(this.ownerDocument, this.tagName);
    copy.attributes = {...this.attributes}; copy._text = this._text; copy._dataset = {...this.dataset};
    if (deep) this.children.forEach(child => copy.append(child.cloneNode(true)));
    return copy;
  }
  matches(selector) {
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('[')) return Object.keys(this.attributes).some(key => selector.includes(key));
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }
  querySelectorAll(selector) {
    if (selector.includes(',')) return selector.split(',').flatMap(part => this.querySelectorAll(part.trim()));
    const direct = selector.split('>').map(part => part.trim());
    if (direct.length === 2) return this.querySelectorAll(direct[0]).flatMap(parent => parent.children.filter(child => child.matches(direct[1])));
    const descendant = selector.split(/\s+/);
    if (descendant.length > 1) return this.querySelectorAll(descendant.slice(1).join(' ')).filter(node => this.querySelectorAll(descendant[0]).some(parent => contains(parent, node)));
    const result = [];
    const visit = node => { node.children.forEach(child => { if (child.matches(selector)) result.push(child); visit(child); }); };
    visit(this); return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

function contains(parent, target) {
  if (parent === target) return true;
  return parent.children.some(child => contains(child, target));
}

class Document {
  constructor() { this.body = new Element(this, 'body'); this.body.dataset.boardPrint = 'letter'; this.defaultView = {getComputedStyle: () => ({})}; }
  createElement(tag) { return new Element(this, tag); }
  querySelector(selector) { if (this.body.matches(selector)) return this.body; return this.body.querySelector(selector); }
  querySelectorAll(selector) { return this.body.querySelectorAll(selector); }
}

function boardDocument() {
  const document = new Document();
  const board = document.createElement('article'); board.className = 'station-board'; board.setAttribute('data-station', 'S1'); board.setAttribute('data-newest-status-date', '2026-10-03');
  const table = document.createElement('table'); const head = document.createElement('div'); head.className = 'poster-heading'; head.setAttribute('data-print-height', '30'); const synthetic = document.createElement('p'); synthetic.className = 'synthetic-banner'; synthetic.textContent = 'Demonstration: synthetic data'; head.append(synthetic);
  const grid = document.createElement('div'); grid.className = 'poster-header-grid'; const context = document.createElement('div'); context.className = 'poster-context'; const h2 = document.createElement('h2'); h2.textContent = 'S1';
  const count = document.createElement('p'); count.className = 'board-count'; const strong = document.createElement('strong'); strong.textContent = 'Whole board'; count.append(strong); context.append(h2, count); grid.append(context); const notice = document.createElement('p'); notice.className = 'board-notice'; notice.textContent = BOARD_NOTICE; head.append(grid, notice);
  const tbody = document.createElement('tbody'); tbody.className = 'board-list';
  for (const [index, title] of ['One', 'Two', 'Three'].entries()) { const row = document.createElement('tr'); row.setAttribute('data-action-id', String(index)); row.setAttribute('data-status', 'planned'); row.setAttribute('data-status-date', '2026-10-03'); const cell = document.createElement('td'); const card = document.createElement('article'); card.className = 'action-card'; card.textContent = title; cell.append(card); row.append(cell); tbody.append(row); }
  const foot = document.createElement('tfoot'); const footCell = document.createElement('td'); const footer = document.createElement('div'); footer.className = 'board-footer'; const invitation = document.createElement('p'); invitation.className = 'board-invitation'; invitation.textContent = 'Invitation'; footer.append(invitation); footCell.append(footer); foot.append(footCell); table.append(head, tbody, foot); board.append(table); document.body.append(board); return document;
}
