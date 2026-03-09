

## Plan: Check if source wallet senders are frozen before allowing registration

### Problem
Currently, the "Registered Lanas" registration checks:
1. Whether the user's own profile has frozen wallets (already implemented)
2. Whether all senders are registered wallets (already implemented via `validate-wallet-senders`)

But it does NOT check if those registered sender wallets are **frozen**. This allows money laundering: someone receives LANA from a frozen wallet, forwards it to a new address, and registers it — bypassing the freeze.

### Solution

**Two changes needed:**

#### 1. Update `validate-wallet-senders` edge function
- In `checkSendersRegistration()`, after finding which senders are registered, also check if any of those registered senders have `frozen = true` in the `wallets` table.
- Return a new field `frozenSenders` (array of frozen sender addresses) and `hasFrozenSenders` (boolean) in the response.

#### 2. Update `src/pages/AddWallet.tsx` (frontend)
- After receiving the sender validation response, check the new `hasFrozenSenders` field.
- If true, block registration and show an error message like: "Registration blocked: funds originate from frozen wallet(s)."
- Treat this the same as unregistered senders — disable the Register button.

### Technical Details

**`validate-wallet-senders/index.ts` — `checkSendersRegistration` function (~line 412-480):**
- When querying registered senders from the `wallets` table, also select `frozen` field: `.select('wallet_id, frozen')`
- Collect frozen senders into a separate array
- Add `frozenSenders` and `hasFrozenSenders` to the return type and response

**`src/pages/AddWallet.tsx` (~line 273-285):**
- Check `senderData.hasFrozenSenders` alongside `senderData.allRegistered`
- If frozen senders exist, set a validation error and block submission

