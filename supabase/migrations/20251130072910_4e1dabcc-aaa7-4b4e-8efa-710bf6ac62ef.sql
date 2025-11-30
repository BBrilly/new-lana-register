-- Add name and display_name fields to main_wallets table
ALTER TABLE public.main_wallets
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.main_wallets.name IS 'User name from Nostr KIND 0 profile';
COMMENT ON COLUMN public.main_wallets.display_name IS 'Display name from Nostr KIND 0 profile';