

# Fix: Filter out registered wallets from Outgoing TX tab

## Problem
The Outgoing TX tab shows transactions where `to_wallet_id IS NULL`, assuming the recipient is unregistered. But some destinations ARE registered — the `to_wallet_id` just wasn't linked at transaction recording time. Example: `LZAHDoeKaJ1uTwXZ3bL8dfbJXT7Af9a8sW` is in `wallets` table but appears in Outgoing TX because its transaction record has `to_wallet_id = NULL`.

## Fix in `src/pages/LandingPage.tsx`

After fetching transactions and parsing `toAddress` from notes, cross-reference all parsed destination addresses against the `wallets` table. Filter out any transaction where the destination address is actually registered.

### Steps:
1. Collect all parsed `toAddress` values from the transactions
2. Query `wallets` table to check which of these addresses are registered: `SELECT wallet_id FROM wallets WHERE wallet_id IN (...parsedAddresses)`
3. Build a `registeredAddressSet` from the results
4. Filter out transactions where `registeredAddressSet.has(toAddress)` before setting state
5. Keep the existing `deletedAddressSet` logic — deleted wallets should still show (with badge) since they are no longer active

This ensures only truly unregistered destinations appear in the Outgoing TX tab.

