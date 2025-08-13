-- 1) Extend customers table for richer data and media paths
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS alt_phone text,
  ADD COLUMN IF NOT EXISTS id_proof_number text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS id_proof_url text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Helpful indexes for search
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers (name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone);
CREATE INDEX IF NOT EXISTS idx_customers_alt_phone ON public.customers (alt_phone);
CREATE INDEX IF NOT EXISTS idx_customers_id_proof_number ON public.customers (id_proof_number);

-- 2) Create private storage bucket for customer media
INSERT INTO storage.buckets (id, name, public)
VALUES ('customers', 'customers', false)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage policies so org members can manage files for their own customers only
-- Object name convention in bucket: "{customer_id}/profile_photo.jpg" or "{customer_id}/id_proof.jpg|pdf"
-- (storage.foldername(name))[1] yields the first path segment which is customer_id

-- SELECT policy
CREATE POLICY IF NOT EXISTS "Org members can read their customer files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'customers'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.org_id = public.current_user_org_id()
  )
);

-- INSERT policy
CREATE POLICY IF NOT EXISTS "Org members can insert their customer files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'customers'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.org_id = public.current_user_org_id()
  )
);

-- UPDATE policy
CREATE POLICY IF NOT EXISTS "Org members can update their customer files"
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

-- DELETE policy
CREATE POLICY IF NOT EXISTS "Org members can delete their customer files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'customers'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.org_id = public.current_user_org_id()
  )
);
