-- Create table for tracking batch import progress
CREATE TABLE public.batch_wallet_import_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  main_wallets_synced BIGINT DEFAULT 0,
  total_wallets_synced BIGINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying of pending/failed batches
CREATE INDEX idx_batch_status ON public.batch_wallet_import_status(status, start_date);

-- Add trigger for updated_at
CREATE TRIGGER update_batch_wallet_import_status_updated_at
  BEFORE UPDATE ON public.batch_wallet_import_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.batch_wallet_import_status ENABLE ROW LEVEL SECURITY;

-- Admin read policy
CREATE POLICY "Admins can view batch import status"
  ON public.batch_wallet_import_status
  FOR SELECT
  USING (true);

-- Generate batch records from today back to August 1, 2025 in 5-day intervals
DO $$
DECLARE
  current_end_date TIMESTAMP WITH TIME ZONE := date_trunc('day', now());
  current_start_date TIMESTAMP WITH TIME ZONE;
  target_date TIMESTAMP WITH TIME ZONE := '2025-08-01'::TIMESTAMP WITH TIME ZONE;
BEGIN
  WHILE current_end_date >= target_date LOOP
    current_start_date := current_end_date - INTERVAL '5 days';
    
    -- Ensure we don't go before target date
    IF current_start_date < target_date THEN
      current_start_date := target_date;
    END IF;
    
    INSERT INTO public.batch_wallet_import_status (start_date, end_date, status)
    VALUES (current_start_date, current_end_date, 'pending');
    
    current_end_date := current_start_date - INTERVAL '1 second';
  END LOOP;
END $$;