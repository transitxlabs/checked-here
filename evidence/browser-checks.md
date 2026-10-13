# Browser checks - 2026-10-13

Local address: `http://127.0.0.1:8913/`. Only synthetic records were used. The test server bound to loopback and was stopped after testing. No deployment occurred.

| Check | Observed result |
| --- | --- |
| Empty staffed form | Required-field errors appeared next to controls; station received focus. |
| Staffed capture | S2, round 1, card 900 saved; quota showed one staffed completion. |
| Rider URL | `?s=S2` opened the rider route with S2 selected, all six questions and the self-selection exclusion notice. |
| Rider capture | Saved separately from the staffed quota. |
| Shift log | S2, round 1, asks 10 and refusals 2 saved. |
| Duplicate card | Re-entering S2, round 1, card 900 displayed the duplicate error and focused card number. |
| Synthetic demo | 600 staffed check-ins, 8 rider-link answers and 8 shift logs added. Repeating skipped 616 duplicates. |
| Complete JSON download | Download parsed as schema version 1 with 610 check-ins (601 staffed, 9 rider-link) and 9 shifts. Saved as `browser-export.json`. |
| Duplicate JSON import | Added 0; skipped 619 duplicates. |
| Clear confirmation | Complete export enabled the checkbox and explicit confirmation. Clearing showed "Device records cleared." |
| Restore into empty device | The downloaded JSON added 619 records and skipped 0 duplicates. |
| CSV downloads | 610 check-in rows and 9 shift rows parsed and validated; local copies retained. |
| Offline reload and capture | With the local server stopped, reloaded `?s=S2`, saved another rider answer, and reopened the quota view. |
| Offline readiness | Final cached revision reloaded with the server stopped and displayed "Offline ready." |
| Clear without session export | Refused with "Export all data as JSON after your last change before clearing." |
| Offline CSV import | Added 0 and skipped 610 duplicates from the downloaded check-ins CSV. |
| Final quota | 601 staffed check-ins; S2 round 1 showed 76/75. Rider counts were S1=2, S2=4, S3=2, S4=2 (10 total), outside the quota. |
| 320 px form | Document width and scroll width both 320 px; six fieldsets; no duplicate IDs. Screenshot retained. |
| 320 px quota | Page-wide scroll width 320 px; tables scroll within their labeled regions. |
| Keyboard | Tab from main focused station, with a solid visible focus outline. First invalid fields received focus. Native controls and buttons support keyboard actions. |

Screenshots: `rider-320.png` and `quota-offline.png`. The browser export predates the extra offline rider save; the final screenshot has 611 check-ins and 9 shift logs on the device. These are local synthetic test records. The export can restore the pre-offline-save test dataset.

The accessibility target is WCAG 2.2 AA. This was a bounded manual keyboard, labeling, contrast and responsive review, not a full assistive-technology audit or certification.
