

# Plan: New "check" Edge Function + API Documentation

## 1. Create edge function `supabase/functions/check/index.ts`

A lightweight endpoint that accepts a single method `simple_check_wallet_registration`. It will:

- Validate the request body contains `method`, `api_key`, and `data.wallet_id`
- Authenticate the API key against the `api_keys` table (same pattern as `register-virgin-wallets`)
- Query the `wallets` table for a matching `wallet_id`
- Return a response indicating whether the wallet is registered, including basic wallet info (wallet_type, main_wallet_id, created_at) if found
- No writes, no Nostr broadcasts -- purely read-only

Response examples:
- **Found**: `{ success: true, registered: true, wallet: { wallet_id, wallet_type, main_wallet_id, created_at } }`
- **Not found**: `{ success: true, registered: false, wallet_id: "..." }`
- **Errors**: 400 (bad request), 401 (invalid API key), 429 (rate limit)

## 2. Update `supabase/config.toml`

Add the new function config:
```toml
[functions.check]
verify_jwt = false
```

## 3. Update `src/pages/ApiDocs.tsx`

- Add a new section below the existing "register-virgin-wallets" documentation for the **second endpoint**: `POST /functions/v1/check`
- Include an endpoint overview card (similar style), request/response examples, error codes table, and a cURL example
- Add code example constants for request body and response samples
- Update the "API Response Times" section in the reference to include `simple_check_wallet_registration: ~200-500ms`

