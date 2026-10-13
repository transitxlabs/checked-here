# Version 1 browser checks

All checks used an existing headless Chrome installation and an existing local browser automation module. An existing local axe-core copy was read offline. No packages were installed. Only loopback HTTP servers were used; external page requests were blocked and the retained run observed none.

## Retained results

- 42 route, viewport and colour-scheme combinations passed: seven views at 320, 768 and 1280 px in light and dark schemes.
- No document overflow, duplicate IDs or visible controls below 24 by 24 CSS pixels were found. Main controls are at least 44 px high.
- Chrome DevTools Protocol Accessibility checks named all visible input, select and button controls in 43 states, covering 719 control observations. Conditional questions were enabled with Yes; the board reason was checked in the Not done error state.
- 45 local WCAG 2.1 A/AA scans found zero violations. Some colour-contrast nodes remain marked for manual review by the scanner. The stylesheet's 24 text-colour pairs were checked separately; all pass 4.5:1, with a minimum ratio of 6.108:1. These results are bounded checks, not accessibility certification.
- Errors were announced through an alert, linked to their controls and focused the first invalid control.
- Both check-in forms saved synthetic answers and cleared conditional answers after switching away from Yes.
- Board creation required the Not done reason; changing to Checked on site retained both events. An actual action-log CSV download was saved.
- Demo loading produced 608 check-ins, 8 shifts and 20 board events. Repeating the load skipped 636 records.
- Keyboard-only operation passed for home, staff entry, rider phone form, station board, printable card, quota view and device data. It included completed check-in and shift saves, board entry, print-button activation, JSON download and confirmed clearing of all three datasets.
- The printable card and the three-action station board each fit on one Letter page; navigation is hidden in print.
- With the loopback server stopped, all seven views were fully reloaded and displayed Offline ready. Stored synthetic data remained available.
- A separate repository-subpath fixture upgraded the original service worker cache from v4 to v1.0.0 after controller activation, removed the older cache, preserved a check-in and shift through the IndexedDB version upgrade, and fully reloaded all seven views with its server stopped. Station query links and board fragments worked together.
- The final run recorded zero page or console errors and zero external page requests.

Scripts: [browser checks](../scripts/browser-checks.mjs), [upgrade checks](../scripts/upgrade-checks.mjs), [contrast checks](../scripts/contrast-checks.mjs).

Results: [browser](v1-browser-results.json), [keyboard output](v1-keyboard-output.txt), [offline reloads](v1-offline-results.json), [upgrade and subpath](v1-upgrade-results.json), [contrast ratios](v1-contrast-results.json).

Print samples: [card](v1-card-print.pdf), [station board](v1-board-print.pdf).

## Screenshots

| View | Light 320 | Light 768 | Light 1280 | Dark 320 | Dark 768 | Dark 1280 |
| --- | --- | --- | --- | --- | --- | --- |
| home | [light 320](v1-home-light-320.png) | [light 768](v1-home-light-768.png) | [light 1280](v1-home-light-1280.png) | [dark 320](v1-home-dark-320.png) | [dark 768](v1-home-dark-768.png) | [dark 1280](v1-home-dark-1280.png) |
| staff | [light 320](v1-staff-light-320.png) | [light 768](v1-staff-light-768.png) | [light 1280](v1-staff-light-1280.png) | [dark 320](v1-staff-dark-320.png) | [dark 768](v1-staff-dark-768.png) | [dark 1280](v1-staff-dark-1280.png) |
| rider | [light 320](v1-rider-light-320.png) | [light 768](v1-rider-light-768.png) | [light 1280](v1-rider-light-1280.png) | [dark 320](v1-rider-dark-320.png) | [dark 768](v1-rider-dark-768.png) | [dark 1280](v1-rider-dark-1280.png) |
| board | [light 320](v1-board-light-320.png) | [light 768](v1-board-light-768.png) | [light 1280](v1-board-light-1280.png) | [dark 320](v1-board-dark-320.png) | [dark 768](v1-board-dark-768.png) | [dark 1280](v1-board-dark-1280.png) |
| card | [light 320](v1-card-light-320.png) | [light 768](v1-card-light-768.png) | [light 1280](v1-card-light-1280.png) | [dark 320](v1-card-dark-320.png) | [dark 768](v1-card-dark-768.png) | [dark 1280](v1-card-dark-1280.png) |
| quota | [light 320](v1-quota-light-320.png) | [light 768](v1-quota-light-768.png) | [light 1280](v1-quota-light-1280.png) | [dark 320](v1-quota-dark-320.png) | [dark 768](v1-quota-dark-768.png) | [dark 1280](v1-quota-dark-1280.png) |
| data | [light 320](v1-data-light-320.png) | [light 768](v1-data-light-768.png) | [light 1280](v1-data-light-1280.png) | [dark 320](v1-data-dark-320.png) | [dark 768](v1-data-dark-768.png) | [dark 1280](v1-data-dark-1280.png) |

## Harness corrections

Initial local harness attempts had a loopback DNS exclusion error, unsuitable native-select key sequences, a visibility wait on a print-hidden status, and a second wait for a server that had already exited. Those harness issues were corrected before the retained successful run. The upgrade harness was corrected to await the new controller, and the offline checks now force full reloads. Visual review corrected the board title label and preserved the draft footer wording with a separate synthetic marker. Historical version 0.1 and 0.2 evidence remains unchanged.
