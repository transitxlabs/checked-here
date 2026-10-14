import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {questionsHTML, syncScaleSelection, riderTimeBand, actionRequirements} from '../js/form.mjs';
import {offlineFiles} from '../js/ui.mjs';
import en from '../js/locales/en.mjs';

const appSource = () => readFileSync(new URL('../js/app.mjs', import.meta.url), 'utf8');

test('R04 form errors use the focused summary without a second alert announcement', () => {
  const source = appSource();
  assert.match(source, /summary\.className='error-summary';summary\.tabIndex=-1/);
  assert.doesNotMatch(source, /summary\.setAttribute\(['"]role['"],['"]alert['"]\)/);
  assert.match(source, /summary\.focus\(\)/);
});

test('R05 capture copy names required staff fields and marks import required', () => {
  const source = appSource();
  assert.match(source, /t\('skipAnyQuestion'\)/);
  assert.match(source, /staffIntro/);
  assert.match(source, /t\('importLabel'\).*required-mark/);
  assert.match(source, /id="file" name="file"[^>]* required/);
  assert.match(en.staffIntro, /required/);
  assert.match(en.staffIntro, /Every rider question is optional/);
});

test('R06 rider save has a local confirmation and keeps it in view', () => {
  const source = appSource();
  assert.match(source, /id="save-confirmation" class="confirmation" hidden/);
  assert.doesNotMatch(source, /id="save-confirmation"[^>]*aria-live/);
  assert.match(source, /t\(staff\?'save':'riderSave'\)/);
  assert.match(source, /confirmation\.scrollIntoView\?\.\(\{block:'nearest'\}\)/);
  assert.match(source, /form\.querySelector\('button\[type="submit"\]'\)\?\.focus\(\)/);
  assert.match(source, /message\(staff\?'savedCard':'saved'/);
  assert.equal(en.riderSave, 'Save answers');
  assert.equal(en.saved, 'Your answers were saved on this device.');
});

test('R07 reason is visible for every selected status and required only for Not done', () => {
  assert.deepEqual(actionRequirements('planned'),{reasonRequired:false,dueRequired:true});
  assert.deepEqual(actionRequirements('checked'),{reasonRequired:false,dueRequired:false});
  assert.deepEqual(actionRequirements('not-done'),{reasonRequired:true,dueRequired:false});
  const source = appSource();
  assert.match(source, /view\.querySelector\('#reason-wrap'\)\.hidden=!statusValue/);
  assert.match(source, /form\.elements\.reason\.required=reasonRequired/);
  assert.match(source, /reason-required-mark'\)\.hidden=!reasonRequired/);
  assert.match(source, /form\.elements\.due_date\.disabled=!planned/);
  assert.match(source, /statusValue==='planned'\?form\.elements\.due_date\.value:null/);
  assert.match(source, /statusValue==='not-done'&&!r\.reason/);
});

test('R08 rider time bands follow the local device clock and keep out-of-hours blank', () => {
  const weekday = (hour, minute = 0) => new Date(2026, 9, 13, hour, minute);
  const saturday = (hour, minute = 0) => new Date(2026, 9, 17, hour, minute);
  assert.equal(riderTimeBand(weekday(5, 59)), '');
  assert.equal(riderTimeBand(weekday(6)), 'weekday-morning');
  assert.equal(riderTimeBand(weekday(9, 59)), 'weekday-morning');
  assert.equal(riderTimeBand(weekday(10)), 'weekday-midday');
  assert.equal(riderTimeBand(weekday(14, 59)), 'weekday-midday');
  assert.equal(riderTimeBand(weekday(15)), 'weekday-evening');
  assert.equal(riderTimeBand(weekday(21, 59)), 'weekday-evening');
  assert.equal(riderTimeBand(weekday(22)), '');
  assert.equal(riderTimeBand(saturday(6)), 'weekend');
  assert.equal(riderTimeBand(saturday(21, 59)), 'weekend');
  assert.equal(riderTimeBand(saturday(22)), '');
  assert.match(appSource(), /const timeHint=staff\?'timeBandHint':'riderTimeBandHint'/);
  assert.match(questionsHTML(false), /Choose one number: 1 means very unsafe/);
  assert.doesNotMatch(questionsHTML(false), /Circle one number/);
  assert.match(questionsHTML(true), /Circle one number/);
  assert.doesNotMatch(en.riderTimeBandHint, /quota|source|station|round/i);
  assert.doesNotMatch(en.riderSafetyHint, /quota|source/i);
  assert.doesNotMatch(en.riderTrustHint, /quota|source/i);
});

test('R09 selected scale labels receive a non-colour fallback class', () => {
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  assert.match(css,/\.scale-choice\.is-selected::after \{ content:'✓'/);
  const html = questionsHTML(false);
  assert.match(html, /data-scale-choice="safety"/);
  assert.match(html, /data-scale-choice="trust"/);
  const labels = [
    {checked: true, classes: new Set(), querySelector: () => ({checked: true})},
    {checked: false, classes: new Set(), querySelector: () => ({checked: false})}
  ];
  labels.forEach(label => { label.classList = {toggle(name, value) { if (value) label.classes.add(name); else label.classes.delete(name);}}; });
  syncScaleSelection({querySelectorAll: () => labels});
  assert.equal(labels[0].classes.has('is-selected'), true);
  assert.equal(labels[1].classes.has('is-selected'), false);
});

test('R10 route heading focus is opt-in for route changes', () => {
  const source = appSource();
  assert.match(source, /function render\(\{focus=false\}=\{\}\)/);
  assert.match(source, /render\(\{focus:true\}\)/);
  assert.match(source, /if\(focus&&heading\)/);
  assert.match(source, /await refresh\(\);route=next;announce\(''\);render\(\{focus:true\}\)/);
});

test('R11 offline setup waits for the new controller and retries the new cache', async () => {
  const oldController = {};
  const newController = {};
  const installing = {state: 'installed', listeners: {}, addEventListener(type, fn) {this.listeners[type] = fn;}};
  const controllerListeners = [];
  let openCount = 0;
  const serviceWorker = {
    controller: oldController,
    addEventListener(type, fn) {if (type === 'controllerchange') controllerListeners.push(fn);},
    removeEventListener() {},
    register: async () => ({installing, waiting: null, addEventListener() {}}),
    ready: Promise.resolve()
  };
  const first = offlineFiles({
    serviceWorker,
    caches: {open: async () => {openCount += 1; return {match: async () => ({ok: true})};}},
    base: 'https://demo.invalid/'
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(openCount, 0, 'the old controller must not open the new cache');
  serviceWorker.controller = newController;
  controllerListeners.forEach(listener => listener());
  await first;
  assert.equal(openCount, 1);

  const waiting = {state: 'installed', listeners: {}, addEventListener(type, fn) {this.listeners[type] = fn;}};
  const waitingListeners = [];
  let waitingOpens = 0;
  const waitingWorker = {
    controller: oldController,
    addEventListener(type, fn) {if (type === 'controllerchange') waitingListeners.push(fn);},
    removeEventListener() {},
    register: async () => ({installing: null, waiting, addEventListener() {}}),
    ready: Promise.resolve()
  };
  const waitingRun = offlineFiles({
    serviceWorker: waitingWorker,
    caches: {open: async () => {waitingOpens += 1; return {match: async () => ({ok: true})};}},
    base: 'https://demo.invalid/'
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(waitingOpens, 0, 'a waiting worker must also wait for control');
  waitingWorker.controller = newController;
  waitingListeners.forEach(listener => listener());
  await waitingRun;
  assert.equal(waitingOpens, 1);

  let retryCount = 0;
  await offlineFiles({
    serviceWorker: {controller: {}, register: async () => ({installing: null, waiting: null, addEventListener() {}}), ready: Promise.resolve()},
    caches: {open: async () => ({match: async () => {retryCount += 1; return retryCount === 2 ? {ok: true} : null;}})},
    base: 'https://demo.invalid/'
  });
  assert.equal(retryCount, 2, 'a missing cache entry gets one final check');
});

test('R27 waiting service workers do not inspect the old cache', async () => {
  const oldController = {};
  const nextController = {};
  const listeners = [];
  let opens = 0;
  const serviceWorker = {
    controller: oldController,
    addEventListener(type, fn) {if (type === 'controllerchange') listeners.push(fn);},
    removeEventListener() {},
    register: async () => ({installing: null, waiting: {state: 'installed'}, addEventListener() {}}),
    ready: Promise.resolve()
  };
  const pending = offlineFiles({
    serviceWorker,
    caches: {open: async () => {opens += 1; return {match: async () => ({ok: true})};}},
    base: 'https://demo.invalid/'
  });
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(opens, 0);
  serviceWorker.controller = nextController;
  listeners.forEach(listener => listener());
  await pending;
  assert.equal(opens, 1);
});

test('R28 offline cache retry yields before the second check', async () => {
  let checks = 0;
  let yielded = false;
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay === 0) yielded = true;
    return originalSetTimeout(callback, delay, ...args);
  };
  try {
    await offlineFiles({
      serviceWorker: {controller: {}, register: async () => ({installing: null, waiting: null, addEventListener() {}}), ready: Promise.resolve()},
      caches: {open: async () => ({match: async () => {checks += 1; return checks === 2 ? {ok: true} : null;}})},
      base: 'https://demo.invalid/'
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
  assert.equal(checks, 2);
  assert.equal(yielded, true);
});

test('R12 clear confirmation returns focus to Data and announces the clear', () => {
  const source = appSource();
  assert.match(source, /await clearRecords\(lastExport\); lastExport=null; await refresh\(\); dataView\(\);/);
  assert.match(source, /const dataHeading=view\.querySelector\('h2'\)/);
  assert.match(source, /dataHeading\.tabIndex=-1;dataHeading\.focus\(\)/);
  assert.match(source, /message\('cleared'\)/);
});

test('Cwithheld withheld checkbox names and describes its plain hint', () => {
  const source = appSource();
  assert.match(source, /id="withheld" name="withheld" type="checkbox" aria-describedby="hint-withheld"/);
  assert.match(source, /<p class="hint" id="hint-withheld">/);
});

test('Ccounts board updates clear and rewrite the whole-board count region', () => {
  const source = appSource();
  assert.match(source, /function announceBoardCount\(\)/);
  assert.match(source, /const region=view\.querySelector\('\.board-count'\)/);
  assert.match(source, /const countText=region\.textContent/);
  assert.match(source, /createAnnouncer\(region\)\(countText\)/);
  assert.match(source, /boardView\(\);announceBoardCount\(\);message\('boardSaved'\)/);
});
