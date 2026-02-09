

# Fix: delete-wallet broadcasts to wrong relays

## Problem

The `delete-wallet` edge function reads relays from the database but parses them incorrectly compared to `register-virgin-wallets`.

**Database stores:** a flat array: `["wss://relay.lanavault.space", "wss://relay.lanacoin-eternity.com", ...]`

**register-virgin-wallets (works):**
```
const relays = (systemParams.relays as any[]).map((r: any) => r.url || r);
```
Correctly gets the 5 LANA relays.

**delete-wallet (broken):**
```
const relays = (systemParams?.relays as any)?.relays || [fallbacks];
```
Tries to access `.relays` inside the already-flat array, gets `undefined`, falls back to `relay.damus.io`, `nos.lol`, `relay.nostr.band` -- generic relays that have nothing to do with LANA. The event IS published there (logs show 2/3 accepted) but nobody checks those relays for KIND 30889.

## Fix

One-line change in `supabase/functions/delete-wallet/index.ts` line 180:

Replace:
```
const relays = (systemParams?.relays as any)?.relays || [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
];
```

With:
```
const relays = (systemParams?.relays as any[])?.map((r: any) => r.url || r) || [
  "wss://relay.lanavault.space",
  "wss://relay.lanacoin-eternity.com",
  "wss://relay.lanaheartvoice.com",
  "wss://relay.lovelana.org",
  "wss://relay.damus.io",
];
```

This matches the exact pattern used in `register-virgin-wallets` and sends the KIND 30889 event to the correct LANA relays.

