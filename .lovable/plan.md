

# Plan: Clarify API Docs -- One Endpoint, Two Methods

## Problem
Both tabs show `POST /functions/v1/register-virgin-wallets` independently, making it look like a copy-paste error. There is no explanation that both methods share a single endpoint and are distinguished by the `method` field in the request body.

## Changes in `src/pages/ApiDocs.tsx`

### 1. Add an "Endpoint Overview" info box before the tabs (after the Authentication card, before line 246)
Add a card or info box explaining:
- This is a **single endpoint**: `POST /functions/v1/register-virgin-wallets`
- The `method` field in the request body determines which operation runs
- Two available methods: `check_wallet` and `register_virgin_wallets_for_existing_user`

### 2. Remove duplicate endpoint sections from each tab
Remove the "Endpoint" sub-section (lines 266-274 and 428-436) from both tab contents, since the endpoint is now shown once above the tabs.

### 3. Update tab titles for clarity
- "Check Wallet" -> "Method: check_wallet"
- "Register Virgin Wallets" -> "Method: register_virgin_wallets_for_existing_user"

This makes it immediately clear that these are two methods on one endpoint, not two separate endpoints.

