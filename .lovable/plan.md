

# Plan: Add "Lana.Discount" Tab to Landing Page

Add a new tab following the exact same pattern as the LanaPays.Us tab.

## Changes in `src/pages/LandingPage.tsx`

### 1. Include "Lana.Discount" in wallet type filter (line 279)
Add `'Lana.Discount'` to the `.in('wallet_type', [...])` array so these wallets are fetched from the database.

### 2. Add filtered/sorted wallet lists (around lines 475-509)
- Add `lanaDiscountWallets` memo filtering by `wallet_type === 'Lana.Discount'`
- Add `lanaDiscountTotalBalance` memo
- Add `sortedLanaDiscountWallets` memo using the existing `sortWallets` function

### 3. Add TabsTrigger (after LanaPays trigger, line ~813)
New tab trigger: `Lana.Discount ({lanaDiscountWallets.length})`

### 4. Add TabsContent (after LanaPays content, after line ~1561)
Copy the LanaPays.Us `TabsContent` block and adapt it for Lana.Discount wallets -- same table structure with #, Name, Wallet ID, Balance columns.

