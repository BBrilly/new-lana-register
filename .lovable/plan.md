

# Plan: Mark Deleted Wallets in Outgoing TX Tab

## What
Cross-reference the "To" addresses in the Outgoing TX list with the `deleted_wallets` table. If a destination address was previously registered but has since been deleted, show a visual badge/indicator next to it.

## Changes in `src/pages/LandingPage.tsx`

### 1. Fetch deleted wallets during outgoing TX loading
After fetching transactions and sender wallets, also query `deleted_wallets` for all `wallet_id` values. Build a Set of deleted wallet addresses for fast lookup.

```typescript
const { data: deletedWallets } = await supabase
  .from('deleted_wallets')
  .select('wallet_id');

const deletedAddressSet = new Set(
  deletedWallets?.map(dw => dw.wallet_id).filter(Boolean) || []
);
```

### 2. Add `is_deleted` flag to formatted data
In the `formatted` mapping, check if `toAddress` exists in the `deletedAddressSet`:

```typescript
return {
  ...tx,
  from_name: ...,
  from_address: ...,
  to_address: toAddress,
  to_was_registered_then_deleted: deletedAddressSet.has(toAddress),
};
```

### 3. Show badge in the "To" column
When `tx.to_was_registered_then_deleted` is true, render a small destructive `Badge` (e.g., "Deleted") next to the address, making it visually distinct with a red/orange color.

