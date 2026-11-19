# Technical FAQ

### 1. What can a shop operator do with PawnTrack?

**Simple answer.** Follow a pledge from borrower registration to collections and settlement. The customer directory, loan portfolio, collateral register and payment ledger refer to the same records.

**Example.** Search for a borrower, open their gold loan and see its remaining principal.

**Implementation.** React Router exposes the screens, and the provider supplies their records. **Evidence.** [Routes](../../src/App.tsx) · [Browser workflow](../../tests/e2e.spec.ts)

### 2. Why use React and TypeScript here?

**Simple answer.** Several screens display different views of the same loan. Shared types describe the fields and React components handle editing, navigation and refresh.

**Example.** The portfolio and payment form both use the loan's remaining principal.

**Implementation.** A typed provider interface connects the components to persistence. SQL constraints validate changes at the database boundary. **Evidence.** [Data types](../../src/data/types.ts) · [Typecheck and test workflow](../../scripts/verify.py)

### 3. Why are there two providers?

**Simple answer.** The demo lets a reader explore synthetic records immediately. Supabase supplies a shared database, authentication and private media storage for evaluating the backend.

**Example.** Adding a demo borrower changes this browser profile. Adding one in Supabase writes a row in the authenticated shop's organization.

**Implementation.** Configuration selects one implementation of the same interface. **Evidence.** [Provider factory](../../src/data/index.ts) · [Demo tests](../../src/data/demo/demoProvider.test.ts) · [API tests](../../tests/integration/tenants.test.mjs)

### 4. How does a new account get a shop?

**Simple answer.** A signed-in account with no membership gets its own organization on first use. Reopening the application returns the same organization.

**Example.** If two tabs initialize the same account, the second waits for the first profile update.

**Implementation.** The provisioning function obtains the user ID from Auth, creates the profile if needed, and locks it before assigning an organization. Existing membership is preserved. Invitations require a separate feature. **Evidence.** [Membership SQL](../../supabase/migrations/20261119000100_membership.sql) · [Concurrent initialization](../../tests/integration/local.mjs)

### 5. What ties a pledge to the correct borrower?

**Simple answer.** The loan stores its customer ID and organization ID. Both must match the same customer row.

**Example.** A shop cannot attach one of its loans to another shop's borrower, even with a known borrower ID.

**Implementation.** A composite foreign key enforces the relationship independently of the form's customer picker. **Evidence.** [Database model](../architecture/DATABASE_MODEL.md) · [Foreign-parent tests](../../tests/integration/tenants.test.mjs)

### 6. How much interest does a loan accrue?

**Simple answer.** Each monthly invoice uses simple interest on the principal assessed for that period. The first invoice is issued at origination and the result is rounded half up to paise.

**Example.** ₹1,00,000 at 2% produces ₹2,000. A future unbilled period on ₹90,000 produces ₹1,800.

**Implementation.** PostgreSQL rounds exact numeric amounts. The demo uses scaled integers for the multiplication. Compounding and penalties are outside this model. **Evidence.** [Invoice calculation](../../supabase/migrations/20261119000200_ledger.sql) · [Arithmetic examples](../../src/data/demo/ledger.test.ts)

### 7. What does a principal repayment change?

**Simple answer.** It creates one receipt and subtracts its amount from remaining principal. Previously issued invoices retain their face values.

**Example.** Paying ₹100 toward ₹1,000 leaves ₹900 before the next repayment.

**Implementation.** The posting operation locks the loan, checks the balance and assesses missing periods before changing principal. An overpayment rolls back. **Evidence.** [Posting rules](../architecture/FINANCIAL_RULES.md) · [Database assertions](../../tests/integration/ledger.test.mjs)

### 8. What happens when interest is partly paid?

**Simple answer.** The due retains its billed amount and accumulates the paid amount. The open balance is the difference.

**Example.** A ₹1 collection against ₹20 leaves ₹19. If two ₹20 invoices are open, ₹21.25 pays the first in full and ₹1.25 of the second.

**Implementation.** The posting loop visits open interest dues in date order. The dashboard displays the remaining amount. Excess interest is rejected. **Evidence.** [Ledger tests](../../tests/integration/ledger.test.mjs) · [Dashboard arithmetic](../../src/lib/dashboardCalculations.ts)

### 9. When can collateral be released?

**Simple answer.** The loan becomes closed once principal and all issued collectible dues have been settled. The register excludes closed loans from the held portfolio.

**Example.** Paying all the principal while ₹19 interest is still open leaves the loan open.

**Implementation.** Posting evaluates closure inside the transaction. This is a financial state transition. The application does not record physical handover signatures. **Evidence.** [Closure test](../../tests/integration/ledger.test.mjs) · [Inventory](../../src/pages/AssetInventory.tsx)

### 10. What if the network fails after a payment commits?

**Simple answer.** Retrying the same intent can return the original receipt. The database compares both the request identifier and the submitted terms.

**Example.** Repeating a ₹100 request after losing its response returns the same receipt ID. Changing that request to ₹200 fails.

