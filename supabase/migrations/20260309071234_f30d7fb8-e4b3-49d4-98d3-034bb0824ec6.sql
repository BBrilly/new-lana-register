
DROP POLICY "Admins can insert app_settings" ON public.app_settings;
DROP POLICY "Admins can update app_settings" ON public.app_settings;
DROP POLICY "Admins can delete app_settings" ON public.app_settings;

CREATE POLICY "Admins can insert app_settings" ON public.app_settings
FOR INSERT TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update app_settings" ON public.app_settings
FOR UPDATE TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete app_settings" ON public.app_settings
FOR DELETE TO authenticated
USING (is_admin(auth.uid()));
