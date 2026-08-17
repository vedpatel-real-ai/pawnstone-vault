# PawnTrack — Pawnshop Management System

PawnTrack is a private mortgage/pawnshop management system with real-time KPI tracking, loan management, customer profiles, payment recording, and asset inventory.

It supports two modes:
1. **Self-Contained Demo Mode (Default)**: Runs completely in your browser using IndexedDB local storage (`localforage`). No remote database, account registration, or API keys needed.
2. **Supabase Mode**: Connects to a full Supabase backend (PostgreSQL + Auth + Storage + Edge Functions) with Row Level Security.

---

## Features

- **Dashboard & KPIs**: Real-time totals for active loans, overdue loans, monthly interest dues, payments collected, and asset distribution charts.
- **Customer Management**: Full CRUD for customer profiles with photo uploads, ID proof attachment, contact details, and linked loan histories.
- **Loan Lifecycle**: Create, edit, track, and close loans with monthly interest calculations and pledged asset photos.
- **Payment Recording**: Record interest and principal payments with immediate balance updates.
- **Asset Inventory**: Real-time listing of active pledged collateral (gold, vehicles, properties, etc.).
- **Reports & Export**: Export loan lists and interest dues to CSV or formatted PDF.
- **Offline Resilience**: Offline queue using IndexedDB syncs operations when online.

---

## Deploy to Vercel

PawnTrack is configured for 1-click deployment on [Vercel](https://vercel.com).

### Method 1: Via Vercel Dashboard (Recommended)
1. Push this repository to GitHub/GitLab/Bitbucket.
2. Go to [vercel.com/new](https://vercel.com/new) and import your repository.
3. Vercel will automatically detect **Vite** as the framework and `dist` as the output directory.
4. (Optional) If using Supabase, add environment variables in **Project Settings → Environment Variables**:
   - `VITE_DATA_MODE` = `supabase`
   - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-key`
   *(If you leave environment variables empty, it will run in standalone Demo Mode!)*
5. Click **Deploy**.

### Method 2: Via Vercel CLI
```bash
npm i -g vercel
vercel
```

---

## Quick Start (Local Demo Mode)

Demo mode works immediately out of the box without any setup or backend connection.

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Explore the app**:
   - Navigate to `http://localhost:8080` (or `http://localhost:5173`)
   - Click **"🔑 Use Demo Account"** (or use `demo@pawntrack.app` / `demo123`)
   - Explore populated customers, loans, overdue alerts, and charts.
   - Use **"Reset Demo Data"** in the top navigation bar at any time to restore the initial sample dataset.

---

## Supabase Mode (Production / Custom Backend)

To connect PawnTrack to a live Supabase backend:

1. **Configure Environment Variables**:
   Create a `.env.local` file:
   ```bash
   VITE_DATA_MODE="supabase"
   VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
   ```

2. **Apply Database Schema**:
   Run the schema in your Supabase SQL editor:
   - `supabase/schema.sql` (Tables, types, RLS policies, trigger functions)
   - `supabase/seed.sql` (Initial organization and test data)

3. **Deploy Edge Functions (Optional for scheduled dues)**:
   ```bash
   supabase functions deploy generate-dues --project-ref <your-project-ref> --no-verify-jwt
   ```

---

## Architecture

PawnTrack uses a clean **Data Provider Abstraction** layer (`src/data/`):

```
UI Pages & Components (Dashboard, Customers, Loans, Payments, etc.)
                   │
                   ▼
       DataProvider Interface (src/data/dataProvider.ts)
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
    DemoProvider      SupabaseProvider
(IndexedDB / Local)   (Supabase Client)
```

- `src/data/types.ts`: Canonical application entity models.
- `src/data/dataProvider.ts`: Provider contract covering auth, CRUD, storage, and queries.
- `src/data/demo/`: Browser-local demo provider, seed dataset generator, and localforage storage engine.
- `src/data/supabase/`: Supabase provider wrapping client calls and storage buckets.

---

## Testing

Run unit tests (Vitest):
```bash
npx vitest run
```

Run production build:
```bash
npm run build
```
