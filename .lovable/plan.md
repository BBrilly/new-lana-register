

## Plan: Add KIND 30889 broadcast to auto-freeze in blockchain-monitor

### Problem
When `blockchain-monitor` auto-freezes a wallet (lines 335-346), it only updates the database (`wallets.frozen = true`). It does NOT broadcast an updated KIND 30889 event to Nostr relays. The `freeze-wallets` edge function does both — but `blockchain-monitor` skips the Nostr broadcast entirely.

### Solution
After a successful auto-freeze in `blockchain-monitor`, call the existing `freeze-wallets` edge function internally (via `supabase.functions.invoke`) to handle both the DB update and the KIND 30889 broadcast. This avoids duplicating the Nostr broadcast logic.

### Changes

#### 1. Update `supabase/functions/blockchain-monitor/index.ts`
- Remove the direct `wallets.update({ frozen: true })` call at lines 336-339
- Replace it with a call to `freeze-wallets` edge function via HTTP fetch (since we're in an edge function context, use the Supabase URL + service role key)
- The call needs: `wallet_ids` (array of wallet UUIDs), `freeze: true`, `freeze_reason: 'frozen_unreg_Lanas'`, and `nostr_hex_id` (the owner's hex pubkey)
- To get `nostr_hex_id`, look up the wallet's `main_wallet_id` → `main_wallets.nostr_hex_id`
- Collect all wallets to freeze during block processing, then batch-call `freeze-wallets` after processing each block (to avoid calling it per-transaction)

#### 2. Implementation detail
- After the receiver wallet is identified for auto-freeze, store it in a `walletsToAutoFreeze` map: `{ walletId, walletUuid, receiverAmount }`
- After all transactions in a block are processed, for each wallet to freeze:
  1. Query `main_wallets.nostr_hex_id` via the wallet's `main_wallet_id`
  2. Call `freeze-wallets` with the wallet UUID, `freeze: true`, `freeze_reason: 'frozen_unreg_Lanas'`, and the `nostr_hex_id`
- This reuses all existing KIND 30889 broadcast logic from `freeze-wallets`

