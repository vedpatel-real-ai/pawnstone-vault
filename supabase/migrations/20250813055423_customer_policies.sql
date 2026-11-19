-- 1) Extend customers table with additional fields for CRM and media
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS alt_phone text,
  ADD COLUMN IF NOT EXISTS id_proof_number text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS id_proof_url text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Indexes for faster search/filtering
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers (name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone);
CREATE INDEX IF NOT EXISTS idx_customers_alt_phone ON public.customers (alt_phone);
CREATE INDEX IF NOT EXISTS idx_customers_id_proof_number ON public.customers (id_proof_number);

-- 2) Private storage bucket for customer media
INSERT INTO storage.buckets (id, name, public)
VALUES ('customers', 'customers', false)
ON CONFLICT (id) DO NOTHING;

-- 3) RLS policies for storage.objects (bucket: customers)
-- Ensure clean re-creation to avoid duplicates
DROP POLICY IF EXISTS "Org members can read their customer files" ON storage.objects;
DROP POLICY IF EXISTS "Org members can insert their customer files" ON storage.objects;
DROP POLICY IF EXISTS "Org members can update their customer files" ON storage.objects;
DROP POLICY IF EXISTS "Org members can delete their customer files" ON storage.objects;

-- Path inside bucket is "{customer_id}/<filename>"
-- First folder name is the customer_id
CREATE POLICY "Org members can read their customer files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'customers'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.org_id = public.current_user_org_id()
  )
);

CREATE POLICY "Org members can insert their customer files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'customers'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.org_id = public.current_user_org_id()
  )
);

CREATE POLICY "Org members can update their customer files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'customers'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.org_id = public.current_user_org_id()
  )
)
WITH CHECK (
  bucket_id = 'customers'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.org_id = public.current_user_org_id()
  )
);

CREATE POLICY "Org members can delete their customer files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'customers'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.org_id = public.current_user_org_id()
  )
);
