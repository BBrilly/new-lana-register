
-- Drop ALL existing policies on api_keys (both old and new)
DROP POLICY IF EXISTS "Anyone can view api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Authenticated can insert api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Authenticated can update api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Authenticated can delete api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can insert api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can update api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can delete api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Authenticated can insert/update/delete api_keys" ON public.api_keys;

-- Recreate all policies as PERMISSIVE (default)
CREATE POLICY "Anyone can view api_keys"
ON public.api_keys FOR SELECT
USING (true);

CREATE POLICY "Authenticated can insert api_keys"
ON public.api_keys FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update api_keys"
ON public.api_keys FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete api_keys"
ON public.api_keys FOR DELETE
TO authenticated
USING (true);
