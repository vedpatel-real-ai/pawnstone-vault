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
