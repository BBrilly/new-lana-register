

# Plan: Editable Wallet Notes with Nostr KIND 30889 Broadcast

## Overview
Allow users to edit the "notes" (description) field on every wallet card, including the Main wallet. When saved, the change is persisted to the database and a fresh KIND 30889 event is broadcast to all Nostr relays with the updated wallet list.

## Frontend Changes

### 1. WalletCard Component (`src/components/WalletCard.tsx`)
- Add an "Edit" (pencil) icon button next to the wallet description text
- When clicked, the description text becomes an inline editable input field
- Show "Save" and "Cancel" buttons while editing
- On save, call a new `onUpdateNotes` callback prop with the wallet ID and new note text
- Show loading state during save, toast on success/failure
- On cancel, revert to original text

### 2. Wallets Page (`src/pages/Wallets.tsx`)
- Add a `handleUpdateNotes` function that calls a new edge function `update-wallet-notes`
- Pass `onUpdateNotes` prop to each `WalletCard`
- Trigger `refetch()` after successful update

### 3. Wallet Type (`src/types/wallet.ts`)
- No changes needed -- the existing `description` field maps to `notes` in the DB

## Backend Changes

### 4. New Edge Function: `update-wallet-notes` (`supabase/functions/update-wallet-notes/index.ts`)
This function will:
1. Validate the API key
2. Verify the requesting user owns the wallet (via `nostr_hex_id` -> `main_wallets` -> `wallets`)
3. Update the `notes` column in the `wallets` table
4. Fetch all wallets for this user
5. Read the registrar NSEC from `app_settings`
6. Read relays from `system_parameters`
7. Build and sign a KIND 30889 event with all wallet `w` tags (same format as `delete-wallet`)
8. Broadcast to all relays
9. Return success/failure

The KIND 30889 event structure (matching existing pattern):
- `d` tag: user's nostr hex ID
- `status` tag: "active"
- `w` tags: `[wallet_id, wallet_type, "LANA", note, amount_unregistered_lanoshi]` for each wallet

### 5. Configuration (`supabase/config.toml`)
- Add `[functions.update-wallet-notes]` with `verify_jwt = false`

## Technical Details

- The edge function reuses the same `createSignedEvent` and `broadcastToRelays` helper pattern from `delete-wallet`
- The registrar NSEC is read from `app_settings` (key: `nostr_registrar_nsec`)
- Relays are read from `system_parameters` table
- API key validation uses the same `api_keys` table pattern
- Ownership is verified by checking that the wallet's `main_wallet_id` belongs to a `main_wallets` record matching the provided `nostr_id_hex`

