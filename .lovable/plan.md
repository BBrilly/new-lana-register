

# NIP-04 Encrypted DM Notification for Unregistered LANA

## Overview

When the existing KIND 87003 cron function detects unregistered LANA coins on a user's wallet, it will also send a **NIP-04 encrypted direct message (Kind 4)** to the wallet owner's Nostr pubkey. This gives the user a personal, private notification in their Nostr chat client.

## What changes

### 1. Database migration -- new tracking columns

Add two columns to `unregistered_lana_events` to track DM delivery separately from the KIND 87003 event:

- `nostr_dm_sent` (boolean, default false) -- whether the NIP-04 DM was sent
- `nostr_dm_event_id` (text, nullable) -- the Nostr event ID of the sent DM

### 2. Edge function changes (`kind-cron-87003-monitoring-unregistered-coins/index.ts`)

**New import:** `nip04` from `nostr-tools` for NIP-04 encryption.

**New function:** `sendEncryptedDM(privateKeyBytes, recipientPubkey, message, relays)` that:
1. Encrypts the message using `nip04.encrypt(privateKeyHex, recipientPubkey, message)`
2. Creates a Kind 4 event with tag `["p", recipientPubkey]`
3. Signs and publishes it to the same relays

**Integration point:** After each successful KIND 87003 publish (line ~335), send the DM to the same `userPubkey`. Update the DB with `nostr_dm_sent = true` and `nostr_dm_event_id`.

### 3. DM message content (English)

```
LANA Unregistered Coins Alert

Your wallet [WALLET_ADDRESS] has received [AMOUNT] LANA from an unregistered source.

These coins need to be regularized through the LANA Registrar. To resolve this:

1. Open the LanaKnight app or visit the Registrar
2. Send the unregistered amount ([AMOUNT] LANA) to the designated return address provided by the Registrar
3. The Registrar will process your return and re-issue registered coins

Video tutorial: https://youtu.be/NulmUXSZ4cE

Please regularize these coins as soon as possible to maintain your wallet's compliance status.
```

## Technical details

### NIP-04 encryption with nostr-tools

```typescript
import { nip04 } from 'https://esm.sh/nostr-tools@2.7.0';

// Encrypt
const ciphertext = await nip04.encrypt(privateKeyHex, recipientPubkeyHex, plaintext);

// Create Kind 4 event
const dmEvent = {
  kind: 4,
  created_at: Math.floor(Date.now() / 1000),
  tags: [['p', recipientPubkeyHex]],
  content: ciphertext,
};

const signedDm = finalizeEvent(dmEvent, privateKeyBytes);
```

### Processing flow

```text
For each unregistered event:
  1. Publish KIND 87003 (existing logic)
  2. If 87003 succeeded AND nostr_dm_sent = false:
     a. Encrypt DM with NIP-04
     b. Publish Kind 4 to relays
     c. Update DB: nostr_dm_sent = true, nostr_dm_event_id = eventId
  3. DM failure does NOT block 87003 success (independent tracking)
```

### Error handling

- DM sending is wrapped in its own try/catch -- a failed DM will not affect the KIND 87003 flow
- DM status is tracked independently, so on next cron run, events with `nostr_87003_published = true` but `nostr_dm_sent = false` can be retried (optional future enhancement)

### Files modified

| File | Change |
|------|--------|
| `supabase/functions/kind-cron-87003-monitoring-unregistered-coins/index.ts` | Add NIP-04 import, `sendEncryptedDM` function, call it after each KIND 87003 publish |
| Database migration | Add `nostr_dm_sent` and `nostr_dm_event_id` columns to `unregistered_lana_events` |

