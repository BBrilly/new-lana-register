
## Plan: Persist freeze_reason from Nostr relay sync

### Problem
The `sync-wallet-kind-30889` edge function parses `freeze_status` from KIND 30889 w-tag's 7th field but only writes `frozen: true/false` to the database. It does not write the `freeze_status` value into the `freeze_reason` column. This causes all frozen wallets to display "Unknown" as their reason.

### Fix

**1. `supabase/functions/sync-wallet-kind-30889/index.ts`** (line ~270-283)
- Add `freeze_reason: wallet.freeze_status` to the upsert payload so the reason code from the relay is persisted.

That's the only change needed. The UI already reads `freeze_reason` from the database and maps it via `FREEZE_LABELS`. Once the sync function writes the value, both the admin Frozen Accounts tab and the public Landing Page frozen tab will display the correct reason.
