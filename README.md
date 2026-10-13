# TransitX Labs rider check-in prototype

A small offline prototype for practicing capture, validation, quota counts and export of short rider check-ins. The independent pilot method is staffed adult check-ins at four placeholder stations, two rounds and 75 check-ins per station per round (600 total).

## Run locally

From this folder:

```sh
python3 -m http.server 8913 --bind 127.0.0.1
```

Open `http://127.0.0.1:8913/` in a current browser with IndexedDB and service worker support. Keep the same address and port to return to the same device data. No framework, build step or package installation is needed. Static files load from this local server only. There are no external requests, remote fonts, analytics or submission endpoints.

Wait for the on-screen "Offline ready" message. After the first load, the service worker caches the entire application, including its modules. Reloads and route changes keep working with the server stopped. Service workers require localhost or a secure context; opening `index.html` directly is not supported. Browser storage restrictions may prevent use. Storage errors appear on screen. No records are sent automatically.

## Two routes

- **Staff entry:** practice keying synthetic paper cards. Enter station S1 to S4, round 1 or 2, date, time band, pseudonymous staff code and positive whole card number, then the card answers, with questions 5 and 6 asked only after Yes on question 4. Card numbers are unique within a station and round. A separate shift log stores numeric asks and refusals with shift context. Each log is one shift; do not enter the same shift twice.
- **Rider phone form:** open `http://127.0.0.1:8913/?s=S2`, or choose the rider route. A valid station in the URL preselects that placeholder station. An absent or invalid station needs a choice. The date is the device's current local date and the rider selects the time band. No staff code, card number or round is collected. Answers are self-selected, marked `source=rider-link`, and excluded from the 600 staffed quota. Before the first question, the form shows `[Emergency and non-emergency help lines approved by the client go here]` and `Nobody watches this form for urgent help.` The self-selection notice and collection-notice placeholder remain visible.

The six card questions and choices use the supplied English wording. Every form save is marked synthetic. Dates cannot be in the future, numeric ratings must be whole numbers in range, questions 1 to 4 are required, and 1 to 3 distinct reasons must be selected. Both card headers say "A short, voluntary card." The form says "Answer 5 and 6 only if you answered Yes to question 4." After Yes, both questions are required with the current choices. After No or Not sure, both questions are hidden and stored as null. Switching away from Yes clears their answers. A value for either question when question 4 is not Yes is rejected on save and import. Errors appear next to fields and focus moves to the first invalid answer. Refusals cannot exceed asks.

## Views and files

The quota view shows staffed completions for each station and round against 75, with counts in each time band. The four bands share the station-round target. Over-target completions remain visible; the prototype does not discard them. Self-selected rider-link totals and shift totals appear separately.

Exports are explicit browser downloads:

- `checkins.csv`: one row per check-in; one column per field; ten separate 0/1 reason columns. Rider staff-only fields are empty. Questions 5 and 6 have empty cells when question 4 is No or Not sure.
- `shifts.csv`: one row per shift log.
- `device-data.json`: schema version 1, check-ins and shift logs together. Use this complete export before clearing a device.
- `data-dictionary.csv` and `data-dictionary.md`: every check-in and shift column, its type, allowed values and description. Repository copies are also supplied as `data-dictionary.csv` and `DATA_DICTIONARY.md`.

Import these CSV or JSON exports from other devices through the file picker. All records must validate and be synthetic. Unsupported fields are rejected. Duplicate UUIDs and staffed station-round-card keys are skipped when the data matches. Conflicting duplicates stop the entire import before any write. Duplicates within an incoming file are also checked. Shift logs use UUIDs for duplicate detection. A differently identified repeat of a real-world shift cannot be inferred automatically.

Clearing requires a complete JSON export during the current session, after the last change. Verify the downloaded file yourself, then check the confirmation box and confirm. The export snapshot is checked again inside the clearing transaction, so a change from another tab prevents deletion. Clearing removes all check-ins and shifts on this browser origin, including imported demo data. It does not remove downloads or the offline cache. Browser clearing, private browsing or storage eviction can remove device data, so keep verified exports. Treat synthetic exports as untrusted files on import.

## Synthetic demo mode

"Fill synthetic demo records" adds 600 fake staffed check-ins (75 per station and round), 8 rider-link answers and 8 numeric shift logs. Demo IDs and cards are stable. Repeating the action skips duplicates. A conflicting manually entered card stops the demo import with an error. All views and exports preserve the synthetic marker. Question 4 includes Yes, No and Not sure on each route; questions 5 and 6 have answers only after Yes and are null otherwise. No device data is preloaded until you choose this action.

## Limits

This is a prototype, for synthetic data only, and is not deployed. Any online use needs the client's approval and Canadian hosting. Do not use it to collect real rider responses. The collection notice is deliberately unfinished: `[Approved collection notice goes here]`.

No personal data is collected. There are no names, contact details, free-text comments, photos or location tracking. Staff codes are restricted pseudonyms. The prototype records placeholder stations only. It does not establish that a station is safe, verify station-board actions, measure a representative rider population, or infer refusal reasons. The self-selected rider route is outside the staffed method and quota. Device dates rely on the device clock. Offline records are local browser storage, without application-level encryption or a remote backup.

## Accessibility and language

The target is WCAG 2.2 AA. The interface uses native labeled controls, a fieldset and legend for each question, visible keyboard focus, status messages, field error descriptions, 18 px base type, high contrast and large controls. At 320 px, forms use one column and wide tables scroll inside labeled keyboard-focusable regions. A complete assistive-technology audit has not been performed; this is a target, not certification.

All display strings, question wording, choices, error messages and dictionary descriptions are in `js/locales/en.mjs`. Domain codes and file schema identifiers stay language-independent. `js/locales/second.mjs` has the same keys, each marked `translation pending`. It is not an available translated language. To add a language, replace all pending values with approved translations, set its language code, and select that locale in the application and dictionary generation. Set the document language to match before shipping it.

## Local verification

Node 22 or later is sufficient; no dependencies are installed.

```sh
node scripts/run-faults.mjs
node --test
```

The fault runner makes disposable local copies. It plants one semantic fault per test, requires that named test to fail with a nonzero exit, rejects syntax-only failures, saves the failed run under `evidence/`, and removes the temporary copy. The delivered source remains intact. The passing test suite covers validation, quota separation, exports, dictionary completeness, import duplicates and conflicts, demo size, locale parity, offline cache coverage, conditional questions and rider notices. `BUILD_REPORT.md` contains the observed runs, browser checks, file hashes and commit references.

## Open by design

Released under Apache-2.0. See `LICENSE`. The plain HTML, CSS and JavaScript modules can be inspected and reused locally. Licensing does not authorize real collection, deployment or public use on behalf of a client.
