-- Drop old RLS policies on main_wallets first
DROP POLICY IF EXISTS "Users can view their own main wallets" ON main_wallets;
DROP POLICY IF EXISTS "Users can create their own main wallets" ON main_wallets;
DROP POLICY IF EXISTS "Users can update their own main wallets" ON main_wallets;
DROP POLICY IF EXISTS "Users can delete their own main wallets" ON main_wallets;

-- Drop old RLS policies on wallets
DROP POLICY IF EXISTS "Users can view wallets from their main wallets" ON wallets;
DROP POLICY IF EXISTS "Users can create wallets for their main wallets" ON wallets;
DROP POLICY IF EXISTS "Users can update wallets from their main wallets" ON wallets;
DROP POLICY IF EXISTS "Users can delete wallets from their main wallets" ON wallets;

-- Now remove user_id column from main_wallets
ALTER TABLE main_wallets DROP COLUMN IF EXISTS user_id;

-- Create new public read policy for main_wallets
CREATE POLICY "Anyone can view main wallets" ON main_wallets
  FOR SELECT USING (true);

-- Create new public read policy for wallets
CREATE POLICY "Anyone can view wallets" ON wallets
  FOR SELECT USING (true);