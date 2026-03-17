

## Plan: New `register_lanapays_wallet` Method on Endpoint 1

### Overview
Add a new method `register_lanapays_wallet` to the `register-virgin-wallets` edge function. It registers a virgin wallet specifically as type `LanaPays.us`, requiring `wallet_id`, `nostr_id_hex`, and `split` parameter (`"current"` or `"next"`).

### Split Logic
- `"current"` → uses the current split value from KIND 38888 system parameters (as-is)
- `"next"` → uses current split + 1 (e.g., if current is 4, writes 5)

### Edge Function Changes (`supabase/functions/register-virgin-wallets/index.ts`)

**New handler function `handleRegisterLanaPaysWallet`:**
1. Validate inputs: `wallet_id` (LANA address format), `nostr_id_hex` (64-char hex), `split` (must be `"current"` or `"next"`)
2. Check if wallet already exists in `wallets` table → reject if duplicate
3. Look up profile by `nostr_id_hex` in `main_wallets` → create new profile if not found (same as `check_wallet` behavior)
4. Get system parameters for electrum servers, relays, and current split
5. Check wallet balance via Electrum → must be virgin (balance = 0)
6. Calculate `split_created`: if `split === "next"` then `currentSplit + 1`, else `currentSplit`
7. Insert wallet with `wallet_type: "LanaPays.us"`, `registration_source: "api_lanapays"`, computed `split_created`
8. Broadcast Nostr events: KIND 87006 (virgin confirmation), KIND 87002 (registration), KIND 30889 (wallet list update)

**Main handler routing (line ~1046):**
- Add `else if (method === "register_lanapays_wallet")` routing
- Update error message to include `register_lanapays_wallet` in supported methods list

### API Docs Changes (`src/pages/ApiDocs.tsx`)
- Add request/response examples for the new method
- Add a new section/card documenting the method under Endpoint 1 tab
- Include cURL example

### Request/Response Format

```json
// Request
{
  "method": "register_lanapays_wallet",
  "api_key": "YOUR_API_KEY",
  "data": {
    "wallet_id": "LWalletAddress123456789012345678",
    "nostr_id_hex": "64-char-hex",
    "split": "current"  // or "next"
  }
}

// Success Response
{
  "success": true,
  "wallet_id": "LWalletAddress...",
  "status": "ok",
  "message": "LanaPays.us wallet registered successfully",
  "data": {
    "profileId": "uuid",
    "split_created": 4
  },
  "correlation_id": "uuid"
}
```

### Files to modify
1. **`supabase/functions/register-virgin-wallets/index.ts`** — Add `handleRegisterLanaPaysWallet` handler + routing
2. **`src/pages/ApiDocs.tsx`** — Add documentation for the new method
3. **Deploy & test** the edge function

