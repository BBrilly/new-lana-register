
DROP POLICY IF EXISTS "Admins can insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can delete app_settings" ON public.app_settings;

CREATE POLICY "Authenticated can insert app_settings" ON public.app_settings
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update app_settings" ON public.app_settings
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete app_settings" ON public.app_settings
FOR DELETE TO authenticated
USING (true);
