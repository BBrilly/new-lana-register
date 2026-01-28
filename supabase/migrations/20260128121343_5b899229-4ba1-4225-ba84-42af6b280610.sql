-- Table to track monthly subscription proposals sent
CREATE TABLE public.subscription_proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    main_wallet_id uuid NOT NULL REFERENCES public.main_wallets(id),
    nostr_hex_id text NOT NULL,
    proposal_month text NOT NULL, -- Format: "YYYY-MM" e.g. "2025-01"
    amount_eur numeric NOT NULL,
    amount_lana numeric NOT NULL,
    amount_lanoshi bigint NOT NULL,
    exchange_rate numeric NOT NULL,
    nostr_event_id text,
    published_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(nostr_hex_id, proposal_month)
);

-- Enable RLS
ALTER TABLE public.subscription_proposals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view subscription proposals"
ON public.subscription_proposals FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert subscription proposals"
ON public.subscription_proposals FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update subscription proposals"
ON public.subscription_proposals FOR UPDATE
USING (auth.role() = 'authenticated');

-- Add app_settings entries
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('registered_lana_wallet', 'LTpv5j4NYmzVF4LPKC6irwc4xvAZkfXjEg', 'Wallet address for receiving subscription payments'),
    ('currency_code', 'EUR', 'Default currency code for subscription fees'),
    ('subscription_fee', '3.00', 'Monthly subscription fee in EUR for Lana8Wonder users')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();