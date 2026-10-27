# Build report

Version: 1.0.0

Completed: 2026-10-13T15:09:52-07:00

Final commit: `69481f908f6fb26e3a8b8d7a88a61e0b7848cb3e`

Final commit message: `Document version 1 and retain release checks`.

Author and committer: `Amirhossein (Amir) Daneshpajouh <52765136+Daneshpajouh@users.noreply.github.com> | Amirhossein (Amir) Daneshpajouh <52765136+Daneshpajouh@users.noreply.github.com>`.

Starting commit: `75dc869bef9ce7e16e5e6518f5d2863ee3d937a5`. All earlier commits were retained. Six new commits were added. No remote was created, nothing was pushed, no packages were installed and no external service was contacted. The company retains publication and release review. There was no deployment.

This report was written after the commit. `BUILD_REPORT.md` and `SHA256SUMS` remain uncommitted. The version 0.2 report and checksum bytes were preserved in `evidence/v0.2-build-report.md` and `evidence/v0.2-SHA256SUMS.txt`; earlier browser and fault evidence is unchanged. All 183 committed files were compared byte for byte with the working files. `SHA256SUMS` covers those files and this final report, and excludes itself.

## Delivered behaviour

- Station board is the third capture and board route, after staff entry and rider phone form. Each action has a fixed station, title and concern from question 2 or Other. Planned, Checked on site and Not done are supported. Not done requires a short reason.
- Each status update appends a complete, dated synthetic snapshot to IndexedDB. Updates never replace earlier events. Transaction validation prevents invalid history. The board shows the latest event per action, each UTC update date and a synthetic marker.
- Printable boards use large high-contrast type and the exact line "Checked means staff checked this action on site. It is not a safety rating." Current board and full log CSV exports include the synthetic marker. The dictionary includes both datasets.
- The printable rider card and both forms use the same six-question source. Draft v2.1 was checked against SHA-256 `cc0040fa1475a4bfe98ce93c0e94f644c1baeb21358532ecbdafb5ecada0b071`. Question wording, choices, conditional instruction, collection placeholder and draft footer are retained. The demo keeps "Emergency: call 911." and replaces the draft's non-emergency line with the required client-approved help placeholder. No transit agency is named.
- A separate synthetic label marks the printable card. The rider form retains its urgent-help and self-selection notices. Follow-up questions are required only after Yes, cleared and stored as null otherwise. Existing validation, quotas, numeric shifts, imports, exports and clearing safeguards remain.
- Demo loading adds 608 synthetic check-ins, 8 shifts and 20 dated action events across four placeholder stations, two staffed rounds and all three statuses. Exact repeat loading skips 636 records. Confirmed clearing removes every dataset after verifying a current complete JSON export.
- The home screen explains the three routes. Seven views are available, including the printable card, quota view and device data. System typography, responsive spacing, light and dark schemes, reduced-motion support, landmarks, skip link, labelled controls, question fieldsets, linked alert errors, focus and polite status regions are present.
- A relative-path manifest and three local icons are supplied. The versioned service worker caches all application assets, removes older application caches after activation, claims clients and serves cached content without a runtime network fallback. Data remains in the browser. The database version upgrade preserves check-ins and shifts.
- README describes the working demo, synthetic-only use, privacy, limits, local running, repository-root static hosting and the company release gate. It makes no affiliation, deployment or accessibility-conformance claim. Open by design and Apache-2.0 are preserved. CHANGELOG is version 1.0.0.

## Tests and fault evidence

Runtime: Node v22.15.1. All checks used installed local software only.

1. `node scripts/run-faults.mjs --v1`: exit 0. All 42 named tests failed individually with exit 1 on their own planted semantic fault. Syntax-only failures are rejected. Mutations were made in disposable copies; source files were unchanged. [Run](evidence/v1-fault-run.txt), [individual fault results](evidence/v1-fault-results.json).
2. `node --test`: exit 0 after the final fault run. 42 passed, 0 failed, 0 skipped. The original 33 tests remain; nine new tests were added. [Passing transcript](evidence/v1-pass-run.txt).
3. `git diff --cached --check`: exit 0 before each retained commit. The final keyboard transcript's trailing whitespace was removed before its commit. CSV CRLF bytes remain preserved by the repository attributes.
4. All 183 committed files match their working-file bytes. Detached checksums were verified after writing this report.
5. Text checks found no em or en dashes in delivered prose and no named transit agency. The starting repository had no remotes; none were added.

