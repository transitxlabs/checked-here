# Checked Here

A working demonstration by TransitX Labs Inc. of a printable rider card, staff entry, rider phone form, station action board, quota counts and manual exports. All records are synthetic. Do not enter real rider data, personal details or incident reports.

Checked means staff verified this action on site. It is not a safety rating.

This demonstration is not approved or ready for real collection or deployment. It is not affiliated with or endorsed by any transit agency. It does not establish that a station is safe, represent a rider population or verify that a real action happened.

## Run locally or as a static site

Run `python3 -m http.server 8913 --bind 127.0.0.1` in this folder and open `http://127.0.0.1:8913/`. Plain HTML, CSS and JavaScript modules need no framework, build step, installation, external font or CDN. Service workers require localhost or HTTPS; opening the file directly is unsupported. GitHub Pages can serve this folder directly, including under a repository subpath. No deployment is part of this work.

Wait for **Offline ready** before disconnecting. The worker caches published application assets in `transitx-checkin-v1.2.0`, removes older application caches and serves cached files without a runtime network fallback. Preparation reports an error after an installation failure or 15 seconds without a result. Keep the same browser, origin and port to retain records.

## Explore

**Load synthetic demo** adds 600 staffed cards, 8 self-selected rider-phone records, 8 shifts and 20 events for 12 actions across four placeholder stations and two rounds. Dates are relative to the load date and identifiers stay stable. Repeating the load on the same date skips duplicates. Loading a fresh dated example into an older example's identifiers reports a conflict; export and clear the old demonstration first. Nothing is silently overwritten.

**Staff entry** is for adult-rider practice cards. Station, round, date, time band, distribution staff code and card number are visibly marked required. Every rider question may be skipped, including all of question 2. Staff must not invent answers. Dates cannot be in the future. Saving keeps station, round, date, time band and staff code, clears answers, advances the card number by one and focuses that number. A separate shift log records asks and refusals, with refusals no greater than asks.

Time bands are demonstration placeholders to be set with the transit agency in Month 1: weekday morning 06:00 to 09:59, weekday midday 10:00 to 14:59, weekday evening 15:00 to 21:59, and weekend 06:00 to 21:59. The hours appear on screen as well.

**Rider phone form** keeps self-selected synthetic answers outside the staffed quota. `?s=S2` preselects a station. Phone answers stay in the browser that took them. They never reach staff devices or the staff quota. There is no shared backend or automatic transfer.

The printable card and both forms share the same six-question source. Riders may skip any question. Question 2 permits up to three ticks, or none. Question 3 asks what riders knew before today. Question 4 distinguishes reading the board from seeing it without reading it. Questions 5 and 6 apply only after **Yes, and I read it**, and remain optional. Switching to another answer clears them. The 1 to 10 safety scale and 1 to 5 trust scale remain. The card is for adult riders, provides an unmonitored-card warning and unfinished help-line and collection-notice placeholders, and keeps the distribution staff code in a labelled staff-only box.

**Quota view** counts only staffed cards with at least one rider answer as completed against 75 per station and round. Entirely blank cards are saved and counted separately, without reducing the remaining target. Time bands share the target. Self-selected rider-phone records and shift totals are separate.

**Station board** shows a full status legend and the Checked notice before the first action. A summary counts each status. The status comes first on every action, followed by its bounded task, concern, Updated date and due date. Planned actions give a reason for waiting, and Not done actions give a reason. Actions appear newest first by their shown Updated date, regardless of status; entry time breaks ties. Older imported events without a due date show that it was not recorded. Unsafe or sensitive actions must be marked withheld; withheld actions remain in the staff log and are excluded from the public board and its CSV.

The status date is the staff-entered date of the on-site check or update, defaulting to today. The log's `updated_at` records when the event was entered; `event_number` orders rechecks entered at the same instant. A same-status recheck appends another event. Station, title and concern cannot be corrected after creation in this demonstration. Status-history events cannot be edited or deleted; record a correction as a new event. Prior snapshots remain in the log.

`?board=S1` opens a read-only phone board with no navigation, staff entry or exports. It shows local records, or a clearly marked synthetic example when the browser has no action log. It does not fetch another device's board. Reprint the station poster after every board update.

## Printing and dates

