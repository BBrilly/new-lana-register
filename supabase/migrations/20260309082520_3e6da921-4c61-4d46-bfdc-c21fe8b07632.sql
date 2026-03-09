ALTER TABLE public.system_parameters
ADD COLUMN IF NOT EXISTS freeze_lana_account_above text,
ADD COLUMN IF NOT EXISTS max_cap_lanas_on_split text,
ADD COLUMN IF NOT EXISTS split_target_lana text,
ADD COLUMN IF NOT EXISTS split_started_at text,
ADD COLUMN IF NOT EXISTS split_ends_at text;