| New test | Rule and planted fault | Retained outcome |
| --- | --- | --- |
| B01 | Required Not done reason check removed | Semantic fault detected; source passed |
| B02 | Append replaced with a one-event history | Semantic fault detected; source passed |
| B03 | Board CSV given log columns | Semantic fault detected; source passed |
| B04 | Imported log events discarded | Semantic fault detected; source passed |
| C01 | Shared question 1 prompt changed | Semantic fault detected; source passed |
| M01 | Demo action log emptied | Semantic fault detected; source passed |
| M02 | Action log omitted from transaction clearing | Semantic fault detected; source passed |
| O02 | Manifest omitted from cache list | Semantic fault detected; source passed |
| O03 | Old-cache deletion bypassed | Semantic fault detected; source passed |

The passing source also verifies board CSV and JSON round trips, conflicts, stable history, every runtime asset, cache installation and activation, relative navigation paths, rejection of missing assets and external requests, and preservation of unrelated caches.

## Browser, print and offline evidence

[Detailed browser checks](evidence/v1-browser-checks.md), [raw results](evidence/v1-browser-results.json), [run output](evidence/v1-browser-run.txt).

- 42 screenshot and layout states passed: all seven views at 320, 768 and 1280 px, each in light and dark schemes. No page overflow, duplicate IDs or undersized visible controls were found. All screenshots are linked in the detailed browser checks.
- Chrome DevTools Protocol Accessibility checks covered every visible input, select and button in 43 states: 719 named control observations. Conditional controls were enabled and the board's required reason was included.
- 45 local axe-core WCAG 2.1 A/AA scans reported zero violations. The existing local copy was used offline without installation. Some colour-contrast nodes remain scanner manual-review items. Separately, 24 stylesheet text-colour pairs pass 4.5:1 in both schemes, with a minimum of 6.108:1. [Ratios](evidence/v1-contrast-results.json), [run](evidence/v1-contrast-run.txt). These checks are not conformance certification or a complete assistive-technology audit.
- Keyboard-only walkthroughs completed all seven views, including completed staff and rider check-ins, a numeric shift log, board entry, conditional questions, validation focus, printable-card button activation, table access, JSON download and confirmed clearing. [Script](scripts/browser-checks.mjs), [output](evidence/v1-keyboard-output.txt).
- Actual IndexedDB operations checked demo repeat loading, both forms, board reasons and retained status changes. Actual downloads are retained as [action log](evidence/v1-action-log-browser.csv) and [complete device data](evidence/v1-device-data-browser.json).
- The printable card and the three-action sample board each fit on one Letter page. Navigation is hidden in print. [Card](evidence/v1-card-print.pdf), [board](evidence/v1-board-print.pdf).
- The loopback server was stopped before every offline full reload. All seven views reloaded, showed Offline ready and retained the populated synthetic datasets. [Offline reload results](evidence/v1-offline-results.json).
- A second loopback fixture used `/checkin-prototype/`. It upgraded the original v4 worker to v1.0.0, waited for the new controller, removed the older cache, preserved a version 1 check-in and shift through the IndexedDB upgrade, and fully reloaded all seven views with its server stopped. Station query links and route fragments worked together. [Script](scripts/upgrade-checks.mjs), [result](evidence/v1-upgrade-results.json).
- The final run recorded zero page or console errors and zero external page requests. Local servers and temporary browser profiles were closed.

Initial harness issues and their corrections are recorded in the detailed browser checks. The final retained runs are complete and passing. Visual review corrected the board title label and restored the draft footer with a separate synthetic marker.

## File list and SHA-256

These are the exact committed payload and evidence bytes. The final report's own checksum is in `SHA256SUMS` to avoid a recursive self-hash.

