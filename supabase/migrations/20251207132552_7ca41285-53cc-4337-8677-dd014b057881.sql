-- Update RLS policy for app_settings to allow public SELECT access
DROP POLICY IF EXISTS "Authenticated can view app_settings" ON public.app_settings;

CREATE POLICY "Anyone can view app_settings" 
ON public.app_settings 
FOR SELECT 
USING (true);