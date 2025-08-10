# PawnTrack — Pawnshop Management PWA (Supabase)

PawnTrack is a private mortgage/pawnshop management system. It runs as a responsive PWA and uses Supabase (Postgres + Auth + Edge Functions) as the backend. Core features: customers, loans, payments, monthly interest dues, overdue alerts, CSV/PDF exports, notifications, and offline-first CRUD with sync.

## Tech
- Frontend: React + Vite + TypeScript + Tailwind (shadcn-ui)
- Backend: Supabase (Postgres tables + RLS + Edge Functions)
- PWA: manifest + service worker (offline cache)

## Quick start

1) Prereqs
- Node 18+
- Supabase CLI installed: https://supabase.com/docs/guides/cli

2) Install deps
```
npm i
```

3) Start Supabase locally
```
supabase start
supabase link --project-ref <your-project-ref> # optional if using remote
supabase db reset -f # applies schema and seeds automatically if linked project is local; otherwise run files below
```

4) Apply schema + seed (if not using db reset)
```
supabase db push --file supabase/schema.sql
psql "$(supabase status -o json | jq -r .db.url)" -f supabase/seed.sql
```

5) Configure Edge Function
- Set secrets (required for function):
```
supabase secrets set SUPABASE_URL=<your-supabase-url>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role>
# Optional for email via SendGrid
supabase secrets set SENDGRID_API_KEY=<your-sendgrid-api-key>
```
- Deploy function:
```
supabase functions deploy generate-dues --project-ref <your-project-ref> --no-verify-jwt
```

6) Schedule daily run
- Supabase Scheduler (if available): create a daily job hitting the function URL.
- Or GitHub Actions cron to curl the function endpoint daily.

7) Run the app
```
npm run dev
```

Login/Signup: Create an account on first run. The app creates your profile and links you to the demo organization so you can see seeded data.

## Monthly interest calculation
Simple monthly interest:
```
interest = remaining_principal * (interest_rate_percent / 100)
```
Rounded to 2 decimals (see src/lib/interest.ts with unit test).

## Offline-first
- Operations queue to local storage via localforage (src/lib/offlineQueue.ts)
- When offline, creates are queued and retried when back online.

## Export
- CSV via PapaParse; PDF via jsPDF.

## Tests
- Unit test: src/lib/interest.test.ts (Vitest)
- E2E skeleton: tests/e2e.spec.ts (Playwright)

Run unit tests:
```
npx vitest run
```

## Security & RLS
- All tables are org-scoped with RLS policies. Users only see data for their org via profiles.org_id.
- SERVICE_ROLE_KEY used only in Edge Functions.

## Directory
- supabase/schema.sql — tables + RLS
- supabase/seed.sql — sample org, customers, loans, payments
- edge-functions/generate-dues/index.ts — daily dues generation + optional email
- public/manifest.webmanifest, public/sw.js — PWA
- src/pages — UI pages
- src/lib/offlineQueue.ts — offline queue
- src/lib/interest.ts — interest util

## Acceptance checklist
- [ ] Signup and sign in works; profile created
- [ ] Create customer; appears in list
- [ ] Create loan; next due set 1 month after start
- [ ] Record payment
- [ ] Reports export CSV/PDF
- [ ] Edge function runs; dues created; overdue marked
- [ ] Notification appears after dues generation
- [ ] Offline create (disable network), then re-enable; data syncs
- [ ] PWA installable; basic offline navigation works