Select Letter portrait or Tabloid landscape in the board view. Each printed sheet carries one action, the station context, the complete legend and both notices; display all sheets together as the station board. The legend and exact Checked notice precede actions and repeat with the header; the notice also repeats in the footer. Tabloid legend and notice text are at least 24 pt, all other Tabloid text is at least 18 pt, and status words are at least the action-title size. Letter board text is at least 13 pt. No viewing distance is claimed.

The rider card uses both sides of one Letter sheet. Print the two pages double-sided. Rider-facing text is at least 12 pt, including instructions, help, collection notice and scale anchors. Administration and version text follow the staff box.

Word dates use **January 2, 2026** and times use **2:30 p.m.** Board posters show dates only and no zone identifiers. The staff log uses station-local dates and times. Vancouver retains the existing year-round Pacific Time handling: UTC-7 from March 8, 2026 onward, without a November fall back. Other listed zones use the installed time-zone database. CSV timestamps retain ISO 8601 with an explicit station offset; imports restore the stored canonical instant.

## Records, privacy and manual transfers

Application records stay in this browser's IndexedDB. The application does not transmit answers or action records, and has no analytics, submission endpoint, tracking or remote backup. Page and static-file requests still reach the site host; the host may retain request logs. This statement about application records does not describe the host's logging policy.

Explicit exports create files outside the browser database. Saved exports remain wherever the user or browser puts them, may be copied separately and are not erased by clearing this application. Transfers between browsers are manual demonstration exports followed by file imports; there is no live collection or synchronization service. Browser clearing, storage eviction or private browsing can remove records. There is no application-level encryption.

Downloads include `checkins.csv`, `shifts.csv`, selected `board-S1.csv`, `action-log-S1.csv`, complete `device-data.json`, and the data dictionary. Blank scalar answers are null in JSON and empty in CSV. Zero question-2 ticks mean no recorded answer: the ten reason columns are empty. On answered question-2 rows the columns are 0 or 1. Legacy all-zero reason rows remain importable. The dictionary defines every field and blank value.

Check-in, shift and action-log CSV and complete JSON bundles can be imported manually. Current-board CSV is a presentation export; use the action log to preserve history. Only synthetic records are accepted. Exact duplicate identifiers and equivalent staffed card keys are skipped; conflicting records stop the entire import before writing. Earlier bundles and action snapshots remain supported. Existing stored records are not silently rewritten.

To clear records, export all data as JSON in the current session and verify the downloaded file, then choose **Clear this device after export**, tick the confirmation and confirm. A second transaction check prevents erasing a changed snapshot. This clears all three datasets, including withheld history, while retaining downloads and the offline cache.

## Local verification and accessibility

Run `node --test` and `node scripts/run-faults.mjs --v12`. The fault runner plants a separate semantic fault for each named test in a disposable local copy and requires that test to fail before the retained passing suite. Syntax-only failures do not count. Existing test identifiers and applicable coverage remain, with revised optional-answer and board-order contracts.

Automatic accessibility results mean **no violations detected automatically in the tested states**. They are not an accessibility conformance certification. Browser checks cover all routes at 320, 768 and 1280 px in light and dark schemes, accessible control names and local automatic scans. Manual-script checks cover keyboard operation, visible focus, skip and error links, focus after save/export/import, conditional questions, blank cards, the phone board, colour contrast, print reading order and type sizes, and reloads with the local server stopped. These checks do not replace review with people using assistive technology.

Use existing local software only. To repeat browser checks, set `BROWSER_LIBRARY` to an installed browser automation module and `AXE_LIBRARY` to a local scanner file, then run `node scripts/browser-checks.mjs`. `CHROME_EXECUTABLE` may select an existing Chrome executable. `python3 scripts/print-checks.py` inspects generated PDFs using the existing local PDF reader. The harness blocks external requests and closes its browser and loopback server.

The final source commit is recorded before generating final PDFs. Refreshed evidence, `BUILD_REPORT.md` and `SHA256SUMS` remain uncommitted receipts, record that SHA and verify tracked source bytes are unchanged. Earlier evidence remains intact. The manifest covers the payload, evidence and report and excludes itself.

Display strings live in `js/locales/en.mjs`; page language comes from the locale. The second locale contains matching pending keys for development and is excluded from the offline cache. Approved translations, help lines, collection notice and further review are required for real use.

## Open by design

Code licence: Apache-2.0 (see `LICENSE`). The plain HTML, CSS and JavaScript modules can be inspected and reused locally. This demonstration is not approved or ready for real collection or deployment.
