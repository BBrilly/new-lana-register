-- Create admin_users table
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nostr_hex_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.main_wallets mw
    INNER JOIN public.admin_users au ON mw.nostr_hex_id = au.nostr_hex_id
    WHERE mw.user_id = _user_id
  )
$$;

-- Create policy for reading admin list (only admins can see it)
CREATE POLICY "Admins can view admin list"
ON public.admin_users
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Create policy for inserting admins (only admins can add new admins)
CREATE POLICY "Admins can add new admins"
ON public.admin_users
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- Create policy for deleting admins (only admins can remove admins)
CREATE POLICY "Admins can remove admins"
ON public.admin_users
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_admin_users_nostr_hex_id ON public.admin_users(nostr_hex_id);