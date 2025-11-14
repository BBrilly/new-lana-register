-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Admins can view admin list" ON admin_users;

-- Create new public SELECT policy that allows anyone to read admin list
-- This is safe because Nostr hex IDs are public information
CREATE POLICY "Anyone can view admin list"
ON admin_users
FOR SELECT
TO authenticated, anon
USING (true);