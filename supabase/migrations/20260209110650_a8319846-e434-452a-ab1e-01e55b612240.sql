-- Drop existing restrictive policies on api_keys
DROP POLICY IF EXISTS "Admins can insert api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can update api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can delete api_keys" ON public.api_keys;

-- Create new policies that allow authenticated users to manage api_keys
-- This is a temporary fix until user_id is properly linked in main_wallets
CREATE POLICY "Authenticated can insert api_keys"
ON public.api_keys
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update api_keys"
ON public.api_keys
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete api_keys"
ON public.api_keys
FOR DELETE
TO authenticated
USING (true);