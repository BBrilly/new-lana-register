-- Add user_id column to main_wallets table
ALTER TABLE public.main_wallets 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_main_wallets_user_id ON public.main_wallets(user_id);

-- Update is_admin function to handle null user_id gracefully
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.main_wallets mw
    INNER JOIN public.admin_users au ON mw.nostr_hex_id = au.nostr_hex_id
    WHERE mw.user_id = _user_id
  )
$$;