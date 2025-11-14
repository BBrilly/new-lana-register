-- Add wallet_id column to main_wallets (LanaCoin Base58 address)
ALTER TABLE public.main_wallets ADD COLUMN IF NOT EXISTS wallet_id TEXT;

-- Add unique constraint on nostr_hex_id
ALTER TABLE public.main_wallets DROP CONSTRAINT IF EXISTS main_wallets_nostr_hex_id_key;
ALTER TABLE public.main_wallets ADD CONSTRAINT main_wallets_nostr_hex_id_key UNIQUE (nostr_hex_id);

-- Add unique constraint on wallet_id
ALTER TABLE public.main_wallets DROP CONSTRAINT IF EXISTS main_wallets_wallet_id_key;
ALTER TABLE public.main_wallets ADD CONSTRAINT main_wallets_wallet_id_key UNIQUE (wallet_id);

-- Add status column to main_wallets
ALTER TABLE public.main_wallets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add wallet_id column to wallets (LanaCoin Base58 address)
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS wallet_id TEXT;

-- Add unique constraint on wallet_id in wallets table
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_wallet_id_key;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_wallet_id_key UNIQUE (wallet_id);

-- Add amount_unregistered_lanoshi column to wallets
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS amount_unregistered_lanoshi BIGINT DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_main_wallets_nostr_hex_id ON public.main_wallets(nostr_hex_id);
CREATE INDEX IF NOT EXISTS idx_main_wallets_wallet_id ON public.main_wallets(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallets_wallet_id ON public.wallets(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallets_main_wallet_id ON public.wallets(main_wallet_id);