

## Plan: Include Frozen Wallets in Hourly Balance Snapshot

### Problem
Line 152 in `blockchain-monitor/index.ts` filters `.eq('frozen', false)`, excluding frozen wallets from the hourly snapshot count and balance.

### Fix
Remove the `.eq('frozen', false)` filter on line 152 so that **all** wallets (frozen + active) are included in the snapshot.

### File to modify
- **`supabase/functions/blockchain-monitor/index.ts`** — Remove line 152 (`.eq('frozen', false)`)

One-line change, redeploy.

