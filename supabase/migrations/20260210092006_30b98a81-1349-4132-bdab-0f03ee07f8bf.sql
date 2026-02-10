
ALTER TABLE public.unregistered_lana_events
ADD COLUMN nostr_dm_sent boolean DEFAULT false,
ADD COLUMN nostr_dm_event_id text;
