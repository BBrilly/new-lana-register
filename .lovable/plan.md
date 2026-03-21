

## Analysis: Why 3 Kind 87003 events for one transaction

### Root Cause

The blockchain transaction `09467515831a0bb045f6ca1d42f3b92d784df53bfbba9a02d500db0866ffb79f` has **3 separate outputs (vouts)** of 137.5 LANA each, all going to the same address `LcQbGbss7hHaCthvX2pdeJoKfHofcz5T3a`.

The processing chain works like this:

```text
1 blockchain TX with 3 vouts to same address
        │
        ▼
blockchain-monitor creates 3 rows in "transactions" table
(one per vout — correct behavior)
        │
        ▼
trigger "detect_unregistered_lana" fires on each INSERT
        │
        ▼
3 rows in "unregistered_lana_events"
        │
        ▼
kind-cron-87003 publishes 3 separate Kind 87003 Nostr events
+ sends 3 separate DMs to the user
```

Each step is technically doing what it's designed to do. The problem is there's **no deduplication by blockchain TX ID** — the system doesn't know that all 3 records come from the same on-chain transaction.

### Fix Options

**Option A — Aggregate in the trigger (recommended):** Modify the `detect_unregistered_lana` trigger to check if an `unregistered_lana_events` record already exists for the same `wallet_id` + same blockchain TX ID (extracted from notes). If yes, update the existing record's amount instead of inserting a new row.

**Option B — Aggregate in blockchain-monitor:** Before inserting into `transactions`, group all vouts going to the same registered address from the same TX and insert a single aggregated record.

### Proposed Plan — Option A

#### 1. Update the `detect_unregistered_lana` trigger function
- Extract the blockchain TX hash from the notes field (pattern: `blockchain transaction TXHASH from`)
- Before inserting into `unregistered_lana_events`, check if a record already exists for the same `wallet_id` + same TX hash (in notes)
- If found: UPDATE that record's `unregistered_amount` by adding the new amount
- If not found: INSERT as before

This approach preserves the per-vout detail in the `transactions` table (useful for auditing) while consolidating alerts.

#### 2. Clean up the current duplicates
- Delete 2 of the 3 duplicate `unregistered_lana_events` for wallet `d0492a41-...` and update the remaining one to have the correct total (412.5 LANA or 137.5 if only one vout was real)
- This is a one-time data fix

#### 3. No edge function or frontend changes needed
The Kind 87003 cron and the UI already work correctly — they just process whatever is in `unregistered_lana_events`. Fewer rows = fewer events.

### Files to modify
1. **Database migration** — Update the `detect_unregistered_lana` trigger function with TX-level deduplication
2. **Database migration** — Clean up existing duplicate records for this wallet

