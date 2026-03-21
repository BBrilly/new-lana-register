CREATE TABLE public.admin_registration_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  justification TEXT NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  approved_by_nostr_hex TEXT,
  unregistered_senders TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_registration_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view overrides" ON public.admin_registration_overrides FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated can insert overrides" ON public.admin_registration_overrides FOR INSERT TO authenticated WITH CHECK (true);