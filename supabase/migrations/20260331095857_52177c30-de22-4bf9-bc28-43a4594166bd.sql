
CREATE TABLE public.balance_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  total_balance_lana NUMERIC NOT NULL DEFAULT 0,
  wallet_count INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view balance snapshots"
  ON public.balance_snapshots
  FOR SELECT
  TO public
  USING (true);
