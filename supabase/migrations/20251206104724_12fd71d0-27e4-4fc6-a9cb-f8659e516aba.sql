-- Create app_settings table for storing application configuration including NOSTR signing keys
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view settings
CREATE POLICY "Authenticated can view app_settings" 
ON public.app_settings 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Only admins can manage settings
CREATE POLICY "Admins can insert app_settings" 
ON public.app_settings 
FOR INSERT 
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update app_settings" 
ON public.app_settings 
FOR UPDATE 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete app_settings" 
ON public.app_settings 
FOR DELETE 
USING (public.is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert placeholder for NOSTR registrar private key (nsec format)
INSERT INTO public.app_settings (key, value, description)
VALUES ('nostr_registrar_nsec', '', 'NOSTR private key in nsec1... format for signing Kind 87005 events');

-- Add columns to registered_lana_events for tracking Kind 87005 publishing
ALTER TABLE public.registered_lana_events
ADD COLUMN IF NOT EXISTS nostr_87005_published boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS nostr_87005_event_id text,
ADD COLUMN IF NOT EXISTS nostr_87005_published_at timestamp with time zone;

-- Create index for efficient querying of unpublished events
CREATE INDEX IF NOT EXISTS idx_registered_lana_events_unpublished
ON public.registered_lana_events (nostr_87005_published)
WHERE nostr_87005_published = false;