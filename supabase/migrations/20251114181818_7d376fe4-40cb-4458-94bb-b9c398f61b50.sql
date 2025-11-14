-- Make user_id nullable in main_wallets so cron job can sync unclaimed wallets
ALTER TABLE public.main_wallets ALTER COLUMN user_id DROP NOT NULL;