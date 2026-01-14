-- Add registration_source column to wallets table
ALTER TABLE public.wallets 
ADD COLUMN IF NOT EXISTS registration_source text DEFAULT NULL;

COMMENT ON COLUMN public.wallets.registration_source IS 'Source of wallet registration: api_virgin_bulk, manual, sync, etc.';