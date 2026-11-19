# Verification

Start Docker in a disposable checkout, install Node 24.14.0, npm, Python 3.9+ and Supabase CLI 2.104.0. Leave local ports 56420–56422 and 37381–37383 available. Keep hosted credentials and mail API keys out of the environment.

```sh
npm ci
npx playwright install chromium
python3 scripts/verify.py
```

The verifier targets the local `pawntrack-local` project. It resets the disposable database, installs the historical version slots, adds a synthetic existing loan and checks the forward upgrade. API tests use confirmed synthetic Auth users and fresh clients. A scoped constraint temporarily forces one due insert to fail. The verifier starts the actual local Edge runtime with a temporary scheduler secret. Every case uses a fake recipient or disables delivery.

The output directory is `.cache/verification/`. Previous local output is archived in `.cache/verification-history/`. The manifest records the Git revision, platform, runtime versions, commands, durations and exit codes. XML contains individual cases. The SHA-256 file covers the exported files, including the manifest. The stack's startup credentials and the temporary scheduler environment are excluded. On CI, open the run's **pawntrack-verification** artifact. [Workflow](../../.github/workflows/verify.yml) · [Run history](https://github.com/vedpatel-real-ai/pawnstone-vault/actions/workflows/verify.yml)

## Reading the counts

| Group | Cases | Evidence |
|---|---:|---|
| Arithmetic, aggregation, demo provider and mocked mail transport | 21 | [Vitest suites](../../src/lib) · [Demo suites](../../src/data/demo) |
| Handler authorization and service-worker security | 9 | [Handler](../../src/lib/scheduler.test.ts) · [Worker](../../src/lib/serviceWorker.test.ts) |
| Database posting and scheduler | 8 | [Posting](../../tests/integration/ledger.test.mjs) · [Scheduler](../../tests/integration/scheduler.test.mjs) |
| Tenant, Storage and real Edge authorization | 4 | [Tenant](../../tests/integration/tenants.test.mjs) · [Deno](../../tests/integration/edge.test.mjs) |
| Chromium demo and offline workflows | 3 | [Collections](../../tests/e2e.spec.ts) · [Offline and mobile](../../tests/offline.spec.ts) |
| Chromium authenticated shop switch | 1 | [Session](../../tests/integration/session.test.mjs) |

Each case appears in one row. Migrations, installation, compilation, lint, build and legacy-data reconciliation are additional checks. The narrower unit, browser and database commands are in [package.json](../../package.json). To run the individual integration cases, start the stack and the local Edge Function using the verifier setup first. The test harness refuses a hosted API URL.

## Baseline and limits

At `06a02e6877b4a49c9a0977c5d4a31c0234ea2b8d`, a fresh locked installation built successfully, the Node configuration typecheck passed, the app typecheck emitted 13 diagnostics, lint reported eight warnings, and 17 Vitest cases and one Chromium case passed. The baseline Chromium command first encountered a sandbox bind denial and passed with local server access.

During hardening, a local Docker-network reset lost Storage-to-Postgres DNS. Recreating only the test project on the CLI-managed network resolved it. Chromium exposed a civil-date mismatch at Indian midnight and duplicate login navigation. The live Deno runtime also represented an empty POST as an empty readable stream. The corrected flows are covered by the local runtime and production-preview tests.

The remaining ESLint warnings are development Fast Refresh warnings on generated UI primitives that export a hook, style helper or toast function alongside a component. Dashboard updates use query invalidation. The full production bundle still produces a Vite size warning. These checks exclude hosted scheduling, provider email delivery, production schema drift, accounting compliance and live borrower data.

[Local verification manifest](../../evidence/tests/2026-11-20/manifest.json) · [Claim matrix](CLAIM_MATRIX.md)

The final local snapshot is stored under [evidence/tests/2026-11-20](../../evidence/tests/2026-11-20/). Its manifest identifies the revision tested before committing the evidence itself. For the exact pull-request or merged revision, use the artifact attached to that revision's workflow run.
