# Changelog

## 1.1.1 - 2026-10-13

- Vancouver times now follow British Columbia's year-round Pacific Time: UTC-7 from 8 March 2026, with no fall back on 1 November 2026. Version 1.1.0 wrongly applied a fall back on that date; a new test and planted fault cover the rule.

## 1.1.0 - 2026-10-13

- Made the station board a poster with a large station heading, newest update, a short legend and ordered action cards.
- Paired every status with an inline check, clock or cross and a written label on the board and action log.
- Added station-local dates, a time-zone setting and explicit station offsets in CSV exports while preserving import round trips.
- Added letter portrait and tabloid landscape print layouts with repeated demonstration banners and explanatory footers; tabloid body text is at least 18 pt.
- Replaced per-row synthetic labels with a clear demonstration banner and made the action log readable in a named keyboard scroll region.
- Added four plain pilot steps, eight semantic fault tests, responsive browser checks and print pagination evidence.
- Pinned the synthetic 2026 Vancouver calendar to the seasonal clock changes requested for this demonstration.

## 1.0.0 - 2026-10-13

- Added dated, append-only station actions with three statuses, required Not done reasons, printable boards and board and log CSV exports.
- Generated a printable rider card and both forms from the same question source using draft v2.1 wording and demonstration help placeholders.
- Extended synthetic demo loading and verified clearing to include the full action log.
- Added a clear home screen, responsive system typography, light and dark schemes, reduced-motion support and linked error summaries.
- Added a relative-path manifest, local icons and a versioned cache covering every application asset.
- Added semantic fault tests, browser screenshots, keyboard and accessibility-tree checks, local accessibility scans, print output and stopped-server offline reload checks.
- Updated public documentation, privacy limits and the data dictionary. Preserved Apache-2.0 and Open by design.

## 0.2.0 - 2026-10-13

- Made questions 5 and 6 conditional on Yes to question 4 in both forms, validation, imports, exports, dictionaries and synthetic demo records.
- Added the rider help-line placeholder and urgent-help notice before the first question.
- Updated both card headers to "A short, voluntary card."
- Added individual planted-fault tests and 320 px browser checks for both routes.

## 0.1.0 - 2026-10-13

- Added synthetic staffed and self-selected rider-link capture with the supplied questions.
- Added numeric shift logs, field validation and device-only IndexedDB storage.
- Added separate quota views, CSV and JSON exports, complete dictionaries and validated imports.
- Added duplicate and conflict detection, and confirmation-based clearing after a current JSON export.
- Added service worker caching, keyboard-accessible layouts and a pending second locale.
- Added local tests with planted-fault evidence and a build report.
