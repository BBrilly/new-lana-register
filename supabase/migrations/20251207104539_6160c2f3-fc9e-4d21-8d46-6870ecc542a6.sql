-- Add "is_owned" field to main_wallets table (default true)
ALTER TABLE public.main_wallets
ADD COLUMN is_owned boolean NOT NULL DEFAULT true;