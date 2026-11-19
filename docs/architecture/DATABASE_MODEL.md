# Database model and upgrades

Start a disposable stack with `supabase start` and initialize it with `supabase db reset --local`. The CLI applies the timestamped files in [migrations](../../supabase/migrations/) in order. The server seed is empty. Browser sample records are independent.

## Existing installations

Back up the database and object storage. Restore into a private staging project with the same platform versions and compare `supabase migration list` with its catalog. Run the complete upgrade and reconciliation there before scheduling a maintenance window. Keep the app and scheduler offline throughout an upgrade. Do not reset a linked project.

The August 1 baseline restores tables previously supplied separately in schema.sql. It tolerates existing tables. The August 13 customer files now use CLI-compatible filenames with the original version numbers. Two historical, unexecutable policy definitions and duplicate asset creation were consolidated within their original version slots. The later migrations apply the effective security and ledger rules to previously installed tables. A version already recorded by Supabase is skipped. On a staging clone with later versions already recorded, use `supabase db push --include-all --dry-run` to see the missing earlier baseline and pending migrations, then apply the reviewed set to that clone. Investigate unknown versions, custom grants, policies, functions and schema drift before proceeding.

Before upgrading, reconcile receipt totals, paid dues, tenant IDs, file paths and outstanding principal against the shop's records. Prior versions could lose a balance update or clear a due early. A database migration cannot reconstruct cash collections from those rows alone. Strict constraints stop on incompatible data. Resolve exceptions from source records and retry the failed migration. Keep a reviewed backup and restoration procedure. Never mark migrations applied solely to skip a failure.

## Relationships and permissions

| Record | Parent or scope | Ordinary client operations |
|---|---|---|
| Profile and organization | Auth user ID and profile membership | Read own profile and organization, provision through the authenticated RPC |
| Customer | Organization | Create, read, edit details, delete when no loan references it |
| Loan | Customer and organization | Originate, read, edit collateral details and maturity information |
| Payment | Loan and organization | Read and post through the collection RPC |
| Due | Loan and organization | Read invoices and allocations |
| Notification | Organization and optional loan | Read messages and create internal reminders |
| Loan asset | Loan and organization | Read, attach or remove metadata and authorized objects |
| Audit log | Organization | Read scoped legacy audit rows. New receipts carry the posting user ID |

RLS scopes rows; column grants separately limit what an authenticated client may change. A composite key on each financial relationship enforces the same tenant on parent and child. The private schema houses the functions that need owner privileges. Their search paths are fixed, ordinary clients cannot run the assessment helpers, and the public posting wrapper derives its tenant from the authenticated user. The migration role owns these functions in the tested local stack. [Membership and file policies](../../supabase/migrations/20261119000100_membership.sql) · [Posting permissions](../../supabase/migrations/20261119000200_ledger.sql)

Private buckets use the first segment of the object name as the parent UUID. Read, upload, overwrite, rename and delete are subject to the parent-row rule. Signed URLs issued by the UI last five minutes. Database and object storage operations use separate APIs. A lost response or administrative change may require checking the metadata row and object together. [Storage client](../../src/data/supabase/supabaseProvider.ts) · [File API checks](../../tests/integration/tenants.test.mjs)

Platform references include [Supabase migration history](https://supabase.com/docs/guides/deployment/database-migrations), [Auth user references](https://supabase.com/docs/guides/auth/managing-user-data), [RLS and function privileges](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
