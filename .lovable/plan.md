

# Plan: New "Outgoing TX" Tab on Landing Page

## What
Add a new tab on the landing page showing transactions sent **from registered wallets to unregistered wallets** -- i.e., rows in the `transactions` table where `from_wallet_id IS NOT NULL` and `to_wallet_id IS NULL`.

## Data Source
Query `transactions` table filtered by:
- `from_wallet_id` is not null (registered sender)
- `to_wallet_id` is null (unregistered receiver)

Join with `wallets` and `main_wallets` to get the sender's name/display_name and wallet_id address. The destination address is extracted from the `notes` field (pattern: `"to ADDRESS"`).

## Changes

### `src/pages/LandingPage.tsx`

1. **Add state** for outgoing transactions list + loading flag
2. **Add data fetching** in existing `useEffect` block:
   - Query `transactions` with `from_wallet_id.not.is.null` and `to_wallet_id.is.null`
   - Select `id, amount, block_id, notes, created_at, from_wallet_id`
   - Order by `created_at desc`
   - Then fetch sender wallet details (wallet_id, main_wallet name/display_name) for the `from_wallet_id` values
3. **Add new TabsTrigger**: "Outgoing TX ({count})" with `ArrowUp` icon
4. **Add new TabsContent** with a table showing:
   - `#` (index)
   - **From** (owner name + truncated wallet address)
   - **To** (unregistered address extracted from notes)
   - **Amount** (formatted LANA)
   - **Block** (block_id)
   - **Date** (relative time using `formatDistanceToNow`)

The destination address will be parsed from the `notes` field using a regex like `to (L[A-Za-z0-9]+)` or displayed as the full notes if parsing fails.

