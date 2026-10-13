# Checked Here

A working demo by TransitX Labs Inc. of the tools a station pilot would use: a printable rider card, staff entry, a rider phone form, a dated station board, quota counts and exports. All records are synthetic. No real rider data is included or permitted.

Riders can see which actions on their concerns are Planned, Checked on site or Not done with a short reason. A short, voluntary card asks how safe riders feel and whether they notice and trust the board. Checked means staff checked an action on site. It is not a safety rating.

This demo is not affiliated with or endorsed by any transit agency. It has not been deployed with real riders. It does not establish that a station is safe, represent a rider population or verify that a real action happened. Accessibility checks are listed below; they are not a conformance claim.

## Run locally

From the repository root:

```sh
python3 -m http.server 8913 --bind 127.0.0.1
```

Open `http://127.0.0.1:8913/`. No framework, build step, package installation, external font, image, script or CDN is needed. Use a current browser with IndexedDB and service worker support. Service workers require localhost or HTTPS; opening `index.html` directly is not supported.

Wait for **Offline ready**. The first load caches every application asset. After that, reloads and all views work with the local server stopped. The service worker uses a versioned cache, removes older application caches on activation and serves cached assets without a runtime network fallback. A manifest and local icons support installation where the browser offers it. Keep the same browser, origin and port to return to stored data.

## Explore the demo

The home screen explains the three capture and board routes. Choose **Load synthetic demo** to add 600 staffed check-ins across four placeholder stations and two rounds, 8 rider-link answers, 8 shifts and 20 dated board events for 12 actions. All three action statuses appear at every station. Demo identifiers are stable, so repeating the action skips exact duplicates. A conflicting manually entered card stops the load.

- **Staff entry:** key in synthetic paper cards. Supply station S1 to S4, round 1 or 2, date, time band, pseudonymous staff code and a positive whole card number. Card numbers are unique within a station and round. A separate shift log records numeric asks and refusals; refusals cannot exceed asks. Do not enter the same shift twice.
- **Rider phone form:** collect self-selected synthetic answers outside the 600 staffed quota. `?s=S2` preselects a placeholder station. No round, staff code or card number is collected. The device supplies the local date.
- **Station board:** select a station, record an action title and its concern from question 2 or Other, and choose a status. Not done requires a short reason. Updating an action adds a dated event; earlier events are retained. Its station, title and concern stay fixed. The large printable board shows current actions, update dates, synthetic markers and the explanation of Checked. Dates are displayed in UTC.

The **Printable rider card** and both forms use one six-question source. Wording follows the supplied draft v2.1. The emergency line says "Emergency: call 911." The non-emergency help line and collection notice remain placeholders. Questions 5 and 6 are shown and required only after Yes on question 4. Switching away from Yes clears them; unasked answers are stored as null and exported as empty CSV cells. Forms reject future dates, invalid ranges and unsupported fields. Select 1 to 3 distinct question 2 reasons.

**Quota view** counts staffed completions against 75 per station and round. Time bands share that target. Over-target records remain visible. Rider-link counts and numeric shift totals appear separately. Wide tables scroll within keyboard-focusable regions.

## Data and exports

Data stays in this browser's IndexedDB. Nothing is sent anywhere. There is no analytics, remote backup, tracking or submission endpoint. Enter only synthetic examples, including action titles and reasons. Do not enter names, contact details or incident reports. Browser clearing, private browsing and storage eviction can remove local records. Browser storage has no application-level encryption.

Explicit downloads include:

- `checkins.csv` and `shifts.csv`: one row per synthetic record. Question 2 reasons use ten separate 0/1 columns.
- `board-S1.csv`: current action snapshots for the selected station.
- `action-log-S1.csv`: every status event for the selected station, including the synthetic marker and UTC timestamp.
- `device-data.json`: the complete schema version 1 bundle with check-ins, shifts and `action_log`. Earlier bundles without `action_log` remain importable.
- `data-dictionary.csv` and `data-dictionary.md`: all fields, types, allowed values and descriptions. Repository copies are also supplied.

Import check-in, shift or action-log CSV exports, or complete JSON bundles, through the file picker. Current-board CSV is a presentation export; import the action log to preserve its history. Records must be synthetic and validate. Exact duplicate UUIDs and equivalent staffed card keys are skipped. Conflicts or invalid history stop the entire import before a write. Action history is append-only. The device database upgrades without rewriting existing check-ins or shifts. Older stored answers are not silently repaired.

To clear local data, first export all data as JSON during the current session and verify the download. Choose **Clear this device after export**, check the confirmation box and confirm. Clearing removes check-ins, shifts and the action log from this browser origin. The transaction checks the export snapshot again, so a change from another tab prevents deletion. Downloads and the offline cache remain.

## Static hosting

The company publishes after its release check. For GitHub Pages, publish the repository root directly. All application paths are relative, including the manifest scope and service worker assets, so an organization repository subpath works without a build or path rewrite. Views use URL fragments such as `#board`, with no server-side routes. HTTPS supplies the secure context needed by the service worker. No deployment has been performed as part of this build.

## Local checks and accessibility

The target is WCAG 2.1 AA. The demo has semantic landmarks, a skip link, labelled controls, question fieldsets and legends, linked and announced errors, visible focus, polite status messages, large control targets and light and dark colour schemes. It honours reduced motion and uses system fonts only.

Run the dependency-free tests with Node 22 or later:

```sh
node --test
node scripts/run-faults.mjs --v1
```

The fault runner makes disposable local copies and plants one semantic fault per test. It requires the named test to fail, rejects syntax-only failures and leaves delivered source intact. Earlier evidence is preserved; version 1 receipts use the `v1-` prefix.

The retained run passed 42 tests, detected all 42 planted semantic faults, and found no WCAG 2.1 A/AA violations in 45 local accessibility scans. The browser checks cover every view at 320, 768 and 1280 px in light and dark schemes, keyboard navigation and operation, control names through the Chrome DevTools Protocol Accessibility domain, printable card and board output, and full reloads after stopping the server. The card and the three-action sample board each fit on one Letter page. An upgrade check preserves existing records, replaces the older cache and reloads every view under a repository subpath. An existing local copy of axe-core is used offline; nothing is installed. Screenshots and machine-readable results are in `evidence/`. The stylesheet text-colour pairs pass 4.5:1 in both schemes, with a minimum of 6.108:1. Some scanner colour-contrast nodes still require manual review. These checks do not replace testing with people using assistive technology.

To repeat the browser script, set `BROWSER_LIBRARY` to an existing local browser automation module and `AXE_LIBRARY` to an existing local `axe.min.js`, then run `node scripts/browser-checks.mjs`. Set `CHROME_EXECUTABLE` if Chrome is at another location. The script uses a temporary browser profile and a loopback server; it stops its server and browser after checking.

`BUILD_REPORT.md` and `SHA256SUMS` are uncommitted post-commit receipts. They record the final commit, observed checks and exact file hashes. The passing suite covers the original rules plus board validation and history, CSV columns and round trips, shared card questions, demo loading and transaction-based clearing, and complete offline asset coverage.

All question wording and translated display strings live in `js/locales/en.mjs`. The second locale has matching keys marked `translation pending`; it is not an available translated language. Approved translations and further accessibility review are required before real use. Help lines and the collection notice deliberately remain unfinished.

## Open by design

Released under Apache-2.0. See `LICENSE`. The plain HTML, CSS and JavaScript modules can be inspected and reused locally. Licensing does not authorize real collection, deployment or public use on behalf of a client.
