-- Create loan_assets table for multiple asset images per loan
CREATE TABLE IF NOT EXISTS public.loan_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  loan_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on loan_assets
ALTER TABLE public.loan_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for loan_assets
DROP POLICY IF EXISTS "org_member_access_loan_assets" ON public.loan_assets;
CREATE POLICY "org_member_access_loan_assets" ON public.loan_assets 
FOR ALL 
USING (org_id = ( SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid()));

-- Add trigger for org_id enforcement on loan_assets
SELECT public._create_enforce_org_trigger('public.loan_assets'::regclass);

-- Create loan_assets storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('loan_assets', 'loan_assets', false) ON CONFLICT (id) DO UPDATE SET public = false;

-- Create storage policies for loan_assets bucket
DROP POLICY IF EXISTS "Users can view their org loan assets" ON storage.objects;
CREATE POLICY "Users can view their org loan assets" ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'loan_assets' 
  AND (storage.foldername(name))[1] IN (
    SELECT loans.id::text 
    FROM loans 
    WHERE loans.org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can upload their org loan assets" ON storage.objects;
CREATE POLICY "Users can upload their org loan assets" ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'loan_assets' 
  AND (storage.foldername(name))[1] IN (
    SELECT loans.id::text 
    FROM loans 
    WHERE loans.org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update their org loan assets" ON storage.objects;
CREATE POLICY "Users can update their org loan assets" ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'loan_assets' 
  AND (storage.foldername(name))[1] IN (
    SELECT loans.id::text 
    FROM loans 
    WHERE loans.org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete their org loan assets" ON storage.objects;
CREATE POLICY "Users can delete their org loan assets" ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'loan_assets' 
  AND (storage.foldername(name))[1] IN (
    SELECT loans.id::text 
    FROM loans 
    WHERE loans.org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid())
  )
);

-- Add due_date column to loans table if it doesn't exist
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS due_date DATE;