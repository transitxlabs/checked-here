# Version 0.2.0 browser checks - 2026-10-13

Local address: `http://127.0.0.1:8914/`. A fresh local browser session used synthetic records only. The viewport was 320 by 900 px. No package was installed and no external service was contacted. The loopback server was stopped before offline checks.

| Check | Observed result |
| --- | --- |
| Staff route, question 4 Yes | Questions 5 and 6 visible, enabled and required. Blank answers produced both field errors; trust received focus. Valid answers saved. |
| Staff route, question 4 No | Switching from populated Yes answers cleared both values, hid both questions and disabled both controls. Saved with null follow-ups. |
| Staff route, question 4 Not sure | Both questions hidden and not required. Saved with null follow-ups. |
| Rider route, question 4 Yes | Same required-field behavior, focus and successful save as staff. URL station S2 remained selected. |
| Rider route, question 4 No | Same clearing, hiding and null storage as staff. Saved without follow-up answers. |
| Rider route, question 4 Not sure | Both questions hidden and not required. Saved with null follow-ups. |
| Rider notices | Both exact help lines appeared before the first question. The self-selection notice and collection-notice placeholder remained visible. |
| Both card headers | A short, voluntary card. |
| Form reset after save | Conditional questions returned to hidden, disabled and not required. |
| Layout and IDs | Page width and document scroll width were 320 px in all six route/answer states. No duplicate IDs were observed in either form. |
| Stored records | Six records: three staff and three rider-link, with one of each question 4 choice per route. Follow-ups were null for No and Not sure. |
| CSV and JSON round trips | Each import parsed all six saved records. CSV cells were empty for unasked follow-ups. Copies retained as `a2-browser-checkins.csv` and `a2-browser-export.json`. |
| Browser console | 0 errors and 0 warnings before the offline check. |
| Offline after server stop | Both routes reloaded with Offline ready. Yes showed the follow-ups; No hid them. Width and scroll width remained 320 px. |

The first browser attempt used a stale save message as its wait condition and reached the next entry too early. It was discarded. The retained run used a fresh session and waited for the form reset and re-enabled save button after each storage operation. The final six-record export confirmed every save.

Screenshots show both routes at 320 px with question 4 Yes and No:

- `a2-staff-yes-320.png`
- `a2-staff-no-320.png`
- `a2-rider-yes-320.png`
- `a2-rider-no-320.png`

Raw layout states are in `a2-browser-results.json`; offline states are in `a2-offline-results.json`. The older unsuffixed browser files remain historical version 0.1 evidence. Their records predate the conditional rule and may be rejected by version 0.2 imports. They were preserved without changing their original answers.

This bounded browser check does not certify accessibility. The README's Limits and Open by design sections remain in place.
