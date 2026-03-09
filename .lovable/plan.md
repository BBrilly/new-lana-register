

## Plan: Add `nostr_hex_id` to `simple_check_wallet_registration` response

### Summary
Add the owner's `nostr_hex_id` to the successful response when a wallet is found. Look it up via `main_wallet_id` → `main_wallets.nostr_hex_id`. Update API docs to match.

### Changes

#### 1. Update `supabase/functions/check/index.ts`
- After finding the wallet, query `main_wallets` using `wallet.main_wallet_id` to get `nostr_hex_id`
- Add `nostr_hex_id` to the response `wallet` object
- If `main_wallets` lookup fails, return `nostr_hex_id: null` (don't break the response)

#### 2. Update `src/pages/ApiDocs.tsx`
- Update `simpleCheckFound` example (line 162-173) to include `"nostr_hex_id": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d"`
- Add `nostr_hex_id` description bullet in the Description section (line 627-644): "Returns the owner's `nostr_hex_id` for registered wallets"

#### 3. Deploy edge function

