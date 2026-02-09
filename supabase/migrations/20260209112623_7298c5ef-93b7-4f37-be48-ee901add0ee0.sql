
-- Disable RLS on api_keys since the admin panel already handles access control
ALTER TABLE public.api_keys DISABLE ROW LEVEL SECURITY;
