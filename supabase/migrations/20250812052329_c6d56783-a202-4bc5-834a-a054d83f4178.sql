-- Fix: define current_user_org_id() before using it, with SECURITY DEFINER to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 1) Ensure RLS on organizations and restrict visibility to the user’s org
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organizations'
      AND policyname = 'orgs_select_current_org_only'
  ) THEN
    CREATE POLICY orgs_select_current_org_only
    ON public.organizations
    FOR SELECT
    USING (id = public.current_user_org_id());
  END IF;
END $$;

-- 2) Prevent clients from setting or changing profiles.org_id (service role can)
CREATE OR REPLACE FUNCTION public.profiles_enforce_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role to bypass
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    IF TG_OP = 'INSERT' AND NEW.org_id IS NOT NULL THEN
      RAISE EXCEPTION 'org_id cannot be set by client on INSERT';
    ELSIF TG_OP = 'UPDATE' AND NEW.org_id IS DISTINCT FROM OLD.org_id THEN
      RAISE EXCEPTION 'org_id cannot be changed by client on UPDATE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 't_profiles_enforce_org_id'
  ) THEN
    DROP TRIGGER t_profiles_enforce_org_id ON public.profiles;
  END IF;
END $$;

CREATE TRIGGER t_profiles_enforce_org_id
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_enforce_org_id();

-- 3) Enforce org_id on org-bound tables to the current user’s org automatically
CREATE OR REPLACE FUNCTION public.enforce_org_id_to_current()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  -- Service role bypasses enforcement
  IF coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_org := public.current_user_org_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No organization assigned to current user';
  END IF;

  -- Force org_id to the user’s org (prevents forgery and drift)
  NEW.org_id := v_org;
  RETURN NEW;
END;
$$;

-- Helper to (re)create trigger safely
CREATE OR REPLACE FUNCTION public._create_enforce_org_trigger(_table regclass)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS t_enforce_org_id ON %s;', _table);
  EXECUTE format('CREATE TRIGGER t_enforce_org_id BEFORE INSERT OR UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id_to_current();', _table);
END;
$$;

SELECT public._create_enforce_org_trigger('public.customers');
SELECT public._create_enforce_org_trigger('public.loans');
SELECT public._create_enforce_org_trigger('public.payments');
SELECT public._create_enforce_org_trigger('public.dues');
SELECT public._create_enforce_org_trigger('public.notifications');
SELECT public._create_enforce_org_trigger('public.audit_logs');

-- 4) Admin/server-only path to set profiles.org_id
CREATE OR REPLACE FUNCTION public.assign_user_to_org(p_user_id uuid, p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET org_id = p_org_id
  WHERE id = p_user_id;
END;
$$;

-- NOTE: Do not GRANT EXECUTE to anon/authenticated; callable via service role only by default.