| File | SHA-256 |
| --- | --- |
| `.gitattributes` | `3ea1bb2451941d6a88659695dfa1dca324d286ec38a8704bdda689697dceb5e0` |
| `CHANGELOG.md` | `0a9b93bb956c54457475d25748aef6f0e87f8f3991d8639c1efbaf34f6871790` |
| `DATA_DICTIONARY.md` | `cccc6abe58edb4c59ce00100c36530c2ff75d6924f4101972247d053a84a18c0` |
| `LICENSE` | `6499f771af5d2d04b9722bdabbb1db4ec8826f39d33358e32678b07d69a452aa` |
| `README.md` | `c7c48a355ea117a5dc92b95649ff3a12daccb2bb382fa595929c3471d8721391` |
| `data-dictionary.csv` | `4dc74c70c4f46860b77e59d95c3c2ca533bdbdc08a647719518872f08acb9db3` |
| `evidence/a2-browser-checkins.csv` | `ca811b31d34579ffd37918fe0f9c37b324a686ed30837c00eeaeaba631241dd3` |
| `evidence/a2-browser-checks.md` | `70600e55fc119f384dedc1b387f2f21b7778dafbff112e70c984a6e81359f2e1` |
| `evidence/a2-browser-export.json` | `24068dbff78cc47041ad38c7c93bb004e1f05698ec4eb29c20f0cf6c7e0a9dcc` |
| `evidence/a2-browser-results.json` | `932ab980cb25a657b85a8c9abae3c5c2f39a5f8ff95226b368c407dfe901de39` |
| `evidence/a2-offline-results.json` | `57525c8420bc24ea65d820e2cd82a9af70edaf598e0b2ca34964176b84465d0c` |
| `evidence/a2-rider-no-320.png` | `db327590acf0118459c4eec499220b9fde25b6f17e6e80ba42224f0e319d5a0b` |
| `evidence/a2-rider-yes-320.png` | `81324883f673c6a4001b06b41aeff0448f60124bebe9f1cda7cd1f979a7b3f95` |
| `evidence/a2-staff-no-320.png` | `8a7b1c5ff66e3940d889c00af2e65a9fa956f6fe8616eeba1bb04a8138944212` |
| `evidence/a2-staff-yes-320.png` | `c425607dcb8a40bb874e2097d1902f16c6c8bbe3f512a717023f3d0f9873943d` |
| `evidence/browser-checkins.csv` | `5306c1a02eec71bdef505bfc82b33e4e568abd9cedbaa965ced63d2cdc394873` |
| `evidence/browser-checks.md` | `77fd69f07bd3214ece5cf0d5da657d35537a17effa8fd9ea372193498cd6d6cf` |
| `evidence/browser-export.json` | `aeb194c06b582d067d5f32416d149b956e828f4369282e6a4a769942dc9435b4` |
| `evidence/browser-shifts.csv` | `a128e8ee454c2f38a17e6fbd11d6c58bdbf9afa42bb28c6cefd9d80a30589718` |
| `evidence/fault-D01.txt` | `106775b911c308415beb3e0911e795ddc2939510e5541f3c6eb89cc2fff1dc59` |
| `evidence/fault-D02.txt` | `766128443171e180bf1f420ac09496812fbf833292aa00c5f7fc5b4f2447107f` |
| `evidence/fault-E01.txt` | `bff7658fe7a58bfe3f681eba1af0fe6cb7af396343c72e8348b2dcbe32b5591d` |
| `evidence/fault-E02.txt` | `67e1e30c647b95ebcee42716292075200c89341f069cb48b5735f70221f68b15` |
| `evidence/fault-E03.txt` | `84b0c7f9fa0072c83326a03a00c19d21cc8b46ca51a8f77d5dbf7e93ef4a127f` |
| `evidence/fault-E04.txt` | `a4ed60cc8490e5432d69166df1b0f6d5c271a36795bd8965149c0d9a09a7fe19` |
| `evidence/fault-F01.txt` | `6183877ba0447fb1ba57cdbf0a4e83b6c04a78f6517bd8cf8e5903a67ee7a969` |
| `evidence/fault-F02.txt` | `83deb343fb55f04495934f332c056d903e9e696d61ca9da45b4fd4e1fc286fb6` |
| `evidence/fault-F03.txt` | `feaa5da2ffc02735cd5ace8165daef5b9be6b12042762daa1a501a5b1b605b4f` |
| `evidence/fault-F04.txt` | `3f305b819c1c3e95447b074aee8ee3be7607cc1e9305b356a6e764475de9a9c0` |
| `evidence/fault-F05.txt` | `756a4d647d05ab4882dd92862f5fd2db0252c6c1179fdaae5c6bab681ae61f80` |
| `evidence/fault-I01.txt` | `c27a88a85db63e4d4d07e85c6fc2eb5ae974a577cd37a8156c5c77a43a464adf` |
| `evidence/fault-I02.txt` | `70924854a914bbb1237203bb980c004ba3b99e25254404e0696c8ff51f04a6f8` |
| `evidence/fault-I03.txt` | `e1c379f77e3350a2e7410e93f8004a8de275493daae8bf0b1ba95d4a23fe0971` |
| `evidence/fault-I04.txt` | `1201234bcb507d394c6393d748a1f88d779ee4b9144d29be5bc1d904f5d90cd3` |
| `evidence/fault-I05.txt` | `fdf5d7d5d403df7ed2d35eedb5d0d20ffd937425cba520172bbe83c1721c4ad0` |
| `evidence/fault-I06.txt` | `8262efc3ac5b4218c32eedd040f9ae0f85c97d90bb63c01f8b776867cb2acecd` |
| `evidence/fault-L01.txt` | `351ee113b84cf139797905620d3b91d2fde36c8022fb7892cda5345a798dece9` |
| `evidence/fault-O01.txt` | `a0247790c7b82e11c579967f1ea7f0f17fe0c7ff8e58220691fb101bc09b055f` |
| `evidence/fault-Q01.txt` | `b0957f9951990ebc1b4b98c66a85dd2ed3a6fb5f1d30526b808daf7ad5728ec2` |
| `evidence/fault-Q02.txt` | `e489fba8dfc2debf6ed096dc2f673c3de931db25a005db155368d123ae5f4b1f` |
| `evidence/fault-S01.txt` | `04361305cc675f065fc55bc539f8ddd965563fb77d5ae8b8728fac3b8b382c73` |
| `evidence/fault-S02.txt` | `2ba797a8e44bddf25d41e3f04aa2528eb70b90bfb1fd2e4749f39b2404a6a23a` |
| `evidence/fault-V01.txt` | `42a9276df4227d58f0795efc3c04eb840ff78aacd462579d53539f8526aaa2d5` |
| `evidence/fault-V02.txt` | `bf171c3b34473de725ce81898c904b8954ec1446879bc116f2911a792014ee2d` |
| `evidence/fault-V03.txt` | `ca83446ab04767a233214aada581714ad7470a5f04ef79564295f263518b26f7` |
| `evidence/fault-V04.txt` | `8ec1108a5cf41af4531a3b009eaf002906b201c1a2a15fcae5b519ebda393ce5` |
| `evidence/fault-V05.txt` | `45c1df7509674a09dc286f34cd500f3c540f914f1b212e7ed492a5401ead693b` |
| `evidence/fault-V06.txt` | `a8674d1054ff2d1bf5c096ab7ea7a1b8bcf8e208fa6c2818abe4d8b1b66ff69b` |
| `evidence/fault-V07.txt` | `97fb550385b8eeab4bae7acfe3670b32e70dc4093abc2f8cdcebeee091e56bd2` |
| `evidence/fault-V08.txt` | `c6420a17cb86739e91e15f1b420c9b518115df9a9e47d8ace1507a51e81c2f33` |
| `evidence/fault-V09.txt` | `4f94e20c4a71987d54d9986c5067d5ce9f3a6f37db4dc1a88d400df85a6daf50` |
| `evidence/fault-V10.txt` | `0b18712fbbe8436c4aa4726042bbdb5a6e6969b4fad6deabb2f5d2cec1f59472` |
| `evidence/fault-results.json` | `409c3a6b28191e7a5a54d3e417bf0ea08864e306942628af27c25f459cf29665` |
| `evidence/fault-run.txt` | `c415c21fa98fc165b938064f9659633fc7be052f72de476727b043b5ba0ec050` |
| `evidence/pass-run.txt` | `045cf92ece6fa433a477e5cac06faad4237c3f19a67cae1cbb49855c465d1b12` |
| `evidence/quota-offline.png` | `0c3baac67bdb472056a44bbad617c647985349f614df07bc63986a93f8c42959` |
| `evidence/rider-320.png` | `deb796ee72ce78a2ba8ad46d014d240e706d7c27d25f884ed1e3c855dca1389c` |
| `evidence/v0.2-SHA256SUMS.txt` | `255d378bccd8351f9f73a910193ad3341a893c59356bb8da417aecc8044c7d0c` |
| `evidence/v0.2-build-report.md` | `d37eb8e9524da0c588f6e0a2e8764d41ae26fdac0be601e0cce28338f1754142` |
| `evidence/v1-action-log-browser.csv` | `ade184b923a2d3507f45d848a3192a55ce7748a843804a4512557b33e028f596` |
| `evidence/v1-board-dark-1280.png` | `e1c9e166beea881f194deee4c6aac93539024a40dc89c91201ac9be63aef3ad1` |
| `evidence/v1-board-dark-320.png` | `cffb6e5b1ae5ca296d46a4acc951faacf90c8bf34c39ab6170d501a6af413510` |
| `evidence/v1-board-dark-768.png` | `e716b3af57939dce4c21fe70898e27bf58a9575501be56790490a840223c79e4` |
| `evidence/v1-board-light-1280.png` | `f9baf2615a7460dfbee3e6683f509d99ad547b396e245e4102f13fbed22aa14a` |
| `evidence/v1-board-light-320.png` | `e04a7d1b73afad8f40c63726c57f658b322768cc7d9174607835b15e9724d159` |
| `evidence/v1-board-light-768.png` | `a961d20a1d4218f8e155a93df7651d44753cfc68a52b0b7c7ab5c9436718c1c0` |
| `evidence/v1-board-print.pdf` | `e0ede72ede91ca979a09f602fcc57b431d12c5d340b3c329e2159c1fce624837` |
| `evidence/v1-browser-checks.md` | `e653ac0ee6b53e5ebe80a3d40890910c11d386b07e0891bf75d5be22886e646c` |
| `evidence/v1-browser-results.json` | `9d81c5a51eb6d7b0eebd5bf2f61fc1dc66927bbf6cff66fc575284b7e05c542a` |
| `evidence/v1-browser-run.txt` | `3ba42b94e5a9a09f4e939de25eac5006670cd1b8628a4f060223e848625db284` |
| `evidence/v1-card-dark-1280.png` | `8cb83d02fb440fea7cb2c59d8292b8e70dfcfaa223730bfe9fd377011d98766a` |
| `evidence/v1-card-dark-320.png` | `5c7b90472fae5b1cb1418e516dec72f6f4eadfd2a3e8a8a21624b1c1778a1f3d` |
| `evidence/v1-card-dark-768.png` | `ffa22f9ca7b65fe30223c4591d4a22674002556739ae97de0ef2fa9c56d41169` |
| `evidence/v1-card-light-1280.png` | `af3d62b61ccb9597be5c20746d562843ea7ea331196e75ed71918181786c95c3` |
| `evidence/v1-card-light-320.png` | `b41e4031a2a90a49a9fe3545bb9e4faf8866b3221bbe2f5dcee4047f8e59be57` |
| `evidence/v1-card-light-768.png` | `8e1b3bb1b5be589cbe42d2e2ed0eaf82746ff5f78bc84f6bd64c2679a05301cf` |
| `evidence/v1-card-print.pdf` | `1579d98eeb83baa51e971f4966fb41675b39eb241476df8b49acf971aee6e860` |
| `evidence/v1-contrast-results.json` | `4303d5c565d6cd4ddc4db2f340107c4e3ef738d5ef0d7548b0cea5ceab1079bf` |
| `evidence/v1-contrast-run.txt` | `18b5fa2448c8e92a4c49e57e1c99c2c588521d9c0ce95d207d999a51acb6a073` |
| `evidence/v1-data-dark-1280.png` | `974dce2b20166877ced689d0791f441f0b45d6dd5ea5ae781f49a34bdcb74ae7` |
| `evidence/v1-data-dark-320.png` | `4d5d4b3bfce1b1739e41840c5dbd15541e72ec7ebbd630990184f081850b29bb` |
| `evidence/v1-data-dark-768.png` | `dd96aee82040db8663ff0d05a372a4e82256ace209a7d1cf4d9c41bcb6b511fc` |
| `evidence/v1-data-light-1280.png` | `1eaca5bf622228aac8724a40c68c6089eea8edc24449099e92f1d680cc00d466` |
| `evidence/v1-data-light-320.png` | `670fc6c66b980696d944d396f243f608feb03f337c63ab4bebc6f0f788d108f4` |
| `evidence/v1-data-light-768.png` | `eb79817b4a54bc93630a7efe06a19f37fd807eaa3def96c37405a3261b8cf9e3` |
| `evidence/v1-device-data-browser.json` | `443e2f63b791cb7f0f31807eb8558b1346daab543e41326d9596110f650c5d3a` |
| `evidence/v1-fault-B01.txt` | `0816e0ab69f6522f67360c3675cc8ff8eeb8144234b20d9e7ef0193421290901` |
| `evidence/v1-fault-B02.txt` | `9fe7dc23c2f662f23e45523b351b39a4e34fed61d84c8440f61d039bd36598e5` |
| `evidence/v1-fault-B03.txt` | `8a32eba60bc21c52b739a289cee64aa664e11920266124475a8738d39865da20` |
| `evidence/v1-fault-B04.txt` | `62abdea8647fc8baf50447bb4017134c42c5590efcde83466476f94a698fae3f` |
| `evidence/v1-fault-C01.txt` | `eee8f5a2a24a5c8b2565c239696928be0554e608a0ec76df8769d5c3424ea8f7` |
| `evidence/v1-fault-D01.txt` | `5f102db602ee6b168cc4653f84c92ec31d06a385997c64ffc1d440618d93ec4f` |
| `evidence/v1-fault-D02.txt` | `aeacb463e156aeb84a33d6c4e02197fd5622993ddb8c52941f06fc3be9dc34ee` |
| `evidence/v1-fault-E01.txt` | `cc3ce0b6fc8fb73893b16e5009387c4a8c5dca0e457a12e8f2d86307f242ffba` |
| `evidence/v1-fault-E02.txt` | `2566fea2453ee31ba395275001295b897b18798307a25bd8d5caf9126aa97c74` |
| `evidence/v1-fault-E03.txt` | `5722925ba83264cb00c539b2a7c5dc80a017499bce721531fca4e7cbb2204075` |
| `evidence/v1-fault-E04.txt` | `bf19c20ae072a9f8f1d09a1bfe529dcf4d9a1c8fd05b62074fa18a4204c25b39` |
| `evidence/v1-fault-F01.txt` | `5399b79f71bfff9f5616ccfd44a5f8751a649922b37d2526e77122f72fa092e7` |
| `evidence/v1-fault-F02.txt` | `eae5c99580b14b215f7a9cb860220b2087ed26cb034fdc3c0afcea57e3423358` |
| `evidence/v1-fault-F03.txt` | `c2f0a62298701ccea72b3a29cee65ba14588f922e39d822ae6e3afc69ced13fb` |
| `evidence/v1-fault-F04.txt` | `cc013bc516f28ef44faffa5849e18d8e6e93c5a09b0a5fa32b8887a97c0f2f46` |
| `evidence/v1-fault-F05.txt` | `6380505421772c11f6870604af6c3e2d702b94c1be852b08c1a11c67e6d67630` |
| `evidence/v1-fault-I01.txt` | `085dc9be7a1b0874f66655d43db273865f1bb4c938d97ce40ca8d5693c53e2fd` |
| `evidence/v1-fault-I02.txt` | `8b2bf2c665e91764a0769ef33cdbde4477a7ff82b00927202208f1fc7b42d685` |
| `evidence/v1-fault-I03.txt` | `92da3f57e76c588b72c2905463eaf097444749acb7c4c8b9c70678bc2740d2e6` |
| `evidence/v1-fault-I04.txt` | `a29ad9533b8270e424e42294d9535510939d24065def085d40cb1d5da07712fc` |
| `evidence/v1-fault-I05.txt` | `a83144efa71b56c275853dc786239b0ab3df734cca59a242799acd1c21e6c8f9` |
| `evidence/v1-fault-I06.txt` | `aa0ba075ea9ab0f3fbbba95ff629312f8ff04cba1b1b1ba90e5d34a6fe4c056d` |
| `evidence/v1-fault-L01.txt` | `41865e371e5b776b2b030e4f820104c2f4348798935602acd9419634b8a959e9` |
| `evidence/v1-fault-M01.txt` | `e10629d350c3c3e7cc8b68f1a9c510e4bf8b3b3c89bc856c1528a83ed4895969` |
| `evidence/v1-fault-M02.txt` | `0e31b5ddb7ac99f5bbceeadb99eb55082cd330bb97f0762ba3799f6d29850645` |
| `evidence/v1-fault-O01.txt` | `24f63d8dff2c7d34a23eca3d7975a6c07256870c97464c893b1e3703570bd32c` |
| `evidence/v1-fault-O02.txt` | `c6a7a66d8345f267f5f21fd8a26a05b2544013e0b178d3bb85cbaf8322a7716a` |
| `evidence/v1-fault-O03.txt` | `544d11fedbed31912c3b559175a84ae9a8939ab7ce8483284e102302f6c8c943` |
| `evidence/v1-fault-Q01.txt` | `fcf633809ae5d910844c418c31b241f72d91247691f72e9dea52e51a0733c4f3` |
| `evidence/v1-fault-Q02.txt` | `2708af53ab9f9b9bd0b5072c918056ad83b9d789bb9ae662cf72c05b56cb2cbb` |
| `evidence/v1-fault-S01.txt` | `35ed600c6f0ea859956be14254fe208d33e115abc4a5201567f5d19c972ad5d5` |
| `evidence/v1-fault-S02.txt` | `217e4af8f9575e08e025cf2155d34898347e5f1443276b2e24830d3ed0e04087` |
| `evidence/v1-fault-V01.txt` | `e0659fbaf04d3d826c915015575c1329e65c9642323e8163c93855e69d1997d4` |
| `evidence/v1-fault-V02.txt` | `8e3a8c706f77336abc78ddf161239978266d22b3d77db5e8c53216220928205c` |
| `evidence/v1-fault-V03.txt` | `95910085d3d6042fe587fb57cf7996e941b41eeb0d2f0bb1305fdcdb6613d7ad` |
| `evidence/v1-fault-V04.txt` | `134084c74078dbfb0b758c1c1c85e17768dead08af13fe98abbef9b58c14d4ed` |
| `evidence/v1-fault-V05.txt` | `41264b895de034d55ad1d62f8ba48512a25b2a4262574b5b3d900699b0c2c3e9` |
| `evidence/v1-fault-V06.txt` | `9bf071cc306143255dd90673ba4afd7027d646122c7d8ecea3d65d10547e237e` |
| `evidence/v1-fault-V07.txt` | `883012eedd9838e0eda09d2381aaffbb88548ff829d14f30672d967c273d62b8` |
| `evidence/v1-fault-V08.txt` | `672d759915033086398153c96c28a924fd78262205ca2ed5ce0c9c1ab06f0405` |
| `evidence/v1-fault-V09.txt` | `ea40c692bbaa258617771cdbf0eb59d234135457864ba3beb0b92a8377dfca08` |
| `evidence/v1-fault-V10.txt` | `ab9568a4192f14eb3162951da84d9dd1d937ea7ed36ecb279f30bc00c2650003` |
| `evidence/v1-fault-results.json` | `99d888a91f39b4e76a330ec916cb68aaefc213f3f3eeef0fbe2ba2157db921bc` |
| `evidence/v1-fault-run.txt` | `4883c54d9186364b2e20b25bf533ae6cbcefac7f7fa4031e181d24fbbf15193d` |
| `evidence/v1-home-dark-1280.png` | `62a4aa9e70d4b6d26a2afac577a9138297cedb0028af10af418c9e755540a16d` |
| `evidence/v1-home-dark-320.png` | `dfe06b83fdbdc73ceb198b27dbd81cded914d06cbb0158be3c272e8b3bc673ae` |
| `evidence/v1-home-dark-768.png` | `04a14a53d7f895d2293ae1a4bae730add20580be88e182483c94a3498857f0e7` |
| `evidence/v1-home-light-1280.png` | `e0d9987adeb1d12eadb14be1899a5bf29872d1032f0a167c84fab254610a2f77` |
| `evidence/v1-home-light-320.png` | `c9bcafc9008611f1dc8e5916b498324f71ffa3ad5bb5fc051833babfe12d3951` |
| `evidence/v1-home-light-768.png` | `82cad05bd617d755f447f29fed5e2427dd8628e968d3b18347a9395fdf40982a` |
| `evidence/v1-keyboard-output.txt` | `8fc6866cca579235bc18303e46e01cf50017cbd7b624371c5417bb4f9faa3ffe` |
| `evidence/v1-offline-results.json` | `a47e9bede5d78aea5cee6444312bbc49f42202048f6bc6a7942620e9d93a53fb` |
| `evidence/v1-pass-run.txt` | `2ee8a246ca9b9644d94ed29b5384209c7952f52dbe7400989672f4ea8106f6d3` |
| `evidence/v1-quota-dark-1280.png` | `7de2cea7ad7ebd65d84a3f03e7412d3fe54ac80886292c6846bffb1fe022bbb0` |
| `evidence/v1-quota-dark-320.png` | `f2b4755b24344787a206601225d2209b65916dd2609ece1b7057a538d343bc13` |
| `evidence/v1-quota-dark-768.png` | `ca65e3f8c4a42187898fe8324db79c21fc3473195ae817a7df0e5041ad0638ea` |
| `evidence/v1-quota-light-1280.png` | `3ba67ba56f452a28611a92bd208e6c088c0fa5f2c5ef605d3db715bd172af263` |
| `evidence/v1-quota-light-320.png` | `b8139df01b9ecf3343a157993b3c4d3cfdb5bd1d06d9030b3ff1af39b68f029f` |
| `evidence/v1-quota-light-768.png` | `0a57e6b6ae397b3d01560f8e833c06e5bcd0774744d28a3c6b5a445d2c38a4a0` |
| `evidence/v1-rider-dark-1280.png` | `8366a5bf759afca4bfd9f09157f8d19f20203d805394a2191b2b8a6d0254bd92` |
| `evidence/v1-rider-dark-320.png` | `91e6af2889534e7a7ea42a8fb0663100f6f971914734be71e32b5d7f3a9b28c6` |
| `evidence/v1-rider-dark-768.png` | `df72f931542f1a9b24a4cb0f4be1ea88ef2a7d0d808ee17f90b68ddadfbc8b44` |
| `evidence/v1-rider-light-1280.png` | `7c1bc25ba5ca5b0e7011175f66ab3fce2da4c596ffd49f7f48769abc3e41b900` |
| `evidence/v1-rider-light-320.png` | `c7da3e1355996ea311a19112b49c02ec3ab4f71e6428ac205874da74db5703d2` |
| `evidence/v1-rider-light-768.png` | `678faf884caaf60e65f2ff69138c3c7a307b63ce2c43985c2d7209fb307b40c9` |
| `evidence/v1-staff-dark-1280.png` | `8b1a1edcc503138eea8071ec4049a312373fd710b6170213df2c0fafaefc401f` |
| `evidence/v1-staff-dark-320.png` | `efa9dd2f3a3822263dc84d801f4d03ed4cb9efe84999deb9b5903cd7bf48684d` |
| `evidence/v1-staff-dark-768.png` | `a72f6dff5b823143cb52553f7bb198dbff299f581c157e1836b4c9d6f48415e7` |
| `evidence/v1-staff-light-1280.png` | `92a71d6a6d388a42bec22ed9324424a15bd5674dfd5671955238e29f6b4a50b5` |
| `evidence/v1-staff-light-320.png` | `8a33fffb063a20173a9a068034f198b164b469563a7e249fedaeedb9bc4acead` |
| `evidence/v1-staff-light-768.png` | `7e071130ad0ad50f1ce7fa75313c5923f7d874906ffa5b81892e1fcc2d989d96` |
| `evidence/v1-upgrade-results.json` | `7f3ef1d6b1ff9f4e29b7aaeb1c60ed0b51e4ed0cbea4c5e2b6f406a4712739a7` |
| `evidence/v1-upgrade-run.txt` | `7f3ef1d6b1ff9f4e29b7aaeb1c60ed0b51e4ed0cbea4c5e2b6f406a4712739a7` |
| `icon.svg` | `612f4ca98b47f5bdfddf13328439046eeb81adc466903aa91e49025d366be1ba` |
| `icons/icon-192.png` | `bbb8c4ccd80c942191624ac1abed15eef8ae03da6541d66d4a2d56e217a8b26a` |
| `icons/icon-512.png` | `f303282e7936db65f46897ad9b80a25b3ad92d77f33dd0fe6d51f841a11f3d1f` |
| `index.html` | `d95e6f75b137ebd0018b5e97308571ecdcaebd28489d3c0b6d4cc59733dda645` |
| `js/app.mjs` | `4793fb326c7b0724ad3442113b9dc291e5b486a509bb11e9d30ad956d67c5fe5` |
| `js/board.mjs` | `c607446575a95c3626272ef8a752b737c165600ea5176a77f8a6cacfdfdab2a8` |
| `js/card.mjs` | `e0b3d67e4d23cd79dd7d62dbc3634321950ebeaf261a583740957edf9366a39f` |
| `js/core.mjs` | `52ad17998b17feeb62be8e21d483c02262092c65a847323375e030d7c0788ba1` |
| `js/form.mjs` | `3b2582d60009b45413a4cc6860d2dbf5ecd230142a055f7bf920ade4ae63176c` |
| `js/locales/en.mjs` | `66f9668feb92a65dbdccb8bbe62ee3971dcedeae274a4b769d2e1de5c33dc8cc` |
| `js/locales/second.mjs` | `f72b988f43ca4e441e4d0ced6ba70e779f6ac530f4e30216d74a29fdea0d82d6` |
| `js/questions.mjs` | `57d6283b6ca68bacf8412e08d41d8de5946b214920e816d88441fe13274f5022` |
| `js/storage.mjs` | `5711b5316f6bdaac1d5e4dec5d8811b3846cf3b3866401ba772f2dc85666a794` |
| `manifest.webmanifest` | `38f6df3f6c25285fb99f53bc929f028e631f6a594de0553396112b7a1f4303d1` |
| `scripts/browser-checks.mjs` | `33810d1f9a3855fa205f56558621d39da55399d8d340d638a3fd1af32d591d62` |
| `scripts/contrast-checks.mjs` | `d17d15dcfe79c520d66ab35fb23254ce29ee7140e055b9ff441e01be4ed496a7` |
| `scripts/faults.mjs` | `43ee053aed818b7dcfa97e4bf0aab1f088de1d52cc004c20a890b41c35631d55` |
| `scripts/refresh-dictionary.mjs` | `071ce5e28bf2306443eee9105fd6cdef4324dee471ad58ff8e9a4ca38d387484` |
| `scripts/run-faults.mjs` | `6e50aa1e9af42bdf6d04a330dbc1cf28be530ddb0a731b4e73c071b84ce20c03` |
| `scripts/upgrade-checks.mjs` | `f850f0b777b6ee507daf49c9f131595b776625882d039918dda3865fae6dbeee` |
| `styles.css` | `30d16484f18a7d2438ee34d66c71ec1092ebf11c3f46b6cb20fd7fc7079ba3db` |
| `sw.js` | `15da0f2618e299e9d0a6c3829295dd43edfe394026238a7e3e2cbd312cde63ef` |
| `tests/core.test.mjs` | `183bf2af799495c2152b435ae6d9aa35fcf6b6bb737dc743773b0e27a40bf956` |
| `tests/helpers/storage.mjs` | `fd65440220b8893dbe67388b71b8e47d37e70ab4aa6ef88e1aa804dd5ad903ac` |
| `BUILD_REPORT.md` | Final report checksum is in `SHA256SUMS`. |
| `SHA256SUMS` | Detached checksum file; excludes itself. |
