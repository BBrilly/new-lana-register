-- Create main_wallets table
CREATE TABLE public.main_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nostr_hex_id TEXT NOT NULL,
  name TEXT NOT NULL,
  profile_pic_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wallets table (child of main_wallets)
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  main_wallet_id UUID NOT NULL REFERENCES public.main_wallets(id) ON DELETE CASCADE,
  wallet_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.main_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- RLS policies for main_wallets
CREATE POLICY "Users can view their own main wallets"
  ON public.main_wallets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own main wallets"
  ON public.main_wallets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own main wallets"
  ON public.main_wallets
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own main wallets"
  ON public.main_wallets
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for wallets (access through main_wallet ownership)
CREATE POLICY "Users can view wallets from their main wallets"
  ON public.wallets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.main_wallets
      WHERE main_wallets.id = wallets.main_wallet_id
      AND main_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create wallets for their main wallets"
  ON public.wallets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.main_wallets
      WHERE main_wallets.id = wallets.main_wallet_id
      AND main_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update wallets from their main wallets"
  ON public.wallets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.main_wallets
      WHERE main_wallets.id = wallets.main_wallet_id
      AND main_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete wallets from their main wallets"
  ON public.wallets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.main_wallets
      WHERE main_wallets.id = wallets.main_wallet_id
      AND main_wallets.user_id = auth.uid()
    )
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_main_wallets_updated_at
  BEFORE UPDATE ON public.main_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();