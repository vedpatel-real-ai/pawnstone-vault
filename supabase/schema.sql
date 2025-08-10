-- PawnTrack Supabase schema and RLS policies
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper: current user's organization
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Profiles (links to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY, -- equal to auth.uid()
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  created_at timestamptz DEFAULT now()
);

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  created_at timestamptz DEFAULT now()
);

-- Loans
DO $$ BEGIN
  CREATE TYPE public.loan_status AS ENUM ('active','closed','defaulted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  asset_type text, -- e.g., 'gold','car','documents'
  asset_description text,
  asset_value numeric(12,2),
  loan_amount numeric(12,2) NOT NULL,
  remaining_principal numeric(12,2) NOT NULL,
  interest_rate_percent numeric(5,3) NOT NULL, -- monthly percent e.g., 2.5
  start_date date NOT NULL,
  term_months int,
  next_due_date date NOT NULL,
  last_interest_calculated date,
  status public.loan_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$;

DO $$ BEGIN
  CREATE TRIGGER set_loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Payments
DO $$ BEGIN
  CREATE TYPE public.payment_type AS ENUM ('interest','principal','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  loan_id uuid REFERENCES public.loans(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  payment_date date NOT NULL DEFAULT now(),
  type public.payment_type DEFAULT 'interest',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Dues
DO $$ BEGIN
  CREATE TYPE public.due_status AS ENUM ('pending','paid','overdue','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.dues (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  loan_id uuid REFERENCES public.loans(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  due_type text NOT NULL, -- 'interest' | 'principal'
  status public.due_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_due_per_month UNIQUE (loan_id, due_date, due_type)
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  loan_id uuid REFERENCES public.loans(id),
  title text NOT NULL,
  body text,
  sent_at timestamptz,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES public.organizations(id),
  user_id uuid,
  action text,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies: organizations (read-only within user's org via membership)
CREATE POLICY orgs_read ON public.organizations
FOR SELECT USING (
  id = current_user_org_id()
);

-- Profiles: self only
CREATE POLICY profiles_select ON public.profiles
FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_insert ON public.profiles
FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update ON public.profiles
FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Generic org-bound policies
CREATE POLICY customers_all ON public.customers
FOR ALL USING (org_id = current_user_org_id()) WITH CHECK (org_id = current_user_org_id());

CREATE POLICY loans_all ON public.loans
FOR ALL USING (org_id = current_user_org_id()) WITH CHECK (org_id = current_user_org_id());

CREATE POLICY payments_all ON public.payments
FOR ALL USING (org_id = current_user_org_id()) WITH CHECK (org_id = current_user_org_id());

CREATE POLICY dues_all ON public.dues
FOR ALL USING (org_id = current_user_org_id()) WITH CHECK (org_id = current_user_org_id());

CREATE POLICY notifications_all ON public.notifications
FOR ALL USING (org_id = current_user_org_id()) WITH CHECK (org_id = current_user_org_id());

CREATE POLICY audit_logs_select ON public.audit_logs
FOR SELECT USING (org_id = current_user_org_id());
CREATE POLICY audit_logs_insert ON public.audit_logs
FOR INSERT WITH CHECK (org_id = current_user_org_id());
