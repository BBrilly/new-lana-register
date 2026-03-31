

## Plan: Self-Unfreeze for "Max Cap Exceeded" Frozen Wallets

### Overview
When a user's wallet is frozen with reason `frozen_max_cap`, they see a "Resolve Max Cap" button on their wallet card. Clicking it opens a flow similar to "Send to Register" — the user enters their WIF private key, and **all LANA** from that wallet is sent to a special donation wallet (`max_cap_freeze` wallet stored in `app_settings`). After successful broadcast, the system automatically unfreezes the wallet.

### How it works

```text
User sees frozen wallet (frozen_max_cap)
    → Clicks "Resolve Max Cap Freeze"
    → Navigated to /wallets/resolve-max-cap?wallet=ADDRESS&walletUuid=UUID
    → Enters WIF private key
    → ALL balance sent to special "max_cap_donation_wallet" address
    → Edge function broadcasts TX + unfreezes wallet + publishes KIND 30889
    → User redirected back to wallets (balance = 0, unfrozen)
```

### Changes

#### 1. Database: Add donation wallet address to `app_settings`
- Insert row: `key = 'max_cap_donation_wallet'`, `value = '<WALLET_ADDRESS>'`
- Will ask user for the actual wallet address during implementation

#### 2. `src/components/WalletCard.tsx`
- When `wallet.frozen && wallet.freezeReason === 'frozen_max_cap'`, show a "Resolve Max Cap" button
- Button navigates to `/wallets/resolve-max-cap?wallet=ADDR&walletUuid=UUID`

#### 3. New page: `src/pages/ResolveMaxCap.tsx`
- Similar to `SendToRegister.tsx` but:
  - Fetches destination from `app_settings` key `max_cap_donation_wallet`
  - Sends **entire balance** (not a fixed amount) to donation wallet
  - After successful TX, calls `freeze-wallets` edge function with `freeze: false` to unfreeze
  - Shows clear explanation: "Your wallet exceeded the maximum cap. To unfreeze, donate all LANA to the system wallet."

#### 4. Edge function reuse
- **Transaction**: Reuse `return-lanas-and-send-KIND-87009` (same TX building logic — send full balance to a target address)
- **Unfreeze**: Call `freeze-wallets` with `freeze: false` after successful TX broadcast
- No new edge function needed

#### 5. `src/App.tsx`
- Add route `/wallets/resolve-max-cap` → `ResolveMaxCap`

### Technical details
- The page reads wallet balance via `useWalletBalances` hook
- Sends `balance - fee` to the donation wallet (sweep all funds)
- After TX success, invokes `freeze-wallets` with `{ wallet_ids: [walletUuid], freeze: false, nostr_hex_id: userHexId }` to unfreeze and broadcast updated KIND 30889
- The memo for the KIND 87009 event: `"Max cap exceeded — balance donated to resolve freeze."`

### Files to create/modify
1. **`src/pages/ResolveMaxCap.tsx`** — New page (based on SendToRegister pattern)
2. **`src/components/WalletCard.tsx`** — Add "Resolve Max Cap" button for frozen_max_cap wallets
3. **`src/App.tsx`** — Add new route
4. **`app_settings`** — Insert `max_cap_donation_wallet` address (will ask user for value)

