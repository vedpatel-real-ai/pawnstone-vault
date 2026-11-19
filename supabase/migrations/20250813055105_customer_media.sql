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

-- The next version installs the four object policies.
