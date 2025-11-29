-- Remove batch wallet import status functionality
-- This removes the manual batch import system while keeping sync-wallet-kind-30889 cron

-- Drop RLS policies
DROP POLICY IF EXISTS "Admins can view batch import status" ON public.batch_wallet_import_status;

-- Drop trigger
DROP TRIGGER IF EXISTS update_batch_wallet_import_status_updated_at ON public.batch_wallet_import_status;

-- Drop index
DROP INDEX IF EXISTS public.idx_batch_status;

-- Drop table
DROP TABLE IF EXISTS public.batch_wallet_import_status;
