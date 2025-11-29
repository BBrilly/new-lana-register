-- Create wallet_types table
CREATE TABLE public.wallet_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallet_types ENABLE ROW LEVEL SECURITY;

-- Create policy - everyone can read wallet types
CREATE POLICY "Anyone can view wallet types"
ON public.wallet_types
FOR SELECT
USING (true);

-- Insert the 4 wallet type options
INSERT INTO public.wallet_types (name) VALUES
  ('Wallet'),
  ('LanaPays.Us'),
  ('Lana8Wonder'),
  ('Main Wallet');