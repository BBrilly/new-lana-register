-- Add columns for tracking Nostr Kind 87003 publication to unregistered_lana_events
ALTER TABLE public.unregistered_lana_events
ADD COLUMN IF NOT EXISTS nostr_87003_published boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS nostr_87003_event_id text,
ADD COLUMN IF NOT EXISTS nostr_87003_published_at timestamp with time zone;