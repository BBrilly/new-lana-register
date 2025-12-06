-- Create deleted_wallets table for tracking removed Knight wallets
CREATE TABLE public.deleted_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id TEXT,
  original_wallet_uuid UUID,
  nostr_hex_id TEXT NOT NULL,
  main_wallet_id UUID,
  wallet_type TEXT,
  reason TEXT NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deleted_wallets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view deleted wallets" 
ON public.deleted_wallets 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated can insert deleted wallets" 
ON public.deleted_wallets 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Add index for faster lookups
CREATE INDEX idx_deleted_wallets_nostr_hex_id ON public.deleted_wallets(nostr_hex_id);
CREATE INDEX idx_deleted_wallets_deleted_at ON public.deleted_wallets(deleted_at DESC);