**Implementation.** The tab retains an opaque ID until acknowledgement. PostgreSQL enforces uniqueness within the organization. A new tab or manually re-entered collection with a fresh ID is a separate intent. Reconcile the ledger if the original tab's state was lost. **Evidence.** [Form posting](../../src/hooks/usePaymentPosting.ts) · [Retry tests](../../tests/integration/ledger.test.mjs)

### 11. How are simultaneous collections handled?

**Simple answer.** Each PostgreSQL transaction locks the affected loan while computing its balance. The next writer sees the result of the preceding transaction.

**Example.** Concurrent ₹100 and ₹200 repayments against ₹1,000 leave ₹700 and two receipts.

**Implementation.** The integration test makes independent concurrent HTTP requests and reads the resulting loan and receipts. The demo uses a local snapshot and has a different durability boundary. **Evidence.** [API concurrency test](../../tests/integration/ledger.test.mjs) · [Demo ledger](../../src/data/demo/demoStorage.ts)

### 12. What does row-level security protect?

**Simple answer.** A database policy determines which rows a role can see or change. Ordinary shop users see rows associated with their profile's organization.

**Example.** A query for another shop's loan returns no rows. A direct balance edit lacks the required column grant.

**Implementation.** Role grants, RLS, tenant-aware foreign keys and checks inside privileged functions work together. **Evidence.** [Membership migration](../../supabase/migrations/20261119000100_membership.sql) · [Two-actor tests](../../tests/integration/tenants.test.mjs)

### 13. How does a borrower photo stay private?

**Simple answer.** The object belongs in a private bucket under its parent's ID. Authorized viewers receive a short-lived signed URL.

**Example.** A user in shop A can replace a file under its customer but cannot sign a URL for shop B's customer file.

**Implementation.** Storage policies bind the first folder segment to the actual customer or loan. Signing failure shows a placeholder. Treat each valid signed URL as a temporary bearer credential. **Evidence.** [Storage client](../../src/data/supabase/supabaseProvider.ts) · [Storage API operations](../../tests/integration/tenants.test.mjs)

### 14. Who can start monthly assessment?

**Simple answer.** An operator-configured scheduler invokes an Edge Function using a separate server-side secret. The function checks the method, configuration and credential before initializing its privileged client.

**Example.** A missing secret yields 401 without changing any loan or notice.

**Implementation.** The Deno entrypoint calls the service-only assessment RPC after the check. The schedule itself is configured externally. **Evidence.** [Entrypoint](../../supabase/functions/generate-dues/index.ts) · [Handler tests](../../src/lib/scheduler.test.ts) · [Local Edge integration](../../tests/integration/edge.test.mjs)

### 15. How do short months and missed runs work?

**Simple answer.** Each period uses the original start day capped to that month's last day. A late run catches up outstanding periods under a loan lock.

**Example.** January 31 becomes February 29 in 2024, then March 31. February 2025 ends on the 28th.

**Implementation.** A unique key protects each loan, due date and due type. The schedule advances in the same transaction as assessment. The date convention is Asia/Kolkata. **Evidence.** [Assessment SQL](../../supabase/migrations/20261119000200_ledger.sql) · [Failure and calendar tests](../../tests/integration/scheduler.test.mjs)

### 16. Does a second scheduler run send the same email again?

**Simple answer.** A due generates at most one automatic internal notice. Workers claim eligible notices before contacting the provider.

**Example.** Two workers can compete for one notice and only one gets its recipient. A timeout leaves an uncertain outcome for reconciliation.

**Implementation.** Unique due IDs, row locks and recorded attempt states protect retries. Provider acceptance gives no proof of inbox delivery. **Evidence.** [Mail claim](../../supabase/migrations/20261119000300_scheduler.sql) · [Fake transport tests](../../src/lib/dueMail.test.ts)

### 17. What survives disconnection or restart?

**Simple answer.** A loaded demo can change sample records offline and read them again when the browser restarts. Remote operations require connectivity.

**Example.** The mobile browser test saves a synthetic customer offline, reopens the same profile and finds the customer.

**Implementation.** Demo records use localForage. A generated public-asset allowlist supports the offline shell. Financial submissions have no remote offline replay. **Evidence.** [Service worker](../../public/sw.js) · [Browser test](../../tests/offline.spec.ts)

### 18. How should I interpret the verification?

**Simple answer.** Arithmetic tests, Chromium workflows and local Supabase requests address different failure modes. Inspect the command, revision and artifact for the claim of interest.

**Example.** Inspect the database integration case for the ₹700 result, and the browser case for a user seeing the changed balance.

**Implementation.** The verification script captures command outcomes and JUnit reports. A disposable upgrade fixture checks a representative existing catalog. Hosted infrastructure, legacy cash reconciliation and real email delivery remain operator responsibilities. **Evidence.** [Verification report](../verification/TEST_VERIFICATION.md) · [Claim matrix](../verification/CLAIM_MATRIX.md)
