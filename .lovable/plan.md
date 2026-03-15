

## Plan: New "Max Cap" Tab for Bulk Balance-Based Freezing (One-by-One)

### Overview
A new tab "Max Cap" in the Admin Panel where the admin enters a LANA threshold amount, clicks "Analyze", and gets a list of all **unfrozen** wallets of type `main wallet` and `wallet` whose balance exceeds that threshold. The admin can then freeze them **one by one** (each with a Freeze button per row). Already frozen wallets are excluded from results.

### New Tab in Admin Panel (`src/pages/AdminPanel.tsx`)
- Add a new tab trigger "Max Cap" with an appropriate icon
- Add `TabsContent` rendering a new `MaxCapFreezeManager` component

### New Component: `src/components/MaxCapFreezeManager.tsx`

**UI:**
1. Input field for LANA threshold amount + "Analyze" button
2. On click, shows a loading state while fetching balances
3. Results table with columns: **Owner Name**, **Wallet Address**, **Wallet Type**, **Balance (LANA)**, **Action**
   - Only shows unfrozen wallets of type `main wallet` or `wallet` with balance > threshold
   - Each row has a "Freeze" button
4. Clicking "Freeze" on a row calls the existing `freeze-wallets` edge function for that single wallet with reason `frozen_max_cap`, then removes the row from the list and shows a success toast

**Logic (all frontend, no new edge function needed):**
1. Fetch all wallets where `wallet_type IN ('main wallet', 'wallet') AND frozen = false` (paginated)
2. Join with `main_wallets` to get owner name (`display_name` or `name`)
3. Fetch `electrum` servers from `system_parameters`
4. Fetch balances via `fetch-wallet-balance` in batches of 50
5. Filter wallets where `balance > threshold`
6. Display results sorted by balance descending
7. Per-row freeze: call existing `freeze-wallets` edge function with `wallet_ids: [id]`, `freeze: true`, `freeze_reason: 'frozen_max_cap'`, `nostr_hex_id` from the joined main_wallet

### No new edge function needed
The existing `freeze-wallets` function already handles single wallet freezing + KIND 30889 broadcast. We just call it once per wallet when the admin clicks "Freeze" on that row.

### Files to modify
1. **`src/pages/AdminPanel.tsx`** — Add "Max Cap" tab
2. **`src/components/MaxCapFreezeManager.tsx`** — New component (analysis + one-by-one freeze)

