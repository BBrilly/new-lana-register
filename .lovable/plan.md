

## Plan: Mark frozen wallets visually and prevent deletion

### Problem
Frozen wallets on the Wallets page look identical to normal wallets. Users need a clear visual indicator (snowflake icon + light blue background) and frozen wallets should not be deletable.

### Changes

#### 1. Update `src/types/wallet.ts`
- Add `frozen?: boolean` and `freezeReason?: string` to the `Wallet` interface.

#### 2. Update `src/hooks/useUserWallets.ts`
- Pass `frozen` and `freeze_reason` from the database query result into the mapped `Wallet` objects.

#### 3. Update `src/components/WalletCard.tsx`
- Import `Snowflake` icon from lucide-react.
- If `wallet.frozen` is true:
  - Apply light blue border and background to the Card (`border-blue-400/50 bg-blue-50/30 dark:bg-blue-950/20`).
  - Show a `Snowflake` icon + "Frozen" badge in the header area.
  - Display the freeze reason if available.
- Update `canDelete` logic: also return `false` when `wallet.frozen === true`.
- Hide the delete button entirely for frozen wallets.

