# How it works

## From signup to a shop record

The sign-up form sends credentials to Supabase Auth. User metadata supplies a display name. After authentication, the provider calls the membership RPC, which locks the caller's profile. A first call creates a private organization and repeated calls return its ID. No user-facing invitation or membership-transfer flow exists. Database grants restrict edits to membership. [Signup](../../src/pages/Signup.tsx) · [Provisioning](../../supabase/migrations/20261119000100_membership.sql)

The operator creates a customer, selects that customer during origination and describes the pledged item. PostgreSQL issues the first invoice within the loan insert transaction. Photo uploads take place after origination. If an upload fails, the operator can reopen the existing loan and retry the attachment. [Loan form](../../src/pages/Loans.tsx) · [Attachment handling](../../src/data/attachCollateral.ts)

## Collecting and reporting

Interest collections apply to open interest invoices by due date. An excess payment fails as a whole. Principal receipts pay down principal. Fees have their own receipt type. Issued invoices preserve the amount assessed. Historical missed periods are assessed before a new collection changes the principal. Imported balances and missing historical records must be reconciled before use. [Rules and example](../architecture/FINANCIAL_RULES.md)

The dashboard queries loans, dues, receipts and customers through the active provider. Its monthly interest-due total uses the billed amount less the paid amount. Collections invalidate query data so a return to the dashboard reflects the updated ledger. CSV and PDF reports reflect the fetched rows. Independent reads during heavy concurrent editing do not form a database-wide reporting snapshot. [Dashboard](../../src/pages/Dashboard.tsx) · [Reports](../../src/pages/Reports.tsx)

## Deploying and scheduling the dues job

1. Apply the tested migrations to the intended environment using the reviewed migration workflow. Provide an independent, uniformly random 32-byte secret encoded as 64 lowercase hexadecimal characters. Generate it with a cryptographic random generator, for example `openssl rand -hex 32`. Store it in the scheduler's secret manager and in the function environment as `DUES_SCHEDULER_SECRET`. Keep it out of Vite variables, source, URLs and logs.
2. Deploy the conventional entrypoint with `supabase functions deploy generate-dues --project-ref <project-ref>`. The checked-in function configuration disables the gateway JWT check for this endpoint. The handler performs its own dedicated scheduler-secret check before creating a service client. The platform supplies its backend URL and service credential. [Handler](../../supabase/functions/generate-dues/handler.ts) · [Supabase service-to-service guidance](https://supabase.com/docs/guides/functions/auth)
3. Configure a scheduler to send an empty HTTPS POST to `https://<project-ref>.supabase.co/functions/v1/generate-dues` with the secret in the `x-scheduler-secret` header. A frequent interval, such as every five minutes, allows subsequent batches to catch up. Each invocation processes up to 100 eligible loans. Monitor response status, outstanding eligible loans and the age of the oldest next date. Test the schedule in staging first.
4. Missing or invalid credentials return 401, unsupported methods 405, a nonempty body 400, and missing configuration 503. A financial failure returns 500. Retry after resolving the cause. The transaction rolls back uncommitted schedules, dues and notices, and concurrent jobs skip locked loans. Existing paid dues retain their status. [Scheduler SQL](../../supabase/migrations/20261119000300_scheduler.sql) · [Runtime tests](../../tests/integration/edge.test.mjs)

## Internal notices and optional mail

Each assessed open due can have one internal notification keyed by due ID. To enable email, configure both `SENDGRID_API_KEY` and a verified `DUES_FROM_EMAIL` on the function. A worker claims up to 20 unclaimed open invoices due **today** with a customer email address. Historical catch-up creates internal notices without mailing a backlog. Manual dashboard reminders create internal messages.

A claim commits before the outbound request. A positive response records **accepted**, a negative response **rejected**, and a network exception **unknown**. A crash between claim and acknowledgement can leave **claimed**. Automated retries skip those rows. An operator can reconcile the attempt time and recipient against provider activity before deciding on a separate follow-up. There is no automated resend of an uncertain attempt and no delivery-webhook integration. The service never includes customer files in reminder emails. [Mail worker](../../supabase/functions/generate-dues/index.ts) · [Outcome tests](../../src/lib/dueMail.test.ts)

## Offline and shared devices

The production build precaches an exact list of public assets, fetched without credentials. Offline navigation can serve the fixed app shell on known routes. The service worker deletes the old broad cache when it takes control. Supabase records, signed URLs and mutation payloads have no replay cache. The remote UI requests reconnection while offline. In-flight network failures surface to the operator, and a receipt retry reuses its request ID in the same tab. Signing out discards the authenticated query cache. [Service worker](../../public/sw.js) · [Offline browser checks](../../tests/offline.spec.ts)

The demo uses a browser-local ledger snapshot. Compatible browsers use Web Locks for coordinated posting, with same-page serialization as a fallback. Browser eviction, resets and multiple devices have different durability characteristics from PostgreSQL. Local demo records survive ordinary logout on the same device. Use synthetic examples.
