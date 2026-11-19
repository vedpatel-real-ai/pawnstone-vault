# Database model and upgrades

Start a disposable stack with `supabase start` and initialize it with `supabase db reset --local`. The CLI applies the timestamped files in [migrations](../../supabase/migrations/) in order. The server seed is empty. Browser sample records are independent.

## Existing installations

Back up the database and object storage. Restore into a private staging project with the same platform versions and compare `supabase migration list` with its catalog. Run the complete upgrade and reconciliation there before scheduling a maintenance window. Keep the app and scheduler offline throughout an upgrade. Do not reset a linked project.

The August 1 baseline restores tables previously supplied separately in schema.sql. It tolerates existing tables. The August 13 customer files now use CLI-compatible filenames with the original version numbers. Two historical, unexecutable policy definitions and duplicate asset creation were consolidated within their original version slots. The later migrations apply the effective security and ledger rules to previously installed tables. A version already recorded by Supabase is skipped. On a staging clone with later versions already recorded, use `supabase db push --include-all --dry-run` to see the missing earlier baseline and pending migrations, then apply the reviewed set to that clone. Investigate unknown versions, custom grants, policies, functions and schema drift before proceeding.

Before upgrading, reconcile receipt totals, paid dues, tenant IDs, file paths and outstanding principal against the shop's records. Prior versions could lose a balance update or clear a due early. A database migration cannot reconstruct cash collections from those rows alone. Strict constraints stop on incompatible data. Resolve exceptions from source records and retry the failed migration. Keep a reviewed backup and restoration procedure. Never mark migrations applied solely to skip a failure.
