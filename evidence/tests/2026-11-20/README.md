# Local verification snapshot

These reports come from a fresh locked installation on macOS arm64, two synthetic shops and disposable local Supabase services. Numerically distinct test groups are listed in the [verification guide](../../../docs/verification/TEST_VERIFICATION.md). All case outcomes and durations are in the XML. The manifest identifies the tested commit and the command exit codes. Local usernames and checkout paths are removed from exported XML. Recompute the checksums from this directory with `shasum -a 256 -c checksums.sha256`.

Earlier attempts exposed a Docker DNS issue during a local reset, an empty-stream difference between Node and Deno, a date-boundary issue in origination, and a browser navigation race. These were corrected and re-run. The Chromium remote-offline test combines transport disconnection with Chromium's explicit offline network-state override. The same-browser account-switch workflow uses real local Supabase Auth. This directory contains no hosted deployment result or real customer records.

## Executed results

Tested revision `ec1bb3ee6ee65088ef12711026faa55e405ca15b`. Local execution started at 2026-11-19T20:21:45.976885+00:00 and finished at 2026-11-19T20:24:23.115365+00:00 (UTC). All 19 recorded commands exited zero. [Command manifest](manifest.json)

| Suite | Cases | Failed | Skipped | Output |
|---|---:|---:|---:|---|
| unit | 30 | 0 | 0 | [XML](unit.xml) |
| browser | 3 | 0 | 0 | [XML](browser.xml) |
| tenants | 3 | 0 | 0 | [XML](tenants.xml) |
| ledger | 5 | 0 | 0 | [XML](ledger.xml) |
| scheduler | 3 | 0 | 0 | [XML](scheduler.xml) |
| edge | 1 | 0 | 0 | [XML](edge.xml) |
| session | 1 | 0 | 0 | [XML](session.xml) |

Two fresh resets completed. The staged upgrade preserved the existing receipt, principal balance and paid invoice. Lint exited zero with seven Fast Refresh warnings. The app and configuration TypeScript checks each exited zero. The bundled runtime tests made no live email calls.
