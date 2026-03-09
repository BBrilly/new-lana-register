

# Completed: Add KIND 30889 broadcast to auto-freeze in blockchain-monitor

## What was done
Updated `blockchain-monitor` to call the existing `freeze-wallets` edge function (via HTTP) instead of directly updating the `wallets` table. This ensures that when a wallet is auto-frozen due to receiving unregistered LANA above the threshold, a KIND 30889 event is also broadcast to Nostr relays.

### Implementation
- Wallets to freeze are collected in a `walletsToAutoFreeze` map during transaction processing
- After all transactions in a block are processed, wallets are grouped by owner (`nostr_hex_id`)
- For each owner group, `freeze-wallets` is called with `freeze_reason: 'frozen_unreg_Lanas'`
- `freeze-wallets` handles both the DB update AND the KIND 30889 broadcast
