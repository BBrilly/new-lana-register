-- Create registered_lana_events table for Knights wallet transactions
CREATE TABLE public.registered_lana_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  notes TEXT,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  split INTEGER NOT NULL,
  block_id INTEGER,
  transaction_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.registered_lana_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view registered events"
  ON public.registered_lana_events FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert registered events"
  ON public.registered_lana_events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update registered events"
  ON public.registered_lana_events FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete registered events"
  ON public.registered_lana_events FOR DELETE
  USING (auth.role() = 'authenticated');