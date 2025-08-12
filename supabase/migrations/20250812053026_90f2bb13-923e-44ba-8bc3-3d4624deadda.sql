-- 1) Allow safe, one-time assignment of profiles.org_id via a controlled bypass flag
CREATE OR REPLACE FUNCTION public.profiles_enforce_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role or controlled bypass to proceed
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND coalesce(current_setting('myapp.bypass_profile_org_guard', true), '') <> 'on' THEN
    IF TG_OP = 'INSERT' AND NEW.org_id IS NOT NULL THEN
      RAISE EXCEPTION 'org_id cannot be set by client on INSERT';
    ELSIF TG_OP = 'UPDATE' AND NEW.org_id IS DISTINCT FROM OLD.org_id THEN
      RAISE EXCEPTION 'org_id cannot be changed by client on UPDATE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Create a safe function to create an org and assign it to the current user (idempotent)
CREATE OR REPLACE FUNCTION public.create_org_for_current_user(p_name text DEFAULT 'My Organization')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_org uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- If already assigned, just return existing org
  SELECT org_id INTO v_org FROM public.profiles WHERE id = v_user;
  IF v_org IS NOT NULL THEN
    RETURN v_org;
  END IF;

  -- Create new organization
  INSERT INTO public.organizations(name) VALUES (p_name) RETURNING id INTO v_org;

  -- Bypass the profile org guard in a controlled way for this one update
  PERFORM set_config('myapp.bypass_profile_org_guard', 'on', true);
  UPDATE public.profiles SET org_id = v_org WHERE id = v_user;

  RETURN v_org;
END;
$$;

-- 3) Lock down the admin-only function from public access
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'assign_user_to_org'
      AND pg_get_function_identity_arguments(p.oid) = 'p_user_id uuid, p_org_id uuid'
  ) THEN
    REVOKE ALL ON FUNCTION public.assign_user_to_org(uuid, uuid) FROM PUBLIC;
  END IF;
END $$;

-- 4) Restrict new RPC to authenticated users only
REVOKE ALL ON FUNCTION public.create_org_for_current_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_org_for_current_user(text) TO authenticated;