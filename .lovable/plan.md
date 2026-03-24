

## Plan: Exclude Knights Wallets from Auto-Freeze

### Problem
The `blockchain-monitor` edge function correctly skips Knights wallets for `unregistered_lana_events` (the DB trigger handles that), but the **auto-freeze logic on line 337** does NOT check `wallet_type` — it freezes ANY wallet receiving unregistered LANA above the threshold, including Knights wallets.

### Root Cause
Lines 336-348 in `supabase/functions/blockchain-monitor/index.ts`: after the Knights-specific handling (lines 322-334), the auto-freeze block runs unconditionally for all wallet types.

### Fix

#### 1. `supabase/functions/blockchain-monitor/index.ts` (line ~337)
Add a check to skip Knights wallets before queuing for auto-freeze:

```typescript
// Auto-freeze: if unregistered LANA amount exceeds threshold
// Skip Knights wallets — they are exempt from freezing
if (autoFreezeThreshold !== null && receiver.amount >= autoFreezeThreshold && receiverWallet?.wallet_type !== 'Knights') {
```

This single condition addition prevents Knights wallets from ever being queued for auto-freeze.

#### 2. Unfreeze the two incorrectly frozen Knights wallets
- Query the database for wallets with `wallet_type = 'Knights' AND frozen = true`
- Unfreeze them via the `freeze-wallets` edge function (which also broadcasts the corrected KIND 30889)

#### 3. Deploy updated edge function

### Files to modify
1. **`supabase/functions/blockchain-monitor/index.ts`** — Add Knights exclusion to auto-freeze condition (1 line change)
2. **Data fix** — Unfreeze any Knights wallets that were incorrectly frozen

