-- Add visible_in_form column to wallet_types table
ALTER TABLE public.wallet_types 
ADD COLUMN visible_in_form boolean NOT NULL DEFAULT true;

-- Set visibility for specific wallet types
UPDATE public.wallet_types 
SET visible_in_form = false 
WHERE name IN ('Lana8Wonder', 'Main Wallet');

UPDATE public.wallet_types 
SET visible_in_form = true 
WHERE name IN ('Wallet', 'LanaPays.Us');