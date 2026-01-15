-- Create api_keys table
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL,
  contact_info TEXT,
  api_key TEXT NOT NULL UNIQUE,
  can_register_lana BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 100,
  last_request_at TIMESTAMP WITH TIME ZONE,
  request_count_current_hour INTEGER NOT NULL DEFAULT 0
);

-- Add comment
COMMENT ON TABLE public.api_keys IS 'API keys for external services to access registration endpoints';

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view api_keys"
ON public.api_keys
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert api_keys"
ON public.api_keys
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update api_keys"
ON public.api_keys
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete api_keys"
ON public.api_keys
FOR DELETE
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();