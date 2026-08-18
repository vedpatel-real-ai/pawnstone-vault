-- Migration: Align loan_status enum with application types (add 'overdue')
-- Ensures Supabase PostgreSQL supports 'overdue' without enum constraint violations.

DO $$
BEGIN
  -- Check if 'overdue' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.loan_status'::regtype
      AND enumlabel = 'overdue'
  ) THEN
    ALTER TYPE public.loan_status ADD VALUE 'overdue' BEFORE 'closed';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
