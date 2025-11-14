-- Create table for KIND 38888 system parameters
CREATE TABLE IF NOT EXISTS public.system_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  pubkey TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  relays JSONB NOT NULL,
  electrum JSONB NOT NULL,
  fx JSONB NOT NULL,
  split TEXT NOT NULL,
  version TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  trusted_signers JSONB NOT NULL,
  raw_event JSONB NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_parameters ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read system parameters (public data)
CREATE POLICY "Anyone can read system parameters"
  ON public.system_parameters
  FOR SELECT
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_system_parameters_version ON public.system_parameters(version DESC);
CREATE INDEX IF NOT EXISTS idx_system_parameters_created_at ON public.system_parameters(created_at DESC);