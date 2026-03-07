CREATE POLICY "Admins can update wallets"
ON public.wallets
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));